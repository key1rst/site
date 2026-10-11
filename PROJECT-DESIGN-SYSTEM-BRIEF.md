# Project brief for a new design system

**Project:** Padna Sivan industrial materials trading platform and CRM

**Purpose of this document:** Give a design team the product, content, workflow, and implementation context needed to create a coherent replacement design system. This is a brief, not an approval of brand claims or a specification for a production launch.

**Source of truth:** [PRD](prd.md) for product intent, [delivery plan](plan.md) for phases, [README](README.md) and [project description](description.md) for the current local build, and [UI/UX brief](UI-UX-BRIEF.md) for existing visual references. Where those sources differ, the current application code describes what is implemented today.

## 1. Product in one page

This is an international, business-to-business website and commercial operations system for **one company**. The company presents its products and approved company-controlled stock, receives purchase inquiries from customers, receives private supply offers from suppliers, and manages follow-up in an internal CRM. The company is the commercial counterparty. The experience must never resemble a marketplace of independent sellers or a retail checkout.

The public site should help a buyer understand the product range, evaluate relevant technical information and available stock, and submit a qualified request for quotation (RFQ). It should help a supplier make a private offer to the company. Sales and Procurement then need separate, permissioned workspaces to review those records, assign responsibility, communicate, and progress the appropriate commercial workflow. Verified customer and supplier portals give each company access only to its own permitted records.

The repository contains a **local development build**, not a deployed or production-approved service. Phase 1 and Phase 2 workflows and a selected Phase 3 shipment/integration package are implemented locally, but their release gates remain open. A new design system must serve this whole product without implying that unfinished content, services, or approvals already exist.

The PRD's product range includes base oils, industrial lubricants, greases, process oils, RPO, white oil, antifreeze, and related petroleum/petrochemical products. The current catalog taxonomy also includes bitumen, industrial solvents, and petrochemical feedstocks. These are category scope, not evidence that each category has an approved published product or available lot.

### Product goals

- Make the company's offer credible and understandable to international industrial buyers and suppliers.
- Make product and approved stock discovery efficient, including when the catalog is sparse or empty.
- Turn public inquiries into durable, actionable CRM records with clear confirmation and reference numbers.
- Help employees scan, prioritize, investigate, and complete follow-up work.
- Communicate commercial status precisely: a request, quote, acceptance, proforma, shipment event, and payment are different things.
- Support future approved content, languages, and integrations without designing fictional examples as facts.

### Business boundary

**Buy From Us** is a customer inquiry about products the company offers or stock it controls. **Sell To Us** is a supplier's private proposal for Procurement review. An RFQ does not reserve stock. A supplier offer does not become public stock. An accepted quote does not prove payment or delivery. Avoid vendor storefronts, shopping carts, public supplier listings, auctions, escrow, commissions, fake discounts, and countdown urgency.

## 2. People, permissions, and primary jobs

| Audience | Main job | Information boundary |
| --- | --- | --- |
| Public buyer | Find a product or lot, assess suitability, request terms | Only approved public catalog, stock, company, team, and editorial content |
| Public supplier | Offer material and supporting documents | Offer and attachments stay private; submission is not purchase acceptance |
| Sales employee | Triage buyer inquiries, assign follow-up, prepare and revise quotes | Buyer-side records and authorized commercial data |
| Procurement employee | Review supplier offers, technical documents, pricing, and next actions | Supplier-side records; no customer quotation workbench |
| Administrator | Control catalog/lot creation, company review, invitations, holds, and selected integrations | Sensitive actions need clear review context and audit history |
| Verified customer | Review own requests, messages, issued quotes, eligible PDFs, and published tracking | Only records linked to its verified company; no internal notes or supplier economics |
| Verified supplier | Review own offers, messages, documents, and drafts | No customer quotes, proformas, or customer tracking |
| Management/content roles | Understand operations and eventually publish approved content | Reports need precise definitions; CMS publication remains incomplete |

Staff access accounts and public team profiles are separate concepts. A public biography, photo, language, or contact option requires approval; possession of a staff account does not publish a person.

## 3. Main journeys

1. **Buyer discovery to RFQ:** Home or catalog → product detail or published stock → Buy From Us form carrying selected product/lot context → server validation and durable submission → reference number → Sales queue → employee follow-up. Guest submission requires no account.
2. **Supplier offer:** Sell To Us form → durable private offer and reference number → authorized document handoff where applicable → Procurement queue → technical/commercial review. The offer never increases saleable stock by itself.
3. **Sales follow-up:** Sales inbox → inquiry detail, company/contact context, priority, owner, next action, tasks, notes, documents, and history → draft quotation → reviewed issue and versioned PDF → delivery queue → explicit acceptance/decline → optional proforma. Each status must describe the actual recorded event.
4. **Customer self-service:** Administrator verifies and invites a company/contact → customer activates portal access → reviews only its linked records, messages, issued quote revisions, permitted documents, drafts, saved products, and explicitly published tracking.
5. **Procurement follow-up:** Procurement inbox → offer and document review → owner, stage, reasoned decision, tasks, and history → any eventual purchase/receipt workflow remains a separate authorized process.
6. **Shipment and exchange:** Staff may plan a shipment from an accepted quote, record evidence-backed actual events, and Admin may publish eligible tracking to the customer portal. Admin may review and queue a shipment snapshot for a paused-by-default external destination. The repository has no live carrier, payment, or ERP connection.

## 4. Surfaces the system must cover

### Public website

| Route/surface | Design purpose and essential patterns | Current content status |
| --- | --- | --- |
| `/` Home | Clear company offer, product families, current published availability, separate Buy and Sell paths, primary RFQ action | API-backed live content; illustrative industrial imagery |
| `/products` Catalog | Search, category/grade filtering, cards, optional dense comparison view, shareable filter state, no-results recovery | Production reads approved API records; development mode can show a fictional demo catalog |
| `/products/:slug` Detail | Description, applications, technical data with units/methods, packaging, relevant lots, document availability, quote handoff | Public records require publication; do not fill missing values with invented claims |
| `/stock` Current Stock | Only approved public lots, last-update context, visible commercial fields, quantity visibility policy, inquiry action | Production reads approved API records; exact quantity may be intentionally hidden |
| `/buy` Buy From Us | Essential RFQ fields first, optional terms progressively, selected product/lot context, inline errors, persistent entered data, confirmed reference | Working guest intake through FastAPI |
| `/sell` Sell To Us | Private supplier offer, quantity/unit, origin/location, terms, company/contact, document handoff, review disclaimer | Working guest intake; uploads are protected and require separate handling |
| `/contact` Contact | General inquiry with clear routing and confirmation | Working guest intake |
| `/about` About | Approved company scope and identity, clear business contact path | Current copy is a working translation of owner-supplied Persian information; final English wording needs approval |
| `/team`, `/team/:slug` Team | Approved public roles and eventual individual profiles | `/team` currently shows sourced names/positions; individual biographies and photos are unavailable |
| `/insights` Knowledge Center | Maintainable, approved technical/editorial content | Currently an honest empty state; articles are not yet approved |

The PRD also proposes Industries, Market Insights, offices, certificates, and richer team/content pages. Treat these as future information architecture inputs until approved content and publication workflows exist. Navigation should remain useful with empty or unpublished sections.

### Staff CRM

The current `/staff` workspace contains a role-filtered inquiry inbox, quotation workbench, shipments, reports, company review, integration administration, and catalog/stock administration. Design for a task-oriented desktop workspace and a deliberately adapted mobile experience. The CRM needs compact but readable lists, filters, clear ownership, stage history, next action, due/overdue status, related company and contact context, document visibility, and permission-aware actions. Sales and Procurement stages and fields differ.

### Customer and supplier portals

The `/portal` entry covers invitation activation, sign-in, assisted recovery, and separate role experiences. Customers see requests, quotations, tracking, account/documents, messages, saved products, and drafts when eligible. Suppliers see offers, account/documents, messages, and drafts. A shared component language is useful, but navigation and records must reflect each role's actual permissions. Portal records must not be visually mixed with public content or staff-only controls.

### Operational and generated artifacts

The system also creates quotation and proforma PDFs, export files, notification states, shipment timelines, and integration job histories. The design system should specify typography, tabular data, status language, document metadata, and print/PDF presentation for these artifacts. It should distinguish queued, sent, failed, expired, cancelled, accepted, and published states where those concepts exist.

## 5. Domain concepts the interface must communicate

| Concept | Meaning in the interface | Common design error to avoid |
| --- | --- | --- |
| Product | Reusable catalog offering and typical description | Presenting a product as a specific stock batch |
| Inventory lot | Specific company-controlled batch with origin, packing, quantity/unit, and visibility settings | Treating all lots of one product as identical; exposing private warehouse or costs |
| Supplier offer | Proposed private supply | Displaying it as saleable stock |
| Inquiry | Buyer RFQ, supplier offer, or contact intake record | Calling it an order or confirmed transaction |
| Company/contact | Shared organization identity and people, possibly customer and supplier | Auto-merging similar names or exposing another company's records |
| Opportunity/task | Internal follow-up and commercial progress | Equating stage closure with payment or delivery |
| Quotation/revision | Commercial terms, with immutable issued revisions | Updating an issued revision in place or implying issue means email sent |
| Proforma | Document derived from an accepted quote | Treating it as payment evidence |
| Shipment event | Staff-recorded operational fact with evidence and publication control | Claiming carrier synchronization or automatic stock dispatch |
| Document | Public, staff-private, or company-scoped file with scan/visibility status | Showing a download action before access or safety requirements are met |

Show quantity **with its unit** and money **with its currency and pricing basis**. Distinguish mass, volume, and packaging counts; a drum or IBC has no universal capacity. Distinguish country of origin, current storage location, and loading port. Technical values need units, conditions, methods, and provenance where applicable; a typical specification is not a batch certificate. Never use invented grades, stock quantities, prices, manufacturers, origins, certifications, or bank details as production content.

## 6. Design direction and existing baseline

The desired impression is **professional, industrial, international, reliable, and restrained**. The site should support technical clarity and qualified inquiries. The CRM should support scanning and action. Favor purposeful imagery, clear hierarchy, explicit labels, measured density, and predictable interactions. Avoid generic retail patterns, decorative gradients, unsupported trust badges, excessive animation, and fabricated urgency.

The current visual system is a **baseline to audit, not a mandatory future palette**:

- [`frontend/src/design-system.css`](frontend/src/design-system.css) defines shared tokens: navy `#0B2D5B`, blue `#2563EB`, amber `#F59E0B`, semantic success/error colors, pale backgrounds, borders, an 8 px radius, 4–32 px spacing steps, and a 1440 px desktop content limit.
- The current shared typeface is Inter, with a 16/24 body and 36/44, 28/36, 20/28, and 18/26 heading levels. Persian styling uses Vazirmatn with fallbacks. Older prose in `description.md` mentions serif display headings; the active design-system CSS uses Inter.
- [`frontend/src/design-system.jsx`](frontend/src/design-system.jsx) provides reusable line icons and semantic status tags. The current CSS also defines buttons, fields, alerts, cards, tables, focus treatment, and reduced-motion behavior.
- [`Industrial Oils Trading Design System.png`](Industrial%20Oils%20Trading%20Design%20System.png) and images in [`ui-images/`](ui-images/) are reference material. Generic names or claims shown in those images are not company facts.
- Public, staff, portal, and localized views currently share CSS across `styles.css`, `experience.css`, `reference-theme.css`, `design-system.css`, `home.css`, and `localization.css`. A replacement system should clarify token ownership and component variants so surfaces remain consistent without forcing identical page density.

The active company profile is Padna Sivan. Its Persian text was supplied by the owner; the English text is a working translation and the official English legal name and publication copy need approval. Existing harbor and category imagery is illustrative, not documentary evidence of the company's facilities or stock. Earlier PETROVEX artwork and demo products are design references only.

## 7. Requirements for the new system

### Foundations

Define semantic color roles and tested text/action contrast; type scale for public storytelling, technical data, CRM density, and Persian; spacing and layout grids; surfaces, borders, radius, elevation, iconography, motion, imagery/cropping, and responsive breakpoints. Keep tokens independent from page-specific copy or fictional data. Specify long labels, long company names, mixed-script values, and absent images.

### Core components

Include public and workspace headers; mobile navigation; breadcrumbs; buttons and links; product/category cards; stock rows; technical specification tables; filters/search; tabs; status tags; alerts/toasts; form fields, field groups, validation and upload progress; empty/loading/error/permission states; tables and mobile detail patterns; pagination; activity timelines; document lists; quote item editors and revision comparison; task and owner controls; confirmation dialogs; and print/PDF styles. Specify keyboard and screen-reader behavior alongside visual variants. A Kanban view, if designed, needs an equivalent non-drag way to change stage.

### Screen states and responsive behavior

For every interactive view, provide loading, empty, no-results, validation error, server error/retry, success, disabled, permission-denied, and unavailable-service states as relevant. Preserve form data after failed submission. Keep key actions visible at mobile widths and browser zoom. Adapt dense CRM data with prioritized columns, contained scroll, or a detail view rather than shrinking the desktop table. Test mobile, tablet, and desktop layouts with long content and real units.

### Accessibility and localization

Use semantic structure, visible focus, proper labels and error associations, keyboard operation, adequate contrast, useful status announcements, accessible dialogs, and reduced motion. English is primary. The current UI exposes a Persian option and RTL layout, but translated business content and full bilingual publication are not approved. Use direction-aware spacing and icons, allow text expansion, preserve technical codes/acronyms, and format dates, numbers, currencies, and units deliberately. Do not use `noindex` as a substitute for private-data access control.

### Content and trust

Create patterns for source/last-updated information, hidden quantity, unpublished products, missing documents, review-only supplier offers, and unverified claims. The content system should distinguish approved copy from placeholder guidance. Do not present illustrative photos as actual staff, offices, facilities, or stocked goods. Publish team profiles, technical articles, office details, certifications, and geographic claims only after approval.

### Security-sensitive UX

Permissioned controls must match server authorization. Make private/public document visibility legible, show upload scan state truthfully, and show why an action is blocked by a review hold or missing approval. Sensitive changes should have review context, reason capture, version awareness, and an attributable history. Never expose confidential costs, margins, internal notes, integration credentials, or other companies' records in public or portal layouts.

## 8. Suggested design-system deliverables

1. A short product principle set and information architecture for public, staff, customer, and supplier contexts.
2. Foundation tokens with semantic names, contrast checks across surfaces, typography for English and Persian, spacing/layout, and motion rules.
3. Component specifications covering anatomy, variants, states, responsive behavior, accessibility, content rules, and implementation mapping.
4. Representative screens: Home; catalog results and empty state; product detail; stock; guest RFQ and confirmation; supplier offer; staff inbox/detail; quote draft and issued revision; customer portal; supplier portal; and one admin review workflow.
5. A migration map from current CSS/components to the proposed system, including which legacy styles to retire, without treating demo imagery or claims as approved content.
6. A review checklist for mobile/tablet/desktop, 200% zoom, keyboard, screen reader, RTL, long data, absent data, permission boundaries, and truthful workflow states.

## 9. Decisions and inputs still required

- Approved logo, official English company name, brand guidance, and final English/Persian publication copy.
- Approved product catalog, technical specifications, lot visibility policy, imagery, documents, and public price policy. The PRD's example data is illustrative only.
- Approved company contacts, markets, offices, biographies, certifications, articles, and legal/privacy text.
- Final content publication workflow, language scope, report definitions, notification wording, and operational ownership before release.
- Production accessibility and browser QA, privileged MFA, scanning/quarantine, production storage, migrations, and security/operations review. These are release gates, not visual polish.

## 10. Implementation pointers

- Frontend: React 19, Vite 7, repository-owned CSS, custom History API routing. Entry/routes: [`frontend/src/main.jsx`](frontend/src/main.jsx); shared shell/API: [`frontend/src/shared.jsx`](frontend/src/shared.jsx); public pages/forms: [`frontend/src/public.jsx`](frontend/src/public.jsx); CRM: [`frontend/src/staff.jsx`](frontend/src/staff.jsx); portals: [`frontend/src/portal.jsx`](frontend/src/portal.jsx).
- Backend: FastAPI, Pydantic, SQLite in the local build, with protected local uploads. Core intake/catalog/inventory: [`backend/app/main.py`](backend/app/main.py); quotations: [`backend/app/commercial.py`](backend/app/commercial.py); portals: [`backend/app/portal.py`](backend/app/portal.py); operations/reports: [`backend/app/operations.py`](backend/app/operations.py); shipments/integrations in sibling modules.
- Design/demo boundaries: [`frontend/src/mockPublic.jsx`](frontend/src/mockPublic.jsx) and [`frontend/src/mockData.js`](frontend/src/mockData.js) contain development-only sample views/data. Production product/stock pages read approved API records. The current build also includes an experimental development Home preview.
- Existing local checks are documented in the [README](README.md). This brief does not change application behavior or certify a production release.
