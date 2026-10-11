# Industrial Oils Trading Platform and CRM

## Project summary

This project is an integrated international B2B website and commercial operations system for a single industrial oils trading company. It combines a public product and stock website, guest inquiry intake, a staff CRM, controlled quotation workflows, separate customer and supplier portals, evidence-based shipment tracking, and a guarded outbound integration mechanism.

The company is the commercial counterparty in every transaction. It publishes products and approved company-controlled inventory for customers to inquire about, and it privately receives supply offers from suppliers for procurement review. The platform is not a multi-vendor marketplace: suppliers do not receive public storefronts, supplier offers are never published as listings, and a submitted offer does not become company-owned inventory.

The current repository is a substantial local-development build. It implements most of the core Phase 1 and Phase 2 workflows and a selected Phase 3 shipment/integration package, but no phase has passed its production release gate. The public reference pages also contain clearly separated demonstration content that must be replaced with approved company information before launch.

| Attribute | Description |
| --- | --- |
| Product type | B2B industrial trading website, CRM, customer portal, and supplier portal |
| Business model | One company sells company-owned or company-controlled stock and reviews private supplier offers |
| Primary market | International industrial buyers and suppliers |
| Primary language | English |
| Future language readiness | Planned for additional languages, including right-to-left languages, after approved translations exist |
| Frontend | React 19 and Vite 7 |
| Backend | FastAPI, Pydantic, and Python |
| Persistence | SQLite in WAL mode for the current local build, plus protected local file storage |
| Document generation | ReportLab PDFs for quotations and proformas |
| Current package version | Frontend package version `0.1.0` |
| Delivery status | Local development and automated-test implementation; not production-ready or deployed |

## Product purpose

Industrial oil transactions are rarely suitable for retail checkout. Buyers need to confirm grades, quantities, units, packaging, origin, destination, commercial terms, documentation, and logistics before a sale can progress. Suppliers also need a private channel through which they can offer material without exposing procurement information publicly. Internally, Sales and Procurement need distinct queues and permissions, while management needs traceable commercial records instead of disconnected emails and spreadsheets.

The platform addresses those needs by connecting the public website to durable internal workflows:

1. A customer discovers a product or approved stock lot and submits a purchase inquiry or request for quotation.
2. The request is stored once, receives a reference number, and enters the Sales CRM even if email delivery is unavailable.
3. Sales reviews the company, contact, product, quantity, destination, priority, and next action before preparing a quotation.
4. Issued quotation revisions become immutable commercial snapshots and can be reviewed through a verified customer portal.
5. An accepted quotation may lead to a proforma and an explicitly planned outbound shipment, but it does not by itself create payment, order-fulfilment, inventory-reservation, or delivery records.
6. A supplier can submit a private offer and supporting documents to Procurement. The offer remains separate from saleable stock until an authorized physical receipt and inventory process is implemented.

This separation is one of the project's central design principles. An inquiry is not an order, a quotation is not a reservation, a supplier offer is not stock, an accepted quote is not proof of payment, and a shipment status event does not automatically alter inventory.

## Users and access levels

### Public visitors

Public visitors can browse the company presentation, product categories, product details, current-stock presentation, team profiles, and knowledge content. They can submit Buy From Us, Sell To Us, and Contact forms without creating an account. Supplier documents can be uploaded only against an authorized supplier-offer reference.

### Customers

Customer portal accounts are created through an administrator-approved invitation after company/contact review. Authenticated customers can see records belonging to their verified company, review their requests, exchange inquiry messages, access issued quotation revisions and PDFs, accept or decline the exact revision they reviewed, download eligible proformas, save products, maintain a limited profile, use retained private drafts, and view shipments explicitly published to their portal.

### Suppliers

Supplier portal accounts are separately permissioned. Suppliers can see only their own company's offers, messages, and eligible documents, and can save or resume private supplier-offer drafts. They cannot access customer quotations, proformas, or customer shipment tracking.

### Sales staff

Sales users can work with purchase inquiries and contact requests, manage follow-up stages, add notes and tasks, assign owners, record priorities and next actions, create and issue quotations, generate proformas, and manage outbound shipment records. Sales access does not grant access to private supplier-offer records.

### Procurement staff

Procurement users work with private supplier offers, procurement-specific stages, documents, tasks, ownership, reminders, search, and scoped reports. They cannot access Sales quotation and shipment workbenches.

### Administrators

Administrators can access both commercial teams and are responsible for sensitive controls such as product and lot creation, company verification, compliance and transaction holds, portal invitations, assisted password recovery, customer shipment publication, integration-profile management, and reviewed outbound snapshot queuing.

### Operators

Some activities are intentionally kept outside browser request handling. An authorized operator separately invokes the email outbox worker, backup/restore tools, or outbound integration worker after the required configuration and business approvals are in place.

## Public website

The React single-page application exposes the following public routes:

| Route | Purpose |
| --- | --- |
| `/` | Home page with the business proposition, product-category entry points, stock preview, and Buy/Sell pathways |
| `/products` | Searchable and filterable product catalog with grid and table views and no-results recovery |
| `/products/:slug` | Product introduction, applications, technical information, packaging, document cues, stock context, and quotation handoff |
| `/stock` | Public-facing approved stock presentation |
| `/buy` | Guest purchase inquiry/RFQ form |
| `/sell` | Private supplier-offer form with document handoff |
| `/contact` | General business contact intake |
| `/about` | Company story, capabilities, values, market presentation, offices, and team introduction |
| `/team/:slug` | Public team-member profile |
| `/insights` | Knowledge Center/editorial presentation |
| `/staff` | Protected staff CRM entry point |
| `/portal` | Customer and supplier portal entry point, activation, and password recovery |

The public visual system uses a restrained industrial direction: deep navy, amber actions, white content surfaces, serif display headings, image-led category cards, generous spacing, and responsive navigation. The implementation includes semantic headings, a skip link, visible form errors, loading and empty states, mobile navigation, keyboard-compatible controls, and responsive catalog and workspace patterns.

### Important demonstration-content boundary

The routes `/`, `/products`, `/products/:slug`, `/stock`, `/about`, `/team/:slug`, and `/insights` currently render reference-driven demo content from `frontend/src/mockData.js`. The PETROVEX name, sample products, specifications, stock, staff, offices, markets, statistics, certificates, contact information, and associated claims are placeholders. Generated images in `frontend/src/assets/` are illustrative and do not depict verified facilities, employees, offices, products, or inventory.

That mock content is intentionally isolated from the FastAPI database. It is not saleable inventory and must not be treated as approved business data. The Buy, Sell, and Contact forms do use the real API and persist submissions. Backend products and lots can be created in the staff workspace, and public product/stock API endpoints exist, but the current reference-driven catalog pages are not yet connected to those records.

Before launch, the demonstration content must be replaced with approved company identity, products, technical values, offices, team profiles, contacts, certifications, legal text, and imagery. The demo disclosure in the footer should remain until that verification is complete.

## Inquiry intake

The platform supports three public intake types: purchase inquiries (`buy`), supplier offers (`sell`), and general contact requests (`contact`). All successful submissions are stored before a success response is shown.

### Buy From Us

The Buy flow accepts a published product or a free-text unlisted requirement, an optional public lot context, quantity and explicit unit, destination country, company/contact details, and a message. Product and stock actions carry their context into the form without placing personal contact details in the URL. Guest account creation is not required.

### Sell To Us

The Sell flow captures the offered product, quantity and unit, origin, company/contact details, and supporting context. A successful submission receives a short-lived upload token so the supplier can attach an eligible PDF, PNG, or JPEG document. Submission means only that Procurement can review the offer; it is not acceptance, purchase, goods receipt, or an inventory increase.

### Contact

The Contact flow records a company, contact, email address, and message and routes the record into the non-procurement CRM scope.

### Intake reliability and data integrity

- Every request requires a client idempotency key. Reusing the same key with the same payload returns the original reference instead of creating a duplicate; using it with a different payload returns a conflict.
- The server validates required fields, accepted units, published products, public lots, destinations, positive quantities, email format, message length, and privacy acceptance.
- Requests receive unique references such as Buy, Sell, or Contact references generated at persistence time.
- Company matching is deliberately cautious. An unverified public submission is matched only through exact normalized company and contact information under limited conditions; a similar organization name is not enough to merge records.
- A portal cookie alone cannot silently link a public submission to private history. A matching verified account, role, email, company name, valid session, permitted origin, and CSRF token are required.
- Internal and submitter notifications are placed in an outbox in the same durable workflow. SMTP failure cannot remove or roll back the recorded inquiry.
- Basic local rate limits protect inquiry submission, file upload, and authentication endpoints.

## Staff CRM

The staff workspace is designed around scanning, prioritization, and follow-up. Its available sections are filtered by staff role:

- **Inquiries:** team-scoped inbox, dashboard counts, search, filters, ownership filters, priority filters, pagination, detail views, notes, tasks, messages, private documents, and activity history.
- **Quotations:** Sales/Admin quotation creation, revision management, issuing, sending, PDFs, customer decisions, and proformas.
- **Shipments:** Sales/Admin outbound shipment planning and evidence-backed status history.
- **Reports:** role-scoped inquiry and commercial reporting with bounded date ranges and exports.
- **Companies:** Admin verification, portal invitation, compliance review, hold management, company history, and assisted recovery.
- **Integrations:** Admin-managed outbound destination profiles, immutable jobs, retries, cancellation, and reconciliation evidence.
- **Catalog & stock:** Admin product and inventory-lot creation and stock changes.

The dashboard currently reports leads created in the current month, RFQs, supplier offers, open inquiries, and overdue tasks. Inquiries can be filtered by type, ownership, priority, search text, and page. Each inquiry can carry an owner, low/normal/high priority, next action, stage-entered timestamp, calculated time in stage, notes, tasks, shared portal messages, documents, and a chronological activity log.

Sales and Procurement stages are intentionally different:

- Purchase inquiries can progress through new, reviewing, qualified, quotation preparation/sending, negotiation, won, lost, or rejected states.
- Supplier offers can progress through new, reviewing, technical review, price review, negotiation, approved, purchase decision, completed, or rejected states.
- Contact requests use a smaller new, reviewing, and closed workflow.

The server validates that a selected stage belongs to the correct workflow. Lost and rejected outcomes require a reason. Assignment is limited to an administrator or a member of the appropriate commercial team, and records can remain in an explicit unassigned queue when no routing rule is available.

## Product catalog and inventory

The backend distinguishes a catalog Product from a specific Inventory Lot.

A Product stores the reusable commercial description: slug, name, category, grade, description, applications, packaging, publication state, and update time. An Inventory Lot belongs to a Product and stores lot-level origin, packing, on-hand quantity, reserved quantity, unit, public visibility, optional exact-quantity visibility, and update time.

Current stock controls support audited `increase`, `decrease`, `reserve`, and `release` actions. Every mutation requires a reason and records the acting staff member, quantity, action, and timestamp. SQLite `BEGIN IMMEDIATE` transactions serialize each stock change so two concurrent requests cannot reserve the same final quantity. Over-reservation and invalid releases/decreases are rejected.

Public stock output includes only lots explicitly marked public. Exact available quantity is hidden unless the lot's `show_quantity` control is enabled. Supplier costs, margins, internal notes, private warehouse information, and supplier offers are never part of the public stock response.

The current accounting slice models on-hand and reserved quantities and derives availability as on-hand minus reserved. The fuller production model described by the PRD - including deliberately separate held and dispatched balances, richer lot fields, receipts, and cache invalidation - is not yet complete. RFQs, quotations, supplier-offer approval, shipment planning, and shipment status events do not automatically reserve or modify a lot.

Money and quantities use Python `Decimal` for calculations and decimal-safe text storage rather than binary floating-point. Currency and quantity unit are explicit. The supported quantity units are metric tonnes, kilograms, litres, barrels, drums, and IBCs; the application does not assume a universal drum/IBC capacity or perform unsupported mass-volume conversion.

## Quotations and proformas

Sales or Admin can create a quotation only from a purchase inquiry. A quotation contains one or more items and explicit commercial context:

- description, quantity, unit, unit price, and server-calculated line total;
- currency (currently USD, EUR, GBP, AED, CNY, or TRY);
- Incoterm and named place;
- validity date;
- payment and delivery terms;
- origin, packing, loading port, and destination;
- additional terms and internal preparation notes as applicable;
- customer/contact and source product/lot snapshots.

Drafts can be edited while preserving commercial audit history. Issuing a revision freezes its items, totals, customer identity, source context, and terms. A later revision creates a new version; earlier issued revisions remain readable and unchanged. Totals are calculated on the server with explicit decimal precision and rounding.

Quotations can be issued, queued for email delivery, duplicated, revised, accepted, rejected, or cancelled through controlled actions. Customer and staff acceptance both identify the exact reviewed version, preventing a stale browser page from accepting newer terms. Commercial holds and rejected/escalated reviews block sensitive actions. Expired, superseded, closed, or held quote deliveries are cancelled rather than sent.

PDF quotations are generated by the backend. A proforma can be created only from an accepted quotation revision and also has a downloadable PDF. A proforma does not prove payment, create an order, reserve stock, or initiate shipment automatically.

## Customer and supplier portals

Portal identity is administrator-mediated. An Admin reviews the relevant company/contact, issues a role-specific invitation with a hashed one-time token, and the user activates the account. Portal sessions use a separate cookie and CSRF token from staff sessions.

Portal reads and downloads are company-scoped on the server. A user cannot obtain another company's inquiries, messages, documents, quotation revisions, proformas, or shipments by changing an identifier in a URL. Customer and supplier roles receive different datasets and navigation.

Long-form Buy/Sell work can be saved as a private portal draft. Drafts expire 30 days after their latest content change, reject stale submission versions, and use a stable server-derived retry identity to prevent duplicate submission. Identical saved content preserves its prior submission reference; a user must start a new draft to create another business submission.

Administrators can perform assisted password recovery after recording an identity-review reason. Recovery tokens are hashed, shown once, expire after 30 minutes, and are single-use. Completing recovery revokes all prior sessions for that portal user. Self-service recovery email is not implemented in this build.

## Company verification and transaction review

Company verification and commercial review are recorded as human decisions, not as automated claims of legal compliance. Admin can record review status, reason, registration information, buyer/supplier countries, product origin, destination, reviewer notes, and a commercial hold. Every status or hold change creates history.

A hold or rejected/escalated compliance review blocks relevant quotation issue/send/accept/proforma actions, shipment booking/dispatch, and outbound integration queuing/delivery. Removing a hold is also audited. Jurisdiction-specific screening rules and legal approvals are deliberately not hard-coded from memory and remain an operational requirement before production transactions.

Withdrawing a company's verification revokes its portal sessions, hides its published shipment tracking, advances shipment versions, and cancels pending outbound snapshots. Reapproval requires a fresh portal login, a new shipment publication decision, and a newly reviewed integration snapshot.

## Documents and file handling

Supplier-offer uploads currently accept PDF, PNG, and JPEG files up to 10 MB. The server checks content signatures rather than trusting only the filename extension, strips directory components from supplied filenames, generates a random storage name, and keeps metadata in the database. Files remain in non-public storage.

Every new upload is marked `unscanned`. Portal users cannot download an unscanned file; an approved external scanning process must mark it clean. No scanner or public scan-status override is included in the current build. Staff downloads are protected by authentication and commercial-team scope. Production still requires an approved quarantine/scanning workflow, retention policy, protected storage design, and malware-handling operations.

Generated quotation and proforma PDFs are separate controlled commercial documents and are not treated as supplier uploads.

## Notifications and background processing

Inquiry and quotation delivery is asynchronous from the web request. The database outbox records queued, sent, failed, or cancelled delivery state. The separately invoked SMTP worker applies bounded retry behavior and records non-sensitive failure classes. It intentionally avoids persisting raw SMTP responses that might contain remote or sensitive information.

The outbox worker remains idle when SMTP settings are absent. Email templates, sender identity, internal recipients, and real commercial addresses must be approved before it is run against a production mail service. The current worker should be run as a single instance until a production-grade claim/lease mechanism is added for email delivery.

## Shipment tracking

The selected Phase 3 package implements outbound tracking as evidence-backed operational history. A shipment can be planned only from an accepted quotation revision. The supported lifecycle is:

`planned -> booked -> dispatched -> in_transit/exception -> delivered`

Cancellation is allowed only from planned or booked state, and exception can return to in-transit or progress to delivered. Each actual status change requires an expected record version, reason, evidence reference, timezone-aware occurrence time, and optional customer-facing note. Future-dated operational events beyond a small clock-tolerance window are rejected.

Booking and dispatch require an approved company without a commercial hold and appropriate carrier/tracking details. Once an actual dispatch has occurred, a later hold does not erase the evidence; later factual tracking events can still be recorded. Optimistic version checks and idempotency identities protect against stale screens and repeated commands.

Shipment plans are private by default. Admin must explicitly publish a booked shipment before it appears in the verified customer portal. Portal responses exclude staff evidence, internal reasons, other companies' records, quote pricing, and payment information.

Shipment planning and status events do not create an order, mark an invoice paid, reserve or dispatch stock in the inventory ledger, or prove carrier-system synchronization.

## Outbound integrations

Admin can register generic outbound integration profiles for logistics, ERP, or BI purposes. These profiles describe a stable slug, name, purpose, staff owner, and reviewed contract notes. They start paused.

The integration mechanism is deliberately controlled:

- A browser user cannot enter or retrieve receiver credentials.
- The HTTPS URL and bearer token are read only from operator-managed environment variables derived from the profile slug.
- Admin explicitly reviews and queues an immutable shipment snapshot.
- The integration worker performs no network delivery unless an operator invokes it with `--send`.
- Jobs have stable event IDs, expiring processing leases, bounded retry/backoff, attempt history, cancellation, dead-letter state, and reconciliation state.
- Superseded shipment snapshots are cancelled before delivery.
- The receiver must return an exact acknowledgement containing the event ID, shipment reference, version, status, and a non-empty external ID.
- A version or status mismatch is not silently adopted as local truth; it enters reconciliation review.
- A shipment changed while an HTTP delivery is in flight also requires review, even when the old event was acknowledged.

The current `shipment.changed.v1` payload contains the minimum reviewed shipment exchange fields: schema, stable event ID, shipment reference, version, status, carrier, tracking reference, origin, destination, expected delivery date, and update time. The receiver is expected to deduplicate by event ID and reject stale shipment versions.

This is a generic adapter, not a live carrier, ERP, BI, accounting, payment, or WhatsApp integration. No approved receiver or external credentials are included in the repository, and the local implementation has not delivered a real external shipment event.

## Reporting and exports

Staff reports operate over an explicit UTC date range of at most 366 days. They show inquiry counts by current stage, assigned owner, and current quotation value grouped by currency and status. Mixed currencies are never silently summed.

Forecast, contracted value, payments, and recognized revenue remain explicitly unavailable because their source records and approved accounting policies do not yet exist. An accepted quotation is not reported as payment or revenue.

CSV inquiry exports enforce the same Sales/Procurement scope as interactive views, reject datasets over 5,000 rows rather than silently truncating totals, record an export audit event, and neutralize spreadsheet-formula prefixes. Native Excel import/export and controlled import preview are not implemented.

## Architecture

### Frontend

The frontend is a React 19 application built with Vite. It uses a small History API router implemented in the shared UI layer rather than a separate routing dependency. The Vite development server proxies `/api` requests to FastAPI. Presentation is organized into public, staff, commercial, portal, operations, shipment, and integration modules, with shared fetch, navigation, shell, and state components.

The design uses repository-owned CSS rather than a third-party component framework. Public reference styles and CRM workspace styles coexist, while mock public data remains isolated from persisted records.

### Backend

The backend is a modular FastAPI application with Pydantic request validation and parameterized SQLite access. Business rules are split across modules for core intake/inventory, commercial documents, portal access, CRM operations/reporting, shipments, integrations, and background workers.

The application initializes SQLite with foreign-key enforcement and WAL mode. Related mutations use explicit transactions, commonly `BEGIN IMMEDIATE` where serialized business changes are required. Earlier schema evolution uses an in-application development initializer; the selected Phase 3 package records an additive schema migration. A complete production-grade versioned migration process is still required.

### Persistence and files

The default database is an ignored local SQLite file under `data/`, and private uploads use an ignored directory under the same project area. Both paths can be overridden with environment variables. The repository does not store production credentials.

The main persisted domains are:

- staff accounts, staff sessions, and rate-limit counters;
- products, inventory lots, and inventory events;
- companies, contacts, inquiries, notes, tasks, operational ownership, activity, and messages;
- idempotency records, upload authorizations, private documents, and notification outbox entries;
- portal users, sessions, invitations, drafts, saved products, password resets, and access events;
- company verification, compliance state, holds, and review history;
- quotes, immutable revisions, quote items, proformas, and commercial events;
- shipments, shipment events, integration profiles, immutable jobs, delivery attempts, audit events, and reconciliations;
- export-audit records and recorded schema migrations.

### Background and command-line tools

- `backend.app.outbox` processes configured transactional email.
- `backend.app.integration_worker` processes approved outbound integration jobs and requires `--send` for network delivery.
- `backend.create_admin` creates staff accounts with a selected Admin, Sales, or Procurement role.
- `backend.backup` creates, verifies, and restores isolated database/upload backups.

## Security and privacy controls in the local build

The codebase includes the following baseline safeguards:

- Passwords are salted and hashed with `scrypt`; plaintext passwords and invitation/recovery tokens are not stored.
- Staff bootstrap requires a password of at least 14 characters.
- Staff and portal sessions use separate HTTP-only cookies; cookie security can be enabled for HTTPS deployments.
- Session tokens are hashed in the database.
- Every authenticated mutation requires a matching CSRF token and permitted browser origin.
- Server-side role, team, company, record, and document checks protect direct API access; hiding a button is not treated as authorization.
- Private responses and downloads use non-public paths and appropriate cache restrictions.
- Public submissions and operational commands use idempotency protections where retry duplication would be harmful.
- Sensitive changes create activity, commercial, access, verification, compliance, shipment, export, or integration audit records.
- Integration credentials remain in the operator environment and are not returned through the UI or API.
- Exported text is hardened against spreadsheet-formula injection.
- Upload type, size, content signature, storage name, authorization, and download scope are validated.
- Commercial holds block consequential actions without deleting previously recorded real-world evidence.

These controls are meaningful development safeguards, not a claim of production security certification. Privileged MFA, edge-aware rate limiting, approved malware scanning, formal secrets management, operational monitoring, penetration/security review, access review, retention policy, production infrastructure hardening, and jurisdiction-specific legal controls remain release requirements.

## Backup and recovery

The backup command uses SQLite's backup API, copies every database-referenced private upload, and writes a SHA-256 manifest. Verification checks database integrity, foreign keys, file sizes, hashes, missing files, and unexpected files. Restore creates a new destination and does not overwrite a running database.

The manifest can detect accidental corruption but is not a substitute for authenticated, encrypted, access-controlled offsite backups. Production still requires retention rules, scheduling, monitoring, a maintenance-window restore exercise, a cutover procedure, and rollback planning.

## Repository structure

```text
.
|-- AGENTS.md                 Working standards and product guardrails
|-- prd.md                    Product requirements and phased delivery scope
|-- plan.md                   Three-phase delivery plan and implementation status
|-- README.md                 Local setup, workflows, configuration, and release gaps
|-- UI-UX-BRIEF.md            Public visual direction and demo-content boundary
|-- description.md            Detailed project description (this file)
|-- .env.example              Secret-free local configuration examples
|-- backend/
|   |-- app/
|   |   |-- main.py           App setup, schema, auth, catalog, stock, and inquiry intake
|   |   |-- commercial.py     Quotations, revisions, PDFs, decisions, and proformas
|   |   |-- portal.py         Verification, invitations, portal identity, drafts, and access
|   |   |-- operations.py     Ownership, reminders, search, reports, and CSV export
|   |   |-- shipments.py      Shipment planning, events, publication, and portal tracking
|   |   |-- integrations.py   Integration profiles, jobs, controls, and reconciliation
|   |   |-- integration_worker.py
|   |   |-- outbox.py         SMTP notification worker
|   |   `-- phase3_schema.py  Additive Phase 3 schema migration
|   |-- tests/                Intake, commercial, Phase 3, and backup regression tests
|   |-- backup.py             Backup/verify/restore CLI
|   |-- create_admin.py       Staff account bootstrap CLI
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |   |-- main.jsx          Route selection and application composition
|   |   |-- shared.jsx        Shared API, routing, shell, and state components
|   |   |-- mockPublic.jsx    Reference-driven public pages
|   |   |-- mockData.js       Isolated illustrative public data
|   |   |-- public.jsx        API-backed inquiry forms and earlier public components
|   |   |-- staff.jsx         Staff authentication and CRM workspace
|   |   |-- commercial.jsx    Quotation and company-review workbenches
|   |   |-- portal*.jsx       Customer/supplier portal experiences
|   |   |-- operations.jsx    CRM ownership, reminders, reports, and export UI
|   |   |-- phase3.jsx        Shipment staff and portal views
|   |   |-- integrations.jsx  Integration administration UI
|   |   `-- assets/           Illustrative demo imagery
|   |-- package.json
|   `-- package-lock.json
|-- data/                     Ignored local database/uploads when created
`-- ui-images/                Public-page visual references
```

## Local development

From the repository root, install the backend dependencies, create an initial staff user, and start FastAPI:

```powershell
python -m pip install -r backend/requirements.txt
python -m backend.create_admin admin@example.com admin
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

The admin command asks for the password interactively so it is not stored in shell history. Use separate Sales and Procurement users to exercise role boundaries:

```powershell
python -m backend.create_admin sales@example.com sales
python -m backend.create_admin procurement@example.com procurement
```

In a second terminal, install the locked frontend dependencies and start Vite:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Vite normally serves the application at `http://127.0.0.1:5173` and proxies `/api` to the backend.

The standard repository checks are:

```powershell
python -m pytest -q backend/tests
cd frontend
npm.cmd run build
```

The automated suite covers durable/idempotent intake, team isolation, stock over-reservation prevention, private documents, notification failure, stage validation, quote revision immutability, company-scoped portal access, draft retention, password recovery, document scanning rules, commercial holds, reporting/export scope, shipment transitions, portal tracking isolation, worker retries/leases, stale snapshot cancellation, reconciliation, verification withdrawal, and backup integrity.

## Configuration

The application uses environment configuration so secrets remain outside source control. Key settings include:

- `OIL_DB_PATH` for the SQLite database;
- `OIL_FILE_PATH` for private uploads;
- `OIL_FRONTEND_ORIGIN` for the permitted frontend origin;
- `OIL_COOKIE_SECURE=1` when served behind HTTPS;
- SMTP host, port, user, password, sender, Sales recipient, and Procurement recipient for the optional mail worker;
- `OIL_INTEGRATION_<SLUG>_URL` and `OIL_INTEGRATION_<SLUG>_TOKEN` for an approved outbound destination.

Integration URLs must be HTTPS and must not contain embedded credentials, a query string, or a fragment. Real SMTP or integration credentials must never be committed to the repository.

## Current delivery status

### Implemented locally

- Responsive public reference pages and working guest Buy, Sell, and Contact submission flows.
- Durable, idempotent CRM intake with role-scoped Sales and Procurement handling.
- Product/lot creation and audited stock reservation/release/adjustment controls.
- Protected supplier-document upload and scoped staff/portal access rules.
- Notes, tasks, ownership, priorities, next actions, reminders, search, history, dashboard counts, reports, and audited CSV export.
- Decimal-safe, versioned quotations; immutable issued revisions; PDFs; delivery queue; decisions; and accepted-quote proformas.
- Verified customer/supplier portals with company isolation, messages, drafts, saved products, protected documents, and assisted recovery.
- Company verification, transaction-review history, compliance holds, and sensitive-action gates.
- Evidence-based shipment planning, controlled status transitions, Admin publication, and company-scoped portal tracking.
- Paused-by-default outbound integration profiles, immutable jobs, retry/lease behavior, acknowledgement validation, and reconciliation review.
- Isolated backup creation, integrity verification, and restore tooling.
- Focused automated backend coverage and a buildable Vite frontend.

### Required before a production release

- Replace every demo business claim and asset with approved company, catalog, technical, team, contact, legal, privacy, certification, and market content.
- Connect the reference-driven public product/stock pages to an approved publishing/CMS workflow and the real catalog source.
- Complete production migrations, hosting/deployment design, monitoring, protected object storage, scanning/quarantine, retention, and tested operational restore.
- Add privileged MFA, production session/security configuration, edge-aware throttling, security review, and formal access review.
- Approve quotation/proforma identity and legal templates, mail content and sender setup, reliable production job claiming, and notification preferences.
- Finish company/profile administration, richer product/lot editing, the complete stock accounting model, controlled imports, and remaining reporting policies.
- Complete keyboard, screen-reader, accessibility, responsive-device, performance, and cross-browser release QA.
- Add indexable public rendering, canonical metadata, structured SEO, sitemap/redirect handling, and approved legal pages.
- Approve any real external provider, data-sharing contract, credentials, remote idempotency/version behavior, operational ownership, and source-to-destination reconciliation.
- Complete all earlier phase release gates before treating the selected Phase 3 package as externally usable.

## Explicitly outside the current implementation

The repository does not currently provide marketplace vendor stores, auctions, commissions, escrow, retail checkout, public supplier listings, live market-price feeds, automatic pricing, payment processing, banking instructions, orders, invoices marked paid, carrier-connected logistics, digital signatures, contract management, OCR, automated compliance decisions, native ERP/accounting/WhatsApp adapters, or approved multilingual content.

Those capabilities must not be inferred from the existing quotation, proforma, shipment, or generic integration records. Any future package requires an identified business owner, approved policy and data source, security and legal review, measurable success criteria, and an implementation that preserves the platform's single-company trading model.

## Product principles

The implementation is guided by several non-negotiable rules:

1. Public success follows durable persistence; an email or integration failure must not erase a business record.
2. Server-side authorization applies to records, fields, downloads, searches, exports, and background jobs.
3. Sales and Procurement are distinct workflows with distinct confidential data.
4. Product, lot, supplier offer, inquiry, quote, proforma, order, payment, and shipment concepts are not interchangeable.
5. Commercial and quantity calculations are decimal-safe and always retain explicit currency and unit context.
6. Sensitive decisions and state changes are attributable and auditable.
7. External communication is queued, reviewable, retryable, and disabled when configuration or approval is missing.
8. Demo content is never represented as verified company, technical, inventory, staff, or certification data.
9. International readiness means designing for longer text, locale changes, and right-to-left layouts; it does not mean pretending translations already exist.
10. A working local build is not equivalent to a secure, accessible, operationally supported production release.
