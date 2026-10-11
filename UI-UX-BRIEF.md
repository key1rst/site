# Industrial oils website: UI/UX brief

## Working assumptions

- Launch as one company's B2B product catalog with public stock and inquiry flows, plus private staff and client areas.
- The four screenshots in `ui-images/` define the current public-page visual demo. PETROVEX and the depicted company, product, stock, team, office, certification, and technical information are sample content only.
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

## Visual direction from `ui-images/`

- White header, deep navy industrial photography, amber actions, generous spacing, and serif display headings.
- Image-led category and product cards with clear labels, grades, and actions.
- Keep headings, product information, stock, buttons, and forms as HTML so they remain responsive and accessible.
- Mobile navigation, catalog filters, and inquiry forms must remain usable at narrow widths.
- Show the PETROVEX name and mock business details for this preview only; the footer identifies the site as a demo.

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
