# Industrial Oils platform — React and FastAPI

This repository contains the public website, CRM, Phase 2 commercial workflows, and a selected Phase 3 shipment/integration package from [the three-phase plan](plan.md), using React and FastAPI with SQLite. This is a **local development build**. No phase has passed its release gate.

## Run locally

From the repository root, install Python dependencies and start the API:

```powershell
python -m pip install -r backend/requirements.txt
python -m backend.create_admin admin@example.com admin
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173`. The development server proxies `/api` to FastAPI. Create separate `sales` and `procurement` accounts with `python -m backend.create_admin <email> <role>` if you want to test role-specific inboxes. Passwords are entered interactively and are not stored in shell history.

The active public pages use the **Padna Sivan** company profile supplied by the project owner. The Persian profile is preserved in `frontend/src/companyProfile.js`; its English version is a working translation. Confirm the official English legal name and approve publication wording before release. The [linked Linka company record](https://linka.ir/company/5e74d1c/%D9%BE%D8%A7%D8%AF%D9%86%D8%A7-%D8%B3%DB%8C%D9%88%D8%A7%D9%86) and its registration notice provide the names and positions shown on `/team`. Home, catalog, product detail, and stock read approved records from the FastAPI public endpoints. Buy, Sell, and Contact submit to the durable inquiry API. No sample product or stock data is published by this change. The former PETROVEX demo pages and mock data remain in source for design reference but are not active routes.

No company phone number, email address, approved individual biography or photograph, certificate, price, product grade, or inventory quantity was supplied. The active site does not display the earlier fictional versions. `/team` lists five Persian names and their positions from the company registration notice published 18 April 2026, with a source link. It does not add biographies, photos, or contact details. Later appointment changes have not been verified. Individual profiles and technical articles still await approved content. Illustrative industry images remain and do not represent company facilities or products. Company copy is still a frontend content module; a reviewed CMS editing and publication workflow remains future work.

The active public images use WebP assets: a full and mobile harbor image plus resized base-oil and process-oil illustrations. The four built WebP assets total about 379 kB; the three formerly active PNGs totaled about 6.47 MB. The original PNGs remain in source as design references. The home hero selects an image by viewport, category images declare intrinsic dimensions, and mobile page banners use the smaller harbor asset.

## Phase 1 functionality

- Public home, searchable product catalog, product detail, published stock, buy request, supplier offer, contact form, About placeholder, and responsive navigation.
- Staff account bootstrap, password hashing, HTTP-only session cookies, CSRF check on staff mutations, role-scoped inbox/detail views, separate Sales and Procurement stages, internal notes, tasks, status changes, activity history, and a basic inquiry dashboard.
- Durable inquiries with unique references, cautious exact company/contact matching, idempotent retry behavior, and queued confirmation/internal notification records. Submission does not depend on email delivery.
- Admin product and lot creation; stock reservations, releases, and audited adjustments using serialized database transactions. Exact public quantity is hidden unless explicitly enabled for a lot.
- Private supplier document upload (PDF/PNG/JPEG, max 10 MB), short-lived upload authorization, content signature check, and role-checked staff download. Files are marked `unscanned`.
- A separately invoked SMTP outbox worker (`python -m backend.app.outbox`) that records sent/failed state. Do **not** run it with real commercial addresses until templates, sender identity, and recipients are approved. It remains idle if SMTP variables are absent.

## Phase 2 functionality

- Sales quotations from buy requests with multiple items, Decimal totals, explicit currencies and quantity units, Incoterm and named place, validity, payment/delivery terms, origin, packing, loading port, destination, and additional terms. Draft editing preserves audit history. Issuing freezes the commercial terms, customer/contact identity, and source product/lot context. Earlier issued revisions stay readable.
- PDF quotations and proformas; duplicate, revise, reject, and cancel actions with audit records. Staff acceptance requires evidence and the reviewed version. Verified customer acceptance also identifies the reviewed version, so a stale page cannot accept newly issued terms. Proformas require an accepted quote and do not establish payment, shipment, or inventory changes.
- Quote email queues with PDF attachments, delivery status, bounded retries, and cancellation of superseded, expired, closed, or held deliveries. `issued`, `queued`, and `sent` remain distinct. No email is sent by the website request handler.
- Administrator-approved customer/supplier invitations, separate portal sessions and CSRF checks, company-scoped inquiries, shared inquiry message threads, protected issued quote revisions and proforma PDFs, profile contact-name editing, and customer saved products. Supplier offers remain private and never create stock.
- Private request/offer drafts retained for 30 days from the latest content change. Drafts resume per account, reject stale submission versions, and submit with a stable server-derived retry identity. Expired drafts are excluded and deleted when the draft endpoint is accessed. Identical saved content preserves the prior submission reference; start a new draft for another submission.
- Portal document upload and company-scoped metadata/downloads. Unscanned files cannot be downloaded through the portal; an approved scanner must mark a file `clean`. No scanner or public scan-status override is provided in this build. Customer commercial PDFs are generated separately from uploaded files.
- Administrator-assisted password recovery using audited, hashed, one-time tokens valid for 30 minutes. Successful recovery revokes every prior portal session. Invitations and recovery tokens require secure manual delivery; self-service recovery email is not implemented.
- Company verification and transaction-review history, commercial holds, review countries/registration information/notes, and audited hold removal. Review status records a staff decision and does not certify legal compliance.
- Team-specific ownership, unassigned queues, priorities, next actions, time in the current stage, company record overviews, search, and due/overdue task reminders. Staff can page through the inbox in batches of 100.
- Reports for selected UTC creation dates, current inquiry stages, owners, and current quotation values separated by currency/status. Forecast, contract, payment, and revenue values remain unavailable until their records and approved calculation policies exist. CSV inquiry exports enforce team scope, neutralize spreadsheet formulas, and record an export audit. Reports/exports reject ranges over 366 days or datasets over 5,000 records rather than silently truncate totals.

## Try the Phase 2 workflow

1. Submit a guest Buy Request at `/buy`; sign in at `/staff` as Sales or Admin and find it in the inbox.
2. In **Quotations**, select the RFQ, enter approved terms, save a draft, and issue it. Download the PDF, or queue delivery for the separately configured worker. Revise to create a new draft while keeping the issued version.
3. As Admin, open **Company verification**, record a review reason, approve the correct company/contact, and create a customer invitation. Use only test identities while developing.
4. At `/portal`, activate the token and sign in. Review issued revisions, accept or decline the current terms, exchange inquiry messages, save products, or save/resume a private request draft. Anonymous submissions using the company name/email are excluded from private portal history; trusted linking requires the account's session and CSRF token.
5. After acceptance, Sales can generate a proforma. It appears in the customer's **Account and documents** section. Supplier invitations expose the supplier's offers and documents, with no customer quotation access.
6. Use the CRM ownership form, task list, reminders, search filters, reports, and period-specific CSV export. To test a review hold, Admin saves a held compliance review and verifies that issue/send/accept/proforma actions are blocked.

For recovery, Admin selects the known account contact, records the identity-review reason, and issues a recovery token. The contact uses the portal **Reset password** tab. Tokens are shown once in the administrator's current UI and are never stored in plaintext in the database.

## Selected Phase 3 package: outbound tracking and reviewed exchange

- Sales/Admin can plan an outbound shipment from an accepted quotation. The record stays private to staff while planned. Staff can record actual status changes with a timezone-aware event time, reason, evidence reference, and optional customer-facing note. The API enforces allowed transitions, version checks, and exact retry identities. Booking and dispatch require an approved company, no commercial hold, and carrier/tracking references. Later evidence can still be recorded if a hold is placed after dispatch; the hold cannot erase a real-world event.
- Only Admin can publish a booked shipment to the verified customer portal. Portal responses omit staff evidence, internal reasons, other companies' records, payment information, and quote pricing. Neither a shipment plan nor a status event reserves, dispatches, or adjusts inventory automatically; there is no carrier system or payment system connected.
- Withdrawing company verification revokes its portal sessions, hides every published shipment, advances each shipment version, and cancels pending outbound snapshots. Reapproval requires a new customer login, a fresh tracking publication, and a newly reviewed outbound snapshot.
- Admin can register an outbound integration profile for logistics, ERP, or BI use with a named owner and contract notes. This is a generic shipment event receiver, **not** a native provider integration. Profiles start paused. Admin explicitly queues a reviewed snapshot and explicitly enables a profile after approving the fixed field contract. The receiver URL and bearer token come only from operator-managed environment variables; the UI and database never return them.
- The worker remains idle unless run explicitly with `--send`. It claims jobs with expiring leases, retries temporary failures with backoff, records each attempt, uses a stable external event ID, and requires an exact acknowledgement. Jobs with outdated shipment versions are cancelled before delivery. A shipment changed during an already started HTTP call remains in reconciliation review even if the old event was acknowledged. A mismatch stays in a review state; Admin can record remote evidence and compare version, status, and external ID. A receiver must deduplicate `event_id` and reject stale shipment versions. This local build has no approved receiver or credentials and has not sent an external shipment event.

### Try Phase 3 locally

1. Accept a quotation in the Phase 2 workflow. At `/staff`, open **Outbound shipments**, create a plan, and review its private history.
2. As Admin, approve the known company. Record a booking with carrier/tracking details and evidence. Publish the booked shipment. Sign in as that company's customer at `/portal` to see only its approved tracking timeline.
3. As Admin, create an integration destination with a business owner. Review the exact payload in the queue. Without a configured HTTPS receiver, the profile remains paused and the worker skips delivery.
4. To test delivery safely, use the isolated test suite. It supplies an in-memory acknowledgement transport and exercises retries, stale snapshots, leases, and reconciliation without network traffic.

For a real receiver, set `OIL_INTEGRATION_<SLUG>_URL` and `OIL_INTEGRATION_<SLUG>_TOKEN` in the operator environment, where `<SLUG>` is the profile slug in uppercase with hyphens replaced by underscores. The URL must use HTTPS and contain no embedded credentials, query, or fragment. The operator must first approve the receiver, transmitted fields, credential handling, remote idempotency, version ordering, and reconciliation procedure. After enabling the profile in Admin, a separately authorized operator may invoke `python -m backend.app.integration_worker --send`. Running `python -m backend.app.integration_worker` without `--send` reports that delivery is disabled.

The fixed `shipment.changed.v1` request is JSON containing `schema`, a stable `event_id`, and `shipment` with reference, version, status, carrier, tracking reference, origin, destination, expected delivery date, and update time. The request includes `Authorization: Bearer <configured-token>` and `Idempotency-Key: <event_id>`. A successful HTTP 200/201 response must contain the same `event_id`, `shipment_reference`, `version`, and `status`, plus a nonempty `external_id`. A response with a different version/status requires reconciliation; the worker does not adopt remote status as local truth. Queuing and acknowledging an event never create an order, payment, or inventory change.

## Checks

```powershell
python -m pytest -q backend/tests
cd frontend
npm.cmd run build
```

The shared visual system is defined by `Industrial Oils Trading Design System.png`, implemented in `frontend/src/design-system.css` and `frontend/src/design-system.jsx`, and documented in [UI-UX-BRIEF.md](UI-UX-BRIEF.md). To repeat the viewport review while Vite is running, use `node scripts/design-review.mjs` from `frontend/`. It uses a local headless Chrome installation, saves screenshots under ignored `data/design-review/`, reports page width and overflow at 390, 768, and 1280 CSS pixels, and exits with an error when a route overflows. Optional `--routes=/,/products` and `--widths=390,768` arguments narrow the check. For isolated signed-in visual checks, point the running backend at a test database and set `DESIGN_REVIEW_STAFF_EMAIL` / `DESIGN_REVIEW_STAFF_PASSWORD` or `DESIGN_REVIEW_PORTAL_EMAIL` / `DESIGN_REVIEW_PORTAL_PASSWORD` in the operator environment.

English and Persian are available in the header. Persian uses a right-to-left layout and established oil-trading terms such as «روغن پایه», «روانکار صنعتی», «استعلام قیمت», «گواهی آنالیز (COA)», «اینکوترمز», and «پیش‌فاکتور». A Persian link carries `?lang=fa`; the selection is also saved in local storage. `frontend/src/localization.js` holds reviewed UI copy, `localization-runtime.js` applies it to existing screens, `localization.css` handles RTL layout, and `locale-format.js` formats numbers and dates. Dates remain Gregorian in either language to avoid silently changing commercial date meanings. Run `npm.cmd run test:localization` for terminology tests. For browser RTL review, set `DESIGN_REVIEW_LOCALE=fa` before running `node scripts/design-review.mjs`.

Localization applies to interface copy, common validation errors, and explicitly reviewed demo descriptions. Product specifications, user-entered text, company names, addresses, technical codes, and other business data are **not** machine-translated; approved Persian content is required before publishing them. Unknown backend error messages can still appear in English. The SPA updates the browser language and metadata after JavaScript loads; server-rendered localized metadata, hreflang, and a full native-speaker legal/content review remain release work.

Local headless Chrome smoke checks rendered Home, Buy, Sell, Staff sign-in, and Portal sign-in at 390, 768, and 1280 CSS pixels with no page-level horizontal overflow. An isolated admin login rendered the shipment and integration workbenches, and a verified customer login rendered portal tracking at 390 pixels. A browser-submitted Buy Request produced a reference and one persisted inquiry. These are targeted Chrome checks; full keyboard and screen-reader operation, document flows, Safari/Firefox/Edge, and real mobile devices still need a release QA pass.

The reference-driven demo pages were also checked in headless Chrome at 390, 768, and 1280 CSS pixels: Home, catalog, product detail, About, sample team profile, stock, and insights rendered without broken images, JavaScript exceptions, or page-level horizontal overflow. Catalog filters, grid/table switching, mobile navigation, and the product quote handoff were exercised. The browser check confirmed that contact details do not enter the quote URL. These checks do not verify the illustrative business claims or replace a release QA pass.

## Configuration

Database and uploads default to ignored paths under `data/`. Override with `OIL_DB_PATH` and `OIL_FILE_PATH` if needed. `OIL_FRONTEND_ORIGIN` controls the browser origin accepted for staff mutations; local `localhost:5173` and `127.0.0.1:5173` are accepted by default. Set `OIL_COOKIE_SECURE=1` behind HTTPS.

### Isolated backup and restore check

The backup command snapshots SQLite through its backup API, copies every database-referenced private upload, and writes a SHA-256 manifest. It verifies database integrity, foreign keys, upload lengths, and hashes. Run it while the source uploads remain available and immutable. A restore always creates a **new** directory; it never overwrites a running database.

```powershell
New-Item -ItemType Directory backups -Force
python -m backend.backup create --db data/oil.db --uploads data/uploads --dest backups/check-001
python -m backend.backup verify --backup backups/check-001
python -m backend.backup restore --backup backups/check-001 --dest backups/restored-check-001
```

Inspect the restored copy, then separately plan a maintenance-window cutover with verified paths and a rollback copy. The manifest detects accidental damage, not malicious alteration; protected offsite storage, encryption, retention, scheduled drills, and access controls remain operational release work. Do not place backups in source control.

The SQLite initializer adds earlier development tables and missing columns to local databases. The selected Phase 3 package records its additive schema in `schema_migrations`, but earlier upgrades still use the development initializer. Legacy quotation customer names are backfilled from current company records when their snapshot is empty; historical names cannot be reconstructed. A complete versioned migration process and tested upgrade/restore are required before production use.

The outbox worker requires `OIL_SMTP_HOST`, `OIL_SMTP_PORT` (default 587), `OIL_SMTP_USER`, `OIL_SMTP_PASSWORD`, `OIL_MAIL_FROM`, `OIL_SALES_EMAIL`, and `OIL_PROCUREMENT_EMAIL`. Secrets belong in the environment, outside source control. Run only one outbox worker until a claim/lease mechanism is added.

## Still required before the Phase 1 release gate

- Approved company content, real contacts, team profiles, legal and privacy text, product specifications/documents, and a complete content publishing workflow. Current generic company text and empty states are placeholders.
- Full CRM company/contact views, task assignment and reminders, visual pipeline and time-in-stage reporting, and the PRD's remaining reporting metrics; richer product/lot editing and stock visibility controls.
- Complete RFQ and offer fields, multiple supplier files, approved document scanning/quarantine workflow, file retention, and operational protected backup/restore drills. The isolated backup/restore command and automated corruption checks are present; offsite protection and a maintenance-window recovery exercise remain. `unscanned` files must not be treated as safe production documents.
- Mail templates, production-grade job claiming/retries, MFA for privileged staff, edge-aware rate limiting, operational monitoring, and security review. Basic local request limits are present; current sessions and SMTP worker are suitable for local development only.
- Indexable public rendering, canonical/structured SEO, approved legal pages, accessibility and browser review, performance work on the large illustration assets, and production deployment design.

## Still required before the Phase 2 release gate

- Resolve the Phase 1 release gaps above, including production migrations, MFA, scanning/quarantine, restore testing, and public content/CMS requirements.
- Approved commercial PDF identity/legal text and templates, SMTP delivery verification, a worker claim/lease design, notification preferences, scheduled follow-up notifications, and self-service recovery email. Current PDFs support the English development workflow; multilingual typography needs review.
- Complete company/profile management and company-level verification document review, fuller activity/reporting views, forecast policy, controlled import with validation/preview and audit, and native Excel support. The present implementation exports CSV only.
- Editorial multilingual publishing when approved translations exist; no translations or commercial/legal decisions have been fabricated.
- Browser and accessibility review of the new portal and commercial journeys, concurrency/operational review, backup restoration, access review, and release sign-off. API tests and a Vite build do not replace these checks.

## Still required before Phase 3 external use

- Named provider and approved data-sharing contract, receiver ownership, credential rotation, operational monitoring, and tested remote deduplication/version ordering. The generic HTTPS adapter is configured only by environment; there is no ERP, carrier, BI, or WhatsApp account connected.
- A provider-specific reconciliation/readback adapter and independent restore/access review. The current workflow records manually obtained remote evidence; exact HTTP acknowledgement alone is not end-to-end source reconciliation.
- Release gates from Phases 1 and 2, including production migrations, scanning, MFA, browser/accessibility QA, and approved business/legal content. Contracts, signatures, finance, credit, payments, OCR, automated pricing/scoring, market feeds, and additional languages are separate unstarted packages.
