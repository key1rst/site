# Industrial oils website: UI/UX brief

## Working assumptions

- Launch as one company's B2B product catalog with public stock and inquiry flows, plus private staff and client areas.
- `Industrial Oils Trading Design System.png` defines the shared visual tokens and component treatment. The four screenshots in `ui-images/` remain page-composition references. PETROVEX and the depicted product, stock, team, office, certification, and technical information are sample content only.
- The active public routes use the owner-supplied Padna Sivan company profile and the FastAPI public product and stock endpoints. `frontend/src/mockData.js` and `mockPublic.jsx` remain inactive design references. Public inquiry forms submit to FastAPI.

## Core screens

| Screen | Main user task | Essential elements |
| --- | --- | --- |
| Home | Understand the offer and start searching | Clear offer, product search, category links, quote action, current stock preview |
| Product catalog | Find a suitable oil | Search, category and grade filters, clear empty state |
| Product detail | Check suitability and inquire | Product information, published stock, quick quote handoff |
| Quote request | Send a usable purchasing inquiry | Product, quantity and unit, destination, contact details, confirmation state |
| Company and contact | Verify the seller and get in touch | Approved company details and real contact routes |
| Staff and client areas | Follow up on commercial activity | Sign-in, inquiry and quotation workflows, shipment information |

## Shared design system

- `frontend/src/design-system.css` applies the PNG palette to public pages, the portals, and CRM: navy `#0B2D5B`, blue `#2563EB`, amber `#F59E0B`, success `#10B981`, error `#EF4444`, neutral `#6B7280`, background `#EFF6FF`, light blue `#DBEAFE`, muted `#F3F4F6`, border `#E5E7EB`, and text `#1F2937`.
- Inter is the shared typeface. The body scale is 16/24, with headings at 36/44, 28/36, 20/28, and 18/26; smaller text uses 14/20 and 12/16. A system-font fallback keeps the interface readable if the web font is unavailable.
- The public header uses dark navy with an amber quotation action. Public search uses a navy utility action. The blue action variant is used for saved CRM changes; blue outlines are used for secondary actions. Disabled actions have an explicit neutral state.
- `frontend/src/design-system.jsx` provides the reusable line icons and status tags used by public content and signed-in navigation. Four alert treatments are available: information, success, warning, and error.
- Cards, tables, inputs, navigation, status tags, and spacing use shared tokens. Main desktop content has a 1440px maximum width and a 24px grid gap; mobile layouts use 16px page gutters. Dense tables scroll within their container.
- Image-led category and product cards retain the public page compositions from `ui-images/`. Headings, product information, stock, buttons, and forms remain HTML so they can adapt responsively and support keyboard access.
- The active site uses the supplied Persian company profile and a working English translation. The English spelling, logo, and publication wording still need owner approval. The PNG's generic company title is a design reference.
- English remains the default UI. Persian is selectable in the header and via `?lang=fa`, with RTL layout and Vazirmatn/system fallback. Technical grade codes, units, Incoterms, ASTM methods, and document acronyms remain identifiable; business data is only translated when an approved Persian value exists. Commercial dates stay Gregorian.

## Implemented visual assets

| Asset | Placement | Description |
| --- | --- | --- |
| `frontend/src/assets/mock-hero.png` | Home, catalog, stock, product, and About banners | Illustrative refinery, ship, and container scene |
| `frontend/src/assets/mock-beaker.png` | Product cards | Illustrative base-oil sample |
| `frontend/src/assets/mock-drum.png` | Product detail gallery | Illustrative oil drum |
| `frontend/src/assets/mock-logistics.png` | Packaging cards | Illustrative logistics options |
| `frontend/src/assets/mock-team.png` | Team cards | Illustrative portraits; these are not actual employees |
| `frontend/src/assets/mock-offices.png` | About office cards | Illustrative cityscapes; these are not verified offices |
| `frontend/src/assets/mock-map.png` | Global presence areas | Illustrative map; dots do not represent verified markets |
| `frontend/src/assets/base-oils.webp` | Active base oils category and product cards | 1200 × 800 illustrative base oil containers |
| `frontend/src/assets/industrial-lubricants.png` | Inactive design reference | Illustrative lubricant containers |
| `frontend/src/assets/greases.png` | Inactive design reference | Illustrative grease containers |
| `frontend/src/assets/process-oils.webp` | Active petroleum products and industrial solvents cards | 1200 × 800 illustrative industrial oil containers |
| `frontend/src/assets/industrial-harbor.webp` and `industrial-harbor-mobile.webp` | Active public banners and home hero | 1983 × 793 and 960 × 384 illustrative harbor scene |

These are generated visuals and do not depict this company's actual facilities, products, staff, or offices. Replace them with approved photography when available. Inactive mock images remain PNG design references; the active public images use resized WebP assets.

## Content still needed

1. Confirmation of the official English legal name, publication copy, logo, factual contacts, sales regions, and brand guidelines.
2. Product images, approved specifications, grade information, and supplier documents.
3. Verified company history, capabilities, team, facilities, and certifications if those are to appear on the site.
4. Approved English and Persian copy if bilingual launch remains a requirement.

## Demo routes and handoff

- `/`, `/products`, `/products/:slug`, `/stock`, and `/about` render active public pages. Product and stock quote actions carry approved database identifiers into `/buy`; the FastAPI inquiry flow is the submission path. `/team` lists five names and positions from the 18 April 2026 company registration notice, without biographies or photos. `/insights` remains an explicit empty state until authorized content is available.
- A company-content publication workflow, approved contact details, team profiles, and editorial content are still needed before external release.
