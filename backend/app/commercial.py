"""Versioned quotations and proformas. Issued revisions are immutable snapshots."""

from __future__ import annotations

import io
import json
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP, localcontext
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

from backend.app.main import database, mutation_staff, scoped_inquiry, staff_user, utc_now


router = APIRouter(prefix="/api/admin", tags=["commercial"])
CENT = Decimal("0.01")


class QuoteItemInput(BaseModel):
    description: str = Field(min_length=2, max_length=500)
    quantity: Decimal = Field(gt=0, max_digits=18, decimal_places=6)
    unit: Literal["MT", "KG", "Litre", "Barrel", "Drum", "IBC"]
    unit_price: Decimal = Field(ge=0, max_digits=18, decimal_places=4)

    @field_validator("description", mode="before")
    @classmethod
    def clean_description(cls, value):
        return value.strip() if isinstance(value, str) else value


class QuoteInput(BaseModel):
    items: list[QuoteItemInput] = Field(min_length=1, max_length=50)
    currency: Literal["USD", "EUR", "GBP", "AED", "CNY", "TRY"]
    incoterm: str = Field(min_length=3, max_length=20)
    named_place: str = Field(min_length=2, max_length=160)
    payment_terms: str = Field(min_length=3, max_length=500)
    delivery_terms: str = Field(min_length=3, max_length=500)
    validity_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    notes: str = Field(default="", max_length=2000)
    origin: str = Field(default="", max_length=80)
    packing: str = Field(default="", max_length=160)
    loading_port: str = Field(default="", max_length=160)
    destination: str = Field(default="", max_length=160)
    terms: str = Field(default="", max_length=4000)

    @field_validator("incoterm", "named_place", "payment_terms", "delivery_terms", mode="before")
    @classmethod
    def clean_terms(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("validity_date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Validity must be a real date") from None
        return value


class NewQuoteInput(QuoteInput):
    inquiry_id: str


class DecisionInput(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)
    version: int = Field(ge=1)


def sales_only(user: dict) -> None:
    if user["role"] not in {"admin", "sales"}:
        raise HTTPException(403, "Sales access required")


def quote_row(db: sqlite3.Connection, quote_id: str) -> sqlite3.Row:
    row = db.execute("SELECT q.*, c.name AS company_name, i.reference AS inquiry_reference "
                     "FROM quotes q JOIN companies c ON c.id = q.company_id "
                     "JOIN inquiries i ON i.id = q.inquiry_id WHERE q.id = ?", (quote_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Quote not found")
    return row


def ensure_not_held(db: sqlite3.Connection, company_id: str) -> None:
    review = db.execute("SELECT status, hold FROM company_compliance WHERE company_id = ?",
                        (company_id,)).fetchone()
    if review and (review["hold"] or review["status"] in {"rejected", "escalated"}):
        raise HTTPException(409, "Commercial action is on hold for this company")


def revision_data(db: sqlite3.Connection, quote_id: str, version: int) -> dict:
    revision = db.execute("SELECT * FROM quote_revisions WHERE quote_id = ? AND version = ?",
                          (quote_id, version)).fetchone()
    if revision is None:
        raise HTTPException(404, "Quote revision not found")
    items = db.execute("SELECT description, quantity, unit, unit_price, line_total FROM quote_items "
                       "WHERE revision_id = ? ORDER BY rowid", (revision["id"],)).fetchall()
    return {**dict(revision), "items": [dict(item) for item in items]}


def computed_items(body: QuoteInput, revision_id: str) -> tuple[Decimal, list[tuple]]:
    with localcontext() as context:
        context.prec = 50
        total = Decimal("0")
        computed = []
        for item in body.items:
            quantity = item.quantity
            price = item.unit_price.quantize(CENT, rounding=ROUND_HALF_UP)
            line_total = (quantity * price).quantize(CENT, rounding=ROUND_HALF_UP)
            total += line_total
            computed.append((str(uuid.uuid4()), revision_id, item.description.strip(), str(quantity),
                             item.unit, str(price), str(line_total)))
        return total.quantize(CENT), computed


def insert_revision(db: sqlite3.Connection, quote_id: str, version: int, body: QuoteInput) -> dict:
    revision_id = str(uuid.uuid4())
    total, computed = computed_items(body, revision_id)
    db.execute("INSERT INTO quote_revisions (id, quote_id, version, state, currency, incoterm, named_place, payment_terms, "
               "delivery_terms, validity_date, notes, total, issued_at, accepted_at, created_at, customer_name) "
               "VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)",
               (revision_id, quote_id, version, body.currency, body.incoterm.strip().upper(),
                body.named_place.strip(), body.payment_terms.strip(), body.delivery_terms.strip(),
                body.validity_date, body.notes.strip(), str(total), utc_now(), quote_row(db, quote_id)["company_name"]))
    db.executemany("INSERT INTO quote_items VALUES (?, ?, ?, ?, ?, ?, ?)", computed)
    db.execute("UPDATE quote_revisions SET origin = ?, packing = ?, loading_port = ?, destination = ?, terms = ? WHERE id = ?",
               (body.origin, body.packing, body.loading_port, body.destination, body.terms, revision_id))
    return {"id": revision_id, "version": version, "total": str(total)}


def commercial_event(db: sqlite3.Connection, quote_id: str, revision_id: str | None,
                     user: dict, action: str, detail: str = "") -> None:
    db.execute("INSERT INTO commercial_events VALUES (?, ?, ?, 'staff', ?, ?, ?, ?)",
               (str(uuid.uuid4()), quote_id, revision_id, user["id"], action, detail, utc_now()))


@router.post("/quotes", status_code=201)
def create_quote(body: NewQuoteInput, user: dict = Depends(mutation_staff)):
    sales_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        inquiry = scoped_inquiry(db, body.inquiry_id, user)
        if inquiry["kind"] != "buy":
            raise HTTPException(422, "A quotation requires a buy request")
        quote_id = str(uuid.uuid4())
        reference = f"Q-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(4).upper()}"
        db.execute("INSERT INTO quotes VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)",
                   (quote_id, reference, body.inquiry_id, inquiry["company_id"], user["id"], utc_now()))
        revision = insert_revision(db, quote_id, 1, body)
        commercial_event(db, quote_id, revision["id"], user, "quote_created")
        db.commit()
    return {"id": quote_id, "reference": reference, "revision_id": revision["id"],
            "version": revision["version"], "total": revision["total"]}


@router.get("/quotes")
def list_quotes(user: dict = Depends(staff_user)):
    sales_only(user)
    with database() as db:
        rows = db.execute("SELECT q.id, q.reference, CASE WHEN q.status IN ('issued','sent') AND r.validity_date < date('now') "
                          "THEN 'expired' ELSE q.status END AS status, q.current_version, q.created_at, "
                          "c.name AS company_name FROM quotes q JOIN companies c ON c.id = q.company_id "
                          "JOIN quote_revisions r ON r.quote_id = q.id AND r.version = q.current_version "
                          "ORDER BY q.created_at DESC LIMIT 100").fetchall()
    return [dict(row) for row in rows]


@router.get("/quotes/{quote_id}")
def get_quote(quote_id: str, user: dict = Depends(staff_user)):
    sales_only(user)
    with database() as db:
        quote = quote_row(db, quote_id)
        versions = db.execute("SELECT version FROM quote_revisions WHERE quote_id = ? ORDER BY version",
                              (quote_id,)).fetchall()
        events = db.execute("SELECT actor_type, action, detail, created_at FROM commercial_events "
                            "WHERE quote_id = ? ORDER BY created_at", (quote_id,)).fetchall()
        revisions = [revision_data(db, quote_id, row["version"]) for row in versions]
        delivery = db.execute("SELECT status, attempts, sent_at FROM outbox WHERE quote_revision_id = ?",
                              (revisions[-1]["id"],)).fetchone()
    status = "expired" if quote["status"] in {"issued", "sent"} and revisions[-1]["validity_date"] < datetime.now(timezone.utc).strftime("%Y-%m-%d") else quote["status"]
    return {**dict(quote), "status": status, "revisions": revisions, "events": [dict(row) for row in events],
            "email_delivery": dict(delivery) if delivery else None}


@router.put("/quotes/{quote_id}/draft")
def replace_draft(quote_id: str, body: QuoteInput, user: dict = Depends(mutation_staff)):
    sales_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        quote = quote_row(db, quote_id)
        ensure_not_held(db, quote["company_id"])
        current = revision_data(db, quote_id, quote["current_version"])
        if current["state"] != "draft" or quote["status"] != "draft":
            raise HTTPException(409, "Issued revisions cannot be edited")
        total, items = computed_items(body, current["id"])
        db.execute("DELETE FROM quote_items WHERE revision_id = ?", (current["id"],))
        db.execute("UPDATE quote_revisions SET currency = ?, incoterm = ?, named_place = ?, payment_terms = ?, "
                   "delivery_terms = ?, validity_date = ?, notes = ?, total = ? WHERE id = ? AND state = 'draft'",
                   (body.currency, body.incoterm.strip().upper(), body.named_place.strip(), body.payment_terms.strip(),
                    body.delivery_terms.strip(), body.validity_date, body.notes.strip(), str(total), current["id"]))
        db.executemany("INSERT INTO quote_items VALUES (?, ?, ?, ?, ?, ?, ?)", items)
        db.execute("UPDATE quote_revisions SET origin = ?, packing = ?, loading_port = ?, destination = ?, terms = ? WHERE id = ?",
                   (body.origin, body.packing, body.loading_port, body.destination, body.terms, current["id"]))
        commercial_event(db, quote_id, current["id"], user, "draft_updated")
        db.commit()
    return {"id": current["id"], "version": current["version"], "total": str(total)}


@router.post("/quotes/{quote_id}/issue")
def issue_quote(quote_id: str, user: dict = Depends(mutation_staff)):
    sales_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        quote = quote_row(db, quote_id)
        ensure_not_held(db, quote["company_id"])
        current = revision_data(db, quote_id, quote["current_version"])
        if current["state"] != "draft" or quote["status"] != "draft":
            raise HTTPException(409, "Only a draft can be issued")
        if current["validity_date"] < datetime.now(timezone.utc).strftime("%Y-%m-%d"):
            raise HTTPException(409, "Cannot issue an expired quotation")
        source = db.execute("SELECT COALESCE(NULLIF(i.product_text, ''), p.name, '') AS product, p.grade, "
                            "i.quantity AS requested_quantity, i.unit AS requested_unit, i.destination_country, "
                            "l.origin AS lot_origin, l.packing AS lot_packing FROM inquiries i "
                            "LEFT JOIN products p ON p.id = i.product_id LEFT JOIN inventory_lots l ON l.id = i.lot_id "
                            "WHERE i.id = ?", (quote["inquiry_id"],)).fetchone()
        contact = db.execute("SELECT t.name, t.email FROM inquiries i JOIN contacts t ON t.id = i.contact_id WHERE i.id = ?",
                             (quote["inquiry_id"],)).fetchone()
        db.execute("UPDATE quote_revisions SET state = 'issued', issued_at = ?, customer_name = ?, source_context_json = ?, "
                   "contact_name = ?, contact_email = ? WHERE id = ?",
                   (utc_now(), quote["company_name"], json.dumps(dict(source)), contact["name"], contact["email"], current["id"]))
        db.execute("UPDATE quotes SET status = 'issued' WHERE id = ?", (quote_id,))
        commercial_event(db, quote_id, current["id"], user, "revision_issued")
        db.commit()
    return {"status": "issued", "version": current["version"]}


@router.post("/quotes/{quote_id}/send")
def queue_quote_email(quote_id: str, user: dict = Depends(mutation_staff)):
    sales_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        quote = quote_row(db, quote_id)
        ensure_not_held(db, quote["company_id"])
        current = revision_data(db, quote_id, quote["current_version"])
        if current["state"] != "issued" or quote["status"] not in {"issued", "sent"}:
            raise HTTPException(409, "Issue the current revision before sending")
        if current["validity_date"] < datetime.now(timezone.utc).strftime("%Y-%m-%d"):
            raise HTTPException(409, "Cannot send an expired quotation")
        prior = db.execute("SELECT status FROM outbox WHERE quote_revision_id = ?", (current["id"],)).fetchone()
        if prior:
            if prior["status"] in {"failed", "cancelled"}:
                db.execute("UPDATE outbox SET status = 'queued', attempts = 0, last_error = '' WHERE quote_revision_id = ?",
                           (current["id"],))
                commercial_event(db, quote_id, current["id"], user, "quote_email_requeued")
                db.commit()
                return {"delivery_status": "queued"}
            db.commit()
            return {"delivery_status": prior["status"]}
        db.execute("INSERT INTO outbox (id, inquiry_id, kind, status, quote_revision_id, created_at) "
                   "VALUES (?, ?, 'quote', 'queued', ?, ?)",
                   (str(uuid.uuid4()), quote["inquiry_id"], current["id"], utc_now()))
        commercial_event(db, quote_id, current["id"], user, "quote_email_queued")
        db.commit()
    return {"delivery_status": "queued"}


@router.post("/quotes/{quote_id}/revisions", status_code=201)
def new_revision(quote_id: str, body: QuoteInput, user: dict = Depends(mutation_staff)):
    sales_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        quote = quote_row(db, quote_id)
        ensure_not_held(db, quote["company_id"])
        current = revision_data(db, quote_id, quote["current_version"])
        if current["state"] != "issued" or quote["status"] in {"accepted", "cancelled"}:
            raise HTTPException(409, "Issue the current draft before revising")
        version = quote["current_version"] + 1
        revision = insert_revision(db, quote_id, version, body)
        db.execute("UPDATE quotes SET current_version = ?, status = 'draft' WHERE id = ?", (version, quote_id))
        commercial_event(db, quote_id, revision["id"], user, "revision_created")
        db.commit()
    return revision


@router.post("/quotes/{quote_id}/duplicate", status_code=201)
def duplicate_quote(quote_id: str, user: dict = Depends(mutation_staff)):
    sales_only(user)
    with database() as db:
        quote = quote_row(db, quote_id)
        current = revision_data(db, quote_id, quote["current_version"])
    return create_quote(NewQuoteInput.model_validate({**current, "inquiry_id": quote["inquiry_id"]}), user)


@router.post("/quotes/{quote_id}/decision")
def close_quote(quote_id: str, body: DecisionInput, outcome: Literal["rejected", "cancelled"],
                user: dict = Depends(mutation_staff)):
    sales_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        quote = quote_row(db, quote_id)
        if quote["status"] in {"accepted", "cancelled", "rejected"} or body.version != quote["current_version"]:
            raise HTTPException(409, "Decision requires the current open quotation")
        revision = revision_data(db, quote_id, body.version)
        db.execute("UPDATE quotes SET status = ? WHERE id = ?", (outcome, quote_id))
        db.execute("UPDATE outbox SET status = 'cancelled' WHERE quote_revision_id = ? AND status IN ('queued','failed')",
                   (revision["id"],))
        commercial_event(db, quote_id, revision["id"], user, f"quote_{outcome}", body.reason)
        db.commit()
    return {"status": outcome}


def accept_revision(db: sqlite3.Connection, quote_id: str, version: int, actor_type: str,
                    actor_id: str, detail: str) -> None:
    quote = quote_row(db, quote_id)
    ensure_not_held(db, quote["company_id"])
    revision = revision_data(db, quote_id, version)
    if revision["state"] != "issued" or version != quote["current_version"] or quote["status"] not in {"issued", "sent"}:
        raise HTTPException(409, "Only the current issued revision can be accepted")
    if revision["validity_date"] < datetime.now(timezone.utc).strftime("%Y-%m-%d"):
        raise HTTPException(409, "Quotation has expired")
    db.execute("UPDATE quote_revisions SET accepted_at = ? WHERE id = ?", (utc_now(), revision["id"]))
    db.execute("UPDATE quotes SET status = 'accepted' WHERE id = ?", (quote_id,))
    db.execute("INSERT INTO commercial_events VALUES (?, ?, ?, ?, ?, 'quote_accepted', ?, ?)",
               (str(uuid.uuid4()), quote_id, revision["id"], actor_type, actor_id, detail, utc_now()))


@router.post("/quotes/{quote_id}/accept")
def staff_accept_quote(quote_id: str, body: DecisionInput, user: dict = Depends(mutation_staff)):
    sales_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        accept_revision(db, quote_id, body.version, "staff", user["id"], body.reason)
        db.commit()
    return {"status": "accepted"}


@router.post("/quotes/{quote_id}/proforma", status_code=201)
def create_proforma(quote_id: str, user: dict = Depends(mutation_staff)):
    sales_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        quote = quote_row(db, quote_id)
        ensure_not_held(db, quote["company_id"])
        if quote["status"] != "accepted":
            raise HTTPException(409, "An accepted quotation is required")
        revision = revision_data(db, quote_id, quote["current_version"])
        prior = db.execute("SELECT id, reference FROM proformas WHERE quote_revision_id = ?", (revision["id"],)).fetchone()
        if prior:
            db.commit()
            return dict(prior)
        proforma_id = str(uuid.uuid4())
        reference = f"PI-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(4).upper()}"
        db.execute("INSERT INTO proformas VALUES (?, ?, ?, ?, ?)",
                   (proforma_id, reference, revision["id"], user["id"], utc_now()))
        commercial_event(db, quote_id, revision["id"], user, "proforma_created")
        db.commit()
    return {"id": proforma_id, "reference": reference}


def render_pdf(title: str, reference: str, company: str, revision: dict) -> bytes:
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=(595, 842))
    pdf.setTitle(f"{title} {reference}")
    y = 790
    def line(text: str, size: int = 10, bold: bool = False):
        nonlocal y
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        for part in simpleSplit(text, "Helvetica", size, 500):
            if y < 55:
                pdf.showPage()
                y = 790
                pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
            pdf.drawString(48, y, part)
            y -= size + 7
    line(title.upper(), 20, True)
    line(f"Reference: {reference}", 11)
    line(f"Customer: {revision.get('customer_name') or company}", 11)
    if revision.get("contact_name"):
        line(f"Contact: {revision['contact_name']} | {revision.get('contact_email', '')}")
    line(f"Revision: {revision['version']}  |  Currency: {revision['currency']}  |  Total: {revision['total']}", 11, True)
    y -= 12
    for item in revision["items"]:
        line(f"{item['description']} | {item['quantity']} {item['unit']} x {item['unit_price']} = {item['line_total']}")
    y -= 12
    line(f"Delivery: {revision['incoterm']} {revision['named_place']}")
    line(f"Delivery terms: {revision['delivery_terms']}")
    for key, label in (("origin", "Origin"), ("packing", "Packing"), ("loading_port", "Loading port"), ("destination", "Destination")):
        if revision.get(key):
            line(f"{label}: {revision[key]}")
    line(f"Payment terms: {revision['payment_terms']}")
    line(f"Valid until: {revision['validity_date']}")
    source = json.loads(revision.get("source_context_json", "{}"))
    if source.get("product"):
        line(f"RFQ product: {source['product']} | Destination: {source.get('destination_country', '')}")
    if source.get("lot_origin") or source.get("lot_packing"):
        line(f"Referenced lot origin: {source.get('lot_origin') or ''} | Packing: {source.get('lot_packing') or ''}")
    if revision["notes"]:
        line(f"Notes: {revision['notes']}")
    if revision.get("terms"):
        line(f"Terms: {revision['terms']}")
    line("Commercial terms subject to authorized confirmation.", 9)
    pdf.save()
    return output.getvalue()


@router.get("/quotes/{quote_id}/revisions/{version}/pdf")
def quote_pdf(quote_id: str, version: int, user: dict = Depends(staff_user)):
    sales_only(user)
    with database() as db:
        quote = quote_row(db, quote_id)
        revision = revision_data(db, quote_id, version)
    title = "Draft quotation" if revision["state"] == "draft" else "Quotation"
    data = render_pdf(title, f"{quote['reference']} v{version}", quote["company_name"], revision)
    return Response(data, media_type="application/pdf", headers={"Cache-Control": "private, no-store",
                    "Content-Disposition": f"attachment; filename={quote['reference']}-v{version}.pdf"})


@router.get("/proformas/{proforma_id}/pdf")
def proforma_pdf(proforma_id: str, user: dict = Depends(staff_user)):
    sales_only(user)
    with database() as db:
        row = db.execute("SELECT p.reference, r.quote_id, r.version FROM proformas p "
                         "JOIN quote_revisions r ON r.id = p.quote_revision_id WHERE p.id = ?", (proforma_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Proforma not found")
        quote = quote_row(db, row["quote_id"])
        revision = revision_data(db, row["quote_id"], row["version"])
    data = render_pdf("Proforma invoice", row["reference"], quote["company_name"], revision)
    return Response(data, media_type="application/pdf", headers={"Cache-Control": "private, no-store",
                    "Content-Disposition": f"attachment; filename={row['reference']}.pdf"})
