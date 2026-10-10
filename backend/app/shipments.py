"""Evidence-based outbound shipment tracking, independent of stock and payment accounting."""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.app.main import database, mutation_staff, scoped_inquiry, staff_user, utc_now
from backend.app.commercial import ensure_not_held, quote_row, revision_data, sales_only
from backend.app.portal import portal_user

router = APIRouter(tags=["shipments"])
ShipmentStatus = Literal["planned", "booked", "dispatched", "in_transit", "exception", "delivered", "cancelled"]
TRANSITIONS = {
    "planned": {"booked", "cancelled"}, "booked": {"dispatched", "cancelled"},
    "dispatched": {"in_transit", "exception", "delivered"}, "in_transit": {"exception", "delivered"},
    "exception": {"in_transit", "delivered"}, "delivered": set(), "cancelled": set(),
}


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ShipmentDetails(StrictInput):
    carrier: str = Field(default="", max_length=160)
    tracking_reference: str = Field(default="", max_length=160)
    origin: str = Field(min_length=2, max_length=160)
    destination: str = Field(min_length=2, max_length=160)
    expected_delivery_date: date | None = None


class NewShipment(ShipmentDetails):
    quote_id: str
    reason: str = Field(min_length=5, max_length=1000)


class UpdateShipment(ShipmentDetails):
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=5, max_length=1000)


class ShipmentEvent(StrictInput):
    expected_version: int = Field(ge=1)
    status: ShipmentStatus
    reason: str = Field(min_length=5, max_length=1000)
    evidence_reference: str = Field(min_length=3, max_length=500)
    customer_note: str = Field(default="", max_length=1000)
    occurred_at: datetime

    @field_validator("occurred_at")
    @classmethod
    def aware_time(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Event time must include its timezone")
        if value > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError("Record actual events, not future status changes")
        return value.astimezone(timezone.utc)


class PublishShipment(StrictInput):
    expected_version: int = Field(ge=1)
    visible: bool
    reason: str = Field(min_length=5, max_length=1000)


def command_key(user, shipment_id, key):
    if not key or len(key) > 100:
        raise HTTPException(400, "Idempotency-Key header required")
    return hashlib.sha256(f"{user['id']}:{shipment_id}:{key}".encode()).hexdigest()


def payload_hash(body):
    return hashlib.sha256(body.model_dump_json().encode()).hexdigest()


def shipment_row(db, shipment_id, user=None):
    row = db.execute("SELECT s.*, q.reference AS quote_reference, q.inquiry_id, c.name AS company_name "
                     "FROM shipments s JOIN quotes q ON q.id = s.quote_id JOIN companies c ON c.id = s.company_id "
                     "WHERE s.id = ?", (shipment_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Shipment not found")
    if user:
        sales_only(user)
        scoped_inquiry(db, row["inquiry_id"], user)
    return row


def shipment_data(db, row):
    data = dict(row)
    data.pop("create_key", None)
    data.pop("payload_hash", None)
    data["allowed_transitions"] = sorted(TRANSITIONS[row["status"]])
    events = db.execute("SELECT action, old_status, new_status, reason, evidence_reference, customer_note, occurred_at, "
                        "recorded_at, version, t.email AS actor FROM shipment_events e JOIN staff t ON t.id = e.staff_id "
                        "WHERE e.shipment_id = ? ORDER BY e.version", (row["id"],)).fetchall()
    data["events"] = [dict(event) for event in events]
    return data


def record_event(db, row, user, action, reason, *, evidence="", note="", occurred_at=None, key=None, body_hash=""):
    now = utc_now()
    db.execute("INSERT INTO shipment_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
               (str(uuid.uuid4()), row["id"], row["version"], action[0], action[1], row["status"], reason,
                evidence, note, occurred_at or now, user["id"], now, key or str(uuid.uuid4()), body_hash))


def check_version(row, expected):
    if row["version"] != expected:
        raise HTTPException(409, "Shipment changed. Reload and review before saving")


def cancel_superseded_snapshots(db, shipment_id: str, version: int):
    db.execute("UPDATE integration_jobs SET status = 'cancelled', last_error = 'snapshot_superseded', updated_at = ? "
               "WHERE shipment_id = ? AND shipment_version < ? AND status IN ('queued','retry_wait')",
               (utc_now(), shipment_id, version))


def hide_for_verification(db, company_id: str, user: dict, reason: str):
    """Revoke tracking and invalidate every outbound snapshot on approval withdrawal."""
    rows = db.execute("SELECT * FROM shipments WHERE company_id = ?", (company_id,)).fetchall()
    for old in rows:
        db.execute("UPDATE shipments SET portal_visible = 0, version = version + 1, updated_at = ? WHERE id = ?",
                   (utc_now(), old["id"]))
        row = shipment_row(db, old["id"])
        cancel_superseded_snapshots(db, old["id"], row["version"])
        record_event(db, row, user, ("verification_withdrawn", old["status"]), reason)
    db.execute("UPDATE integration_jobs SET status = 'cancelled', last_error = 'verification_withdrawn', updated_at = ? "
               "WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = ?) AND status IN ('queued','retry_wait')",
               (utc_now(), company_id))


@router.get("/api/admin/shipments")
def list_shipments(offset: int = Query(default=0, ge=0), user: dict = Depends(staff_user)):
    sales_only(user)
    with database() as db:
        rows = db.execute("SELECT s.id, s.reference, s.status, s.version, s.carrier, s.tracking_reference, s.expected_delivery_date, "
                          "s.portal_visible, q.reference AS quote_reference, c.name AS company_name FROM shipments s "
                          "JOIN quotes q ON q.id = s.quote_id JOIN companies c ON c.id = s.company_id "
                          "ORDER BY s.created_at DESC LIMIT 100 OFFSET ?", (offset,)).fetchall()
    return [dict(row) for row in rows]


@router.post("/api/admin/shipments", status_code=201)
def create_shipment(body: NewShipment, idempotency_key: str | None = Header(default=None), user: dict = Depends(mutation_staff)):
    sales_only(user)
    key, digest = command_key(user, "create", idempotency_key), payload_hash(body)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        existing = db.execute("SELECT id, payload_hash FROM shipments WHERE create_key = ?", (key,)).fetchone()
        if existing:
            if existing["payload_hash"] != digest:
                raise HTTPException(409, "Idempotency key used for different shipment details")
            result = shipment_data(db, shipment_row(db, existing["id"], user))
            db.commit()
            return result
        quote = quote_row(db, body.quote_id)
        scoped_inquiry(db, quote["inquiry_id"], user)
        if quote["status"] != "accepted":
            raise HTTPException(409, "An accepted quotation is required to plan an outbound shipment")
        revision = revision_data(db, quote["id"], quote["current_version"])
        if not revision["accepted_at"]:
            raise HTTPException(409, "Quotation acceptance evidence is missing")
        shipment_id, now = str(uuid.uuid4()), utc_now()
        reference = f"SHP-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(4).upper()}"
        db.execute("INSERT INTO shipments (id, reference, quote_id, quote_revision_id, company_id, carrier, tracking_reference, origin, destination, "
                   "expected_delivery_date, created_by, create_key, payload_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (shipment_id, reference, quote["id"], revision["id"], quote["company_id"], body.carrier, body.tracking_reference, body.origin,
                    body.destination, body.expected_delivery_date.isoformat() if body.expected_delivery_date else None, user["id"], key, digest, now, now))
        row = shipment_row(db, shipment_id, user)
        record_event(db, row, user, ("planned", ""), body.reason)
        result = shipment_data(db, row)
        db.commit()
    return result


@router.get("/api/admin/shipments/{shipment_id}")
def get_shipment(shipment_id: str, user: dict = Depends(staff_user)):
    with database() as db:
        return shipment_data(db, shipment_row(db, shipment_id, user))


@router.put("/api/admin/shipments/{shipment_id}")
def update_shipment(shipment_id: str, body: UpdateShipment, user: dict = Depends(mutation_staff)):
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        old = shipment_row(db, shipment_id, user)
        check_version(old, body.expected_version)
        if old["status"] in {"delivered", "cancelled"}:
            raise HTTPException(409, "Closed shipment details cannot be edited")
        if old["status"] != "planned" and (not body.carrier or not body.tracking_reference):
            raise HTTPException(422, "Booked shipments require carrier and tracking references")
        db.execute("UPDATE shipments SET carrier = ?, tracking_reference = ?, origin = ?, destination = ?, expected_delivery_date = ?, "
                   "version = version + 1, updated_at = ? WHERE id = ?",
                   (body.carrier, body.tracking_reference, body.origin, body.destination,
                    body.expected_delivery_date.isoformat() if body.expected_delivery_date else None, utc_now(), shipment_id))
        row = shipment_row(db, shipment_id, user)
        cancel_superseded_snapshots(db, shipment_id, row["version"])
        prior = f"Previous: carrier={old['carrier']}; tracking={old['tracking_reference']}; origin={old['origin']}; destination={old['destination']}; ETA={old['expected_delivery_date']}"
        current = f"Updated: carrier={row['carrier']}; tracking={row['tracking_reference']}; origin={row['origin']}; destination={row['destination']}; ETA={row['expected_delivery_date']}"
        record_event(db, row, user, ("details_updated", old["status"]), f"{body.reason}\n{prior}\n{current}")
        result = shipment_data(db, row)
        db.commit()
    return result


@router.post("/api/admin/shipments/{shipment_id}/events")
def change_status(shipment_id: str, body: ShipmentEvent, idempotency_key: str | None = Header(default=None), user: dict = Depends(mutation_staff)):
    key, digest = command_key(user, shipment_id, idempotency_key), payload_hash(body)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        old = shipment_row(db, shipment_id, user)
        existing = db.execute("SELECT payload_hash FROM shipment_events WHERE command_key = ?", (key,)).fetchone()
        if existing:
            if existing["payload_hash"] != digest:
                raise HTTPException(409, "Idempotency key used for a different event")
            result = shipment_data(db, old)
            db.commit()
            return result
        check_version(old, body.expected_version)
        if body.status not in TRANSITIONS[old["status"]]:
            raise HTTPException(409, "Shipment status transition is not allowed")
        last = db.execute("SELECT max(occurred_at) FROM shipment_events WHERE shipment_id = ? AND action = 'status_changed'", (shipment_id,)).fetchone()[0]
        if last and body.occurred_at.isoformat() < last:
            raise HTTPException(422, "Status event times must follow the recorded chronology")
        if body.status in {"booked", "dispatched"}:
            ensure_not_held(db, old["company_id"])
            verified = db.execute("SELECT verification_status FROM companies WHERE id = ?", (old["company_id"],)).fetchone()[0]
            if verified != "approved":
                raise HTTPException(409, "Company verification is required before booking or dispatch")
            if not old["carrier"] or not old["tracking_reference"]:
                raise HTTPException(422, "Record carrier and tracking reference before booking")
        db.execute("UPDATE shipments SET status = ?, version = version + 1, updated_at = ? WHERE id = ?", (body.status, utc_now(), shipment_id))
        row = shipment_row(db, shipment_id, user)
        cancel_superseded_snapshots(db, shipment_id, row["version"])
        record_event(db, row, user, ("status_changed", old["status"]), body.reason, evidence=body.evidence_reference,
                     note=body.customer_note, occurred_at=body.occurred_at.isoformat(), key=key, body_hash=digest)
        result = shipment_data(db, row)
        db.commit()
    return result


@router.post("/api/admin/shipments/{shipment_id}/visibility")
def publish_shipment(shipment_id: str, body: PublishShipment, user: dict = Depends(mutation_staff)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin approval required")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        old = shipment_row(db, shipment_id, user)
        check_version(old, body.expected_version)
        if body.visible and old["status"] == "planned":
            raise HTTPException(409, "Book the shipment before publishing its tracking information")
        if body.visible:
            verified = db.execute("SELECT verification_status FROM companies WHERE id = ?", (old["company_id"],)).fetchone()[0]
            if verified != "approved":
                raise HTTPException(409, "Company verification is required before publishing tracking information")
        db.execute("UPDATE shipments SET portal_visible = ?, version = version + 1, updated_at = ? WHERE id = ?",
                   (int(body.visible), utc_now(), shipment_id))
        row = shipment_row(db, shipment_id, user)
        cancel_superseded_snapshots(db, shipment_id, row["version"])
        record_event(db, row, user, ("published" if body.visible else "hidden", old["status"]), body.reason)
        result = shipment_data(db, row)
        db.commit()
    return result


def public_shipment(db, row):
    fields = ("id", "reference", "status", "carrier", "tracking_reference", "origin", "destination", "expected_delivery_date", "updated_at")
    result = {field: row[field] for field in fields}
    events = db.execute("SELECT new_status AS status, customer_note, occurred_at FROM shipment_events "
                        "WHERE shipment_id = ? AND action = 'status_changed' ORDER BY version", (row["id"],)).fetchall()
    result["events"] = [dict(event) for event in events]
    return result


@router.get("/api/portal/shipments")
def portal_shipments(user: dict = Depends(portal_user)):
    if user["role"] != "customer":
        raise HTTPException(403, "Customer access required")
    with database() as db:
        rows = db.execute("SELECT * FROM shipments WHERE company_id = ? AND portal_visible = 1 ORDER BY created_at DESC LIMIT 100",
                          (user["company_id"],)).fetchall()
        return [public_shipment(db, row) for row in rows]


@router.get("/api/portal/shipments/{shipment_id}")
def portal_shipment(shipment_id: str, user: dict = Depends(portal_user)):
    if user["role"] != "customer":
        raise HTTPException(403, "Customer access required")
    with database() as db:
        row = db.execute("SELECT * FROM shipments WHERE id = ? AND company_id = ? AND portal_visible = 1", (shipment_id, user["company_id"])).fetchone()
        if not row:
            raise HTTPException(404, "Shipment not found")
        return public_shipment(db, row)
