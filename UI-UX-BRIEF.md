# Industrial oils website: UI/UX brief

## Working assumptions

- Launch as one company's B2B product catalog with public stock and inquiry flows, plus private staff and client areas.
- `Industrial Oils Trading Design System.png` defines the shared visual tokens and component treatment. The four screenshots in `ui-images/` remain page-composition references for the public demo. PETROVEX and the depicted company, product, stock, team, office, certification, and technical information are sample content only.
- Keep the mock catalog and company facts isolated in `frontend/src/mockData.js` until approved content and API integration replace them. Public inquiry forms still submit to FastAPI.

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
- The PETROVEX name and mock business details remain preview content; the footer identifies the site as a demo. The PNG's generic company title is a design reference, not a verified company identity.

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
| `frontend/src/assets/base-oils.png` | Base oils category and product cards | Illustrative base oil containers |
| `frontend/src/assets/industrial-lubricants.png` | Industrial lubricants category and product cards | Illustrative lubricant containers |
| `frontend/src/assets/greases.png` | Greases category and product cards | Illustrative grease containers |
| `frontend/src/assets/process-oils.png` | Process oils category and product cards | Illustrative process oil containers |

These are generated visuals and do not depict this company's actual facilities, products, staff, or offices. Replace them with approved photography when available. The mock images are large PNGs; optimize approved replacement images before release.

## Content still needed

1. Approved company name, logo, contacts, sales regions, and brand guidelines.
2. Product images, approved specifications, grade information, and supplier documents.
3. Verified company history, capabilities, team, facilities, and certifications if those are to appear on the site.
4. Approved English and Persian copy if bilingual launch remains a requirement.

## Demo routes and handoff

- `/`, `/products`, `/products/:slug`, `/stock`, `/about`, `/team/:slug`, and `/insights` currently render the demo content.
- Product and stock quote actions carry the sample product name into `/buy`; the existing FastAPI inquiry flow remains the submission path. No mock stock entry is treated as a real inventory lot.
- Replace `frontend/src/mockData.js` values first, then connect these pages to approved public product, stock, company, and editorial endpoints. Remove the demo footer note only after content verification.
