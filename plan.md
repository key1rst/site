# Three-phase delivery plan

Source: [prd.md](prd.md), version 1.0. This plan consolidates the PRD's MVP, Version 1, Version 2, and five-step development priority into three delivery phases. Phases 1 and 2 have release gates; Phase 3 is a set of separately approved extensions. Later work builds on persisted data and permissions from earlier phases.

**Implementation status:** Phases 1 and 2 are in progress; neither has passed its release gate. Phase 3 has started with an isolated outbound shipment tracking and integration foundation package. Its remaining packages are uncommitted. Implementation details and release gaps are documented in [README.md](README.md).

## Product boundary and release rules

- This is one company's international B2B trading website and integrated CRM. Buyers request products from the company; suppliers privately offer products to the company. Supplier offers never become public listings or saleable stock automatically.
- English is the initial published language. Store translatable content and support locale-aware routes, layouts, dates, currencies, and units from the start. Publish Persian, Arabic, and other translations only after approved content and review. The existing UI/UX brief assumes a bilingual launch; resolve that difference before committing a launch date.
- A product is a catalog description; an inventory lot is controlled stock; an RFQ is an inquiry; a supplier offer is proposed supply. Keep these records and their state changes distinct.
- Use approved company identity, contact details, team profiles, product data, technical documents, inventory, legal text, and claims. Example figures and geography in the PRD are placeholders, not publishable facts.
- Security, accessibility, responsive behavior, backup and restore, privacy, and audit of sensitive changes are release requirements wherever their related feature is introduced.

## Phase 1 — MVP: public discovery and dependable intake

**Outcome:** A visitor can assess the company and its products, submit a Buy Request or Sell Offer without an account, and an employee can find and act on the resulting record in the CRM.

### Build

1. **Foundation and design:** Select a small, coherent application stack after confirming hosting and operational constraints. Define the data model, migrations, environments, deployment path, design tokens, reusable components, English content structure, locale readiness, and responsive page patterns. Establish logging, monitoring, backups, and a tested restore procedure.
2. **Public website and CMS:** Build Home, Products, Product Detail, Current Stock, Buy From Us, Sell To Us, About, Our Team, Contact, Industries, Knowledge Center, and the approved Privacy, Terms, Cookie, Disclaimer, and Compliance pages. Add CMS workflows for products, categories, technical attributes, documents, team, articles, pages, navigation, offices, FAQs, and SEO metadata. Use draft, review, publish, and archive states where content becomes public. Add search and the PRD's relevant product and stock filters, useful empty states, shareable URLs, sitemaps, canonical metadata, schema, and redirects. Market Insights can begin as an editorial section with dated, approved content; no live price feed is implied.
3. **Inventory:** Manage multiple lots per product, origin, location, packing, units, stock status, and public visibility. Define on-hand, held, reserved, and dispatched quantities; make adjustments and reservations transactional and auditable. Public stock shows only approved fields, its update time, and an honest availability label; private cost, supplier, margin, and warehouse details remain protected. Make public quantity and price display configurable, defaulting to price on request. Define cache invalidation and stale-data behavior when stock changes.
4. **Inquiry intake:** Build Buy Request from product, stock, and standalone entry points, carrying product and lot context. Build private Sell Offer intake with COA/TDS/SDS and company document uploads, plus a Contact form that enters the appropriate CRM queue. Include the PRD's mandatory fields and relevant optional fields, server-side validation, privacy-policy acceptance, data preservation after errors, upload progress, and clear confirmation with a unique reference. Validate uploaded file content, type and size; keep private files in protected storage with authorized downloads. Add click-to-WhatsApp using verified details.
5. **Basic CRM:** Authenticate staff, enforce server-side role and record permissions, and require MFA for privileged production accounts. Persist companies, contacts, leads, buy requests, supplier offers, sales and procurement opportunities, owners, tasks, internal notes, documents, activity history, and separate pipeline stages. Provide unassigned Sales and Procurement queues when routing rules do not find an owner. Match duplicates cautiously and leave uncertain matches for review. Include a usable dashboard and basic reports for leads this month, RFQs, open pipeline, won/lost deals, top products/countries, and sales by employee; define date ranges and avoid summing mixed currencies.
6. **Notifications and measurement:** Queue internal alerts and transactional email with retry/status tracking so delivery failure cannot erase a submission. Configure approved templates and sender details. Track the PRD's core website events and define lead, RFQ, offer, response-time, and conversion metrics from persisted records; keep sensitive details out of analytics.

### Acceptance gate

- A guest RFQ saves once despite retry, gets a reference, appears in the Sales queue with company/contact linkage, and remains available if email delivery fails. A guest supplier offer appears only in Procurement and does not change company inventory.
- Authorized staff can publish or archive a product, manage its specifications/documents, update a lot, and see the intended public page reflect the approved change. Direct API, file, cache, and export access do not expose private costs, notes, or supplier offers. Concurrent reservations cannot oversell a lot; releasing one restores the correct availability.
- Staff can move an opportunity through allowed stages, assign an owner, add a task/note/document, inspect history, and see basic dashboard counts. Lost or rejected outcomes require a reason.
- Critical journeys work on mobile, tablet, and desktop with keyboard access, visible validation and error states. SEO pages are indexable; private pages and data are protected by authorization. Backup restoration and core security checks are demonstrated before launch. Test the latest supported Chrome, Safari, Edge, and Firefox versions.

## Phase 2 — Version 1: controlled commercial execution

**Outcome:** Sales and Procurement can manage negotiation through an approved quotation or purchase decision, while customers and suppliers can see only their own authorized records.

### Local implementation progress

- [x] Itemized quotations with server totals, commercial terms, PDF generation, issued snapshots, immutable revision history, email queue/delivery state, expiry checks, duplicate/reject/cancel, version-specific acceptance, and accepted-quote proformas.
- [x] Verified customer/supplier portals with company-scoped history, issued revision/PDF access, shared messages, contact-name profile editing, saved products, private form drafts with 30-day retention, and administrator-assisted one-time password recovery.
- [x] Verification and compliance review history, commercial holds, supplier document upload, and protected document access that blocks unscanned portal downloads.
- [x] Team ownership and priorities, next actions, inbox search/filter/pagination, time in current stage, company overviews, due/overdue reminders, currency-separated quotation reporting, and scoped/audited CSV exports.
- [ ] Complete company/profile and company verification document workflows, deeper reporting/forecast policies, controlled imports/native Excel, notification preferences and scheduled delivery, and self-service recovery email.
- [ ] Approved templates/company identity/legal text, multilingual editorial publishing, and production scanning/job processing.
- [ ] Close Phase 1 release dependencies; demonstrate migrations/restore, privileged MFA, access review, browser/accessibility QA, and the Phase 2 acceptance gate.

### Build

1. **Sales and procurement depth:** Extend pipeline history, time in stage, priorities, follow-up reminders, activity timeline, company 360 views, CRM search, ownership rules, and operational reports. Keep opportunity status separate from order, payment, and shipment status; record those only from authorized events.
2. **Quotations and proforma:** Create draft quotations from RFQs, itemized pricing and commercial terms, server-calculated totals, PDF generation, controlled email sending, expiry, and immutable issued revisions. Snapshot currency, quantity unit, pricing basis, Incoterm and named place, validity, payment terms, and product/lot details. Generate a proforma from an accepted quote through an authorized action; do not infer payment or delivery.
3. **Customer and supplier portals:** Add email/password, reset, verified account-to-company linking, and company-scoped access. Customer portal: profile/company, requests, quotations, documents, messages, saved products, and contact. Supplier portal: company/profile, offers, documents, messages, and procurement contact. Add save-draft support for long request and offer forms with a defined retention period. Protect all direct API requests, downloads, searches, and cached responses at record level.
4. **Verification and compliance:** Add customer and supplier verification status, review documents, transaction holds, compliance status/notes, and approval history. Obtain jurisdiction-specific legal and business rules before enabling real transaction decisions; the software records review rather than claiming compliance automatically.
5. **Operations and content:** Add approved email templates, notification preferences, advanced reports and forecasts with stated date ranges and currency policy, controlled CSV/Excel import and export, and editorial multilingual publishing when translations are ready. Include audit logs for approval, sensitive commercial terms, access changes, and published content. Expand CMS and document retention controls as needed.

### Acceptance gate

- A quote can be created, sent, revised, and rendered as a PDF; an earlier issued revision remains unchanged. Totals are server-calculated and sensitive changes are attributable. A proforma can be generated only from an appropriately accepted quote.
- Two companies cannot read each other's portal records or documents, including through direct URLs and API calls. Unverified public submissions are not automatically attached to private portal history.
- A supplier offer or accepted quote does not silently reserve stock or create owned inventory. Portal form drafts remain private, can be resumed by their owner, and expire according to the approved retention policy.
- Management reports distinguish forecast pipeline, contracted value, payments, and revenue; mixed currencies are separated unless an approved conversion policy exists. A documented restore and access review passes before release.

## Phase 3 — selective scale and integration

**Outcome:** Add higher-cost capabilities only where Phase 1–2 usage and approved business processes justify them.

### Selected local work package

- [x] Plan outbound shipments only from accepted quote revisions; record evidence-based booking, dispatch, transit, exception, delivery, and cancellation events without changing inventory or payment state.
- [x] Keep customer tracking hidden until an administrator publishes a booked shipment. Scope portal reads to the verified customer company and exclude internal evidence and notes.
- [x] Register named outbound destinations and business owners, paused by default. Require a reviewed fixed payload contract and HTTPS credentials before enabling; queue explicit immutable shipment snapshots with version and event identity.
- [x] Provide a separately invoked HTTPS worker with leasing, bounded retry and dead-letter states, exact acknowledgement checks, stale-snapshot cancellation, and staff-recorded reconciliation evidence. It remains inactive unless explicitly run with `--send`.
- [ ] Approve a real provider's payload contract, data sharing, credentials, remote idempotency/version behavior, reconciliation method, and operational owner before any external delivery. Test partial failures, disablement, and source-to-destination reconciliation with that provider.
- [ ] Decide if contract, finance, payments, signatures, OCR, market feeds, scoring, multilingual expansion, or native ERP/accounting/WhatsApp adapters have enough business evidence and approved policy to become separate packages. None are active or represented as connected here.

**Selected-package status:** local development implementation and automated checks only. The Phase 3 acceptance gate remains open, alongside the earlier phase gates.

### Candidate work packages

1. **System integrations:** ERP, accounting, shipping/logistics, BI, and WhatsApp Business API, each with an owner, data contract, credential plan, reconciliation method, retry behavior, and audit trail.
2. **Commercial extensions:** Contract management, digital signatures, credit limits, finance workflows, and any payment capability only after legal, operational, and security design approval. The local shipment tracking package above does not fulfill a carrier-connected logistics workflow.
3. **Decision support:** Market price feeds, automated pricing, lead scoring, product recommendations, OCR, and email automation. Validate source rights and data quality; keep human approval for consequential commercial actions.
4. **International expansion:** Additional approved translations, right-to-left QA, country-specific content, locale-specific SEO, and performance scaling based on measured traffic and search usage.

### Acceptance gate

- Each selected integration reconciles against the source system, handles retries and partial failures, and can be disabled without losing core inquiry or CRM records.
- Automated recommendations or prices expose provenance and can be reviewed or overridden by authorized staff. No optional package is considered committed until its business owner, policy, data source, cost, and measurable success criterion are approved.

## Delivery order and decision register

Build Phase 1 in vertical slices: **foundation and staff access → product/CMS and approved stock → guest RFQ persisted into a minimal Sales queue → supplier offer persisted into a private Procurement queue → tasks, documents, reporting, and launch hardening**. Each intake slice includes its form, server behavior, persistence, permissions, and employee action; public success must never precede durable storage. Phase 2 depends on trusted company/contact identity, permission rules, document storage, stock accounting, and event history from Phase 1. Phase 3 depends on real workflow data and named integration owners.

The PRD's section 7 places pipelines, tasks, documents, notifications, and basic reporting in the MVP, while section 99 spreads some of them into a second development step. This plan keeps the **MVP release gate** aligned with section 7, even if those components are built in later Phase 1 iterations. The PRD's five recommended development steps are consolidated into the three releases above.

Resolve before implementation or publication: approved company and product content; launch language versus the bilingual UI brief; exact stock visibility and pricing policy; sales/procurement assignment and response targets; legal/privacy text and retention rules; transaction approval authority; initial hosting, mail, and file-storage providers. These decisions should be documented without delaying independent foundation work.

## Definition of done for every phase

For each shipped feature, verify the user journey, persistence, server-side validation and authorization, audit trail where sensitive, responsive and accessible states, failure recovery, analytics where specified, operational documentation, and focused automated tests. Report actual checks run and known limits. A functioning local build or a generated UI alone is not a production release.
