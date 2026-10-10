"""Permission-aware CRM follow-up and commercial reporting."""
from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, localcontext
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from backend.app.main import database, mutation_staff, scoped_inquiry, staff_user, utc_now

router = APIRouter(prefix="/api/admin", tags=["operations"])


def inquiry_scope(user: dict) -> str:
    return "i.kind != 'sell'" if user["role"] == "sales" else "i.kind = 'sell'" if user["role"] == "procurement" else "1 = 1"


def period(start: str | None, end: str | None) -> tuple[str, str, str]:
    today = datetime.now(timezone.utc).date()
    try:
        first = date.fromisoformat(start) if start else today.replace(day=1)
        last = date.fromisoformat(end) if end else today
    except ValueError:
        raise HTTPException(422, "Enter valid report dates") from None
    if first > last or (last - first).days > 365:
        raise HTTPException(422, "Report period must be ordered and at most 366 days")
    return first.isoformat(), last.isoformat(), (last + timedelta(days=1)).isoformat()


@router.get("/owners")
def owners(user: dict = Depends(staff_user)):
    with database() as db:
        rows = db.execute("SELECT id, email, role FROM staff WHERE ? = 'admin' OR role IN ('admin', ?) ORDER BY email",
                          (user["role"], user["role"])).fetchall()
    return [dict(row) for row in rows]


class OperationsInput(BaseModel):
    assigned_to: str | None = None
    priority: Literal["low", "normal", "high"] = "normal"
    next_action: str = Field(default="", max_length=500)


def operations_data(db, inquiry_id: str, user: dict) -> dict:
    inquiry = scoped_inquiry(db, inquiry_id, user)
    row = db.execute("SELECT o.priority, o.next_action, s.email AS owner_email FROM inquiries i "
                     "LEFT JOIN inquiry_operations o ON o.inquiry_id = i.id LEFT JOIN staff s ON s.id = i.assigned_to "
                     "WHERE i.id = ?", (inquiry_id,)).fetchone()
    entered = db.execute("SELECT max(created_at) FROM activity WHERE inquiry_id = ? AND action = 'status_changed'",
                         (inquiry_id,)).fetchone()[0] or inquiry["created_at"]
    elapsed = datetime.now(timezone.utc) - datetime.fromisoformat(entered)
    return {"assigned_to": inquiry["assigned_to"], "owner_email": row["owner_email"],
            "priority": row["priority"] or "normal", "next_action": row["next_action"] or "",
            "stage_entered_at": entered, "days_in_stage": max(0, elapsed.total_seconds() / 86400)}


@router.get("/inquiries/{inquiry_id}/operations")
def get_operations(inquiry_id: str, user: dict = Depends(staff_user)):
    with database() as db:
        return operations_data(db, inquiry_id, user)


@router.put("/inquiries/{inquiry_id}/operations")
def save_operations(inquiry_id: str, body: OperationsInput, user: dict = Depends(mutation_staff)):
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        inquiry = scoped_inquiry(db, inquiry_id, user)
        old = operations_data(db, inquiry_id, user)
        if body.assigned_to:
            owner = db.execute("SELECT role FROM staff WHERE id = ?", (body.assigned_to,)).fetchone()
            expected = "procurement" if inquiry["kind"] == "sell" else "sales"
            if not owner or owner["role"] not in {"admin", expected}:
                raise HTTPException(422, "Owner must belong to the appropriate team")
        db.execute("UPDATE inquiries SET assigned_to = ?, updated_at = ? WHERE id = ?", (body.assigned_to, utc_now(), inquiry_id))
        db.execute("INSERT INTO inquiry_operations VALUES (?, ?, ?, ?, ?) ON CONFLICT(inquiry_id) DO UPDATE SET "
                   "priority = excluded.priority, next_action = excluded.next_action, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
                   (inquiry_id, body.priority, body.next_action.strip(), user["id"], utc_now()))
        detail = f"Owner {old['assigned_to'] or 'unassigned'} -> {body.assigned_to or 'unassigned'}; priority {old['priority']} -> {body.priority}; next action: {body.next_action.strip()}"
        db.execute("INSERT INTO activity VALUES (?, ?, ?, 'operations_updated', ?, ?)",
                   (str(uuid.uuid4()), inquiry_id, user["id"], detail, utc_now()))
        db.commit()
        return operations_data(db, inquiry_id, user)


@router.get("/reminders")
def reminders(user: dict = Depends(staff_user)):
    with database() as db:
        rows = db.execute("SELECT t.id, t.title, t.due_date, t.priority, i.id AS inquiry_id, i.reference, c.name AS company_name "
                          "FROM tasks t JOIN inquiries i ON i.id = t.inquiry_id JOIN companies c ON c.id = i.company_id "
                          f"WHERE t.status = 'pending' AND t.due_date <= date('now') AND {inquiry_scope(user)} "
                          "ORDER BY t.due_date, t.created_at LIMIT 100").fetchall()
    return [dict(row) for row in rows]


@router.get("/search")
def search(q: str = Query(min_length=2, max_length=160), user: dict = Depends(staff_user)):
    pattern = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    with database() as db:
        rows = db.execute("SELECT i.id, i.reference, i.kind, i.status, i.created_at, i.company_id, i.product_text, "
                          "c.name AS company_name, t.name AS contact_name FROM inquiries i JOIN companies c ON c.id = i.company_id "
                          "JOIN contacts t ON t.id = i.contact_id "
                          f"WHERE {inquiry_scope(user)} AND (c.name LIKE ? ESCAPE '\\' OR t.email LIKE ? ESCAPE '\\' "
                          "OR i.reference LIKE ? ESCAPE '\\' OR i.product_text LIKE ? ESCAPE '\\') ORDER BY i.created_at DESC LIMIT 100",
                          (pattern, pattern, pattern, pattern)).fetchall()
    return [dict(row) for row in rows]


@router.get("/company-overview/{company_id}")
def company_overview(company_id: str, user: dict = Depends(staff_user)):
    with database() as db:
        inquiries = db.execute("SELECT i.id, i.reference, i.kind, i.status, i.product_text, i.created_at, i.assigned_to "
                               f"FROM inquiries i WHERE i.company_id = ? AND {inquiry_scope(user)} ORDER BY i.created_at DESC LIMIT 100",
                               (company_id,)).fetchall()
        if not inquiries:
            raise HTTPException(404, "Company not found in your team records")
        company = db.execute("SELECT id, name, verification_status, created_at FROM companies WHERE id = ?", (company_id,)).fetchone()
        contacts = db.execute("SELECT DISTINCT t.id, t.name, t.email FROM contacts t JOIN inquiries i ON i.contact_id = t.id "
                              f"WHERE i.company_id = ? AND {inquiry_scope(user)} LIMIT 100", (company_id,)).fetchall()
        tasks = db.execute("SELECT t.id, t.title, t.due_date, t.status, i.reference FROM tasks t JOIN inquiries i ON i.id = t.inquiry_id "
                           f"WHERE i.company_id = ? AND {inquiry_scope(user)} ORDER BY t.due_date LIMIT 100", (company_id,)).fetchall()
    return {**dict(company), "contacts": [dict(row) for row in contacts], "inquiries": [dict(row) for row in inquiries],
            "tasks": [dict(row) for row in tasks]}


def report_inquiries(db, user, start, exclusive_end):
    rows = db.execute("SELECT i.id, i.reference, i.kind, i.status, i.created_at, i.product_text, i.quantity, i.unit, "
                      "i.destination_country, c.name AS company_name, t.name AS contact_name, t.email, s.email AS owner, "
                      "COALESCE(o.priority, 'normal') AS priority FROM inquiries i JOIN companies c ON c.id = i.company_id "
                      "JOIN contacts t ON t.id = i.contact_id LEFT JOIN staff s ON s.id = i.assigned_to "
                      "LEFT JOIN inquiry_operations o ON o.inquiry_id = i.id "
                      f"WHERE {inquiry_scope(user)} AND i.created_at >= ? AND i.created_at < ? ORDER BY i.created_at DESC LIMIT 5001",
                      (start, exclusive_end)).fetchall()
    if len(rows) > 5000:
        raise HTTPException(422, "More than 5000 records; narrow the date range")
    return rows


@router.get("/reports")
def reports(start: str | None = None, end: str | None = None, user: dict = Depends(staff_user)):
    first, last, exclusive_end = period(start, end)
    with database() as db:
        rows = report_inquiries(db, user, first, exclusive_end)
        quotes = [] if user["role"] == "procurement" else db.execute(
            "SELECT q.status, r.currency, r.total, r.validity_date FROM quotes q JOIN quote_revisions r "
            "ON r.quote_id = q.id AND r.version = q.current_version WHERE q.created_at >= ? AND q.created_at < ? LIMIT 5001",
            (first, exclusive_end)).fetchall()
    if len(quotes) > 5000:
        raise HTTPException(422, "More than 5000 quotations; narrow the date range")
    by_stage, by_owner, values = {}, {}, {}
    for row in rows:
        key = (row["kind"], row["status"])
        by_stage[key] = by_stage.get(key, 0) + 1
        owner = row["owner"] or "Unassigned"
        by_owner[owner] = by_owner.get(owner, 0) + 1
    for quote in quotes:
        status = "expired" if quote["status"] in {"issued", "sent"} and quote["validity_date"] < datetime.now(timezone.utc).date().isoformat() else quote["status"]
        key = (quote["currency"], status)
        count, value = values.get(key, (0, Decimal("0")))
        with localcontext() as context:
            context.prec = 64
            values[key] = (count + 1, value + Decimal(quote["total"]))
    return {"period_start": first, "period_end": last, "inquiries": len(rows),
            "stage_counts": [{"kind": kind, "stage": stage, "count": count} for (kind, stage), count in sorted(by_stage.items())],
            "owners": [{"email": owner, "inquiries": count} for owner, count in sorted(by_owner.items())],
            "quote_values": [{"currency": currency, "status": status, "count": count, "total": str(value)} for (currency, status), (count, value) in sorted(values.items())],
            "basis": "Records created in the selected UTC dates, grouped by their current status. Quote values are separated by currency. Accepted quotations do not establish contracted value, payments, or recognized revenue.",
            "forecast": None, "contracted_value": None, "payments": None, "revenue": None}


def spreadsheet_safe(value) -> str:
    text = "" if value is None else str(value)
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")) else text


@router.get("/reports/inquiries.csv")
def export_inquiries(start: str | None = None, end: str | None = None, user: dict = Depends(staff_user)):
    first, last, exclusive_end = period(start, end)
    with database() as db:
        rows = report_inquiries(db, user, first, exclusive_end)
        db.execute("INSERT INTO export_events VALUES (?, ?, 'inquiries_csv', ?, ?, ?, ?)",
                   (str(uuid.uuid4()), user["id"], first, last, len(rows), utc_now()))
    fields = ["reference", "kind", "company_name", "contact_name", "email", "product_text", "quantity", "unit",
              "destination_country", "status", "owner", "priority", "created_at"]
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(fields)
    writer.writerows([[spreadsheet_safe(row[field]) for field in fields] for row in rows])
    return Response(output.getvalue().encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=inquiries-{first}-{last}.csv", "Cache-Control": "private, no-store"})
