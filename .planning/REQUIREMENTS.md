# Requirements — Oak Homes Website v1

Source: approved design spec (`docs/specs/2026-08-28-oak-homes-website-design.md`) + research additions accepted 2026-08-28.

## v1 Requirements

### Browsing (BROWSE)

- [x] **BROWSE-01**: Visitor can browse all homes on a listing page showing cover photo, address, status badge (Available/Pending/Sold), down payment, and monthly payment per card
- [x] **BROWSE-02**: Visitor can open each home's own page at a shareable URL (`/homes/<slug>`)
- [x] **BROWSE-03**: Homepage shows brand intro, 3-step overview, and featured available homes

### Property pages (PROP)

- [x] **PROP-01**: Property page shows a photo gallery (ordered, first photo = cover)
- [x] **PROP-02**: Property page shows terms (down/monthly), beds, baths, square footage, and rich description with feature bullets
- [ ] **PROP-03**: Property page shows a map pin of the home's location (Leaflet + OpenStreetMap, no paid API)
- [ ] **PROP-04**: Property page can embed an optional video (YouTube/Facebook link)
- [ ] **PROP-05**: Sharing a property URL on Facebook/Instagram shows a rich preview card (photo, address, terms) via OpenGraph tags

### Education & trust (EDU)

- [x] **EDU-01**: How It Works page explains land contracts in plain language (content ported from refined one-pager)
- [x] **EDU-02**: FAQ section answers trust questions ("Is this legit?", "Do I get the deed?", "What if I miss a payment?") — folded into How It Works page
- [x] **EDU-03**: About page introduces the company
- [x] **EDU-04**: Learn section publishes blog posts (index + per-post pages)
- [x] **EDU-05**: Schedule a Showing page presents the phone CTA (217) 269-0003

### Lead capture (LEAD)

- [ ] **LEAD-01**: Contact page embeds the existing Zoho web-to-lead form; submissions arrive in Zoho CRM as Leads tagged "Website Lead"
- [ ] **LEAD-02**: Property Inquire buttons open the contact form with the property address pre-filled (custom URL-parameter script — not Zoho-native)
- [x] **LEAD-03**: Phone number is visible on every page (prominent on mobile)

### Admin panel (ADMIN)

- [ ] **ADMIN-01**: Assistant can log into a form-based admin panel at `/admin` (Sveltia CMS, GitHub sign-in via Netlify's built-in OAuth)
- [ ] **ADMIN-02**: Assistant can add a property by filling a form and uploading photos; it appears on the live site within ~2 minutes of Publish
- [ ] **ADMIN-03**: Assistant can edit a property and change its status (Available/Pending/Sold) via dropdown
- [ ] **ADMIN-04**: Assistant can write and publish blog posts (title + rich text + optional cover image)
- [ ] **ADMIN-05**: Assistant can edit site settings (phone, email, social links, homepage intro) via a settings form
- [ ] **ADMIN-06**: Assistant receives a one-page illustrated cheat-sheet (incl. photo pre-resize guidance ~2000px)

### Design & compliance (DESIGN)

- [x] **DESIGN-01**: Site ports mockup branding: yellow #F6C84C / ink #1A1A1A / warm cream, Lora + Inter, leaf logo, "From Rent to Roots"
- [x] **DESIGN-02**: Equal Housing Opportunity footer with refined legal wording is baked into the single shared layout (structurally on every page)
- [x] **DESIGN-03**: Legally-sensitive copy (land-contract wording) lives in code, not the CMS, and preserves the refined phrasing exactly
- [x] **DESIGN-04**: Site meets WCAG 2.1 AA basics: alt text, contrast, keyboard/screen-reader-friendly forms and navigation
- [x] **DESIGN-05**: Mobile-first responsive layout; pages are static pre-rendered HTML
- [x] **DESIGN-06**: Shared layout includes a marked integrations slot for future site-wide widgets (Phase 2 chat/popups)

### Infrastructure (INFRA)

- [x] **INFRA-01**: Oak Homes GitHub account created (browser walkthrough with owner) and this computer connected to it
- [x] **INFRA-02**: Site source + content live in a private GitHub repo (single source of truth)
- [ ] **INFRA-03**: Netlify builds and deploys automatically on every commit (replacing zip-drag deploys)
- [x] **INFRA-04**: The two existing homes (614 E Marengo; Brown St — number confirmed 2734 vs 2437) are migrated with pre-resized photos

### Launch (LAUNCH)

- [ ] **LAUNCH-01**: Domain transfer completes to Oak-owned Cloudflare; `ownwithoak.com` serves the new site (A → 75.2.60.5, www → Netlify)
- [ ] **LAUNCH-02**: Google Workspace email verified working before and after DNS cutover (staged MX/DKIM checklist; SPF record `v=spf1 include:_spf.google.com ~all` added)
- [ ] **LAUNCH-03**: End-to-end lead test on the production domain (submit → verify in Zoho → delete)
- [ ] **LAUNCH-04**: Local SEO basics: Google Business Profile claimed; name/address/phone consistent site-wide; sitemap submitted

## v2 Requirements (deferred)

- **V2-01**: AI chat agent popup integrated with Zoho (recommended: Zoho SalesIQ via integrations slot)
- **V2-02**: Promotional popups / offer banners posting into Zoho
- **V2-03**: Image CDN optimization upgrade (only if page weight becomes a measured problem)
- **V2-04**: Structured data (JSON-LD) for listings
- **V2-05**: Analytics (via integrations slot)

## Out of Scope

- Online credit/financial applications — regulatory exposure; handled off-site
- User accounts, saved favorites — infrastructure overkill for a small inventory
- On-site payment collection — legal/PCI complexity; transactions happen off-site
- MLS/IDX listing feeds — misrepresents the owner-financing business model
- Google Drive content pipeline — replaced by the admin panel
- Instant-approval quizzes — mimics scam-site UX in this niche

## Traceability

Each v1 requirement maps to exactly one phase. Coverage: **36/36** — no orphans, no duplicates.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BROWSE-01 | Phase 1 — Foundation | Complete |
| BROWSE-02 | Phase 1 — Foundation | Complete |
| BROWSE-03 | Phase 1 — Foundation | Complete |
| PROP-01 | Phase 1 — Foundation | Complete |
| PROP-02 | Phase 1 — Foundation | Complete |
| PROP-03 | Phase 3 — Integrations | Pending |
| PROP-04 | Phase 3 — Integrations | Pending |
| PROP-05 | Phase 3 — Integrations | Pending |
| EDU-01 | Phase 1 — Foundation | Complete |
| EDU-02 | Phase 1 — Foundation | Complete |
| EDU-03 | Phase 1 — Foundation | Complete |
| EDU-04 | Phase 1 — Foundation | Complete |
| EDU-05 | Phase 1 — Foundation | Complete |
| LEAD-01 | Phase 3 — Integrations | Pending |
| LEAD-02 | Phase 3 — Integrations | Pending |
| LEAD-03 | Phase 1 — Foundation | Complete |
| ADMIN-01 | Phase 2 — Publishing | Pending |
| ADMIN-02 | Phase 2 — Publishing | Pending |
| ADMIN-03 | Phase 2 — Publishing | Pending |
| ADMIN-04 | Phase 2 — Publishing | Pending |
| ADMIN-05 | Phase 2 — Publishing | Pending |
| ADMIN-06 | Phase 2 — Publishing | Pending |
| DESIGN-01 | Phase 1 — Foundation | Complete |
| DESIGN-02 | Phase 1 — Foundation | Complete |
| DESIGN-03 | Phase 1 — Foundation | Complete |
| DESIGN-04 | Phase 1 — Foundation | Complete |
| DESIGN-05 | Phase 1 — Foundation | Complete |
| DESIGN-06 | Phase 1 — Foundation | Complete |
| INFRA-01 | Phase 1 — Foundation | Complete |
| INFRA-02 | Phase 1 — Foundation | Complete |
| INFRA-03 | Phase 2 — Publishing | Pending |
| INFRA-04 | Phase 1 — Foundation | Complete |
| LAUNCH-01 | Phase 4 — Launch | Pending |
| LAUNCH-02 | Phase 4 — Launch | Pending |
| LAUNCH-03 | Phase 4 — Launch | Pending |
| LAUNCH-04 | Phase 4 — Launch | Pending |

**Coverage by phase:** Phase 1 = 20, Phase 2 = 7, Phase 3 = 5, Phase 4 = 4.
