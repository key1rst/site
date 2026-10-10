"""Reviewed shipment snapshots, paused-by-default destinations, and reconciliation."""
from __future__ import annotations

import json
import os
import uuid
from typing import Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from backend.app.main import database, mutation_staff, staff_user, utc_now
from backend.app.commercial import ensure_not_held
from backend.app.shipments import ShipmentStatus, StrictInput, shipment_row

router = APIRouter(prefix="/api/admin/integrations", tags=["integrations"])
CONTRACT = "shipment.changed.v1"


def admin_only(user):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")


def configuration(slug):
    prefix = "OIL_INTEGRATION_" + slug.upper().replace("-", "_")
    target, token = os.getenv(prefix + "_URL", ""), os.getenv(prefix + "_TOKEN", "")
    try:
        parsed = urlsplit(target)
        if not token or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            return None
        if parsed.port is not None and not 1 <= parsed.port <= 65535:
            return None
    except ValueError:
        return None
    return {"url": target, "token": token}


def profile_row(db, profile_id):
    row = db.execute("SELECT p.*, s.email AS owner_email FROM integration_profiles p JOIN staff s ON s.id = p.owner_id WHERE p.id = ?", (profile_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Integration profile not found")
    return row


def profile_data(row):
    return {**dict(row), "configured": bool(configuration(row["slug"])), "contract": CONTRACT,
            "environment_prefix": "OIL_INTEGRATION_" + row["slug"].upper().replace("-", "_")}


def audit(db, profile_id, user, action, detail, job_id=None):
    db.execute("INSERT INTO integration_events VALUES (?, ?, ?, ?, ?, ?, ?)",
               (str(uuid.uuid4()), profile_id, job_id, user["id"], action, detail, utc_now()))


class ProfileInput(StrictInput):
    slug: str = Field(min_length=2, max_length=50, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str = Field(min_length=2, max_length=160)
    purpose: Literal["logistics", "erp", "bi"]
    owner_id: str
    contract_notes: str = Field(min_length=10, max_length=2000)


class ControlInput(StrictInput):
    expected_version: int = Field(ge=1)
    enabled: bool
    contract_approved: bool = False
    reason: str = Field(min_length=5, max_length=1000)


class QueueInput(StrictInput):
    shipment_id: str
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=5, max_length=1000)


class JobActionInput(StrictInput):
    reason: str = Field(min_length=5, max_length=1000)


class ReconcileInput(StrictInput):
    remote_version: int = Field(ge=1)
    remote_status: ShipmentStatus
    external_id: str = Field(min_length=1, max_length=160)
    evidence_reference: str = Field(min_length=3, max_length=500)


@router.get("")
def list_profiles(user: dict = Depends(staff_user)):
    admin_only(user)
    with database() as db:
        rows = db.execute("SELECT p.*, s.email AS owner_email FROM integration_profiles p JOIN staff s ON s.id = p.owner_id "
                          "ORDER BY p.created_at DESC LIMIT 100").fetchall()
    return [profile_data(row) for row in rows]


@router.post("", status_code=201)
def create_profile(body: ProfileInput, user: dict = Depends(mutation_staff)):
    admin_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        if not db.execute("SELECT id FROM staff WHERE id = ?", (body.owner_id,)).fetchone():
            raise HTTPException(422, "Select a known integration owner")
        if db.execute("SELECT id FROM integration_profiles WHERE slug = ?", (body.slug,)).fetchone():
            raise HTTPException(409, "Integration slug already exists")
        if db.execute("SELECT count(*) FROM integration_profiles").fetchone()[0] >= 100:
            raise HTTPException(409, "Integration profile limit reached")
        profile_id, now = str(uuid.uuid4()), utc_now()
        db.execute("INSERT INTO integration_profiles VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)",
                   (profile_id, body.slug, body.name, body.purpose, body.owner_id, body.contract_notes, user["id"], now, now))
        audit(db, profile_id, user, "profile_created", body.contract_notes)
        result = profile_data(profile_row(db, profile_id))
        db.commit()
    return result


@router.post("/{profile_id}/control")
def control_profile(profile_id: str, body: ControlInput, user: dict = Depends(mutation_staff)):
    admin_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        profile = profile_row(db, profile_id)
        if profile["version"] != body.expected_version:
            raise HTTPException(409, "Integration settings changed. Reload before saving")
        if body.enabled and (not body.contract_approved or not configuration(profile["slug"])):
            raise HTTPException(422, "Enabling requires approved shipment data contract and HTTPS credentials in the environment")
        db.execute("UPDATE integration_profiles SET enabled = ?, version = version + 1, updated_at = ? WHERE id = ?",
                   (int(body.enabled), utc_now(), profile_id))
        audit(db, profile_id, user, "profile_enabled" if body.enabled else "profile_paused", body.reason)
        result = profile_data(profile_row(db, profile_id))
        db.commit()
    return result


def job_row(db, job_id):
    row = db.execute("SELECT j.*, p.name AS profile_name, p.enabled, s.reference AS shipment_reference "
                     "FROM integration_jobs j JOIN integration_profiles p ON p.id = j.profile_id "
                     "JOIN shipments s ON s.id = j.shipment_id WHERE j.id = ?", (job_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Integration job not found")
    return row


def job_data(db, row, detail=False):
    data = dict(row)
    data.pop("lease_token", None)
    raw = data.pop("payload_json")
    if detail:
        data["payload"] = json.loads(raw)
        data["attempt_history"] = [dict(item) for item in db.execute("SELECT attempt, outcome, error_code, started_at, completed_at "
                                                                   "FROM integration_attempts WHERE job_id = ? ORDER BY attempt", (row["id"],))]
        data["reconciliations"] = [dict(item) for item in db.execute("SELECT remote_version, remote_status, external_id, evidence_reference, result, created_at "
                                                                   "FROM integration_reconciliations WHERE job_id = ? ORDER BY created_at", (row["id"],))]
    return data


@router.get("/jobs")
def list_jobs(profile_id: str = "", offset: int = Query(default=0, ge=0), user: dict = Depends(staff_user)):
    admin_only(user)
    with database() as db:
        rows = db.execute("SELECT j.*, p.name AS profile_name, p.enabled, s.reference AS shipment_reference "
                          "FROM integration_jobs j JOIN integration_profiles p ON p.id = j.profile_id JOIN shipments s ON s.id = j.shipment_id "
                          "WHERE (? = '' OR j.profile_id = ?) ORDER BY j.created_at DESC LIMIT 100 OFFSET ?", (profile_id, profile_id, offset)).fetchall()
        return [job_data(db, row) for row in rows]


@router.get("/jobs/{job_id}")
def get_job(job_id: str, user: dict = Depends(staff_user)):
    admin_only(user)
    with database() as db:
        return job_data(db, job_row(db, job_id), True)


@router.post("/{profile_id}/queue", status_code=201)
def queue_snapshot(profile_id: str, body: QueueInput, user: dict = Depends(mutation_staff)):
    admin_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        profile_row(db, profile_id)
        shipment = shipment_row(db, body.shipment_id, user)
        company = db.execute("SELECT verification_status FROM companies WHERE id = ?", (shipment["company_id"],)).fetchone()
        if company["verification_status"] != "approved":
            raise HTTPException(409, "Approved company verification is required before external exchange")
        ensure_not_held(db, shipment["company_id"])
        if shipment["version"] != body.expected_version:
            raise HTTPException(409, "Shipment changed. Review the latest snapshot before queueing")
        if shipment["status"] == "planned":
            raise HTTPException(409, "Only booked or later shipments can be queued externally")
        existing = db.execute("SELECT id FROM integration_jobs WHERE profile_id = ? AND shipment_id = ? AND shipment_version = ?",
                              (profile_id, shipment["id"], shipment["version"])).fetchone()
        if existing:
            result = job_data(db, job_row(db, existing["id"]), True)
            db.commit()
            return result
        db.execute("UPDATE integration_jobs SET status = 'cancelled', last_error = 'snapshot_superseded', updated_at = ? "
                   "WHERE profile_id = ? AND shipment_id = ? AND shipment_version < ? AND status IN ('queued','retry_wait')",
                   (utc_now(), profile_id, shipment["id"], shipment["version"]))
        job_id, now = str(uuid.uuid4()), utc_now()
        fields = ("reference", "version", "status", "carrier", "tracking_reference", "origin", "destination", "expected_delivery_date", "updated_at")
        payload = {"schema": CONTRACT, "event_id": job_id, "shipment": {field: shipment[field] for field in fields}}
        db.execute("INSERT INTO integration_jobs (id, profile_id, shipment_id, shipment_version, payload_json, next_attempt_at, queued_by, created_at, updated_at) "
                   "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (job_id, profile_id, shipment["id"], shipment["version"], json.dumps(payload, sort_keys=True), now, user["id"], now, now))
        audit(db, profile_id, user, "snapshot_queued", body.reason, job_id)
        result = job_data(db, job_row(db, job_id), True)
        db.commit()
    return result


@router.post("/jobs/{job_id}/retry")
def retry_job(job_id: str, body: JobActionInput, user: dict = Depends(mutation_staff)):
    admin_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        job = job_row(db, job_id)
        if job["status"] not in {"retry_wait", "dead_letter"}:
            raise HTTPException(409, "Only failed jobs can be retried")
        db.execute("UPDATE integration_jobs SET status = 'queued', cycle_attempts = 0, next_attempt_at = ?, last_error = '', updated_at = ? WHERE id = ?",
                   (utc_now(), utc_now(), job_id))
        audit(db, job["profile_id"], user, "retry_requested", body.reason, job_id)
        result = job_data(db, job_row(db, job_id), True)
        db.commit()
    return result


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, body: JobActionInput, user: dict = Depends(mutation_staff)):
    admin_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        job = job_row(db, job_id)
        if job["status"] not in {"queued", "retry_wait", "dead_letter", "reconciliation_required"}:
            raise HTTPException(409, "In-flight and acknowledged jobs cannot be cancelled")
        db.execute("UPDATE integration_jobs SET status = 'cancelled', updated_at = ? WHERE id = ?", (utc_now(), job_id))
        audit(db, job["profile_id"], user, "job_cancelled", body.reason, job_id)
        result = job_data(db, job_row(db, job_id), True)
        db.commit()
    return result


@router.post("/jobs/{job_id}/reconcile")
def reconcile_job(job_id: str, body: ReconcileInput, user: dict = Depends(mutation_staff)):
    admin_only(user)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        job = job_row(db, job_id)
        if job["status"] not in {"sent", "reconciliation_required"}:
            raise HTTPException(409, "Reconciliation requires an acknowledged job")
        shipment = json.loads(job["payload_json"])["shipment"]
        current = db.execute("SELECT version FROM shipments WHERE id = ?", (job["shipment_id"],)).fetchone()[0]
        exact = body.remote_version == shipment["version"] and body.remote_status == shipment["status"] and body.external_id == job["external_id"]
        result = "stale" if exact and current != shipment["version"] else "matched" if exact else "mismatch"
        db.execute("INSERT INTO integration_reconciliations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (str(uuid.uuid4()), job_id, body.remote_version, body.remote_status, body.external_id, body.evidence_reference, result, user["id"], utc_now()))
        db.execute("UPDATE integration_jobs SET reconciliation_status = ?, updated_at = ? WHERE id = ?", (result, utc_now(), job_id))
        if job["status"] == "reconciliation_required" and result == "matched":
            db.execute("UPDATE integration_jobs SET status = 'sent', acknowledged_at = ?, last_error = '' WHERE id = ?",
                       (utc_now(), job_id))
        audit(db, job["profile_id"], user, "reconciliation_recorded", result + ": " + body.evidence_reference, job_id)
        db.commit()
    return {"result": result}


@router.get("/{profile_id}/history")
def profile_history(profile_id: str, user: dict = Depends(staff_user)):
    admin_only(user)
    with database() as db:
        profile_row(db, profile_id)
        rows = db.execute("SELECT e.action, e.detail, e.job_id, e.created_at, s.email AS actor FROM integration_events e "
                          "JOIN staff s ON s.id = e.staff_id WHERE e.profile_id = ? ORDER BY e.created_at DESC LIMIT 100", (profile_id,)).fetchall()
    return [dict(row) for row in rows]
