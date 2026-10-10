# Industrial oils website: UI/UX starter brief

## Working assumptions

- Launch as one company's bilingual (English/Persian) B2B catalog with a request-for-quote flow.
- Keep product browsing public and the sales CRM private to staff.
- Confirm whether independent sellers, online checkout, and country-specific prices are needed before designing those flows.

## First screens to design

| Screen | Main user task | Essential elements |
| --- | --- | --- |
| Home | Understand the offer and start searching | Clear value proposition, product search, category links, quote CTA, company trust cues |
| Product catalog | Find a suitable oil | Search; filters for application, brand, ISO VG, approval/specification, and package size; clear empty state |
| Product detail | Check suitability and inquire | Product name/grade, applications, specifications and approvals, pack sizes, PDS/TDS and SDS downloads, quote CTA |
| Quote request | Send a usable purchasing inquiry | Selected product/grade, quantity and unit, delivery location, company/contact, target date, confirmation state |
| Company and team | Verify who is selling | Actual company story, address, capabilities, real team names/roles/photos, contact routes |
| Staff CRM | Respond to and track inquiries | Sign-in, lead list, lead detail, assigned owner, status, notes, follow-up date, quote history |

## Visual direction

- Industrial, credible, precise. Use spacious layouts, readable type, high contrast, and restrained navy/steel/amber accents as an initial direction; refine to the real brand identity when supplied.
- Put headings, buttons, specifications, and other meaningful content in HTML rather than baking English or Persian text into images.
- Use a shared component system for both languages. Mirror layout and navigation for Persian; keep oil grades, model numbers, units, and file names legible in mixed-direction text.
- Design mobile catalog filtering and the quote form early, since both are core buying tasks.

## Image inventory

| File | Suggested placement | Suggested English alt text | Suggested Persian alt text |
| --- | --- | --- | --- |
| `ui-images/home-hero.png` | Home hero or category introduction | Industrial hydraulic machinery with lubricant reservoir | ماشین‌آلات هیدرولیک صنعتی و مخزن روانکار |
| `ui-images/category-hydraulic-oils.png` | Hydraulic oils category card | Industrial hydraulic press | پرس هیدرولیک صنعتی |
| `ui-images/category-gear-oils.png` | Gear oils category card | Industrial gearbox with visible gears | گیربکس صنعتی با چرخ‌دنده‌های نمایان |
| `ui-images/company-facility.png` | About page visual placeholder | Industrial oil warehouse with drums and containers | انبار روغن صنعتی با بشکه‌ها و مخازن |

These images are AI-generated **illustrations of the industry**. Do not present `company-facility.png` as a photograph of the company's actual site. Use real staff portraits, facilities, product packaging, certifications, and supplier documents once available.

## Content needed before high-fidelity screens

1. Company name, logo, real contact details, launch countries, and sales model.
2. Initial product list with brand, category, ISO VG, pack sizes, approved claims/specifications, and PDS/SDS files.
3. Exact quote process: sales owner, expected response time, pricing policy, and delivery regions.
4. Real company/facility/team photos and permission to publish them.
5. Approved English and Persian copy, including product names, terminology, and form messages.

## Image generation prompts

Built-in image generation was used for all four assets. The prompts requested: (1) a wide modern hydraulic-machinery hero with restrained amber lubricant detail, (2) a square hydraulic press category photograph, (3) a square industrial gearbox category photograph, and (4) a wide clean oil-warehouse photograph. All prompts specified a realistic navy/steel/amber treatment with no text, logos, watermarks, or people.
