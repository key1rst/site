"""Phase 3 local workflow tests; no real external delivery."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from backend.app import main
from backend.app import integration_worker


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "phase3.db")
    monkeypatch.setattr(main, "FILE_PATH", tmp_path / "uploads")
    main.initialize()
    main.create_staff("admin@example.test", "long-secret-password", "admin")
    main.create_staff("sales@example.test", "long-secret-password", "sales")
    main.create_staff("procurement@example.test", "long-secret-password", "procurement")
    with TestClient(main.app) as browser:
        yield browser


def login(client, email="admin@example.test"):
    response = client.post("/api/auth/login", json={"email": email, "password": "long-secret-password"})
    assert response.status_code == 200, response.text
    return {"X-CSRF-Token": response.json()["csrf_token"]}


def accepted_quote(client, company="Shipment Buyer", email="ship@example.test"):
    intake = client.post("/api/inquiries", headers={"Idempotency-Key": f"buy-{email}"}, json={
        "kind": "buy", "company_name": company, "contact_name": "Buyer Contact", "email": email,
        "product_text": "Test base oil", "quantity": "2", "unit": "MT", "destination_country": "UAE", "privacy_accepted": True,
    })
    assert intake.status_code == 201, intake.text
    with main.database() as db:
        inquiry = db.execute("SELECT id, company_id, contact_id FROM inquiries WHERE reference = ?", (intake.json()["reference"],)).fetchone()
    csrf = login(client)
    quote = client.post("/api/admin/quotes", headers=csrf, json={
        "inquiry_id": inquiry["id"], "items": [{"description": "Test base oil", "quantity": "2", "unit": "MT", "unit_price": "100"}],
        "currency": "USD", "incoterm": "FOB", "named_place": "Approved port", "payment_terms": "Subject to agreement",
        "delivery_terms": "Subject to booking", "validity_date": "2099-12-31",
    })
    assert quote.status_code == 201, quote.text
    quote_id = quote.json()["id"]
    assert client.post(f"/api/admin/quotes/{quote_id}/issue", headers=csrf).status_code == 200
    assert client.post(f"/api/admin/quotes/{quote_id}/accept", headers=csrf,
                       json={"version": 1, "reason": "Customer written acceptance on file"}).status_code == 200
    return quote_id, dict(inquiry), csrf


def create_shipment(client, quote_id, csrf, key="shipment-plan"):
    response = client.post("/api/admin/shipments", headers={**csrf, "Idempotency-Key": key}, json={
        "quote_id": quote_id, "carrier": "Test Carrier", "tracking_reference": "TEST-TRACK-1",
        "origin": "Loading point", "destination": "Customer destination", "reason": "Operations planning after accepted quote",
    })
    assert response.status_code == 201, response.text
    return response.json()


def event(client, shipment, csrf, status, *, key=None, version=None, occurred_at=None):
    return client.post(f"/api/admin/shipments/{shipment['id']}/events",
                       headers={**csrf, "Idempotency-Key": key or f"{shipment['id']}-{status}"},
                       json={"expected_version": version or shipment["version"], "status": status,
                             "reason": f"Evidence reviewed for {status}", "evidence_reference": f"TEST-{status}",
                             "customer_note": f"{status} update", "occurred_at": occurred_at or datetime.now(timezone.utc).isoformat()})


def enable_profile(client, csrf, monkeypatch, slug="test-logistics"):
    with main.database() as db:
        owner = db.execute("SELECT id FROM staff WHERE role = 'admin'").fetchone()[0]
    created = client.post("/api/admin/integrations", headers=csrf, json={
        "slug": slug, "name": "Test logistics receiver", "purpose": "logistics", "owner_id": owner,
        "contract_notes": "Receiver accepts shipment.changed.v1 and deduplicates event_id",
    })
    assert created.status_code == 201, created.text
    profile = created.json()
    assert profile["enabled"] == 0 and profile["configured"] is False
    blocked = client.post(f"/api/admin/integrations/{profile['id']}/control", headers=csrf,
                          json={"expected_version": 1, "enabled": True, "contract_approved": True, "reason": "Test approval"})
    assert blocked.status_code == 422
    monkeypatch.setenv("OIL_INTEGRATION_TEST_LOGISTICS_URL", "https://receiver.example.test/hooks")
    monkeypatch.setenv("OIL_INTEGRATION_TEST_LOGISTICS_TOKEN", "test-secret-never-returned")
    assert client.post(f"/api/admin/integrations/{profile['id']}/control", headers=csrf,
                       json={"expected_version": 1, "enabled": True, "reason": "Missing explicit approval"}).status_code == 422
    enabled = client.post(f"/api/admin/integrations/{profile['id']}/control", headers=csrf,
                          json={"expected_version": 1, "enabled": True, "contract_approved": True,
                                "reason": "Reviewed exact outbound contract"})
    assert enabled.status_code == 200, enabled.text
    assert enabled.json()["enabled"] == 1 and "test-secret" not in enabled.text
    return enabled.json()


def test_shipments_need_acceptance_and_explicit_evidence(client):
    intake = client.post("/api/inquiries", headers={"Idempotency-Key": "unaccepted-shipment"}, json={
        "kind": "buy", "company_name": "Unaccepted", "contact_name": "Buyer Contact", "email": "no@example.test",
        "product_text": "Test oil", "quantity": "2", "unit": "MT", "destination_country": "UAE", "privacy_accepted": True,
    })
    csrf = login(client)
    with main.database() as db:
        inquiry_id = db.execute("SELECT id FROM inquiries WHERE reference = ?", (intake.json()["reference"],)).fetchone()[0]
    quote = client.post("/api/admin/quotes", headers=csrf, json={
        "inquiry_id": inquiry_id, "items": [{"description": "Test oil", "quantity": "2", "unit": "MT", "unit_price": "100"}],
        "currency": "USD", "incoterm": "FOB", "named_place": "Approved port", "payment_terms": "To confirm",
        "delivery_terms": "To confirm", "validity_date": "2099-12-31",
    }).json()
    failed = client.post("/api/admin/shipments", headers={**csrf, "Idempotency-Key": "unaccepted-plan"}, json={
        "quote_id": quote["id"], "origin": "Port A", "destination": "Port B", "reason": "Tentative booking request",
    })
    assert failed.status_code == 409
    quote_id, inquiry, csrf = accepted_quote(client)
    planned = create_shipment(client, quote_id, csrf)
    assert planned["status"] == "planned" and planned["portal_visible"] == 0
    assert create_shipment(client, quote_id, csrf)["id"] == planned["id"]
    with main.database() as db:
        assert db.execute("SELECT count(*) FROM shipments").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM inventory_events").fetchone()[0] == 0
    assert event(client, planned, csrf, "booked").status_code == 409  # company verification required
    assert client.post(f"/api/admin/shipments/{planned['id']}/visibility", headers=csrf,
                       json={"expected_version": 1, "visible": True, "reason": "Customer access approved"}).status_code == 409
    verify = client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf,
                         json={"status": "approved", "reason": "Company registration reviewed"})
    assert verify.status_code == 200
    booking_time = datetime.now(timezone.utc).isoformat()
    booked = event(client, planned, csrf, "booked", occurred_at=booking_time)
    assert booked.status_code == 200, booked.text
    booked = booked.json()
    assert booked["version"] == 2
    assert event(client, planned, csrf, "booked", occurred_at=booking_time).json()["version"] == 2  # exact retry
    assert event(client, booked, csrf, "delivered").status_code == 409
    published = client.post(f"/api/admin/shipments/{planned['id']}/visibility", headers=csrf,
                            json={"expected_version": 2, "visible": True, "reason": "Reviewed customer-facing tracking"})
    assert published.status_code == 200
    with main.database() as db:
        assert db.execute("SELECT count(*) FROM inventory_events").fetchone()[0] == 0


def test_portal_tracking_scope_and_internal_evidence(client):
    first_quote, first, csrf = accepted_quote(client, "Company One", "one@example.test")
    second_quote, second, csrf = accepted_quote(client, "Company Two", "two@example.test")
    shipment = create_shipment(client, first_quote, csrf)
    other = create_shipment(client, second_quote, csrf, "second-plan")
    for inquiry in (first, second):
        assert client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf,
                           json={"status": "approved", "reason": "Known company registration reviewed"}).status_code == 200
    for shipment_id in (shipment, other):
        booked = event(client, shipment_id, csrf, "booked").json()
        assert client.post(f"/api/admin/shipments/{shipment_id['id']}/visibility", headers=csrf,
                           json={"expected_version": booked["version"], "visible": True,
                                 "reason": "Approved tracking publication"}).status_code == 200
    invite = client.post("/api/admin/portal-invites", headers=csrf,
                         json={"company_id": first["company_id"], "contact_id": first["contact_id"], "role": "customer"}).json()
    assert client.post("/api/portal/activate", json={"token": invite["token"], "password": "customer-long-password"}).status_code == 200
    assert client.post("/api/portal/login", json={"email": "one@example.test", "password": "customer-long-password"}).status_code == 200
    items = client.get("/api/portal/shipments").json()
    assert len(items) == 1 and items[0]["id"] == shipment["id"]
    assert "reason" not in str(items) and "evidence" not in str(items)
    assert client.get(f"/api/portal/shipments/{other['id']}").status_code == 404
    assert client.get(f"/api/portal/shipments/{shipment['id']}").json()["tracking_reference"] == "TEST-TRACK-1"
    assert client.post(f"/api/admin/shipments/{shipment['id']}/visibility", headers=csrf,
                       json={"expected_version": 3, "visible": False, "reason": "Tracking access withdrawn"}).status_code == 200
    assert client.get(f"/api/portal/shipments/{shipment['id']}").status_code == 404
    login(client, "procurement@example.test")
    assert client.get(f"/api/admin/shipments/{shipment['id']}").status_code == 403


def test_paused_jobs_require_review_and_reconcile_exact_snapshot(client, monkeypatch):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf,
                json={"status": "approved", "reason": "Company identity reviewed"})
    booked = event(client, shipment, csrf, "booked").json()
    with main.database() as db:
        owner = db.execute("SELECT id FROM staff WHERE role = 'admin'").fetchone()[0]
    profile = client.post("/api/admin/integrations", headers=csrf, json={
        "slug": "test-logistics", "name": "Test receiver", "purpose": "logistics", "owner_id": owner,
        "contract_notes": "Receiver deduplicates event_id and checks shipment version",
    }).json()
    queued = client.post(f"/api/admin/integrations/{profile['id']}/queue", headers=csrf,
                         json={"shipment_id": shipment["id"], "expected_version": booked["version"],
                               "reason": "Reviewed exact outbound shipment fields"})
    assert queued.status_code == 201, queued.text
    job = queued.json()
    assert job["status"] == "queued" and job["payload"]["schema"] == "shipment.changed.v1"
    assert set(job["payload"]["shipment"]) == {"reference", "version", "status", "carrier", "tracking_reference", "origin",
                                                  "destination", "expected_delivery_date", "updated_at"}
    assert integration_worker.process_once(send_enabled=True)["sent"] == 0
    assert integration_worker.process_once()["skipped"].startswith("External delivery is disabled")
    profile = enable_existing_profile(client, csrf, monkeypatch, profile)
    def ack(_config, payload):
        return {"event_id": payload["event_id"], "shipment_reference": payload["shipment"]["reference"],
                "version": payload["shipment"]["version"], "status": payload["shipment"]["status"], "external_id": "remote-1"}
    sent = integration_worker.process_once(send_enabled=True, transport=ack)
    assert sent["sent"] == 1
    result = client.get(f"/api/admin/integrations/jobs/{job['id']}").json()
    assert result["status"] == "sent" and len(result["attempt_history"]) == 1
    assert client.post(f"/api/admin/integrations/jobs/{job['id']}/reconcile", headers=csrf,
                       json={"remote_version": 99, "remote_status": "delivered", "external_id": "remote-1",
                             "evidence_reference": "REMOTE-MISMATCH"}).json()["result"] == "mismatch"
    assert client.post(f"/api/admin/integrations/jobs/{job['id']}/reconcile", headers=csrf,
                       json={"remote_version": booked["version"], "remote_status": "booked", "external_id": "remote-1",
                             "evidence_reference": "REMOTE-MATCH"}).json()["result"] == "matched"
    assert client.get(f"/api/admin/shipments/{shipment['id']}").json()["status"] == "booked"
    assert "test-secret" not in client.get(f"/api/admin/integrations/jobs/{job['id']}").text


def enable_existing_profile(client, csrf, monkeypatch, profile):
    monkeypatch.setenv("OIL_INTEGRATION_TEST_LOGISTICS_URL", "https://receiver.example.test/hooks")
    monkeypatch.setenv("OIL_INTEGRATION_TEST_LOGISTICS_TOKEN", "test-secret")
    response = client.post(f"/api/admin/integrations/{profile['id']}/control", headers=csrf,
                           json={"expected_version": profile["version"], "enabled": True, "contract_approved": True,
                                 "reason": "Reviewed HTTPS receiver and data contract"})
    assert response.status_code == 200, response.text
    return response.json()


def test_worker_retries_and_pausing_prevents_delivery(client, monkeypatch):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf,
                json={"status": "approved", "reason": "Company identity reviewed"})
    booked = event(client, shipment, csrf, "booked").json()
    profile = enable_profile(client, csrf, monkeypatch)
    job = client.post(f"/api/admin/integrations/{profile['id']}/queue", headers=csrf,
                      json={"shipment_id": shipment["id"], "expected_version": booked["version"], "reason": "Send reviewed status"}).json()
    def fail(_config, _payload):
        raise integration_worker.DeliveryFailure("http_503", True)
    result = integration_worker.process_once(send_enabled=True, transport=fail)
    assert result["retry_wait"] == 1
    saved = client.get(f"/api/admin/integrations/jobs/{job['id']}").json()
    assert saved["attempts"] == 1 and saved["status"] == "retry_wait" and saved["last_error"] == "http_503"
    paused = client.post(f"/api/admin/integrations/{profile['id']}/control", headers=csrf,
                         json={"expected_version": profile["version"], "enabled": False, "reason": "Pause outbound processing"})
    assert paused.status_code == 200
    assert client.post(f"/api/admin/integrations/jobs/{job['id']}/retry", headers=csrf,
                       json={"reason": "Retry after review"}).status_code == 200
    assert integration_worker.process_once(send_enabled=True, transport=lambda *_: pytest.fail("Paused destination sent"))["sent"] == 0
    assert client.get(f"/api/admin/integrations/jobs/{job['id']}").json()["status"] == "queued"


def test_stale_snapshot_cancels_and_mismatch_needs_reconciliation(client, monkeypatch):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf,
                json={"status": "approved", "reason": "Company registration reviewed"})
    booked = event(client, shipment, csrf, "booked").json()
    profile = enable_profile(client, csrf, monkeypatch)
    endpoint = f"/api/admin/integrations/{profile['id']}/queue"
    first = client.post(endpoint, headers=csrf, json={"shipment_id": shipment["id"],
                                                    "expected_version": booked["version"], "reason": "Reviewed first snapshot"}).json()
    changed = client.put(f"/api/admin/shipments/{shipment['id']}", headers=csrf, json={
        "expected_version": booked["version"], "carrier": "Updated Carrier", "tracking_reference": "TEST-TRACK-2",
        "origin": "Loading point", "destination": "Customer destination", "reason": "Booking details corrected",
    })
    assert changed.status_code == 200, changed.text
    assert client.get(f"/api/admin/integrations/jobs/{first['id']}").json()["status"] == "cancelled"
    assert integration_worker.process_once(send_enabled=True, transport=lambda *_: pytest.fail("Stale snapshot sent"))["sent"] == 0
    newer = client.post(endpoint, headers=csrf, json={"shipment_id": shipment["id"],
                                                    "expected_version": changed.json()["version"], "reason": "Reviewed corrected snapshot"}).json()
    def mismatched_ack(_config, payload):
        return {"event_id": payload["event_id"], "shipment_reference": payload["shipment"]["reference"],
                "version": payload["shipment"]["version"] + 1, "status": "dispatched", "external_id": "remote-2"}
    result = integration_worker.process_once(send_enabled=True, transport=mismatched_ack)
    assert result["reconciliation_required"] == 1
    assert client.get(f"/api/admin/integrations/jobs/{newer['id']}").json()["status"] == "reconciliation_required"
    assert client.post(f"/api/admin/integrations/jobs/{newer['id']}/reconcile", headers=csrf,
                       json={"remote_version": changed.json()["version"] + 1, "remote_status": "dispatched",
                             "external_id": "remote-2", "evidence_reference": "REMOTE-ADVANCED"}).json()["result"] == "mismatch"
    assert client.post(f"/api/admin/integrations/jobs/{newer['id']}/reconcile", headers=csrf,
                       json={"remote_version": changed.json()["version"], "remote_status": "booked",
                             "external_id": "remote-2", "evidence_reference": "REMOTE-CORRECTED"}).json()["result"] == "matched"
    assert client.get(f"/api/admin/integrations/jobs/{newer['id']}").json()["status"] == "sent"


def test_commercial_hold_blocks_dispatch_but_preserves_tracking_evidence(client):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf,
                json={"status": "approved", "reason": "Company registration reviewed"})
    booked = event(client, shipment, csrf, "booked").json()
    review = client.put(f"/api/admin/companies/{inquiry['company_id']}/compliance", headers=csrf, json={
        "status": "pending", "hold": True, "reason": "Transaction review pending additional documents",
    })
    assert review.status_code == 200
    assert event(client, booked, csrf, "dispatched").status_code == 409
    assert client.get(f"/api/admin/shipments/{shipment['id']}").json()["status"] == "booked"
    released = client.put(f"/api/admin/companies/{inquiry['company_id']}/compliance", headers=csrf, json={
        "status": "approved", "hold": False, "reason": "Document review completed for this test",
    })
    assert released.status_code == 200
    current = event(client, booked, csrf, "dispatched")
    assert current.status_code == 200
    for status in ("in_transit", "delivered"):
        current = event(client, current.json(), csrf, status)
        assert current.status_code == 200, current.text
    assert event(client, current.json(), csrf, "cancelled").status_code == 409
    with main.database() as db:
        assert db.execute("SELECT count(*) FROM inventory_events").fetchone()[0] == 0
        assert db.execute("SELECT status FROM quotes WHERE id = ?", (quote_id,)).fetchone()[0] == "accepted"


def test_lease_recovery_reuses_stable_external_event_id(client, monkeypatch):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf,
                json={"status": "approved", "reason": "Company registration reviewed"})
    booked = event(client, shipment, csrf, "booked").json()
    profile = enable_profile(client, csrf, monkeypatch)
    job = client.post(f"/api/admin/integrations/{profile['id']}/queue", headers=csrf,
                      json={"shipment_id": shipment["id"], "expected_version": booked["version"],
                            "reason": "Approved snapshot for receiver"}).json()
    first = integration_worker.claim(set())
    assert first["payload"]["event_id"] == job["id"]
    with main.database() as db:
        db.execute("UPDATE integration_jobs SET lease_expires_at = '2000-01-01' WHERE id = ?", (job["id"],))
    ids = []
    def ack(_config, payload):
        ids.append(payload["event_id"])
        return {"event_id": payload["event_id"], "shipment_reference": payload["shipment"]["reference"],
                "version": payload["shipment"]["version"], "status": payload["shipment"]["status"], "external_id": "remote-3"}
    assert integration_worker.process_once(send_enabled=True, transport=ack)["sent"] == 1
    assert ids == [job["id"]]
    result = client.get(f"/api/admin/integrations/jobs/{job['id']}").json()
    assert [attempt["outcome"] for attempt in result["attempt_history"]] == ["outcome_unknown", "sent"]


def test_shipment_changed_during_http_delivery_needs_review(client, monkeypatch):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf,
                json={"status": "approved", "reason": "Company registration reviewed"})
    booked = event(client, shipment, csrf, "booked").json()
    profile = enable_profile(client, csrf, monkeypatch)
    job = client.post(f"/api/admin/integrations/{profile['id']}/queue", headers=csrf,
                      json={"shipment_id": shipment["id"], "expected_version": booked["version"],
                            "reason": "Reviewed booking snapshot"}).json()
    def ack_after_change(_config, payload):
        changed = client.put(f"/api/admin/shipments/{shipment['id']}", headers=csrf, json={
            "expected_version": booked["version"], "carrier": "Updated Carrier", "tracking_reference": "TEST-TRACK-2",
            "origin": "Loading point", "destination": "Customer destination", "reason": "Carrier changed during delivery",
        })
        assert changed.status_code == 200, changed.text
        return {"event_id": payload["event_id"], "shipment_reference": payload["shipment"]["reference"],
                "version": payload["shipment"]["version"], "status": payload["shipment"]["status"], "external_id": "remote-4"}
    result = integration_worker.process_once(send_enabled=True, transport=ack_after_change)
    assert result["sent"] == 0 and result["reconciliation_required"] == 1
    pending = client.get(f"/api/admin/integrations/jobs/{job['id']}").json()
    assert pending["last_error"] == "snapshot_changed_during_delivery"
    observed = client.post(f"/api/admin/integrations/jobs/{job['id']}/reconcile", headers=csrf,
                           json={"remote_version": booked["version"], "remote_status": "booked",
                                 "external_id": "remote-4", "evidence_reference": "REMOTE-OLD"})
    assert observed.json()["result"] == "stale"
    assert client.get(f"/api/admin/integrations/jobs/{job['id']}").json()["status"] == "reconciliation_required"


def test_bounded_delivery_retries_end_in_dead_letter(client, monkeypatch):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf,
                json={"status": "approved", "reason": "Company registration reviewed"})
    booked = event(client, shipment, csrf, "booked").json()
    profile = enable_profile(client, csrf, monkeypatch)
    job = client.post(f"/api/admin/integrations/{profile['id']}/queue", headers=csrf,
                      json={"shipment_id": shipment["id"], "expected_version": booked["version"],
                            "reason": "Reviewed booking snapshot"}).json()
    def fail(_config, _payload):
        raise integration_worker.DeliveryFailure("http_503", True)
    for attempt in range(5):
        result = integration_worker.process_once(send_enabled=True, transport=fail)
        assert result["dead_letter" if attempt == 4 else "retry_wait"] == 1
        if attempt < 4:
            with main.database() as db:
                db.execute("UPDATE integration_jobs SET next_attempt_at = '2000-01-01' WHERE id = ?", (job["id"],))
    saved = client.get(f"/api/admin/integrations/jobs/{job['id']}").json()
    assert saved["status"] == "dead_letter" and saved["attempts"] == 5
    assert len(saved["attempt_history"]) == 5
    retried = client.post(f"/api/admin/integrations/jobs/{job['id']}/retry", headers=csrf,
                          json={"reason": "Receiver recovered after operator review"})
    assert retried.status_code == 200 and retried.json()["cycle_attempts"] == 0


def test_verification_withdrawal_revokes_tracking_sessions_and_pending_exchange(client, monkeypatch):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    verification_url = f"/api/admin/companies/{inquiry['company_id']}/verification"
    assert client.post(verification_url, headers=csrf, json={
        "status": "approved", "reason": "Company identity reviewed",
    }).status_code == 200
    booked = event(client, shipment, csrf, "booked").json()
    published = client.post(f"/api/admin/shipments/{shipment['id']}/visibility", headers=csrf, json={
        "expected_version": booked["version"], "visible": True, "reason": "Reviewed tracking access",
    })
    assert published.status_code == 200, published.text
    profile = enable_profile(client, csrf, monkeypatch)
    job = client.post(f"/api/admin/integrations/{profile['id']}/queue", headers=csrf, json={
        "shipment_id": shipment["id"], "expected_version": published.json()["version"],
        "reason": "Reviewed booking snapshot",
    }).json()
    invite = client.post("/api/admin/portal-invites", headers=csrf, json={
        "company_id": inquiry["company_id"], "contact_id": inquiry["contact_id"], "role": "customer",
    }).json()
    assert client.post("/api/portal/activate", json={
        "token": invite["token"], "password": "customer-long-password",
    }).status_code == 200
    assert client.post("/api/portal/login", json={
        "email": "ship@example.test", "password": "customer-long-password",
    }).status_code == 200
    assert len(client.get("/api/portal/shipments").json()) == 1

    revoked = client.post(verification_url, headers=csrf, json={
        "status": "pending", "reason": "Registration requires renewed review",
    })
    assert revoked.status_code == 200, revoked.text
    assert client.get("/api/portal/shipments").status_code == 401
    assert client.get(f"/api/admin/integrations/jobs/{job['id']}").json()["status"] == "cancelled"
    assert integration_worker.process_once(send_enabled=True,
                                           transport=lambda *_: pytest.fail("Revoked company sent"))["sent"] == 0
    current = client.get(f"/api/admin/shipments/{shipment['id']}").json()
    assert current["portal_visible"] == 0 and current["version"] == published.json()["version"] + 1
    assert any(item["action"] == "verification_withdrawn" for item in current["events"])
    assert client.post(f"/api/admin/shipments/{shipment['id']}/visibility", headers=csrf, json={
        "expected_version": current["version"], "visible": True,
        "reason": "Attempt to publish before renewed review",
    }).status_code == 409
    assert client.post(f"/api/admin/integrations/{profile['id']}/queue", headers=csrf, json={
        "shipment_id": shipment["id"], "expected_version": current["version"],
        "reason": "Attempt while approval withdrawn",
    }).status_code == 409

    assert client.post(verification_url, headers=csrf, json={
        "status": "approved", "reason": "Registration rechecked",
    }).status_code == 200
    assert client.get("/api/portal/shipments").status_code == 401
    assert client.post("/api/portal/login", json={
        "email": "ship@example.test", "password": "customer-long-password",
    }).status_code == 200
    assert client.get("/api/portal/shipments").json() == []


def test_withdrawal_invalidates_private_snapshot_and_reapproval_allows_fresh_review(client, monkeypatch):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    verification_url = f"/api/admin/companies/{inquiry['company_id']}/verification"
    assert client.post(verification_url, headers=csrf, json={
        "status": "approved", "reason": "Identity review completed",
    }).status_code == 200
    booked = event(client, shipment, csrf, "booked").json()
    profile = enable_profile(client, csrf, monkeypatch)
    queue_url = f"/api/admin/integrations/{profile['id']}/queue"
    first = client.post(queue_url, headers=csrf, json={
        "shipment_id": shipment["id"], "expected_version": booked["version"],
        "reason": "Reviewed private booking snapshot",
    })
    assert first.status_code == 201, first.text
    assert client.post(verification_url, headers=csrf, json={
        "status": "rejected", "reason": "Registration could not be confirmed",
    }).status_code == 200
    current = client.get(f"/api/admin/shipments/{shipment['id']}").json()
    assert current["version"] == booked["version"] + 1
    assert client.get(f"/api/admin/integrations/jobs/{first.json()['id']}").json()["status"] == "cancelled"
    assert client.post(verification_url, headers=csrf, json={
        "status": "approved", "reason": "New evidence was reviewed",
    }).status_code == 200
    renewed = client.post(queue_url, headers=csrf, json={
        "shipment_id": shipment["id"], "expected_version": current["version"],
        "reason": "Reviewed fresh booking snapshot",
    })
    assert renewed.status_code == 201, renewed.text
    assert renewed.json()["id"] != first.json()["id"]
    assert renewed.json()["payload"]["shipment"]["version"] == current["version"]


def test_hold_blocks_queue_and_worker_delivery(client, monkeypatch):
    quote_id, inquiry, csrf = accepted_quote(client)
    shipment = create_shipment(client, quote_id, csrf)
    assert client.post(f"/api/admin/companies/{inquiry['company_id']}/verification", headers=csrf, json={
        "status": "approved", "reason": "Company registration reviewed",
    }).status_code == 200
    booked = event(client, shipment, csrf, "booked").json()
    profile = enable_profile(client, csrf, monkeypatch)
    queue_url = f"/api/admin/integrations/{profile['id']}/queue"
    job = client.post(queue_url, headers=csrf, json={
        "shipment_id": shipment["id"], "expected_version": booked["version"],
        "reason": "Reviewed booking snapshot",
    })
    assert job.status_code == 201
    assert client.put(f"/api/admin/companies/{inquiry['company_id']}/compliance", headers=csrf, json={
        "status": "pending", "hold": True, "reason": "Transaction review is pending",
    }).status_code == 200
    assert client.post(queue_url, headers=csrf, json={
        "shipment_id": shipment["id"], "expected_version": booked["version"],
        "reason": "Attempt to queue while held",
    }).status_code == 409
    result = integration_worker.process_once(send_enabled=True,
                                             transport=lambda *_: pytest.fail("Held company sent"))
    assert result["sent"] == 0 and result["retry_wait"] == 1
    saved = client.get(f"/api/admin/integrations/jobs/{job.json()['id']}").json()
    assert saved["last_error"] == "commercial_hold"
