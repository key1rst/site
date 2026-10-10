"""Company-scoped portal access with staff-approved identity linking."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.app.commercial import accept_revision, quote_row, render_pdf, revision_data
from backend.app.main import (InquiryInput, MessageInput, check_origin, create_inquiry, database, enforce_rate_limit, mutation_staff, password_hash,
                              password_matches, staff_user, utc_now)


router = APIRouter(tags=["portal"])
PORTAL_HOURS = 8


class VerificationInput(BaseModel):
    status: Literal["pending", "approved", "rejected", "escalated"]
    reason: str = Field(min_length=5, max_length=1000)


@router.get("/api/admin/companies")
def list_companies(user: dict = Depends(staff_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    with database() as db:
        rows = db.execute("SELECT c.id, c.name, c.verification_status, c.created_at, "
                          "COALESCE(v.status, 'not_reviewed') AS compliance_status, COALESCE(v.hold, 0) AS commercial_hold, "
                          "t.id AS contact_id, t.email AS contact_email FROM companies c "
                          "LEFT JOIN company_compliance v ON v.company_id = c.id "
                          "LEFT JOIN contacts t ON t.company_id = c.id ORDER BY c.created_at DESC LIMIT 100").fetchall()
    return [dict(row) for row in rows]


@router.post("/api/admin/companies/{company_id}/verification")
def verify_company(company_id: str, body: VerificationInput, user: dict = Depends(mutation_staff)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        company = db.execute("SELECT verification_status FROM companies WHERE id = ?", (company_id,)).fetchone()
        if company is None:
            raise HTTPException(404, "Company not found")
        db.execute("UPDATE companies SET verification_status = ? WHERE id = ?", (body.status, company_id))
        db.execute("INSERT INTO verification_events VALUES (?, ?, ?, ?, ?, ?, ?)",
                   (str(uuid.uuid4()), company_id, user["id"], company["verification_status"],
                    body.status, body.reason.strip(), utc_now()))
        if body.status != "approved":
            from backend.app.shipments import hide_for_verification
            hide_for_verification(db, company_id, user, body.reason.strip())
            db.execute("DELETE FROM portal_sessions WHERE user_id IN (SELECT id FROM portal_users WHERE company_id = ?)",
                       (company_id,))
        db.commit()
    return {"status": body.status}


@router.get("/api/admin/companies/{company_id}/history")
def company_history(company_id: str, user: dict = Depends(staff_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    with database() as db:
        if not db.execute("SELECT id FROM companies WHERE id = ?", (company_id,)).fetchone():
            raise HTTPException(404, "Company not found")
        verification = db.execute("SELECT e.old_status, e.new_status, e.reason, e.created_at, s.email AS actor "
                                  "FROM verification_events e JOIN staff s ON s.id = e.staff_id WHERE e.company_id = ? "
                                  "ORDER BY e.created_at DESC LIMIT 100", (company_id,)).fetchall()
        compliance = db.execute("SELECT e.old_status, e.new_status, e.old_hold, e.new_hold, e.reason, e.created_at, s.email AS actor "
                                "FROM compliance_events e JOIN staff s ON s.id = e.staff_id WHERE e.company_id = ? "
                                "ORDER BY e.created_at DESC LIMIT 100", (company_id,)).fetchall()
        access = db.execute("SELECT actor_type, action, detail, created_at FROM access_events WHERE company_id = ? "
                            "ORDER BY created_at DESC LIMIT 100", (company_id,)).fetchall()
    return {"verification": [dict(row) for row in verification], "compliance": [dict(row) for row in compliance],
            "access": [dict(row) for row in access]}


class ComplianceInput(BaseModel):
    registration_information: str = Field(default="", max_length=500)
    buyer_country: str = Field(default="", max_length=80)
    supplier_country: str = Field(default="", max_length=80)
    product_origin: str = Field(default="", max_length=80)
    destination_country: str = Field(default="", max_length=80)
    status: Literal["not_reviewed", "pending", "approved", "rejected", "escalated"]
    hold: bool = False
    review_notes: str = Field(default="", max_length=2000)
    reason: str = Field(min_length=5, max_length=1000)


@router.get("/api/admin/companies/{company_id}/compliance")
def get_compliance(company_id: str, user: dict = Depends(staff_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    with database() as db:
        if not db.execute("SELECT id FROM companies WHERE id = ?", (company_id,)).fetchone():
            raise HTTPException(404, "Company not found")
        row = db.execute("SELECT * FROM company_compliance WHERE company_id = ?", (company_id,)).fetchone()
    return dict(row) if row else {"company_id": company_id, "status": "not_reviewed", "hold": False,
                                  "registration_information": "", "buyer_country": "", "supplier_country": "",
                                  "product_origin": "", "destination_country": "", "review_notes": ""}


@router.put("/api/admin/companies/{company_id}/compliance")
def save_compliance(company_id: str, body: ComplianceInput, user: dict = Depends(mutation_staff)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        if not db.execute("SELECT id FROM companies WHERE id = ?", (company_id,)).fetchone():
            raise HTTPException(404, "Company not found")
        prior = db.execute("SELECT status, hold FROM company_compliance WHERE company_id = ?", (company_id,)).fetchone()
        old_status, old_hold = (prior["status"], prior["hold"]) if prior else ("not_reviewed", 0)
        db.execute("INSERT INTO company_compliance VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                   "ON CONFLICT(company_id) DO UPDATE SET registration_information = excluded.registration_information, "
                   "buyer_country = excluded.buyer_country, supplier_country = excluded.supplier_country, "
                   "product_origin = excluded.product_origin, destination_country = excluded.destination_country, "
                   "status = excluded.status, hold = excluded.hold, review_notes = excluded.review_notes, "
                   "updated_by = excluded.updated_by, updated_at = excluded.updated_at",
                   (company_id, body.registration_information, body.buyer_country, body.supplier_country,
                    body.product_origin, body.destination_country, body.status, int(body.hold),
                    body.review_notes, user["id"], utc_now()))
        db.execute("INSERT INTO compliance_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (str(uuid.uuid4()), company_id, user["id"], old_status, body.status, old_hold,
                    int(body.hold), body.reason, utc_now()))
        db.commit()
    return {"status": body.status, "hold": body.hold}


class InviteInput(BaseModel):
    company_id: str
    contact_id: str
    role: Literal["customer", "supplier"]


@router.post("/api/admin/portal-invites", status_code=201)
def create_invite(body: InviteInput, user: dict = Depends(mutation_staff)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        company = db.execute("SELECT verification_status FROM companies WHERE id = ?", (body.company_id,)).fetchone()
        if company is None or company["verification_status"] != "approved":
            raise HTTPException(409, "Company must be verified before portal access")
        contact = db.execute("SELECT email FROM contacts WHERE id = ? AND company_id = ?",
                             (body.contact_id, body.company_id)).fetchone()
        if contact is None:
            raise HTTPException(422, "Contact does not belong to company")
        existing = db.execute("SELECT id FROM portal_users WHERE email = ?", (contact["email"],)).fetchone()
        if existing:
            raise HTTPException(409, "A portal account already exists for this email")
        invite_id = str(uuid.uuid4())
        token = secrets.token_urlsafe(32)
        expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        db.execute("INSERT INTO portal_invites VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
                   (invite_id, body.company_id, body.contact_id, contact["email"], body.role,
                    hashlib.sha256(token.encode()).hexdigest(), expires, user["id"], utc_now()))
        access_event(db, body.company_id, "staff", user["id"], "invite_created", contact["email"])
        db.commit()
    return {"invite_id": invite_id, "email": contact["email"], "token": token, "expires_at": expires}


class ActivateInput(BaseModel):
    token: str = Field(min_length=32, max_length=200)
    password: str = Field(min_length=14, max_length=200)


@router.post("/api/portal/activate")
def activate(body: ActivateInput, request: Request):
    check_origin(request)
    enforce_rate_limit("portal_activate", request.client.host, 10, 60 * 60)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        invite = db.execute("SELECT i.*, c.verification_status FROM portal_invites i "
                            "JOIN companies c ON c.id = i.company_id WHERE i.token_hash = ?",
                            (hashlib.sha256(body.token.encode()).hexdigest(),)).fetchone()
        if invite is None or invite["used_at"] or invite["expires_at"] <= utc_now() or invite["verification_status"] != "approved":
            raise HTTPException(403, "Invite invalid or expired")
        user_id = str(uuid.uuid4())
        try:
            db.execute("INSERT INTO portal_users VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
                       (user_id, invite["company_id"], invite["contact_id"], invite["email"],
                        password_hash(body.password), invite["role"], utc_now()))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Portal account already activated") from None
        db.execute("UPDATE portal_invites SET used_at = ? WHERE id = ?", (utc_now(), invite["id"]))
        access_event(db, invite["company_id"], "portal", user_id, "account_activated", invite["email"])
        db.commit()
    return {"email": invite["email"], "role": invite["role"]}


def access_event(db, company_id: str, actor_type: str, actor_id: str, action: str, detail: str):
    db.execute("INSERT INTO access_events VALUES (?, ?, ?, ?, ?, ?, ?)",
               (str(uuid.uuid4()), company_id, actor_type, actor_id, action, detail, utc_now()))


class ResetIssueInput(BaseModel):
    contact_id: str
    reason: str = Field(min_length=5, max_length=1000)


@router.post("/api/admin/companies/{company_id}/password-reset", status_code=201)
def issue_password_reset(company_id: str, body: ResetIssueInput, user: dict = Depends(mutation_staff)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        account = db.execute("SELECT p.id, p.email FROM portal_users p JOIN companies c ON c.id = p.company_id "
                             "WHERE p.company_id = ? AND p.contact_id = ? AND p.active = 1 "
                             "AND c.verification_status = 'approved'", (company_id, body.contact_id)).fetchone()
        if not account:
            raise HTTPException(404, "Active verified portal account not found")
        token = secrets.token_urlsafe(32)
        expires = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        db.execute("UPDATE portal_password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
                   (utc_now(), account["id"]))
        db.execute("INSERT INTO portal_password_resets VALUES (?, ?, ?, NULL, ?, ?)",
                   (hashlib.sha256(token.encode()).hexdigest(), account["id"], expires, user["id"], utc_now()))
        access_event(db, company_id, "staff", user["id"], "password_reset_issued", body.reason)
        db.commit()
    return {"email": account["email"], "token": token, "expires_at": expires}


@router.post("/api/portal/password-reset")
def reset_password(body: ActivateInput, request: Request):
    check_origin(request)
    enforce_rate_limit("portal_reset", request.client.host, 10, 60 * 60)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        reset = db.execute("SELECT r.*, p.company_id FROM portal_password_resets r JOIN portal_users p ON p.id = r.user_id "
                           "JOIN companies c ON c.id = p.company_id WHERE r.token_hash = ? "
                           "AND r.used_at IS NULL AND r.expires_at > ? AND p.active = 1 "
                           "AND c.verification_status = 'approved'",
                           (hashlib.sha256(body.token.encode()).hexdigest(), utc_now())).fetchone()
        if not reset:
            raise HTTPException(403, "Reset token invalid or expired")
        db.execute("UPDATE portal_users SET password_hash = ? WHERE id = ?", (password_hash(body.password), reset["user_id"]))
        db.execute("DELETE FROM portal_sessions WHERE user_id = ?", (reset["user_id"],))
        db.execute("UPDATE portal_password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
                   (utc_now(), reset["user_id"]))
        access_event(db, reset["company_id"], "portal", reset["user_id"], "password_reset_completed", "All prior sessions revoked")
        db.commit()
    return {"ok": True}


class PortalLoginInput(BaseModel):
    email: str = Field(min_length=5, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str


@router.post("/api/portal/login")
def portal_login(body: PortalLoginInput, response: Response, request: Request):
    check_origin(request)
    enforce_rate_limit("portal_login", f"{request.client.host}:{body.email.lower()}", 8, 15 * 60)
    with database() as db:
        row = db.execute("SELECT p.*, c.verification_status, c.name AS company_name FROM portal_users p "
                         "JOIN companies c ON c.id = p.company_id WHERE p.email = ?", (body.email.lower(),)).fetchone()
        if row is None or not row["active"] or row["verification_status"] != "approved" or not password_matches(body.password, row["password_hash"]):
            raise HTTPException(401, "Invalid credentials")
        token = secrets.token_urlsafe(32)
        csrf = secrets.token_urlsafe(24)
        expires = (datetime.now(timezone.utc) + timedelta(hours=PORTAL_HOURS)).isoformat()
        db.execute("INSERT INTO portal_sessions VALUES (?, ?, ?, ?)",
                   (hashlib.sha256(token.encode()).hexdigest(), row["id"], csrf, expires))
    response.set_cookie("oil_portal", token, httponly=True, secure=os.getenv("OIL_COOKIE_SECURE") == "1",
                        samesite="lax", max_age=PORTAL_HOURS * 3600)
    return {"email": row["email"], "company": row["company_name"], "role": row["role"], "csrf_token": csrf}


def portal_user(oil_portal: str | None = Cookie(default=None)) -> dict:
    if not oil_portal:
        raise HTTPException(401, "Portal sign in required")
    with database() as db:
        row = db.execute("SELECT p.id, p.email, p.company_id, p.role, c.name AS company_name, "
                         "s.csrf_token FROM portal_sessions s JOIN portal_users p ON p.id = s.user_id "
                         "JOIN companies c ON c.id = p.company_id WHERE s.token_hash = ? AND s.expires_at > ? "
                         "AND p.active = 1 AND c.verification_status = 'approved'",
                         (hashlib.sha256(oil_portal.encode()).hexdigest(), utc_now())).fetchone()
    if row is None:
        raise HTTPException(401, "Portal session expired")
    return dict(row)


def portal_mutation(request: Request, x_csrf_token: str | None = Header(default=None),
                    user: dict = Depends(portal_user)) -> dict:
    check_origin(request)
    if not x_csrf_token or not hmac.compare_digest(x_csrf_token, user["csrf_token"]):
        raise HTTPException(403, "CSRF token required")
    return user


@router.get("/api/portal/me")
def portal_me(user: dict = Depends(portal_user)):
    return {"email": user["email"], "company": user["company_name"],
            "role": user["role"], "csrf_token": user["csrf_token"]}


@router.get("/api/portal/profile")
def portal_profile(user: dict = Depends(portal_user)):
    with database() as db:
        row = db.execute("SELECT c.name AS company_name, c.verification_status, t.name AS contact_name, p.email, p.role "
                         "FROM portal_users p JOIN contacts t ON t.id = p.contact_id "
                         "JOIN companies c ON c.id = p.company_id WHERE p.id = ?", (user["id"],)).fetchone()
    return dict(row)


class ProfileInput(BaseModel):
    contact_name: str = Field(min_length=2, max_length=160)


@router.put("/api/portal/profile")
def update_portal_profile(body: ProfileInput, user: dict = Depends(portal_mutation)):
    if len(body.contact_name.strip()) < 2:
        raise HTTPException(422, "Contact name is required")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("UPDATE contacts SET name = ? WHERE id = (SELECT contact_id FROM portal_users WHERE id = ?)",
                   (body.contact_name.strip(), user["id"]))
        access_event(db, user["company_id"], "portal", user["id"], "contact_name_updated", body.contact_name.strip())
        db.commit()
    return portal_profile(user)


@router.get("/api/portal/saved-products")
def saved_products(user: dict = Depends(portal_user)):
    if user["role"] != "customer":
        raise HTTPException(403, "Customer access required")
    with database() as db:
        rows = db.execute("SELECT p.id, p.slug, p.name, p.grade, p.category FROM portal_saved_products s "
                          "JOIN products p ON p.id = s.product_id WHERE s.user_id = ? AND p.published = 1 "
                          "ORDER BY s.created_at DESC LIMIT 100", (user["id"],)).fetchall()
    return [dict(row) for row in rows]


@router.put("/api/portal/saved-products/{product_id}")
def save_product(product_id: str, user: dict = Depends(portal_mutation)):
    if user["role"] != "customer":
        raise HTTPException(403, "Customer access required")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        if not db.execute("SELECT id FROM products WHERE id = ? AND published = 1", (product_id,)).fetchone():
            raise HTTPException(404, "Published product not found")
        already_saved = db.execute("SELECT 1 FROM portal_saved_products WHERE user_id = ? AND product_id = ?",
                                   (user["id"], product_id)).fetchone()
        count = db.execute("SELECT count(*) FROM portal_saved_products WHERE user_id = ?", (user["id"],)).fetchone()[0]
        if count >= 100 and not already_saved:
            raise HTTPException(409, "Saved product limit reached")
        db.execute("INSERT OR IGNORE INTO portal_saved_products VALUES (?, ?, ?)", (user["id"], product_id, utc_now()))
        db.commit()
    return {"ok": True}


@router.delete("/api/portal/saved-products/{product_id}")
def remove_saved_product(product_id: str, user: dict = Depends(portal_mutation)):
    if user["role"] != "customer":
        raise HTTPException(403, "Customer access required")
    with database() as db:
        db.execute("DELETE FROM portal_saved_products WHERE user_id = ? AND product_id = ?", (user["id"], product_id))
    return {"ok": True}


@router.post("/api/portal/logout")
def portal_logout(response: Response, oil_portal: str | None = Cookie(default=None),
                  user: dict = Depends(portal_mutation)):
    with database() as db:
        db.execute("DELETE FROM portal_sessions WHERE token_hash = ?",
                   (hashlib.sha256(oil_portal.encode()).hexdigest(),))
    response.delete_cookie("oil_portal")
    return {"ok": True}


@router.get("/api/portal/inquiries")
def portal_inquiries(user: dict = Depends(portal_user)):
    kind = "buy" if user["role"] == "customer" else "sell"
    with database() as db:
        rows = db.execute("SELECT reference, kind, product_text, quantity, unit, destination_country, "
                          "status, created_at FROM inquiries WHERE company_id = ? AND kind = ? "
                          "ORDER BY created_at DESC LIMIT 100", (user["company_id"], kind)).fetchall()
    return [dict(row) for row in rows]


class PortalDraftInput(BaseModel):
    product_text: str = Field(default="", max_length=160)
    quantity: Decimal | None = Field(default=None, gt=0)
    unit: Literal["MT", "KG", "Litre", "Barrel", "Drum", "IBC"] | None = None
    destination_country: str = Field(default="", max_length=80)
    origin: str = Field(default="", max_length=80)
    message: str = Field(default="", max_length=4000)


class DraftSubmitInput(BaseModel):
    privacy_accepted: bool
    updated_at: str = Field(max_length=80)


@router.get("/api/portal/draft")
def portal_draft(user: dict = Depends(portal_user)):
    with database() as db:
        db.execute("DELETE FROM portal_drafts WHERE expires_at <= ?", (utc_now(),))
        row = db.execute("SELECT * FROM portal_drafts WHERE user_id = ?", (user["id"],)).fetchone()
    if row is None:
        return {"payload": PortalDraftInput().model_dump(mode="json"), "expires_at": None,
                "submitted_reference": None, "updated_at": None}
    return {"payload": json.loads(row["payload_json"]), "expires_at": row["expires_at"],
            "submitted_reference": row["submitted_reference"], "updated_at": row["updated_at"]}


@router.put("/api/portal/draft")
def save_portal_draft(body: PortalDraftInput, user: dict = Depends(portal_mutation)):
    payload = body.model_dump_json()
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        current = db.execute("SELECT * FROM portal_drafts WHERE user_id = ?", (user["id"],)).fetchone()
        # Saving an unchanged, unexpired draft keeps its stable submission identity.
        if not current or current["payload_json"] != payload or current["expires_at"] <= utc_now():
            expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            db.execute("INSERT INTO portal_drafts VALUES (?, ?, ?, NULL, ?) ON CONFLICT(user_id) "
                       "DO UPDATE SET payload_json = excluded.payload_json, expires_at = excluded.expires_at, "
                       "submitted_reference = NULL, updated_at = excluded.updated_at",
                       (user["id"], payload, expires, utc_now()))
        db.commit()
    return portal_draft(user)


@router.post("/api/portal/draft/submit", status_code=201)
def submit_portal_draft(body: DraftSubmitInput, request: Request,
                        oil_portal: str | None = Cookie(default=None), user: dict = Depends(portal_mutation)):
    if not body.privacy_accepted:
        raise HTTPException(422, "Accept the privacy policy to submit")
    with database() as db:
        draft = db.execute("SELECT * FROM portal_drafts WHERE user_id = ? AND expires_at > ?",
                           (user["id"], utc_now())).fetchone()
        contact = db.execute("SELECT t.name FROM contacts t JOIN portal_users p ON p.contact_id = t.id "
                             "WHERE p.id = ?", (user["id"],)).fetchone()
    if not draft:
        raise HTTPException(409, "Save a draft before submitting")
    if body.updated_at != draft["updated_at"]:
        raise HTTPException(409, "Draft changed in another tab. Reload and review before submitting")
    if draft["submitted_reference"]:
        return {"reference": draft["submitted_reference"]}
    inquiry = InquiryInput(**json.loads(draft["payload_json"]), kind="buy" if user["role"] == "customer" else "sell",
                           company_name=user["company_name"], contact_name=contact["name"],
                           email=user["email"], privacy_accepted=True)
    # The server-derived key stays stable even if the response or subsequent update is interrupted.
    key = "draft-" + hashlib.sha256(f"{user['id']}:{draft['updated_at']}:{draft['payload_json']}".encode()).hexdigest()
    result = create_inquiry(inquiry, request, key, oil_portal, user["csrf_token"])
    with database() as db:
        db.execute("UPDATE portal_drafts SET submitted_reference = ? WHERE user_id = ? AND updated_at = ?",
                   (result["reference"], user["id"], draft["updated_at"]))
    return result


def own_inquiry(db: sqlite3.Connection, reference: str, user: dict) -> sqlite3.Row:
    kind = "buy" if user["role"] == "customer" else "sell"
    row = db.execute("SELECT id FROM inquiries WHERE reference = ? AND company_id = ? AND kind = ?",
                     (reference, user["company_id"], kind)).fetchone()
    if row is None:
        raise HTTPException(404, "Inquiry not found")
    return row


@router.get("/api/portal/inquiries/{reference}/documents")
def portal_documents(reference: str, user: dict = Depends(portal_user)):
    with database() as db:
        inquiry = own_inquiry(db, reference, user)
        rows = db.execute("SELECT id, filename, bytes, scan_status, created_at FROM documents WHERE inquiry_id = ? "
                          "ORDER BY created_at DESC LIMIT 100", (inquiry["id"],)).fetchall()
    return [dict(row) for row in rows]


@router.get("/api/portal/documents/{document_id}")
def portal_document(document_id: str, user: dict = Depends(portal_user)):
    from backend.app.main import FILE_PATH
    with database() as db:
        row = db.execute("SELECT d.*, i.reference FROM documents d JOIN inquiries i ON i.id = d.inquiry_id "
                         "WHERE d.id = ?", (document_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Document not found")
        own_inquiry(db, row["reference"], user)
    if row["scan_status"] != "clean":
        raise HTTPException(409, "Document is awaiting approved security scanning")
    target = FILE_PATH / row["storage_name"]
    if not target.is_file():
        raise HTTPException(503, "Document temporarily unavailable")
    return FileResponse(target, media_type="application/octet-stream", filename=row["filename"],
                        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.post("/api/portal/inquiries/{reference}/upload-token")
def portal_upload_token(reference: str, user: dict = Depends(portal_mutation)):
    if user["role"] != "supplier":
        raise HTTPException(403, "Supplier access required")
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    with database() as db:
        inquiry = own_inquiry(db, reference, user)
        db.execute("INSERT INTO upload_tokens VALUES (?, ?, ?) ON CONFLICT(inquiry_id) "
                   "DO UPDATE SET token_hash = excluded.token_hash, expires_at = excluded.expires_at",
                   (inquiry["id"], hashlib.sha256(token.encode()).hexdigest(), expires))
    return {"upload_token": token}


@router.get("/api/portal/inquiries/{reference}/messages")
def portal_messages(reference: str, user: dict = Depends(portal_user)):
    with database() as db:
        inquiry = own_inquiry(db, reference, user)
        rows = db.execute("SELECT sender_type, body, created_at FROM portal_messages "
                          "WHERE inquiry_id = ? ORDER BY created_at", (inquiry["id"],)).fetchall()
    return [dict(row) for row in rows]


@router.post("/api/portal/inquiries/{reference}/messages", status_code=201)
def portal_send_message(reference: str, body: MessageInput, user: dict = Depends(portal_mutation)):
    enforce_rate_limit("portal_message", user["id"], 30, 60 * 60)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        inquiry = own_inquiry(db, reference, user)
        message_id = str(uuid.uuid4())
        db.execute("INSERT INTO portal_messages VALUES (?, ?, 'portal', ?, ?, ?)",
                   (message_id, inquiry["id"], user["id"], body.body.strip(), utc_now()))
        db.commit()
    return {"id": message_id}


@router.get("/api/portal/quotes")
def portal_quotes(user: dict = Depends(portal_user)):
    if user["role"] != "customer":
        raise HTTPException(403, "Customer access required")
    with database() as db:
        rows = db.execute("SELECT q.id, q.reference, CASE WHEN q.status IN ('issued','sent') AND r.validity_date < date('now') "
                          "THEN 'expired' ELSE q.status END AS status, r.version, r.currency, r.total, "
                          "r.validity_date, r.issued_at FROM quotes q JOIN quote_revisions r ON r.quote_id = q.id "
                          "WHERE q.company_id = ? AND r.state = 'issued' AND r.version = "
                          "(SELECT max(version) FROM quote_revisions WHERE quote_id = q.id AND state = 'issued') "
                          "ORDER BY r.issued_at DESC LIMIT 100", (user["company_id"],)).fetchall()
    return [dict(row) for row in rows]


def own_quote(db: sqlite3.Connection, quote_id: str, user: dict) -> sqlite3.Row:
    if user["role"] != "customer":
        raise HTTPException(403, "Customer access required")
    quote = quote_row(db, quote_id)
    if quote["company_id"] != user["company_id"]:
        raise HTTPException(404, "Quote not found")
    return quote


@router.get("/api/portal/quotes/{quote_id}")
def portal_quote(quote_id: str, version: int | None = Query(default=None, ge=1), user: dict = Depends(portal_user)):
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        quote = own_quote(db, quote_id, user)
        versions = db.execute("SELECT version FROM quote_revisions WHERE quote_id = ? AND state = 'issued' ORDER BY version",
                              (quote_id,)).fetchall()
        allowed_versions = [row["version"] for row in versions]
        if not allowed_versions or (version is not None and version not in allowed_versions):
            raise HTTPException(404, "No issued quote")
        revision = revision_data(db, quote_id, version or allowed_versions[-1])
        current = revision_data(db, quote_id, quote["current_version"])
        review = db.execute("SELECT hold, status FROM company_compliance WHERE company_id = ?", (user["company_id"],)).fetchone()
        held = bool(review and (review["hold"] or review["status"] in {"rejected", "escalated"}))
        viewed = db.execute("SELECT id FROM commercial_events WHERE revision_id = ? AND actor_id = ? AND action = 'quote_viewed'",
                            (revision["id"], user["id"])).fetchone()
        if not viewed:
            db.execute("INSERT INTO commercial_events VALUES (?, ?, ?, 'portal', ?, 'quote_viewed', '', ?)",
                       (str(uuid.uuid4()), quote_id, revision["id"], user["id"], utc_now()))
        db.commit()
    status = "expired" if quote["status"] in {"issued", "sent"} and current["validity_date"] < datetime.now(timezone.utc).strftime("%Y-%m-%d") else quote["status"]
    return {"id": quote["id"], "reference": quote["reference"], "status": status,
            "company_name": revision["customer_name"], "revision": revision, "versions": allowed_versions,
            "acceptance_available": not held and status in {"issued", "sent"} and revision["version"] == quote["current_version"]}


@router.get("/api/portal/quotes/{quote_id}/pdf")
def portal_quote_pdf(quote_id: str, version: int | None = Query(default=None, ge=1), user: dict = Depends(portal_user)):
    with database() as db:
        quote = own_quote(db, quote_id, user)
        row = db.execute("SELECT max(version) AS version FROM quote_revisions "
                         "WHERE quote_id = ? AND state = 'issued' AND (? IS NULL OR version = ?)", (quote_id, version, version)).fetchone()
        if row["version"] is None:
            raise HTTPException(404, "No issued quote")
        revision = revision_data(db, quote_id, row["version"])
    data = render_pdf("Quotation", f"{quote['reference']} v{row['version']}", quote["company_name"], revision)
    return Response(data, media_type="application/pdf", headers={"Cache-Control": "private, no-store",
                    "Content-Disposition": f"attachment; filename={quote['reference']}-v{row['version']}.pdf"})


class PortalAcceptanceInput(BaseModel):
    version: int = Field(ge=1)


@router.post("/api/portal/quotes/{quote_id}/accept")
def portal_accept(quote_id: str, body: PortalAcceptanceInput, user: dict = Depends(portal_mutation)):
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        quote = own_quote(db, quote_id, user)
        accept_revision(db, quote_id, body.version, "portal", user["id"], "Accepted by verified customer account")
        db.commit()
    return {"status": "accepted"}


class PortalRejectionInput(PortalAcceptanceInput):
    reason: str = Field(min_length=5, max_length=1000)


@router.post("/api/portal/quotes/{quote_id}/reject")
def portal_reject(quote_id: str, body: PortalRejectionInput, user: dict = Depends(portal_mutation)):
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        quote = own_quote(db, quote_id, user)
        revision = revision_data(db, quote_id, body.version)
        if quote["status"] not in {"issued", "sent"} or quote["current_version"] != body.version or revision["state"] != "issued":
            raise HTTPException(409, "Only the current open issued quotation can be rejected")
        db.execute("UPDATE quotes SET status = 'rejected' WHERE id = ?", (quote_id,))
        db.execute("UPDATE outbox SET status = 'cancelled' WHERE quote_revision_id = ? AND status IN ('queued','failed')", (revision["id"],))
        db.execute("INSERT INTO commercial_events VALUES (?, ?, ?, 'portal', ?, 'quote_rejected', ?, ?)",
                   (str(uuid.uuid4()), quote_id, revision["id"], user["id"], body.reason, utc_now()))
        db.commit()
    return {"status": "rejected"}


@router.get("/api/portal/proformas")
def portal_proformas(user: dict = Depends(portal_user)):
    if user["role"] != "customer":
        raise HTTPException(403, "Customer access required")
    with database() as db:
        rows = db.execute("SELECT p.id, p.reference, p.created_at, r.currency, r.total, q.reference AS quote_reference "
                          "FROM proformas p JOIN quote_revisions r ON r.id = p.quote_revision_id "
                          "JOIN quotes q ON q.id = r.quote_id WHERE q.company_id = ? ORDER BY p.created_at DESC LIMIT 100",
                          (user["company_id"],)).fetchall()
    return [dict(row) for row in rows]


@router.get("/api/portal/proformas/{proforma_id}/pdf")
def portal_proforma_pdf(proforma_id: str, user: dict = Depends(portal_user)):
    with database() as db:
        row = db.execute("SELECT p.*, r.quote_id, r.version FROM proformas p JOIN quote_revisions r ON r.id = p.quote_revision_id "
                         "WHERE p.id = ?", (proforma_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Proforma not found")
        quote = own_quote(db, row["quote_id"], user)
        revision = revision_data(db, row["quote_id"], row["version"])
    pdf = render_pdf("Proforma Invoice", row["reference"], quote["company_name"], revision)
    return Response(pdf, media_type="application/pdf", headers={"Cache-Control": "private, no-store",
                    "Content-Disposition": f"attachment; filename={row['reference']}.pdf"})
