import pytest
from fastapi.testclient import TestClient

from backend.app import main
from backend.app import outbox


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "phase2.db")
    monkeypatch.setattr(main, "FILE_PATH", tmp_path / "uploads")
    main.initialize()
    main.create_staff("admin@example.test", "long-secret-password", "admin")
    main.create_staff("sales@example.test", "long-secret-password", "sales")
    main.create_staff("procurement@example.test", "long-secret-password", "procurement")
    with TestClient(main.app) as test_client:
        yield test_client


def staff_login(client, email="sales@example.test"):
    response = client.post("/api/auth/login", json={"email": email, "password": "long-secret-password"})
    assert response.status_code == 200, response.text
    return response.json()["csrf_token"]


def buy_inquiry(client, company, email, key):
    response = client.post("/api/inquiries", headers={"Idempotency-Key": key}, json={
        "kind": "buy", "company_name": company, "contact_name": "Buyer Contact",
        "email": email, "product_text": "Industrial oil grade", "quantity": "2.5",
        "unit": "MT", "destination_country": "UAE", "privacy_accepted": True,
    })
    assert response.status_code == 201, response.text
    with main.database() as db:
        row = db.execute("SELECT id, company_id, contact_id FROM inquiries WHERE reference = ?",
                         (response.json()["reference"],)).fetchone()
    return dict(row)


def quote_body(inquiry_id=None, price="123.45"):
    body = {
        "items": [{"description": "Industrial oil grade", "quantity": "2.5", "unit": "MT", "unit_price": price}],
        "currency": "USD", "incoterm": "FOB", "named_place": "Jebel Ali",
        "payment_terms": "Terms subject to confirmation", "delivery_terms": "To be agreed",
        "validity_date": "2099-12-31", "notes": "Customer requested batch documents",
    }
    if inquiry_id:
        body["inquiry_id"] = inquiry_id
    return body


def create_quote(client, inquiry_id):
    csrf = staff_login(client)
    response = client.post("/api/admin/quotes", headers={"X-CSRF-Token": csrf}, json=quote_body(inquiry_id))
    assert response.status_code == 201, response.text
    return response.json(), csrf


def approve_and_invite(client, company_id, contact_id, role="customer"):
    csrf = staff_login(client, "admin@example.test")
    response = client.post(f"/api/admin/companies/{company_id}/verification",
                           headers={"X-CSRF-Token": csrf},
                           json={"status": "approved", "reason": "Reviewed company registration"})
    assert response.status_code == 200, response.text
    invite = client.post("/api/admin/portal-invites", headers={"X-CSRF-Token": csrf},
                         json={"company_id": company_id, "contact_id": contact_id, "role": role})
    assert invite.status_code == 201, invite.text
    activated = client.post("/api/portal/activate", json={"token": invite.json()["token"],
                                                        "password": "customer-long-password"})
    assert activated.status_code == 200, activated.text
    return invite.json()["email"]


def test_quote_revision_total_pdf_and_proforma(client):
    inquiry = buy_inquiry(client, "Buyer A", "buyer-a@example.test", "quote-buy-a")
    quote, csrf = create_quote(client, inquiry["id"])
    quote_id = quote["id"]
    assert quote["total"] == "308.63"
    issued = client.post(f"/api/admin/quotes/{quote_id}/issue", headers={"X-CSRF-Token": csrf})
    assert issued.status_code == 200, issued.text
    queued = client.post(f"/api/admin/quotes/{quote_id}/send", headers={"X-CSRF-Token": csrf})
    assert queued.status_code == 200 and queued.json()["delivery_status"] == "queued"
    assert client.put(f"/api/admin/quotes/{quote_id}/draft", headers={"X-CSRF-Token": csrf},
                      json=quote_body(price="999.00")).status_code == 409
    revised = client.post(f"/api/admin/quotes/{quote_id}/revisions", headers={"X-CSRF-Token": csrf},
                          json=quote_body(price="200.00"))
    assert revised.status_code == 201, revised.text
    detail = client.get(f"/api/admin/quotes/{quote_id}").json()
    assert detail["revisions"][0]["items"][0]["unit_price"] == "123.45"
    assert detail["revisions"][0]["total"] == "308.63"
    assert detail["revisions"][1]["total"] == "500.00"
    with main.database() as db:
        assert db.execute("SELECT status FROM outbox WHERE quote_revision_id = ?",
                          (detail["revisions"][0]["id"],)).fetchone()[0] == "queued"
    assert client.post(f"/api/admin/quotes/{quote_id}/proforma", headers={"X-CSRF-Token": csrf}).status_code == 409
    assert client.post(f"/api/admin/quotes/{quote_id}/issue", headers={"X-CSRF-Token": csrf}).status_code == 200
    pdf = client.get(f"/api/admin/quotes/{quote_id}/revisions/1/pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF-")
    accepted = client.post(f"/api/admin/quotes/{quote_id}/accept", headers={"X-CSRF-Token": csrf},
                           json={"reason": "Written acceptance received from authorized buyer", "version": 2})
    assert accepted.status_code == 200, accepted.text
    proforma = client.post(f"/api/admin/quotes/{quote_id}/proforma", headers={"X-CSRF-Token": csrf})
    assert proforma.status_code == 201, proforma.text
    pi_pdf = client.get(f"/api/admin/proformas/{proforma.json()['id']}/pdf")
    assert pi_pdf.status_code == 200 and pi_pdf.content.startswith(b"%PDF-")


def test_draft_can_be_edited_without_destroying_audit_history(client):
    inquiry = buy_inquiry(client, "Buyer Draft", "buyer-draft@example.test", "draft-buy")
    quote, csrf = create_quote(client, inquiry["id"])
    updated = client.put(f"/api/admin/quotes/{quote['id']}/draft",
                         headers={"X-CSRF-Token": csrf}, json=quote_body(price="200.00"))
    assert updated.status_code == 200, updated.text
    detail = client.get(f"/api/admin/quotes/{quote['id']}").json()
    assert len(detail["revisions"]) == 1
    assert detail["revisions"][0]["id"] == quote["revision_id"]
    assert detail["revisions"][0]["total"] == "500.00"
    assert [event["action"] for event in detail["events"]] == ["quote_created", "draft_updated"]


def test_portal_requires_verification_and_is_company_scoped(client):
    buyer_a = buy_inquiry(client, "Buyer A", "buyer-a@example.test", "portal-buy-a")
    buyer_b = buy_inquiry(client, "Buyer B", "buyer-b@example.test", "portal-buy-b")
    quote_a, csrf = create_quote(client, buyer_a["id"])
    quote_b, csrf = create_quote(client, buyer_b["id"])
    client.post(f"/api/admin/quotes/{quote_a['id']}/issue", headers={"X-CSRF-Token": csrf})
    client.post(f"/api/admin/quotes/{quote_b['id']}/issue", headers={"X-CSRF-Token": csrf})
    admin_csrf = staff_login(client, "admin@example.test")
    blocked = client.post("/api/admin/portal-invites", headers={"X-CSRF-Token": admin_csrf},
                          json={"company_id": buyer_a["company_id"], "contact_id": buyer_a["contact_id"],
                                "role": "customer"})
    assert blocked.status_code == 409
    email = approve_and_invite(client, buyer_a["company_id"], buyer_a["contact_id"])
    login = client.post("/api/portal/login", json={"email": email, "password": "customer-long-password"})
    assert login.status_code == 200, login.text
    portal_csrf = login.json()["csrf_token"]
    requests = client.get("/api/portal/inquiries").json()
    assert len(requests) == 1
    public_payload = {
        "kind": "buy", "company_name": "Buyer A", "contact_name": "Buyer Contact",
        "email": "buyer-a@example.test", "product_text": "Another product",
        "quantity": 1, "unit": "MT", "destination_country": "UAE", "privacy_accepted": True,
    }
    with TestClient(main.app) as anonymous:
        assert anonymous.post("/api/inquiries", headers={"Idempotency-Key": "anonymous-spoof"},
                              json=public_payload).status_code == 201
    assert len(client.get("/api/portal/inquiries").json()) == 1
    assert client.post("/api/inquiries", headers={"Idempotency-Key": "missing-portal-csrf"}, json=public_payload).status_code == 403
    assert client.post("/api/inquiries", headers={"Idempotency-Key": "verified-new-inquiry", "X-CSRF-Token": portal_csrf},
                       json=public_payload).status_code == 201
    assert len(client.get("/api/portal/inquiries").json()) == 2
    with TestClient(main.app) as anonymous:
        assert anonymous.post("/api/inquiries", headers={"Idempotency-Key": "verified-new-inquiry"}, json=public_payload).status_code == 403
    sent = client.post(f"/api/portal/inquiries/{requests[0]['reference']}/messages",
                       headers={"X-CSRF-Token": portal_csrf}, json={"body": "Please confirm packing"})
    assert sent.status_code == 201, sent.text
    assert client.get(f"/api/portal/inquiries/{requests[0]['reference']}/messages").json()[0]["body"] == "Please confirm packing"
    with main.database() as db:
        other_reference = db.execute("SELECT reference FROM inquiries WHERE id = ?", (buyer_b["id"],)).fetchone()[0]
    assert client.get(f"/api/portal/inquiries/{other_reference}/messages").status_code == 404
    quotes = client.get("/api/portal/quotes").json()
    assert len(quotes) == 1 and quotes[0]["id"] == quote_a["id"]
    assert client.get(f"/api/portal/quotes/{quote_b['id']}").status_code == 404
    assert client.get(f"/api/portal/quotes/{quote_b['id']}/pdf").status_code == 404
    assert client.get(f"/api/portal/quotes/{quote_a['id']}/pdf").content.startswith(b"%PDF-")
    assert client.post(f"/api/portal/quotes/{quote_b['id']}/accept",
                       headers={"X-CSRF-Token": portal_csrf}, json={"version": 1}).status_code == 404
    assert client.post(f"/api/portal/quotes/{quote_a['id']}/accept").status_code == 403
    accepted = client.post(f"/api/portal/quotes/{quote_a['id']}/accept",
                           headers={"X-CSRF-Token": portal_csrf}, json={"version": 1})
    assert accepted.status_code == 200, accepted.text
    with main.database() as db:
        event = db.execute("SELECT actor_type FROM commercial_events WHERE quote_id = ? AND action = 'quote_accepted'",
                           (quote_a["id"],)).fetchone()
    assert event["actor_type"] == "portal"


def test_quote_email_has_pdf_and_updates_delivery_state(client, monkeypatch):
    inquiry = buy_inquiry(client, "Buyer A", "buyer-a@example.test", "email-buy-a")
    quote, csrf = create_quote(client, inquiry["id"])
    assert client.post(f"/api/admin/quotes/{quote['id']}/issue", headers={"X-CSRF-Token": csrf}).status_code == 200
    queued = client.post(f"/api/admin/quotes/{quote['id']}/send", headers={"X-CSRF-Token": csrf})
    assert queued.json()["delivery_status"] == "queued"
    for name in ("OIL_SMTP_HOST", "OIL_SMTP_USER", "OIL_SMTP_PASSWORD", "OIL_MAIL_FROM",
                 "OIL_SALES_EMAIL", "OIL_PROCUREMENT_EMAIL"):
        monkeypatch.setenv(name, "configured@example.test")
    messages = []
    monkeypatch.setattr(outbox, "send", messages.append)
    result = outbox.process_once()
    assert result["sent"] == 3 and result["failed"] == 0
    quote_mail = [message for message in messages if message["Subject"].startswith("Quotation")][0]
    assert quote_mail["To"] == "buyer-a@example.test"
    attachment = list(quote_mail.iter_attachments())[0]
    assert attachment.get_payload(decode=True).startswith(b"%PDF-")
    detail = client.get(f"/api/admin/quotes/{quote['id']}").json()
    assert detail["status"] == "sent"
    assert detail["email_delivery"]["status"] == "sent"


def test_supplier_portal_cannot_see_customer_quotes(client):
    offer = client.post("/api/inquiries", headers={"Idempotency-Key": "supplier-portal"}, json={
        "kind": "sell", "company_name": "Supplier A", "contact_name": "Supplier Contact",
        "email": "supplier-a@example.test", "product_text": "Base oil", "quantity": 20,
        "unit": "MT", "privacy_accepted": True,
    })
    assert offer.status_code == 201
    with main.database() as db:
        row = db.execute("SELECT company_id, contact_id FROM inquiries WHERE reference = ?",
                         (offer.json()["reference"],)).fetchone()
    email = approve_and_invite(client, row["company_id"], row["contact_id"], "supplier")
    login = client.post("/api/portal/login", json={"email": email, "password": "customer-long-password"})
    assert login.status_code == 200
    assert len(client.get("/api/portal/inquiries").json()) == 1
    assert client.get("/api/portal/quotes").status_code == 403


def test_private_portal_drafts_resume_expire_and_submit_once(client):
    buyer_a = buy_inquiry(client, "Draft A", "draft-a@example.test", "draft-company-a")
    buyer_b = buy_inquiry(client, "Draft B", "draft-b@example.test", "draft-company-b")
    email_a = approve_and_invite(client, buyer_a["company_id"], buyer_a["contact_id"])
    email_b = approve_and_invite(client, buyer_b["company_id"], buyer_b["contact_id"])
    login = client.post("/api/portal/login", json={"email": email_a, "password": "customer-long-password"})
    headers = {"X-CSRF-Token": login.json()["csrf_token"]}
    assert client.put("/api/portal/draft", json={"product_text": "Partial product"}).status_code == 403
    saved = client.put("/api/portal/draft", headers=headers, json={"product_text": "Partial product"})
    assert saved.status_code == 200, saved.text
    assert saved.json()["expires_at"]
    assert client.get("/api/portal/draft").json()["payload"]["product_text"] == "Partial product"
    assert client.post("/api/portal/draft/submit", headers=headers,
                       json={"privacy_accepted": True, "updated_at": saved.json()["updated_at"]}).status_code == 422
    complete = {"product_text": "Private draft product", "quantity": "4.5", "unit": "MT",
                "destination_country": "UAE", "message": "Please confirm availability"}
    complete_saved = client.put("/api/portal/draft", headers=headers, json=complete)
    assert complete_saved.status_code == 200
    assert client.post("/api/portal/draft/submit", headers=headers,
                       json={"privacy_accepted": True, "updated_at": saved.json()["updated_at"]}).status_code == 409
    submit_body = {"privacy_accepted": True, "updated_at": complete_saved.json()["updated_at"]}
    submitted = client.post("/api/portal/draft/submit", headers=headers, json=submit_body)
    assert submitted.status_code == 201, submitted.text
    ref = submitted.json()["reference"]
    assert client.post("/api/portal/draft/submit", headers=headers,
                       json=submit_body).json()["reference"] == ref
    # Saving unchanged terms also preserves retry identity after a browser reload.
    assert client.put("/api/portal/draft", headers=headers, json=complete).json()["submitted_reference"] == ref
    with main.database() as db:
        assert db.execute("SELECT count(*) FROM inquiries WHERE company_id = ?", (buyer_a["company_id"],)).fetchone()[0] == 2
    login_b = client.post("/api/portal/login", json={"email": email_b, "password": "customer-long-password"})
    assert client.get("/api/portal/draft").json()["payload"]["product_text"] == ""
    headers_b = {"X-CSRF-Token": login_b.json()["csrf_token"]}
    assert client.post("/api/portal/draft/submit", headers=headers_b, json={"privacy_accepted": True, "updated_at": "missing"}).status_code == 409
    assert client.put("/api/portal/draft", headers=headers_b, json={"product_text": "Expired private draft"}).status_code == 200
    with main.database() as db:
        db.execute("UPDATE portal_drafts SET expires_at = '2000-01-01' WHERE user_id = "
                   "(SELECT id FROM portal_users WHERE email = ?)", (email_b,))
    assert client.post("/api/portal/draft/submit", headers=headers_b, json={"privacy_accepted": True, "updated_at": "expired"}).status_code == 409
    assert client.get("/api/portal/draft").json()["expires_at"] is None


def test_password_recovery_is_single_use_audited_and_revokes_sessions(client):
    buyer = buy_inquiry(client, "Recovery Buyer", "recover@example.test", "recovery-buy")
    email = approve_and_invite(client, buyer["company_id"], buyer["contact_id"])
    assert client.post("/api/portal/login", json={"email": email, "password": "customer-long-password"}).status_code == 200
    csrf = staff_login(client)
    body = {"contact_id": buyer["contact_id"], "reason": "Identity checked with established contact"}
    path = f"/api/admin/companies/{buyer['company_id']}/password-reset"
    assert client.post(path, headers={"X-CSRF-Token": csrf}, json=body).status_code == 403
    csrf = staff_login(client, "admin@example.test")
    issued = client.post(path, headers={"X-CSRF-Token": csrf}, json=body)
    assert issued.status_code == 201, issued.text
    reset_body = {"token": issued.json()["token"], "password": "new-customer-long-password"}
    assert client.post("/api/portal/password-reset", json=reset_body).status_code == 200
    assert client.get("/api/portal/me").status_code == 401
    assert client.post("/api/portal/password-reset", json=reset_body).status_code == 403
    assert client.post("/api/portal/login", json={"email": email, "password": "customer-long-password"}).status_code == 401
    assert client.post("/api/portal/login", json={"email": email, "password": reset_body["password"]}).status_code == 200
    with main.database() as db:
        events = [row[0] for row in db.execute("SELECT action FROM access_events WHERE company_id = ?", (buyer["company_id"],))]
        stored = db.execute("SELECT token_hash FROM portal_password_resets").fetchone()[0]
    assert "password_reset_issued" in events and "password_reset_completed" in events
    assert stored != issued.json()["token"]


def test_profile_and_saved_products_are_owner_scoped(client):
    buyer_a = buy_inquiry(client, "Saved A", "saved-a@example.test", "saved-buy-a")
    buyer_b = buy_inquiry(client, "Saved B", "saved-b@example.test", "saved-buy-b")
    email_a = approve_and_invite(client, buyer_a["company_id"], buyer_a["contact_id"])
    email_b = approve_and_invite(client, buyer_b["company_id"], buyer_b["contact_id"])
    csrf = staff_login(client, "admin@example.test")
    product_body = {"slug": "test-saved-oil", "name": "Test saved oil", "category": "Test only", "published": True}
    product = client.post("/api/admin/products", headers={"X-CSRF-Token": csrf}, json=product_body).json()
    login = client.post("/api/portal/login", json={"email": email_a, "password": "customer-long-password"})
    headers = {"X-CSRF-Token": login.json()["csrf_token"]}
    path = f"/api/portal/saved-products/{product['id']}"
    assert client.put(path, headers=headers).status_code == 200
    assert client.put(path, headers=headers).status_code == 200
    assert len(client.get("/api/portal/saved-products").json()) == 1
    profile = client.put("/api/portal/profile", headers=headers, json={"contact_name": "Updated Buyer"})
    assert profile.status_code == 200 and profile.json()["contact_name"] == "Updated Buyer"
    login_b = client.post("/api/portal/login", json={"email": email_b, "password": "customer-long-password"})
    assert client.get("/api/portal/saved-products").json() == []
    assert client.get("/api/portal/profile").json()["contact_name"] == "Buyer Contact"
    assert client.delete(path, headers={"X-CSRF-Token": login_b.json()["csrf_token"]}).status_code == 200
    client.post("/api/portal/login", json={"email": email_a, "password": "customer-long-password"})
    assert len(client.get("/api/portal/saved-products").json()) == 1


def test_portal_documents_enforce_company_scope_and_scanning(client):
    offer = client.post("/api/inquiries", headers={"Idempotency-Key": "document-owner"}, json={
        "kind": "sell", "company_name": "Document Supplier", "contact_name": "Supplier Contact",
        "email": "documents@example.test", "product_text": "Test oil", "quantity": 2,
        "unit": "MT", "privacy_accepted": True,
    }).json()
    with main.database() as db:
        row = db.execute("SELECT company_id, contact_id FROM inquiries WHERE reference = ?", (offer["reference"],)).fetchone()
    email = approve_and_invite(client, row["company_id"], row["contact_id"], "supplier")
    login = client.post("/api/portal/login", json={"email": email, "password": "customer-long-password"})
    headers = {"X-CSRF-Token": login.json()["csrf_token"]}
    token = client.post(f"/api/portal/inquiries/{offer['reference']}/upload-token", headers=headers).json()["upload_token"]
    uploaded = client.post(f"/api/inquiries/{offer['reference']}/documents",
                           headers={"X-Upload-Token": token, "X-Filename": "COA.pdf"}, content=b"%PDF-1.7\nTest-only content")
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]
    assert client.get(f"/api/portal/inquiries/{offer['reference']}/documents").json()[0]["scan_status"] == "unscanned"
    assert client.get(f"/api/portal/documents/{document_id}").status_code == 409
    with main.database() as db:
        # This fixture stands in for a trusted scanner; there is no public scan override endpoint.
        db.execute("UPDATE documents SET scan_status = 'clean' WHERE id = ?", (document_id,))
    assert client.get(f"/api/portal/documents/{document_id}").content.startswith(b"%PDF-")
    buyer = buy_inquiry(client, "Other Document Buyer", "other-doc@example.test", "other-document-company")
    email_b = approve_and_invite(client, buyer["company_id"], buyer["contact_id"])
    client.post("/api/portal/login", json={"email": email_b, "password": "customer-long-password"})
    assert client.get(f"/api/portal/documents/{document_id}").status_code == 404
    assert client.get(f"/api/portal/inquiries/{offer['reference']}/documents").status_code == 404


def test_stale_acceptance_and_issued_customer_snapshot(client):
    buyer = buy_inquiry(client, "Snapshot Buyer", "snapshot@example.test", "snapshot-buy")
    email = approve_and_invite(client, buyer["company_id"], buyer["contact_id"])
    quote, csrf = create_quote(client, buyer["id"])
    path = f"/api/admin/quotes/{quote['id']}"
    assert client.post(path + "/issue", headers={"X-CSRF-Token": csrf}).status_code == 200
    with main.database() as db:
        db.execute("UPDATE companies SET name = 'Changed later' WHERE id = ?", (buyer["company_id"],))
    detail = client.get(path).json()
    assert detail["revisions"][0]["customer_name"] == "Snapshot Buyer"
    assert detail["revisions"][0]["contact_email"] == "snapshot@example.test"
    assert client.post(path + "/revisions", headers={"X-CSRF-Token": csrf}, json=quote_body(price="500")).status_code == 201
    assert client.post(path + "/issue", headers={"X-CSRF-Token": csrf}).status_code == 200
    login = client.post("/api/portal/login", json={"email": email, "password": "customer-long-password"})
    accepted = client.post(f"/api/portal/quotes/{quote['id']}/accept",
                           headers={"X-CSRF-Token": login.json()["csrf_token"]}, json={"version": 1})
    assert accepted.status_code == 409, accepted.text
    assert client.get(path).json()["status"] == "issued"
    first_version = client.get(f"/api/portal/quotes/{quote['id']}?version=1").json()
    assert first_version["revision"]["items"][0]["unit_price"] == "123.45"
    assert first_version["acceptance_available"] is False
    assert client.get(f"/api/portal/quotes/{quote['id']}/pdf?version=1").headers["content-disposition"].endswith('-v1.pdf')
    rejected = client.post(f"/api/portal/quotes/{quote['id']}/reject",
                           headers={"X-CSRF-Token": login.json()["csrf_token"]},
                           json={"version": 2, "reason": "Revised commercial terms are unsuitable"})
    assert rejected.status_code == 200
    assert client.get(path).json()["status"] == "rejected"


def test_cancel_quote_preserves_revision_and_cancels_delivery(client):
    buyer = buy_inquiry(client, "Cancelled Buyer", "cancel@example.test", "cancel-buy")
    quote, csrf = create_quote(client, buyer["id"])
    path = f"/api/admin/quotes/{quote['id']}"
    client.post(path + "/issue", headers={"X-CSRF-Token": csrf})
    client.post(path + "/send", headers={"X-CSRF-Token": csrf})
    cancelled = client.post(path + "/decision?outcome=cancelled", headers={"X-CSRF-Token": csrf},
                            json={"version": 1, "reason": "Commercial request withdrawn by customer"})
    assert cancelled.status_code == 200
    detail = client.get(path).json()
    assert detail["status"] == "cancelled"
    assert detail["email_delivery"]["status"] == "cancelled"
    assert detail["revisions"][0]["state"] == "issued"
    assert client.post(path + "/accept", headers={"X-CSRF-Token": csrf},
                       json={"version": 1, "reason": "Attempted acceptance after cancellation"}).status_code == 409
    duplicate = client.post(path + "/duplicate", headers={"X-CSRF-Token": csrf})
    assert duplicate.status_code == 201 and duplicate.json()["id"] != quote["id"]
    assert client.get(f"/api/admin/quotes/{duplicate.json()['id']}").json()["status"] == "draft"


def test_operations_ownership_search_reminders_and_exports_are_team_scoped(client):
    buyer = buy_inquiry(client, "=SUM(1,2)", "operations@example.test", "operations-buy")
    offer = client.post("/api/inquiries", headers={"Idempotency-Key": "operations-supplier"}, json={
        "kind": "sell", "company_name": "Private Supplier", "contact_name": "Supplier Contact",
        "email": "private-supplier@example.test", "product_text": "Test oil", "quantity": 2,
        "unit": "MT", "privacy_accepted": True,
    }).json()
    with main.database() as db:
        sales_id = db.execute("SELECT id FROM staff WHERE role = 'sales'").fetchone()[0]
        procurement_id = db.execute("SELECT id FROM staff WHERE role = 'procurement'").fetchone()[0]
        supplier = dict(db.execute("SELECT id, company_id FROM inquiries WHERE reference = ?", (offer["reference"],)).fetchone())
    csrf = staff_login(client)
    headers = {"X-CSRF-Token": csrf}
    path = f"/api/admin/inquiries/{buyer['id']}/operations"
    invalid_owner = client.put(path, headers=headers, json={"assigned_to": procurement_id})
    assert invalid_owner.status_code == 422
    saved = client.put(path, headers=headers, json={"assigned_to": sales_id, "priority": "high", "next_action": "Request batch specification"})
    assert saved.status_code == 200, saved.text
    assert saved.json()["owner_email"] == "sales@example.test"
    mine = client.get("/api/admin/inquiries?owner=mine&priority=high").json()
    assert [item["id"] for item in mine] == [buyer["id"]]
    assert client.get(f"/api/admin/inquiries/{supplier['id']}/operations").status_code == 403
    assert client.get(f"/api/admin/company-overview/{supplier['company_id']}").status_code == 404
    assert client.get("/api/admin/search?q=Private%20Supplier").json() == []
    assert client.get("/api/admin/inquiries?q=Private%20Supplier").json() == []
    company = client.get(f"/api/admin/company-overview/{buyer['company_id']}").json()
    assert company["contacts"][0]["email"] == "operations@example.test"
    assert client.post(f"/api/admin/inquiries/{buyer['id']}/tasks", headers=headers,
                       json={"title": "Due follow-up", "due_date": "2000-01-01"}).status_code == 201
    assert len(client.get("/api/admin/reminders").json()) == 1
    csv = client.get("/api/admin/reports/inquiries.csv")
    assert csv.status_code == 200
    assert "'=SUM(1,2)" in csv.text and "Private Supplier" not in csv.text
    assert csv.headers["cache-control"] == "private, no-store"
    with main.database() as db:
        assert db.execute("SELECT record_count FROM export_events").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM activity WHERE action = 'operations_updated'").fetchone()[0] == 1
    staff_login(client, "procurement@example.test")
    assert client.get("/api/admin/reminders").json() == []
    assert client.get("/api/admin/reports").json()["inquiries"] == 1
    assert client.get("/api/admin/reports").json()["quote_values"] == []
    assert "operations@example.test" not in client.get("/api/admin/reports/inquiries.csv").text


def test_report_dates_and_currencies_are_explicit(client):
    first = buy_inquiry(client, "USD Buyer", "usd@example.test", "usd-report")
    second = buy_inquiry(client, "EUR Buyer", "eur@example.test", "eur-report")
    usd, csrf = create_quote(client, first["id"])
    eur = client.post("/api/admin/quotes", headers={"X-CSRF-Token": csrf},
                      json={**quote_body(second["id"], "200"), "currency": "EUR"}).json()
    for quote in (usd, eur):
        assert client.post(f"/api/admin/quotes/{quote['id']}/issue", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert client.post(f"/api/admin/quotes/{usd['id']}/accept", headers={"X-CSRF-Token": csrf},
                       json={"version": 1, "reason": "Authorized written acceptance received"}).status_code == 200
    report = client.get("/api/admin/reports").json()
    assert report["quote_values"] == [
        {"currency": "EUR", "status": "issued", "count": 1, "total": "500.00"},
        {"currency": "USD", "status": "accepted", "count": 1, "total": "308.63"},
    ]
    assert all(report[field] is None for field in ["forecast", "contracted_value", "payments", "revenue"])
    assert client.get("/api/admin/reports?start=2026-02-30").status_code == 422
    assert client.get("/api/admin/reports?start=2020-01-01&end=2026-10-10").status_code == 422
    assert client.get("/api/admin/reports?start=2026-02-01&end=2026-01-01").status_code == 422


def test_portal_proformas_and_verification_withdrawal(client):
    buyer_a = buy_inquiry(client, "Proforma A", "pi-a@example.test", "pi-portal-a")
    buyer_b = buy_inquiry(client, "Proforma B", "pi-b@example.test", "pi-portal-b")
    email_a = approve_and_invite(client, buyer_a["company_id"], buyer_a["contact_id"])
    email_b = approve_and_invite(client, buyer_b["company_id"], buyer_b["contact_id"])
    quote, csrf = create_quote(client, buyer_a["id"])
    path = f"/api/admin/quotes/{quote['id']}"
    assert client.post(path + "/issue", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert client.post(path + "/accept", headers={"X-CSRF-Token": csrf},
                       json={"version": 1, "reason": "Written acceptance received"}).status_code == 200
    pi = client.post(path + "/proforma", headers={"X-CSRF-Token": csrf}).json()
    client.post("/api/portal/login", json={"email": email_b, "password": "customer-long-password"})
    assert client.get("/api/portal/proformas").json() == []
    assert client.get(f"/api/portal/proformas/{pi['id']}/pdf").status_code == 404
    client.post("/api/portal/login", json={"email": email_a, "password": "customer-long-password"})
    assert client.get("/api/portal/proformas").json()[0]["id"] == pi["id"]
    assert client.get(f"/api/portal/proformas/{pi['id']}/pdf").content.startswith(b"%PDF-")
    admin_csrf = staff_login(client, "admin@example.test")
    assert client.post(f"/api/admin/companies/{buyer_a['company_id']}/verification",
                       headers={"X-CSRF-Token": admin_csrf}, json={"status": "pending", "reason": "Renewed company review required"}).status_code == 200
    assert client.get("/api/portal/me").status_code == 401
    assert client.get(f"/api/portal/proformas/{pi['id']}/pdf").status_code == 401


def test_commercial_hold_blocks_issuing_and_records_review(client):
    inquiry = buy_inquiry(client, "Buyer Hold", "buyer-hold@example.test", "hold-buy")
    quote, sales_csrf = create_quote(client, inquiry["id"])
    admin_csrf = staff_login(client, "admin@example.test")
    path = f"/api/admin/companies/{inquiry['company_id']}/compliance"
    review = {
        "registration_information": "Registration pending review",
        "buyer_country": "UAE", "destination_country": "UAE",
        "status": "pending", "hold": True,
        "review_notes": "Additional documentation requested",
        "reason": "Transaction review hold pending documents",
    }
    saved = client.put(path, headers={"X-CSRF-Token": admin_csrf}, json=review)
    assert saved.status_code == 200, saved.text
    assert client.get(path).json()["hold"] == 1
    sales_csrf = staff_login(client)
    assert client.post(f"/api/admin/quotes/{quote['id']}/issue",
                       headers={"X-CSRF-Token": sales_csrf}).status_code == 409
    admin_csrf = staff_login(client, "admin@example.test")
    review.update({"status": "approved", "hold": False, "reason": "Documents reviewed by authorized staff"})
    assert client.put(path, headers={"X-CSRF-Token": admin_csrf}, json=review).status_code == 200
    sales_csrf = staff_login(client)
    assert client.post(f"/api/admin/quotes/{quote['id']}/issue",
                       headers={"X-CSRF-Token": sales_csrf}).status_code == 200
    with main.database() as db:
        assert db.execute("SELECT count(*) FROM compliance_events WHERE company_id = ?",
                          (inquiry["company_id"],)).fetchone()[0] == 2
