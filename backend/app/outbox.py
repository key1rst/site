"""Process queued transactional email. Not run automatically; configure SMTP first."""

from __future__ import annotations

import os
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage

from backend.app.main import database, utc_now
from backend.app.commercial import quote_row, render_pdf, revision_data


def configured() -> bool:
    return all(os.getenv(name) for name in ("OIL_SMTP_HOST", "OIL_SMTP_USER", "OIL_SMTP_PASSWORD",
                                             "OIL_MAIL_FROM", "OIL_SALES_EMAIL", "OIL_PROCUREMENT_EMAIL"))


def send(message: EmailMessage) -> None:
    host = os.environ["OIL_SMTP_HOST"]
    port = int(os.getenv("OIL_SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(os.environ["OIL_SMTP_USER"], os.environ["OIL_SMTP_PASSWORD"])
        smtp.send_message(message)


def process_once(limit: int = 20) -> dict:
    if not configured():
        return {"sent": 0, "failed": 0, "skipped": "SMTP not configured"}
    sent = failed = 0
    with database() as db:
        rows = db.execute(
            "SELECT o.id, o.kind AS notification_kind, o.quote_revision_id, "
            "r.quote_id, r.version, r.validity_date, q.current_version, q.status AS quote_status, "
            "COALESCE(v.hold, 0) AS commercial_hold, COALESCE(v.status, 'not_reviewed') AS compliance_status, "
            "i.kind AS inquiry_kind, i.reference, "
            "c.name AS company_name, t.email AS contact_email FROM outbox o "
            "JOIN inquiries i ON i.id = o.inquiry_id "
            "JOIN companies c ON c.id = i.company_id "
            "JOIN contacts t ON t.id = i.contact_id "
            "LEFT JOIN quote_revisions r ON r.id = o.quote_revision_id "
            "LEFT JOIN quotes q ON q.id = r.quote_id "
            "LEFT JOIN company_compliance v ON v.company_id = q.company_id "
            "WHERE o.status IN ('queued','failed') AND o.attempts < 5 "
            "ORDER BY o.created_at LIMIT ?", (limit,),
        ).fetchall()
    for row in rows:
        if row["notification_kind"] == "quote" and (
            row["version"] != row["current_version"] or row["quote_status"] not in {"issued", "sent"}
            or row["commercial_hold"] or row["compliance_status"] in {"rejected", "escalated"}
            or row["validity_date"] < datetime.now(timezone.utc).strftime("%Y-%m-%d")
        ):
            with database() as db:
                db.execute("UPDATE outbox SET status = 'cancelled' WHERE id = ?", (row["id"],))
            continue
        message = EmailMessage()
        message["From"] = os.environ["OIL_MAIL_FROM"]
        message["To"] = (row["contact_email"] if row["notification_kind"] in {"confirmation", "quote"} else
                         os.environ["OIL_PROCUREMENT_EMAIL"] if row["inquiry_kind"] == "sell" else
                         os.environ["OIL_SALES_EMAIL"])
        if row["notification_kind"] == "quote":
            with database() as db:
                quote = quote_row(db, row["quote_id"])
                revision = revision_data(db, row["quote_id"], row["version"])
            message.replace_header("To", revision["contact_email"] or row["contact_email"])
            message["Subject"] = f"Quotation {quote['reference']} v{row['version']}"
            message.set_content(f"Please review quotation {quote['reference']} version {row['version']} in the attached PDF.\n"
                                "Contact the Sales team to discuss its terms.")
            pdf = render_pdf("Quotation", f"{quote['reference']} v{row['version']}", quote["company_name"], revision)
            message.add_attachment(pdf, maintype="application", subtype="pdf",
                                   filename=f"{quote['reference']}-v{row['version']}.pdf")
        else:
            message["Subject"] = f"Inquiry {row['reference']} received" if row["notification_kind"] == "confirmation" else f"New {row['inquiry_kind']} inquiry {row['reference']}"
            message.set_content(
                f"Reference: {row['reference']}\nCompany: {row['company_name']}\n"
                "The request is recorded. The appropriate team can review it in the CRM."
            )
        try:
            send(message)
        except (OSError, smtplib.SMTPException) as exc:
            # Avoid storing SMTP responses, which may contain sensitive remote data.
            with database() as db:
                db.execute("UPDATE outbox SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?",
                           (type(exc).__name__, row["id"]))
            failed += 1
        else:
            with database() as db:
                db.execute("BEGIN IMMEDIATE")
                db.execute("UPDATE outbox SET status = 'sent', attempts = attempts + 1, last_error = '', sent_at = ? WHERE id = ?",
                           (utc_now(), row["id"]))
                if row["notification_kind"] == "quote":
                    db.execute("UPDATE quotes SET status = 'sent' WHERE id = ? AND current_version = ? AND status = 'issued'",
                               (row["quote_id"], row["version"]))
                db.commit()
            sent += 1
    return {"sent": sent, "failed": failed}


if __name__ == "__main__":
    print(process_once())
