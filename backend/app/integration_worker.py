"""Explicitly invoked HTTPS sender for reviewed shipment snapshots.

The receiver must deduplicate by event_id and acknowledge that exact event and
version. A local acknowledgement never changes shipment or inventory state.
"""
from __future__ import annotations

import argparse
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import httpx

from backend.app.main import database, utc_now
from backend.app.integrations import configuration


class DeliveryFailure(Exception):
    def __init__(self, code: str, retryable: bool):
        super().__init__(code)
        self.code = code
        self.retryable = retryable


def https_json(config: dict, payload: dict) -> dict:
    """Read a bounded acknowledgement without following redirects or proxies."""
    try:
        with httpx.Client(timeout=10, follow_redirects=False, trust_env=False) as client:
            with client.stream("POST", config["url"], json=payload,
                               headers={"Authorization": "Bearer " + config["token"],
                                        "Idempotency-Key": payload["event_id"], "Accept": "application/json"}) as response:
                status = response.status_code
                if status not in {200, 201}:
                    raise DeliveryFailure(f"http_{status}", status in {408, 425, 429} or status >= 500)
                content = bytearray()
                for chunk in response.iter_bytes():
                    content.extend(chunk)
                    if len(content) > 65536:
                        raise DeliveryFailure("ack_too_large", False)
        decoded = json.loads(content)
        if not isinstance(decoded, dict):
            raise ValueError("Acknowledgement must be an object")
        return decoded
    except DeliveryFailure:
        raise
    except (httpx.HTTPError, OSError):
        raise DeliveryFailure("transport_error", True) from None
    except (UnicodeDecodeError, ValueError):
        raise DeliveryFailure("invalid_ack", False) from None


def classify_ack(payload: dict, ack: dict) -> tuple[str, str]:
    if not isinstance(ack, dict):
        raise DeliveryFailure("invalid_ack", False)
    external_id = ack.get("external_id")
    if not isinstance(external_id, str) or not 1 <= len(external_id) <= 160:
        raise DeliveryFailure("invalid_ack", False)
    expected = payload["shipment"]
    if ack.get("event_id") != payload["event_id"] or ack.get("shipment_reference") != expected["reference"]:
        raise DeliveryFailure("ack_identity_mismatch", False)
    if type(ack.get("version")) is not int or ack["version"] != expected["version"] or ack.get("status") != expected["status"]:
        return "reconciliation_required", external_id
    return "sent", external_id


def claim(excluded: set[str]):
    """Lease one due job with a serialized SQLite transaction."""
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        profiles = db.execute("SELECT id, slug FROM integration_profiles WHERE enabled = 1 ORDER BY created_at LIMIT 100").fetchall()
        now = utc_now()
        for profile in profiles:
            config = configuration(profile["slug"])
            if not config:
                continue
            excluded_clause = " AND j.id NOT IN (" + ",".join("?" for _ in excluded) + ")" if excluded else ""
            candidate = db.execute(
                "SELECT j.id, j.shipment_id, j.shipment_version, j.payload_json, j.attempts, j.cycle_attempts, j.status FROM integration_jobs j "
                "WHERE j.profile_id = ? AND ((j.status IN ('queued','retry_wait') AND j.next_attempt_at <= ?) "
                "OR (j.status = 'processing' AND j.lease_expires_at <= ?))" + excluded_clause +
                " ORDER BY j.created_at LIMIT 1", (profile["id"], now, now, *excluded),
            ).fetchone()
            if not candidate:
                continue
            current_version = db.execute("SELECT version FROM shipments WHERE id = ?", (candidate["shipment_id"],)).fetchone()[0]
            if current_version != candidate["shipment_version"]:
                db.execute("UPDATE integration_jobs SET status = 'cancelled', last_error = 'snapshot_superseded', updated_at = ? "
                           "WHERE id = ?", (now, candidate["id"]))
                db.commit()
                return {"superseded": True, "id": candidate["id"]}
            if candidate["status"] == "processing":
                db.execute("UPDATE integration_attempts SET outcome = 'outcome_unknown', error_code = 'lease_expired', "
                           "completed_at = ? WHERE job_id = ? AND outcome = 'processing'", (now, candidate["id"]))
            if candidate["cycle_attempts"] >= 5:
                db.execute("UPDATE integration_jobs SET status = 'dead_letter', lease_token = NULL, lease_expires_at = NULL, "
                           "last_error = 'attempt_limit', updated_at = ? WHERE id = ?", (now, candidate["id"]))
                db.commit()
                return {"dead_letter": True, "id": candidate["id"]}
            lease = secrets.token_urlsafe(32)
            expires = (datetime.now(timezone.utc) + timedelta(seconds=45)).isoformat()
            attempt = candidate["attempts"] + 1
            db.execute("UPDATE integration_jobs SET status = 'processing', attempts = ?, cycle_attempts = cycle_attempts + 1, "
                       "lease_token = ?, lease_expires_at = ?, updated_at = ? WHERE id = ?",
                       (attempt, lease, expires, now, candidate["id"]))
            db.execute("INSERT INTO integration_attempts VALUES (?, ?, ?, 'processing', '', ?, NULL)",
                       (str(uuid.uuid4()), candidate["id"], attempt, now))
            db.commit()
            return {"id": candidate["id"], "lease": lease, "attempt": attempt,
                    "cycle_attempts": candidate["cycle_attempts"] + 1,
                    "payload": json.loads(candidate["payload_json"]), "config": config, "profile_id": profile["id"]}
        db.commit()
    return None


def delivery_gate(claimed: dict) -> str | None:
    with database() as db:
        row = db.execute("SELECT j.lease_token, j.status, j.shipment_version, s.version AS current_version, p.enabled, "
                         "c.verification_status, COALESCE(v.hold, 0) AS commercial_hold, COALESCE(v.status, 'not_reviewed') AS compliance_status "
                         "FROM integration_jobs j JOIN integration_profiles p ON p.id = j.profile_id "
                         "JOIN shipments s ON s.id = j.shipment_id JOIN companies c ON c.id = s.company_id "
                         "LEFT JOIN company_compliance v ON v.company_id = c.id WHERE j.id = ?", (claimed["id"],)).fetchone()
    if not row or row["lease_token"] != claimed["lease"] or row["status"] != "processing":
        return "lease_lost"
    if row["current_version"] != row["shipment_version"]:
        return "snapshot_superseded"
    if row["verification_status"] != "approved":
        return "verification_withdrawn"
    if row["commercial_hold"] or row["compliance_status"] in {"rejected", "escalated"}:
        return "commercial_hold"
    if not row["enabled"]:
        return "profile_paused"
    return None


def finish(claimed: dict, status: str, code: str = "", external_id: str | None = None) -> str | None:
    now = utc_now()
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT j.lease_token, j.shipment_version, s.version AS current_version "
                         "FROM integration_jobs j JOIN shipments s ON s.id = j.shipment_id "
                         "WHERE j.id = ? AND j.status = 'processing'", (claimed["id"],)).fetchone()
        if not row or row["lease_token"] != claimed["lease"]:
            db.commit()
            return None
        if row["shipment_version"] != row["current_version"] and status == "sent":
            status, code = "reconciliation_required", "snapshot_changed_during_delivery"
        wait_minutes = min(60, 2 ** min(claimed["cycle_attempts"], 6))
        next_attempt = (datetime.now(timezone.utc) + timedelta(minutes=wait_minutes)).isoformat() if status == "retry_wait" else now
        db.execute("UPDATE integration_jobs SET status = ?, last_error = ?, external_id = COALESCE(?, external_id), "
                   "acknowledged_at = CASE WHEN ? = 'sent' THEN ? ELSE acknowledged_at END, next_attempt_at = ?, "
                   "lease_token = NULL, lease_expires_at = NULL, updated_at = ? WHERE id = ?",
                   (status, code, external_id, status, now, next_attempt, now, claimed["id"]))
        db.execute("UPDATE integration_attempts SET outcome = ?, error_code = ?, completed_at = ? WHERE job_id = ? AND attempt = ?",
                   (status, code, now, claimed["id"], claimed["attempt"]))
        db.commit()
    return status


def process_once(limit: int = 20, *, send_enabled: bool = False, transport=None) -> dict:
    if not send_enabled:
        return {"sent": 0, "retry_wait": 0, "dead_letter": 0, "reconciliation_required": 0,
                "skipped": "External delivery is disabled; invoke explicitly with --send"}
    if not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")
    counts = {"sent": 0, "retry_wait": 0, "dead_letter": 0, "reconciliation_required": 0, "superseded": 0}
    seen: set[str] = set()
    for _ in range(limit):
        claimed = claim(seen)
        if not claimed:
            break
        seen.add(claimed["id"])
        if claimed.get("dead_letter"):
            counts["dead_letter"] += 1
            continue
        if claimed.get("superseded"):
            counts["superseded"] += 1
            continue
        gate = delivery_gate(claimed)
        if gate:
            status = "cancelled" if gate in {"snapshot_superseded", "verification_withdrawn"} else "retry_wait"
            finished = finish(claimed, status, gate)
            if finished:
                counts["superseded" if finished == "cancelled" else finished] += 1
            continue
        try:
            ack = (transport or https_json)(claimed["config"], claimed["payload"])
            status, external_id = classify_ack(claimed["payload"], ack)
            failure_code = "ack_version_mismatch" if status == "reconciliation_required" else ""
        except DeliveryFailure as failure:
            status = "retry_wait" if failure.retryable and claimed["cycle_attempts"] < 5 else "dead_letter"
            external_id, failure_code = None, failure.code
        except Exception:
            # A plug-in transport may fail unexpectedly; never store exception text or credentials.
            status = "retry_wait" if claimed["cycle_attempts"] < 5 else "dead_letter"
            external_id, failure_code = None, "transport_exception"
        finished = finish(claimed, status, failure_code, external_id)
        if finished:
            counts[finished] += 1
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process explicitly approved shipment integration jobs")
    parser.add_argument("--send", action="store_true", help="Enable real HTTPS delivery for this invocation")
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    print(process_once(args.limit, send_enabled=args.send))
