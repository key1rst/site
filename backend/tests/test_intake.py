from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from backend.app import main
from backend.app import outbox


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test.db")
    main.initialize()
    main.create_staff("sales@example.test", "long-secret-password", "sales")
    main.create_staff("procurement@example.test", "long-secret-password", "procurement")
    main.create_staff("admin@example.test", "long-secret-password", "admin")
    with TestClient(main.app) as test_client:
        yield test_client


def sign_in(client, email):
    response = client.post("/api/auth/login", json={"email": email, "password": "long-secret-password"})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def add_product(client):
    csrf = sign_in(client, "admin@example.test")
    response = client.post("/api/admin/products", headers={"X-CSRF-Token": csrf}, json={
        "slug": "sample-product", "name": "Sample Product", "category": "Base Oils",
        "grade": "Grade A", "published": True,
    })
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_rfq_is_durable_idempotent_and_visible_to_sales(client):
    product_id = add_product(client)
    payload = {
        "kind": "buy", "company_name": "Example Buyer", "contact_name": "Buyer One",
        "email": "buyer@example.test", "product_id": product_id, "quantity": 20,
        "unit": "MT", "destination_country": "Turkey", "privacy_accepted": True,
    }
    first = client.post("/api/inquiries", headers={"Idempotency-Key": "request-1"}, json=payload)
    again = client.post("/api/inquiries", headers={"Idempotency-Key": "request-1"}, json=payload)
    assert first.status_code == 201, first.text
    assert again.status_code == 201
    assert first.json()["reference"] == again.json()["reference"]
    with main.database() as db:
        assert db.execute("SELECT count(*) FROM inquiries").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM outbox WHERE status = 'queued'").fetchone()[0] == 2
    sign_in(client, "sales@example.test")
    inbox = client.get("/api/admin/inquiries")
    assert inbox.status_code == 200
    assert inbox.json()[0]["reference"] == first.json()["reference"]
    dashboard = client.get("/api/admin/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["counts"]["rfqs"] == 1


def test_guest_can_request_an_unlisted_product(client):
    response = client.post("/api/inquiries", headers={"Idempotency-Key": "custom-product"}, json={
        "kind": "buy", "company_name": "Buyer Co", "contact_name": "Buyer Person",
        "email": "buyer-custom@example.test", "product_text": "Unlisted lubricant grade",
        "quantity": 3, "unit": "MT", "destination_country": "Turkey", "privacy_accepted": True,
    })
    assert response.status_code == 201, response.text


def test_supplier_offer_stays_private_and_is_not_stock(client):
    response = client.post("/api/inquiries", headers={"Idempotency-Key": "offer-1"}, json={
        "kind": "sell", "company_name": "Example Supplier", "contact_name": "Supplier One",
        "email": "supplier@example.test", "product_text": "Base oil grade",
        "quantity": 30, "unit": "MT", "origin": "UAE", "privacy_accepted": True,
    })
    assert response.status_code == 201, response.text
    assert client.get("/api/stock").json() == []
    csrf = sign_in(client, "sales@example.test")
    assert client.get("/api/admin/inquiries").json() == []
    with main.database() as db:
        inquiry_id = db.execute("SELECT id FROM inquiries").fetchone()[0]
    assert client.get(f"/api/admin/inquiries/{inquiry_id}").status_code == 403
    assert client.post(f"/api/admin/inquiries/{inquiry_id}/follow-up", headers={"X-CSRF-Token": csrf},
                       json={"status": "reviewing"}).status_code == 403
    sign_in(client, "procurement@example.test")
    assert len(client.get("/api/admin/inquiries").json()) == 1


def test_follow_up_requires_csrf_and_loss_reason(client):
    product_id = add_product(client)
    response = client.post("/api/inquiries", headers={"Idempotency-Key": "request-2"}, json={
        "kind": "buy", "company_name": "Buyer Co", "contact_name": "Buyer Two",
        "email": "buyer2@example.test", "product_id": product_id, "quantity": 1,
        "unit": "MT", "destination_country": "UAE", "privacy_accepted": True,
    })
    assert response.status_code == 201
    with main.database() as db:
        inquiry_id = db.execute("SELECT id FROM inquiries").fetchone()[0]
    csrf = sign_in(client, "sales@example.test")
    path = f"/api/admin/inquiries/{inquiry_id}/follow-up"
    assert client.post(path, json={"status": "reviewing"}).status_code == 403
    assert client.post(path, headers={"X-CSRF-Token": csrf}, json={"status": "lost"}).status_code == 422
    updated = client.post(path, headers={"X-CSRF-Token": csrf},
                          json={"status": "lost", "note": "Customer cancelled"})
    assert updated.status_code == 200, updated.text
    detail = client.get(f"/api/admin/inquiries/{inquiry_id}").json()
    assert detail["status"] == "lost"
    assert detail["notes"][0]["body"] == "Customer cancelled"


def test_private_lot_is_not_public(client):
    product_id = add_product(client)
    csrf = sign_in(client, "admin@example.test")
    response = client.post("/api/admin/lots", headers={"X-CSRF-Token": csrf}, json={
        "product_id": product_id, "origin": "UAE", "quantity": 100,
        "unit": "MT", "public_visible": False,
    })
    assert response.status_code == 201, response.text
    assert client.get("/api/stock").json() == []
    assert client.get("/api/products/sample-product").json()["lots"] == []


def test_stock_reservation_cannot_oversell_and_release_restores_availability(client):
    product_id = add_product(client)
    csrf = sign_in(client, "admin@example.test")
    created = client.post("/api/admin/lots", headers={"X-CSRF-Token": csrf}, json={
        "product_id": product_id, "quantity": "10.5", "unit": "MT", "public_visible": True, "show_quantity": True,
    })
    assert created.status_code == 201, created.text
    lot_id = created.json()["id"]
    path = f"/api/admin/lots/{lot_id}/change"
    reserved = client.post(path, headers={"X-CSRF-Token": csrf},
                           json={"action": "reserve", "amount": "8.5", "reason": "Approved hold"})
    assert reserved.status_code == 200
    assert reserved.json()["available_quantity"] == "2.0"
    rejected = client.post(path, headers={"X-CSRF-Token": csrf},
                           json={"action": "reserve", "amount": "3", "reason": "Second hold"})
    assert rejected.status_code == 409
    assert client.get("/api/stock").json()[0]["quantity"] == "2.0"
    released = client.post(path, headers={"X-CSRF-Token": csrf},
                           json={"action": "release", "amount": "8.5", "reason": "Hold cancelled"})
    assert released.status_code == 200
    assert Decimal(client.get("/api/stock").json()[0]["quantity"]) == Decimal("10.5")
    with main.database() as db:
        assert db.execute("SELECT count(*) FROM inventory_events WHERE lot_id = ?", (lot_id,)).fetchone()[0] == 2


def test_supplier_document_is_private_and_type_checked(client, tmp_path, monkeypatch):
    monkeypatch.setattr(main, "FILE_PATH", tmp_path / "uploads")
    offer = client.post("/api/inquiries", headers={"Idempotency-Key": "offer-document"}, json={
        "kind": "sell", "company_name": "Supplier Co", "contact_name": "Supplier Person",
        "email": "person@example.test", "product_text": "Base oil", "quantity": 4,
        "unit": "MT", "privacy_accepted": True,
    }).json()
    path = f"/api/inquiries/{offer['reference']}/documents"
    headers = {"X-Upload-Token": offer["upload_token"], "X-Filename": "COA.pdf"}
    assert client.post(path, headers=headers, content=b"not a pdf").status_code == 415
    uploaded = client.post(path, headers=headers, content=b"%PDF-1.4\nexample")
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]
    assert client.get(f"/api/admin/documents/{document_id}").status_code == 401
    sign_in(client, "sales@example.test")
    assert client.get(f"/api/admin/documents/{document_id}").status_code == 403
    sign_in(client, "procurement@example.test")
    downloaded = client.get(f"/api/admin/documents/{document_id}")
    assert downloaded.status_code == 200
    assert downloaded.content == b"%PDF-1.4\nexample"


def test_notification_failure_does_not_erase_inquiry(client, monkeypatch):
    product_id = add_product(client)
    response = client.post("/api/inquiries", headers={"Idempotency-Key": "mail-failure"}, json={
        "kind": "buy", "company_name": "Buyer Co", "contact_name": "Buyer Three",
        "email": "buyer3@example.test", "product_id": product_id, "quantity": 2,
        "unit": "MT", "destination_country": "UAE", "privacy_accepted": True,
    })
    assert response.status_code == 201
    for name in ("OIL_SMTP_HOST", "OIL_SMTP_USER", "OIL_SMTP_PASSWORD", "OIL_MAIL_FROM",
                 "OIL_SALES_EMAIL", "OIL_PROCUREMENT_EMAIL"):
        monkeypatch.setenv(name, "configured@example.test")
    def fail(_message):
        raise OSError("mail transport unavailable")
    monkeypatch.setattr(outbox, "send", fail)
    assert outbox.process_once() == {"sent": 0, "failed": 2}
    with main.database() as db:
        assert db.execute("SELECT count(*) FROM inquiries").fetchone()[0] == 1
        assert db.execute("SELECT count(*) FROM outbox WHERE status = 'failed'").fetchone()[0] == 2


def test_procurement_stage_and_task_follow_up(client):
    offer = client.post("/api/inquiries", headers={"Idempotency-Key": "offer-task"}, json={
        "kind": "sell", "company_name": "Supplier Co", "contact_name": "Supplier Person",
        "email": "supplier-task@example.test", "product_text": "Process oil", "quantity": 5,
        "unit": "MT", "privacy_accepted": True,
    })
    assert offer.status_code == 201
    with main.database() as db:
        inquiry_id = db.execute("SELECT id FROM inquiries").fetchone()[0]
    csrf = sign_in(client, "procurement@example.test")
    headers = {"X-CSRF-Token": csrf}
    follow_up = f"/api/admin/inquiries/{inquiry_id}/follow-up"
    assert client.post(follow_up, headers=headers, json={"status": "quotation_sent"}).status_code == 422
    assert client.post(follow_up, headers=headers, json={"status": "technical_review"}).status_code == 200
    task = client.post(f"/api/admin/inquiries/{inquiry_id}/tasks", headers=headers,
                       json={"title": "Review certificate", "due_date": "2026-11-01", "priority": "high"})
    assert task.status_code == 201, task.text
    detail = client.get(f"/api/admin/inquiries/{inquiry_id}").json()
    assert detail["status"] == "technical_review"
    assert detail["tasks"][0]["title"] == "Review certificate"
    completed = client.post(f"/api/admin/inquiries/{inquiry_id}/tasks/{task.json()['id']}/complete", headers=headers)
    assert completed.status_code == 200
    assert client.get(f"/api/admin/inquiries/{inquiry_id}").json()["tasks"][0]["status"] == "completed"
