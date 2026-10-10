"""First Phase 1 vertical slice: public discovery, durable intake, staff follow-up."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Literal
from urllib.parse import unquote

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator


DB_PATH = Path(os.getenv("OIL_DB_PATH", Path(__file__).resolve().parents[2] / "data" / "oil.db"))
FILE_PATH = Path(os.getenv("OIL_FILE_PATH", Path(__file__).resolve().parents[2] / "data" / "uploads"))
SESSION_HOURS = 8


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize()
    yield


app = FastAPI(title="Industrial Oils API", version="0.1.0", lifespan=lifespan)


@app.middleware("http")
async def private_response_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(("/api/admin", "/api/portal", "/api/auth")):
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def database():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 10000")
    try:
        yield connection
    finally:
        connection.close()


def initialize() -> None:
    with database() as db:
        db.executescript(
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS staff (
                id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
                role TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, staff_id TEXT NOT NULL REFERENCES staff(id),
                csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
                category TEXT NOT NULL, grade TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '', applications TEXT NOT NULL DEFAULT '',
                packaging TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS inventory_lots (
                id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
                origin TEXT NOT NULL DEFAULT '', packing TEXT NOT NULL DEFAULT '',
                quantity TEXT NOT NULL, reserved_quantity TEXT NOT NULL DEFAULT '0',
                unit TEXT NOT NULL, public_visible INTEGER NOT NULL DEFAULT 0,
                show_quantity INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS inventory_events (
                id TEXT PRIMARY KEY, lot_id TEXT NOT NULL REFERENCES inventory_lots(id),
                staff_id TEXT NOT NULL REFERENCES staff(id), action TEXT NOT NULL,
                amount TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS companies (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL,
                verification_status TEXT NOT NULL DEFAULT 'not_reviewed',
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_companies_name ON companies(normalized_name);
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
                name TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL,
                UNIQUE(company_id, email)
            );
            CREATE TABLE IF NOT EXISTS inquiries (
                id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL,
                kind TEXT NOT NULL CHECK(kind IN ('buy','sell','contact')),
                company_id TEXT NOT NULL REFERENCES companies(id),
                contact_id TEXT NOT NULL REFERENCES contacts(id),
                product_id TEXT REFERENCES products(id), lot_id TEXT REFERENCES inventory_lots(id),
                product_text TEXT NOT NULL DEFAULT '', quantity TEXT NOT NULL DEFAULT '',
                unit TEXT NOT NULL DEFAULT '', destination_country TEXT NOT NULL DEFAULT '',
                origin TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'new', assigned_to TEXT REFERENCES staff(id),
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_inquiries_kind_created ON inquiries(kind, created_at);
            CREATE TABLE IF NOT EXISTS idempotency (
                key TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, inquiry_id TEXT NOT NULL REFERENCES inquiries(id)
            );
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY, inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
                staff_id TEXT NOT NULL REFERENCES staff(id), body TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
                staff_id TEXT NOT NULL REFERENCES staff(id), title TEXT NOT NULL,
                due_date TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'normal',
                status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS activity (
                id TEXT PRIMARY KEY, inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
                staff_id TEXT REFERENCES staff(id), action TEXT NOT NULL,
                detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS outbox (
                id TEXT PRIMARY KEY, inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
                kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
                quote_revision_id TEXT,
                attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT '',
                sent_at TEXT, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS upload_tokens (
                inquiry_id TEXT PRIMARY KEY REFERENCES inquiries(id), token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY, inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
                filename TEXT NOT NULL, media_type TEXT NOT NULL, bytes INTEGER NOT NULL,
                storage_name TEXT NOT NULL, scan_status TEXT NOT NULL DEFAULT 'unscanned',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS rate_limits (
                scope TEXT NOT NULL, subject TEXT NOT NULL, window_start INTEGER NOT NULL,
                count INTEGER NOT NULL, PRIMARY KEY(scope, subject, window_start)
            );
            CREATE TABLE IF NOT EXISTS portal_users (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
                contact_id TEXT NOT NULL REFERENCES contacts(id), email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('customer','supplier')),
                active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS portal_sessions (
                token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES portal_users(id),
                csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS portal_invites (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
                contact_id TEXT NOT NULL REFERENCES contacts(id), email TEXT NOT NULL,
                role TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL, used_at TEXT,
                created_by TEXT NOT NULL REFERENCES staff(id), created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS portal_messages (
                id TEXT PRIMARY KEY, inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
                sender_type TEXT NOT NULL CHECK(sender_type IN ('staff','portal')),
                sender_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS portal_drafts (
                user_id TEXT PRIMARY KEY REFERENCES portal_users(id), payload_json TEXT NOT NULL,
                expires_at TEXT NOT NULL, submitted_reference TEXT, updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS portal_saved_products (
                user_id TEXT NOT NULL REFERENCES portal_users(id), product_id TEXT NOT NULL REFERENCES products(id),
                created_at TEXT NOT NULL, PRIMARY KEY(user_id, product_id)
            );
            CREATE TABLE IF NOT EXISTS portal_password_resets (
                token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES portal_users(id),
                expires_at TEXT NOT NULL, used_at TEXT, created_by TEXT NOT NULL REFERENCES staff(id),
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS access_events (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
                actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL,
                detail TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS inquiry_operations (
                inquiry_id TEXT PRIMARY KEY REFERENCES inquiries(id), priority TEXT NOT NULL DEFAULT 'normal',
                next_action TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL REFERENCES staff(id), updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS export_events (
                id TEXT PRIMARY KEY, staff_id TEXT NOT NULL REFERENCES staff(id), dataset TEXT NOT NULL,
                period_start TEXT NOT NULL, period_end TEXT NOT NULL, record_count INTEGER NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS verification_events (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
                staff_id TEXT NOT NULL REFERENCES staff(id), old_status TEXT NOT NULL,
                new_status TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS company_compliance (
                company_id TEXT PRIMARY KEY REFERENCES companies(id),
                registration_information TEXT NOT NULL DEFAULT '',
                buyer_country TEXT NOT NULL DEFAULT '', supplier_country TEXT NOT NULL DEFAULT '',
                product_origin TEXT NOT NULL DEFAULT '', destination_country TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'not_reviewed', hold INTEGER NOT NULL DEFAULT 0,
                review_notes TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL REFERENCES staff(id),
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS compliance_events (
                id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
                staff_id TEXT NOT NULL REFERENCES staff(id), old_status TEXT NOT NULL,
                new_status TEXT NOT NULL, old_hold INTEGER NOT NULL, new_hold INTEGER NOT NULL,
                reason TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS quotes (
                id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE,
                inquiry_id TEXT NOT NULL REFERENCES inquiries(id),
                company_id TEXT NOT NULL REFERENCES companies(id),
                status TEXT NOT NULL DEFAULT 'draft', current_version INTEGER NOT NULL DEFAULT 1,
                created_by TEXT NOT NULL REFERENCES staff(id), created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS quote_revisions (
                id TEXT PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES quotes(id),
                version INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('draft','issued')),
                currency TEXT NOT NULL, incoterm TEXT NOT NULL, named_place TEXT NOT NULL,
                payment_terms TEXT NOT NULL, delivery_terms TEXT NOT NULL,
                validity_date TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
                total TEXT NOT NULL, issued_at TEXT, accepted_at TEXT,
                created_at TEXT NOT NULL, UNIQUE(quote_id, version)
            );
            CREATE TABLE IF NOT EXISTS quote_items (
                id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES quote_revisions(id),
                description TEXT NOT NULL, quantity TEXT NOT NULL, unit TEXT NOT NULL,
                unit_price TEXT NOT NULL, line_total TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS proformas (
                id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE,
                quote_revision_id TEXT NOT NULL UNIQUE REFERENCES quote_revisions(id),
                created_by TEXT NOT NULL REFERENCES staff(id), created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS commercial_events (
                id TEXT PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES quotes(id),
                revision_id TEXT REFERENCES quote_revisions(id), actor_type TEXT NOT NULL,
                actor_id TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );
            """
        )
        # Development schema upgrades for databases created by an earlier slice.
        for table, additions in {
            "inventory_lots": {
                "reserved_quantity": "TEXT NOT NULL DEFAULT '0'",
                "show_quantity": "INTEGER NOT NULL DEFAULT 0",
            },
            "outbox": {
                "quote_revision_id": "TEXT",
                "attempts": "INTEGER NOT NULL DEFAULT 0",
                "last_error": "TEXT NOT NULL DEFAULT ''",
                "sent_at": "TEXT",
            },
            "companies": {
                "verification_status": "TEXT NOT NULL DEFAULT 'not_reviewed'",
            },
            "quote_revisions": {
                "customer_name": "TEXT NOT NULL DEFAULT ''",
                "source_context_json": "TEXT NOT NULL DEFAULT '{}'",
                "origin": "TEXT NOT NULL DEFAULT ''",
                "packing": "TEXT NOT NULL DEFAULT ''",
                "loading_port": "TEXT NOT NULL DEFAULT ''",
                "destination": "TEXT NOT NULL DEFAULT ''",
                "terms": "TEXT NOT NULL DEFAULT ''",
                "contact_name": "TEXT NOT NULL DEFAULT ''",
                "contact_email": "TEXT NOT NULL DEFAULT ''",
            },
        }.items():
            existing = {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}
            for column, definition in additions.items():
                if column not in existing:
                    db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        db.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_quote_revision ON outbox(quote_revision_id) "
                   "WHERE quote_revision_id IS NOT NULL")
        db.execute("UPDATE quote_revisions SET customer_name = (SELECT c.name FROM quotes q "
                   "JOIN companies c ON c.id = q.company_id WHERE q.id = quote_revisions.quote_id) WHERE customer_name = ''")
        from backend.app.phase3_schema import migrate
        migrate(db)


def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}:{digest.hex()}"


def password_matches(password: str, encoded: str) -> bool:
    try:
        salt_hex, digest_hex = encoded.split(":", 1)
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(digest, bytes.fromhex(digest_hex))
    except (ValueError, TypeError):
        return False


def create_staff(email: str, password: str, role: str = "admin") -> str:
    if len(password) < 14:
        raise ValueError("Staff password must have at least 14 characters")
    if role not in {"admin", "sales", "procurement"}:
        raise ValueError("Unsupported role")
    initialize()
    staff_id = str(uuid.uuid4())
    with database() as db:
        db.execute("INSERT INTO staff VALUES (?, ?, ?, ?, ?)",
                   (staff_id, email.strip().lower(), password_hash(password), role, utc_now()))
    return staff_id


def enforce_rate_limit(scope: str, subject: str, max_attempts: int, window_seconds: int) -> None:
    window_start = int(time.time()) // window_seconds * window_seconds
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("INSERT INTO rate_limits VALUES (?, ?, ?, 1) ON CONFLICT(scope, subject, window_start) "
                   "DO UPDATE SET count = count + 1", (scope, subject, window_start))
        count = db.execute("SELECT count FROM rate_limits WHERE scope = ? AND subject = ? AND window_start = ?",
                           (scope, subject, window_start)).fetchone()[0]
        db.commit()
    if count > max_attempts:
        raise HTTPException(429, "Too many attempts. Please try again later")


def staff_user(oil_session: str | None = Cookie(default=None)) -> dict:
    if not oil_session:
        raise HTTPException(401, "Sign in required")
    with database() as db:
        row = db.execute(
            "SELECT staff.id, staff.email, staff.role, sessions.csrf_token FROM sessions "
            "JOIN staff ON staff.id = sessions.staff_id WHERE token_hash = ? AND expires_at > ?",
            (hashlib.sha256(oil_session.encode()).hexdigest(), utc_now()),
        ).fetchone()
    if row is None:
        raise HTTPException(401, "Session expired")
    return dict(row)


def check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin != str(request.base_url).rstrip("/"):
        # Vite proxy uses the browser's frontend origin. Configure it explicitly in development.
        configured_origin = os.getenv("OIL_FRONTEND_ORIGIN")
        allowed = {configured_origin} if configured_origin else {"http://localhost:5173", "http://127.0.0.1:5173"}
        if origin not in allowed:
            raise HTTPException(403, "Origin rejected")


def mutation_staff(request: Request, x_csrf_token: str | None = Header(default=None),
                   user: dict = Depends(staff_user)) -> dict:
    check_origin(request)
    if not x_csrf_token or not hmac.compare_digest(x_csrf_token, user["csrf_token"]):
        raise HTTPException(403, "CSRF token required")
    return user


class LoginInput(BaseModel):
    email: str = Field(min_length=5, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str


@app.post("/api/auth/login")
def login(body: LoginInput, response: Response, request: Request):
    check_origin(request)
    enforce_rate_limit("login", f"{request.client.host}:{body.email.lower()}", 8, 15 * 60)
    with database() as db:
        row = db.execute("SELECT * FROM staff WHERE email = ?", (body.email.lower(),)).fetchone()
        if row is None or not password_matches(body.password, row["password_hash"]):
            raise HTTPException(401, "Invalid credentials")
        token = secrets.token_urlsafe(32)
        csrf = secrets.token_urlsafe(24)
        expires = (datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)).isoformat()
        db.execute("INSERT INTO sessions VALUES (?, ?, ?, ?)",
                   (hashlib.sha256(token.encode()).hexdigest(), row["id"], csrf, expires))
    response.set_cookie("oil_session", token, httponly=True, secure=os.getenv("OIL_COOKIE_SECURE") == "1",
                        samesite="lax", max_age=SESSION_HOURS * 3600)
    return {"email": row["email"], "role": row["role"], "csrf_token": csrf}


@app.get("/api/auth/me")
def me(user: dict = Depends(staff_user)):
    return {"email": user["email"], "role": user["role"], "csrf_token": user["csrf_token"]}


@app.post("/api/auth/logout")
def logout(response: Response, oil_session: str | None = Cookie(default=None),
           user: dict = Depends(mutation_staff)):
    with database() as db:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (hashlib.sha256(oil_session.encode()).hexdigest(),))
    response.delete_cookie("oil_session")
    return {"ok": True}


class ProductInput(BaseModel):
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str = Field(min_length=2, max_length=160)
    category: str = Field(min_length=2, max_length=80)
    grade: str = Field(default="", max_length=80)
    description: str = Field(default="", max_length=4000)
    applications: str = Field(default="", max_length=1000)
    packaging: str = Field(default="", max_length=500)
    published: bool = False


class LotInput(BaseModel):
    product_id: str
    origin: str = Field(default="", max_length=80)
    packing: str = Field(default="", max_length=80)
    quantity: Decimal = Field(ge=0)
    unit: Literal["MT", "KG", "Litre", "Barrel", "Drum", "IBC"]
    public_visible: bool = False
    show_quantity: bool = False


@app.get("/api/products")
def products(q: str = "", category: str = ""):
    with database() as db:
        rows = db.execute(
            "SELECT id, slug, name, category, grade, description, applications, packaging, updated_at "
            "FROM products WHERE published = 1 AND (? = '' OR name LIKE ? OR grade LIKE ?) "
            "AND (? = '' OR category = ?) ORDER BY name LIMIT 100",
            (q, f"%{q}%", f"%{q}%", category, category),
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/products/{slug}")
def product(slug: str):
    with database() as db:
        row = db.execute("SELECT id, slug, name, category, grade, description, applications, packaging, updated_at "
                         "FROM products WHERE slug = ? AND published = 1", (slug,)).fetchone()
        if row is None:
            raise HTTPException(404, "Product not found")
        lots = db.execute("SELECT id, origin, packing, quantity, reserved_quantity, show_quantity, unit, updated_at FROM inventory_lots "
                          "WHERE product_id = ? AND public_visible = 1 ORDER BY updated_at DESC", (row["id"],)).fetchall()
    return {**dict(row), "lots": [public_lot(lot) for lot in lots]}


def public_lot(row: sqlite3.Row) -> dict:
    item = dict(row)
    available = Decimal(item["quantity"]) - Decimal(item.pop("reserved_quantity"))
    item["quantity"] = str(available) if item.pop("show_quantity") else None
    return item


@app.get("/api/stock")
def stock():
    with database() as db:
        rows = db.execute("SELECT l.id, l.product_id, p.slug, p.name, p.grade, l.origin, l.packing, "
                          "l.quantity, l.reserved_quantity, l.show_quantity, l.unit, l.updated_at FROM inventory_lots l JOIN products p ON p.id = l.product_id "
                          "WHERE p.published = 1 AND l.public_visible = 1 ORDER BY l.updated_at DESC LIMIT 100").fetchall()
    return [public_lot(row) for row in rows]


@app.post("/api/admin/products", status_code=201)
def add_product(body: ProductInput, user: dict = Depends(mutation_staff)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    product_id = str(uuid.uuid4())
    with database() as db:
        try:
            db.execute("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       (product_id, body.slug, body.name, body.category, body.grade, body.description,
                        body.applications, body.packaging, int(body.published), utc_now()))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Product slug already exists") from None
    return {"id": product_id}


@app.post("/api/admin/lots", status_code=201)
def add_lot(body: LotInput, user: dict = Depends(mutation_staff)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    lot_id = str(uuid.uuid4())
    with database() as db:
        try:
            db.execute("INSERT INTO inventory_lots (id, product_id, origin, packing, quantity, unit, public_visible, show_quantity, updated_at) "
                       "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       (lot_id, body.product_id, body.origin, body.packing, str(body.quantity),
                        body.unit, int(body.public_visible), int(body.show_quantity), utc_now()))
        except sqlite3.IntegrityError:
            raise HTTPException(400, "Unknown product") from None
    return {"id": lot_id}


class StockChange(BaseModel):
    action: Literal["reserve", "release", "increase", "decrease"]
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=3, max_length=500)


@app.post("/api/admin/lots/{lot_id}/change")
def change_stock(lot_id: str, body: StockChange, user: dict = Depends(mutation_staff)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        lot = db.execute("SELECT quantity, reserved_quantity FROM inventory_lots WHERE id = ?", (lot_id,)).fetchone()
        if lot is None:
            raise HTTPException(404, "Stock lot not found")
        on_hand, reserved = Decimal(lot["quantity"]), Decimal(lot["reserved_quantity"])
        if body.action == "reserve":
            if body.amount > on_hand - reserved:
                raise HTTPException(409, "Not enough available stock")
            reserved += body.amount
        elif body.action == "release":
            if body.amount > reserved:
                raise HTTPException(409, "Release exceeds reserved stock")
            reserved -= body.amount
        elif body.action == "increase":
            on_hand += body.amount
        else:
            if body.amount > on_hand - reserved:
                raise HTTPException(409, "Adjustment would exceed available stock")
            on_hand -= body.amount
        now = utc_now()
        db.execute("UPDATE inventory_lots SET quantity = ?, reserved_quantity = ?, updated_at = ? WHERE id = ?",
                   (str(on_hand), str(reserved), now, lot_id))
        db.execute("INSERT INTO inventory_events VALUES (?, ?, ?, ?, ?, ?, ?)",
                   (str(uuid.uuid4()), lot_id, user["id"], body.action, str(body.amount), body.reason, now))
        db.commit()
    return {"quantity": str(on_hand), "reserved_quantity": str(reserved), "available_quantity": str(on_hand - reserved)}


class InquiryInput(BaseModel):
    kind: Literal["buy", "sell", "contact"]
    company_name: str = Field(min_length=2, max_length=160)
    contact_name: str = Field(min_length=2, max_length=160)
    email: str = Field(min_length=5, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    product_id: str | None = None
    lot_id: str | None = None
    product_text: str = Field(default="", max_length=160)
    quantity: Decimal | None = Field(default=None, gt=0)
    unit: Literal["MT", "KG", "Litre", "Barrel", "Drum", "IBC"] | None = None
    destination_country: str = Field(default="", max_length=80)
    origin: str = Field(default="", max_length=80)
    message: str = Field(default="", max_length=4000)
    privacy_accepted: bool

    @field_validator("company_name", "contact_name", mode="before")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


def validate_inquiry(body: InquiryInput, db: sqlite3.Connection) -> None:
    if not body.privacy_accepted:
        raise HTTPException(422, "Accept the privacy policy to submit")
    if body.kind in {"buy", "sell"} and (body.quantity is None or body.unit is None):
        raise HTTPException(422, "Quantity and unit are required")
    if body.kind == "buy" and ((not body.product_id and not body.product_text.strip()) or
                               not body.destination_country.strip()):
        raise HTTPException(422, "Product and destination country are required")
    if body.kind == "sell" and not body.product_text.strip():
        raise HTTPException(422, "Offered product is required")
    if body.kind == "contact" and not body.message.strip():
        raise HTTPException(422, "Message is required")
    if body.product_id:
        product_row = db.execute("SELECT id FROM products WHERE id = ? AND published = 1", (body.product_id,)).fetchone()
        if product_row is None:
            raise HTTPException(422, "Product is unavailable")
    if body.lot_id:
        lot = db.execute("SELECT product_id FROM inventory_lots WHERE id = ? AND public_visible = 1", (body.lot_id,)).fetchone()
        if lot is None or lot["product_id"] != body.product_id:
            raise HTTPException(422, "Selected stock is unavailable")


@app.post("/api/inquiries", status_code=201)
def create_inquiry(body: InquiryInput, request: Request, idempotency_key: str | None = Header(default=None),
                   oil_portal: str | None = Cookie(default=None), x_csrf_token: str | None = Header(default=None)):
    if not idempotency_key or len(idempotency_key) > 100:
        raise HTTPException(400, "Idempotency-Key header required")
    enforce_rate_limit("inquiry", request.client.host, 30, 60 * 60)
    now = utc_now()
    payload_hash = hashlib.sha256(body.model_dump_json().encode()).hexdigest()
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        normalized = " ".join(body.company_name.casefold().split())
        # A portal cookie alone cannot authorize attaching a public form to private history.
        verified_identity = None
        if oil_portal:
            verified_identity = db.execute(
                "SELECT c.id, s.csrf_token FROM portal_sessions s JOIN portal_users p ON p.id = s.user_id "
                "JOIN companies c ON c.id = p.company_id WHERE s.token_hash = ? AND s.expires_at > ? "
                "AND p.active = 1 AND c.verification_status = 'approved' AND p.email = ? "
                "AND c.normalized_name = ? AND p.role = ?",
                (hashlib.sha256(oil_portal.encode()).hexdigest(), now, body.email.lower(), normalized,
                 "supplier" if body.kind == "sell" else "customer"),
            ).fetchone()
        if verified_identity:
            check_origin(request)
            if not x_csrf_token or not hmac.compare_digest(x_csrf_token, verified_identity["csrf_token"]):
                raise HTTPException(403, "CSRF token required for portal-linked submissions")
        existing = db.execute("SELECT payload_hash, inquiry_id FROM idempotency WHERE key = ?", (idempotency_key,)).fetchone()
        if existing:
            if existing["payload_hash"] != payload_hash:
                raise HTTPException(409, "Idempotency key used for a different request")
            saved = db.execute("SELECT i.reference, i.company_id, EXISTS(SELECT 1 FROM portal_users p WHERE p.company_id = i.company_id) AS private "
                               "FROM inquiries i WHERE i.id = ?", (existing["inquiry_id"],)).fetchone()
            if saved["private"] and (not verified_identity or verified_identity["id"] != saved["company_id"]):
                raise HTTPException(403, "Verified portal identity required to retry this submission")
            ref = saved["reference"]
            upload_token = secrets.token_urlsafe(32)
            db.execute("INSERT INTO upload_tokens VALUES (?, ?, ?) ON CONFLICT(inquiry_id) DO UPDATE SET "
                       "token_hash = excluded.token_hash, expires_at = excluded.expires_at",
                       (existing["inquiry_id"], hashlib.sha256(upload_token.encode()).hexdigest(),
                        (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()))
            db.commit()
            return {"reference": ref, "upload_token": upload_token}
        validate_inquiry(body, db)
        company_id = str(uuid.uuid4())
        contact_id = str(uuid.uuid4())
        inquiry_id = str(uuid.uuid4())
        company = verified_identity or db.execute(
            "SELECT c.id FROM companies c JOIN contacts t ON t.company_id = c.id "
            "WHERE c.normalized_name = ? AND t.email = ? "
            "AND NOT EXISTS (SELECT 1 FROM portal_users p WHERE p.company_id = c.id) LIMIT 1",
            (normalized, body.email.lower()),
        ).fetchone()
        if company:
            company_id = company["id"]
        else:
            db.execute("INSERT INTO companies (id, name, normalized_name, created_at) VALUES (?, ?, ?, ?)",
                       (company_id, body.company_name, normalized, now))
        contact = db.execute("SELECT id FROM contacts WHERE company_id = ? AND email = ?", (company_id, body.email.lower())).fetchone()
        if contact:
            contact_id = contact["id"]
        else:
            db.execute("INSERT INTO contacts VALUES (?, ?, ?, ?, ?)",
                       (contact_id, company_id, body.contact_name, body.email.lower(), now))
        reference = f"{body.kind.upper()}-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(4).upper()}"
        db.execute("INSERT INTO inquiries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (inquiry_id, reference, body.kind, company_id, contact_id, body.product_id, body.lot_id,
                    body.product_text, str(body.quantity) if body.quantity is not None else "", body.unit or "",
                    body.destination_country, body.origin, body.message, "new", None, now, now))
        db.execute("INSERT INTO idempotency VALUES (?, ?, ?)", (idempotency_key, payload_hash, inquiry_id))
        db.execute("INSERT INTO activity VALUES (?, ?, NULL, 'created', '', ?)", (str(uuid.uuid4()), inquiry_id, now))
        for kind in ("internal", "confirmation"):
            db.execute("INSERT INTO outbox (id, inquiry_id, kind, status, created_at) VALUES (?, ?, ?, 'queued', ?)",
                       (str(uuid.uuid4()), inquiry_id, kind, now))
        upload_token = secrets.token_urlsafe(32)
        db.execute("INSERT INTO upload_tokens VALUES (?, ?, ?)",
                   (inquiry_id, hashlib.sha256(upload_token.encode()).hexdigest(),
                    (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()))
        db.commit()
    return {"reference": reference, "upload_token": upload_token}


@app.post("/api/inquiries/{reference}/documents", status_code=201)
async def upload_document(reference: str, request: Request, x_upload_token: str | None = Header(default=None),
                          x_filename: str | None = Header(default=None), x_filename_encoding: str | None = Header(default=None)):
    enforce_rate_limit("upload", request.client.host, 30, 60 * 60)
    if not x_upload_token or not x_filename:
        raise HTTPException(403, "Upload authorization required")
    with database() as db:
        row = db.execute("SELECT i.id, i.kind, t.token_hash, t.expires_at FROM inquiries i "
                         "JOIN upload_tokens t ON t.inquiry_id = i.id WHERE i.reference = ?", (reference,)).fetchone()
    if row is None or row["expires_at"] <= utc_now() or not hmac.compare_digest(
        row["token_hash"], hashlib.sha256(x_upload_token.encode()).hexdigest()
    ):
        raise HTTPException(403, "Upload authorization expired")
    if row["kind"] != "sell":
        raise HTTPException(403, "Documents are only accepted with supplier offers in this release")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 10 * 1024 * 1024:
            raise HTTPException(413, "File exceeds 10 MB")
    if not data:
        raise HTTPException(422, "Empty file")
    magic = bytes(data[:12])
    if magic.startswith(b"%PDF-"):
        media_type, extension = "application/pdf", ".pdf"
    elif magic.startswith(b"\x89PNG\r\n\x1a\n"):
        media_type, extension = "image/png", ".png"
    elif magic.startswith(b"\xff\xd8\xff"):
        media_type, extension = "image/jpeg", ".jpg"
    else:
        raise HTTPException(415, "Only PDF, PNG, and JPEG documents are accepted")
    try:
        supplied_name = unquote(x_filename, errors="strict") if x_filename_encoding == "utf8-percent" else x_filename
    except UnicodeDecodeError:
        raise HTTPException(422, "Invalid filename encoding") from None
    name = Path(supplied_name).name[:160]
    document_id = str(uuid.uuid4())
    storage_name = document_id + extension
    FILE_PATH.mkdir(parents=True, exist_ok=True)
    target = FILE_PATH / storage_name
    target.write_bytes(data)
    try:
        with database() as db:
            db.execute("INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, 'unscanned', ?)",
                       (document_id, row["id"], name, media_type, len(data), storage_name, utc_now()))
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return {"id": document_id, "scan_status": "unscanned"}


def scoped_inquiry(db: sqlite3.Connection, inquiry_id: str, user: dict):
    row = db.execute("SELECT i.*, c.name AS company_name, t.name AS contact_name, t.email "
                     "FROM inquiries i JOIN companies c ON c.id = i.company_id "
                     "JOIN contacts t ON t.id = i.contact_id WHERE i.id = ?", (inquiry_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Inquiry not found")
    if user["role"] == "sales" and row["kind"] == "sell":
        raise HTTPException(403, "Procurement only")
    if user["role"] == "procurement" and row["kind"] != "sell":
        raise HTTPException(403, "Sales only")
    return row


@app.get("/api/admin/inquiries")
def list_inquiries(kind: str = "", q: str = Query(default="", max_length=160),
                   owner: Literal["all", "mine", "unassigned"] = "all",
                   priority: Literal["", "low", "normal", "high"] = "",
                   offset: int = Query(default=0, ge=0), user: dict = Depends(staff_user)):
    if kind and kind not in {"buy", "sell", "contact"}:
        raise HTTPException(422, "Invalid inquiry type")
    scope = " AND kind != 'sell'" if user["role"] == "sales" else " AND kind = 'sell'" if user["role"] == "procurement" else ""
    with database() as db:
        rows = db.execute("SELECT i.id, i.reference, i.kind, i.status, i.created_at, i.product_text, i.company_id, i.assigned_to, "
                          "COALESCE(o.priority, 'normal') AS priority, s.email AS owner_email, "
                          "c.name AS company_name, t.name AS contact_name FROM inquiries i "
                          "JOIN companies c ON c.id = i.company_id JOIN contacts t ON t.id = i.contact_id "
                          "LEFT JOIN inquiry_operations o ON o.inquiry_id = i.id LEFT JOIN staff s ON s.id = i.assigned_to "
                          "WHERE (? = '' OR i.kind = ?) AND (? = '' OR c.name LIKE ? OR i.reference LIKE ? OR i.product_text LIKE ? OR t.email LIKE ?) "
                          "AND (? = 'all' OR (? = 'mine' AND i.assigned_to = ?) OR (? = 'unassigned' AND i.assigned_to IS NULL)) "
                          "AND (? = '' OR COALESCE(o.priority, 'normal') = ?)" + scope + " ORDER BY i.created_at DESC LIMIT 100 OFFSET ?",
                          (kind, kind, q, f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%", owner, owner, user["id"], owner, priority, priority, offset)).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/admin/dashboard")
def dashboard(user: dict = Depends(staff_user)):
    scope = "kind != 'sell'" if user["role"] == "sales" else "kind = 'sell'" if user["role"] == "procurement" else "1 = 1"
    month_start = datetime.now(timezone.utc).strftime("%Y-%m-01")
    with database() as db:
        counts = db.execute(
            f"SELECT count(*) AS total, "
            f"sum(CASE WHEN kind = 'buy' THEN 1 ELSE 0 END) AS rfqs, "
            f"sum(CASE WHEN kind = 'sell' THEN 1 ELSE 0 END) AS offers, "
            f"sum(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won, "
            f"sum(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost, "
            f"sum(CASE WHEN status NOT IN ('won','lost','rejected','completed','closed') THEN 1 ELSE 0 END) AS open, "
            f"sum(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS leads_this_month "
            f"FROM inquiries WHERE {scope}", (month_start,),
        ).fetchone()
        due = db.execute(
            "SELECT count(*) FROM tasks t JOIN inquiries i ON i.id = t.inquiry_id "
            f"WHERE t.status = 'pending' AND t.due_date < date('now') AND {scope}"
        ).fetchone()[0]
        top_products = db.execute(
            "SELECT p.name, count(*) AS inquiries FROM inquiries i JOIN products p ON p.id = i.product_id "
            f"WHERE {scope} GROUP BY p.id ORDER BY inquiries DESC LIMIT 5"
        ).fetchall()
        top_countries = db.execute(
            "SELECT destination_country AS country, count(*) AS inquiries FROM inquiries "
            f"WHERE {scope} AND destination_country != '' GROUP BY destination_country ORDER BY inquiries DESC LIMIT 5"
        ).fetchall()
    return {"period_start": month_start, "counts": dict(counts), "overdue_tasks": due,
            "top_products": [dict(row) for row in top_products],
            "top_countries": [dict(row) for row in top_countries]}


@app.get("/api/admin/inquiries/{inquiry_id}")
def get_inquiry(inquiry_id: str, user: dict = Depends(staff_user)):
    with database() as db:
        row = scoped_inquiry(db, inquiry_id, user)
        notes = db.execute("SELECT n.body, n.created_at, s.email AS author FROM notes n "
                           "JOIN staff s ON s.id = n.staff_id WHERE inquiry_id = ? ORDER BY n.created_at", (inquiry_id,)).fetchall()
        activity = db.execute("SELECT action, detail, created_at FROM activity WHERE inquiry_id = ? ORDER BY created_at", (inquiry_id,)).fetchall()
        documents = db.execute("SELECT id, filename, media_type, bytes, scan_status, created_at FROM documents "
                               "WHERE inquiry_id = ? ORDER BY created_at", (inquiry_id,)).fetchall()
        tasks = db.execute("SELECT id, title, due_date, priority, status, created_at FROM tasks "
                           "WHERE inquiry_id = ? ORDER BY due_date", (inquiry_id,)).fetchall()
    return {**dict(row), "notes": [dict(note) for note in notes], "activity": [dict(item) for item in activity],
            "documents": [dict(doc) for doc in documents], "tasks": [dict(task) for task in tasks]}


@app.get("/api/admin/documents/{document_id}")
def download_document(document_id: str, user: dict = Depends(staff_user)):
    with database() as db:
        row = db.execute("SELECT d.*, i.id AS inquiry_id FROM documents d "
                         "JOIN inquiries i ON i.id = d.inquiry_id WHERE d.id = ?", (document_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Document not found")
        scoped_inquiry(db, row["inquiry_id"], user)
    target = FILE_PATH / row["storage_name"]
    if not target.is_file():
        raise HTTPException(503, "Document temporarily unavailable")
    return FileResponse(target, media_type="application/octet-stream", filename=row["filename"],
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


class MessageInput(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


@app.get("/api/admin/inquiries/{inquiry_id}/messages")
def staff_messages(inquiry_id: str, user: dict = Depends(staff_user)):
    with database() as db:
        scoped_inquiry(db, inquiry_id, user)
        rows = db.execute("SELECT sender_type, body, created_at FROM portal_messages "
                          "WHERE inquiry_id = ? ORDER BY created_at", (inquiry_id,)).fetchall()
    return [dict(row) for row in rows]


@app.post("/api/admin/inquiries/{inquiry_id}/messages", status_code=201)
def staff_send_message(inquiry_id: str, body: MessageInput, user: dict = Depends(mutation_staff)):
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        scoped_inquiry(db, inquiry_id, user)
        message_id = str(uuid.uuid4())
        db.execute("INSERT INTO portal_messages VALUES (?, ?, 'staff', ?, ?, ?)",
                   (message_id, inquiry_id, user["id"], body.body.strip(), utc_now()))
        db.commit()
    return {"id": message_id}


class FollowUpInput(BaseModel):
    status: str | None = None
    note: str = Field(default="", max_length=4000)


INQUIRY_STAGES = {
    "buy": {"new", "reviewing", "qualified", "quotation_preparing", "quotation_sent", "negotiating", "won", "lost", "rejected"},
    "sell": {"new", "reviewing", "technical_review", "price_review", "negotiating", "approved", "purchase_decision", "completed", "rejected"},
    "contact": {"new", "reviewing", "closed"},
}


@app.post("/api/admin/inquiries/{inquiry_id}/follow-up")
def follow_up(inquiry_id: str, body: FollowUpInput, user: dict = Depends(mutation_staff)):
    if not body.status and not body.note.strip():
        raise HTTPException(422, "Enter a note or status")
    if body.status in {"lost", "rejected"} and not body.note.strip():
        raise HTTPException(422, "A reason is required")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        row = scoped_inquiry(db, inquiry_id, user)
        if body.status and body.status not in INQUIRY_STAGES[row["kind"]]:
            raise HTTPException(422, "Stage is not valid for this inquiry type")
        now = utc_now()
        if body.status and body.status != row["status"]:
            db.execute("UPDATE inquiries SET status = ?, assigned_to = COALESCE(assigned_to, ?), updated_at = ? WHERE id = ?",
                       (body.status, user["id"], now, inquiry_id))
            db.execute("INSERT INTO activity VALUES (?, ?, ?, 'status_changed', ?, ?)",
                       (str(uuid.uuid4()), inquiry_id, user["id"], f"{row['status']} → {body.status}", now))
        if body.note.strip():
            db.execute("INSERT INTO notes VALUES (?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), inquiry_id, user["id"], body.note.strip(), now))
            db.execute("INSERT INTO activity VALUES (?, ?, ?, 'note_added', '', ?)",
                       (str(uuid.uuid4()), inquiry_id, user["id"], now))
        db.commit()
    return {"ok": True}


class TaskInput(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    due_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    priority: Literal["low", "normal", "high"] = "normal"

    @field_validator("due_date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        try:
            datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Due date must be a valid date") from None
        return value


@app.post("/api/admin/inquiries/{inquiry_id}/tasks", status_code=201)
def add_task(inquiry_id: str, body: TaskInput, user: dict = Depends(mutation_staff)):
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        scoped_inquiry(db, inquiry_id, user)
        task_id = str(uuid.uuid4())
        now = utc_now()
        db.execute("INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
                   (task_id, inquiry_id, user["id"], body.title.strip(), body.due_date, body.priority, now))
        db.execute("INSERT INTO activity VALUES (?, ?, ?, 'task_created', ?, ?)",
                   (str(uuid.uuid4()), inquiry_id, user["id"], body.title.strip(), now))
        db.commit()
    return {"id": task_id}


@app.post("/api/admin/inquiries/{inquiry_id}/tasks/{task_id}/complete")
def complete_task(inquiry_id: str, task_id: str, user: dict = Depends(mutation_staff)):
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        scoped_inquiry(db, inquiry_id, user)
        task = db.execute("SELECT id, status FROM tasks WHERE id = ? AND inquiry_id = ?", (task_id, inquiry_id)).fetchone()
        if task is None:
            raise HTTPException(404, "Task not found")
        if task["status"] != "completed":
            now = utc_now()
            db.execute("UPDATE tasks SET status = 'completed' WHERE id = ?", (task_id,))
            db.execute("INSERT INTO activity VALUES (?, ?, ?, 'task_completed', '', ?)",
                       (str(uuid.uuid4()), inquiry_id, user["id"], now))
        db.commit()
    return {"ok": True}


from backend.app.commercial import router as commercial_router  # noqa: E402
from backend.app.portal import router as portal_router  # noqa: E402
from backend.app.operations import router as operations_router  # noqa: E402
from backend.app.shipments import router as shipment_router  # noqa: E402
from backend.app.integrations import router as integration_router  # noqa: E402

app.include_router(commercial_router)
app.include_router(portal_router)
app.include_router(operations_router)
app.include_router(shipment_router)
app.include_router(integration_router)
