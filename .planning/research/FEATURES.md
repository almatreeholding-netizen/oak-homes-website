# Feature Research

**Domain:** Owner-financing / land-contract / rent-to-own home sales website (small local seller, single market — Flint, MI)
**Researched:** 2026-08-28
**Confidence:** MEDIUM (regulatory items cross-checked against HUD/DOJ sources; competitive/UX patterns from general web search, LOW individually but consistent across multiple independent sites)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist on any credible owner-financing home-sales site. Missing these makes the site feel incomplete or, worse, makes it look like a scam — a real risk in this specific niche because buyers are primed to be suspicious of owner-financing offers.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Property listing grid with cover photo, address, status badge, terms (down/monthly) | Every owner-financing/rent-to-own aggregator (LoopNet, OwnerWillCarry, RentUntilYouOwn) leads with searchable, terms-first cards; buyers filter by affordability before anything else | LOW | Already in spec (`/homes`) |
| Per-property detail page with full gallery, specs, description, map | Standard for both MLS-style and owner-financing niche sites; buyers expect to verify the property is real and see it from multiple angles before contacting | LOW–MEDIUM | Already in spec |
| Transparent financing terms shown up front (down payment, monthly payment) | Owner-financing buyers explicitly shop by these two numbers; niche sites (RentUntilYouOwn, OwnerWillCarry) foreground them on cards, not buried in description | LOW | Already in spec |
| Clear "How It Works" / plain-language education page | Land contracts are unfamiliar to most renters; every serious owner-financing operation explains the mechanism (down payment → monthly payments → deed transfer at payoff) to build understanding before asking for a lead | LOW (content) | Already in spec; this is also the primary anti-scam trust device — see Pitfalls note below |
| FAQ addressing common fears in plain language | The rent-to-own/land-contract niche has a well-documented scam reputation (balloon payments, no title transfer, deposits not escrowed); an FAQ that proactively answers "what if I miss a payment," "do I get the deed," "is this legit" reduces buyer hesitation before they ever call | LOW (content) | Not explicitly in current spec as a standalone page — recommend folding into How It Works or adding a short FAQ block there |
| Equal Housing Opportunity statement/logo, prominent and on every page | HUD advertising guidance (24 CFR Part 109) plus near-universal state/MLS/lender practice expects this; its absence on a financing-focused site reads as a red flag to a wary buyer, not just a compliance gap | LOW | Already in spec (footer, every page) — keep it visible, not buried in fine print |
| Phone number visible everywhere, especially on mobile | Land-contract buyers want to talk to a real person before trusting an unfamiliar arrangement; a prominent tap-to-call CTA is the single highest-trust, lowest-friction action on this kind of site | LOW | Already in spec (`Schedule a Showing` phone CTA); ensure phone is in header/footer on every page, not just one CTA page |
| Simple inquiry/contact form (name, email/phone, message, property reference) | Every real-estate lead-gen pattern converges on short forms (5–8 fields); asking for less than that is unusual, asking for more (SSN, income, credit info) is a red flag and legal exposure | LOW | Already in spec (Zoho web-to-lead + property pre-fill) |
| Mobile-first, fast-loading pages | Rent-to-own buyers skew toward mobile browsing; niche site UX patterns and general real-estate lead-gen research both stress speed and mobile CTA prominence | LOW–MEDIUM | Already in spec (Astro static, mobile-first) |
| Status badges (Available/Pending/Sold) kept current | Buyers lose trust fast if they inquire about a home that's already gone; stale listings are a common complaint about small owner-financing operations | LOW | Already in spec; depends on assistant discipline via admin panel, not a build risk |
| Accessible forms and navigable content (keyboard, screen reader, alt text, contrast) | ADA Title III applies to real-estate sites regardless of business size — no small-business exemption. Property search/filter UI and contact forms are the most litigated real-estate accessibility failure points; WCAG 2.1 AA is the de facto legal bar in the US as of 2026 | LOW–MEDIUM | Not explicitly called out in current spec — recommend adding as an explicit acceptance criterion (alt text on all property photos, form labels, focus states, color contrast on yellow/ink palette) |
| Local NAP consistency + Google Business Profile | 97% of buyers search online first; Local Pack visibility for "owner financing homes Flint MI" / "rent to own Flint" is free and directly reachable; requires site NAP (name/address/phone) to exactly match the GBP listing | LOW (site) / separate task (GBP claim) | Not in current spec as a task — recommend adding to launch checklist even though it's mostly outside the codebase (structured data + consistent footer NAP is the site's part) |

### Differentiators (Competitive Advantage)

Features that set Oak Homes apart from generic listing aggregators and from other small owner-financing sellers, most of whom run bare-bones single-page sites or Facebook Marketplace posts.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-home shareable URL with rich OpenGraph preview (photo + terms in Facebook/Instagram link cards) | Most small owner-financing sellers post static Facebook album links with no structured preview; a clean share card with photo + price signals legitimacy and drives organic referral traffic at zero cost | LOW–MEDIUM | Already in spec — this is a genuine differentiator versus the FB-Marketplace-only competition typical in this niche |
| Blog / "Learn" content (buyer education, local neighborhood info, success stories) | Content marketing is largely absent among small owner-financing operators; even light, recurring content (what a land contract is, credit-repair-while-you-pay tips, neighborhood spotlights) compounds local SEO and reinforces the "we're the trustworthy, established option" positioning | LOW (content authoring via admin) / MEDIUM (SEO payoff takes months) | Already in spec (`/learn`); value depends on the assistant actually publishing regularly — a content-cadence risk, not a technical one |
| Self-service admin panel for non-technical staff (Sveltia CMS) | Competitors either pay a developer for every listing change or run on Facebook/Craigslist with no dedicated site at all; a same-day publish-to-live property update is a real operational edge for a small owner keeping listings current | MEDIUM (one-time build cost) | Already in spec — this is the core differentiator of the whole project, not just a marketing one |
| Map pin on property page | Some aggregator sites omit an embedded map or make buyers cross-reference the address themselves; a simple map removes friction for buyers evaluating a Flint neighborhood site-unseen | LOW | Already in spec |
| Optional video embed per property | Video walkthroughs are uncommon among small owner-financing sellers (photo-only is the norm); even a simple phone-shot walkthrough differentiates a listing and reduces no-show showings | LOW | Already in spec, optional field — good as-is, don't make it required (raises the bar for the assistant unnecessarily) |
| "What You'll Need" panel on How It Works | Setting expectations (ID, proof of income, down payment amount, etc.) before a lead is submitted pre-qualifies interest without a formal application — reduces low-intent inquiries without adding legal exposure of a credit app | LOW (content) | Already in spec's How It Works content; worth treating this as a genuine soft-qualification differentiator, not just copy |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create legal, operational, or trust problems for a small owner-financing seller. All of these are already correctly excluded in the spec's Non-goals — listed here with the reasoning so it survives into the roadmap.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Online credit/financing application (collecting SSN, income, credit consent on-site) | Feels like it would "pre-qualify" buyers and speed up the funnel | Creates real regulatory exposure (credit-reporting, data-security, potentially SAFE Act/lending-disclosure obligations) for a business that isn't set up as a licensed lender; a data breach of SSNs on a $0/month static site is a severe, disproportionate risk | Keep qualification conversational/phone-based; "What You'll Need" panel sets expectations without collecting sensitive data online |
| User accounts / saved favorites / "My Homes" login | Common on big real-estate portals (Zillow-style), feels modern | Adds auth, database, and session infrastructure to a static $0/month site with only 1–5 active listings at a time — the inventory is too small for personalization to matter, and it breaks the "no database" architecture decision | A short inventory browsed in one visit; "Inquire" is the only action a buyer needs |
| On-site payment processing / down-payment collection | Would look "complete" and modern | Money movement on a marketing site multiplies PCI, legal, and trust risk for a small operator; land-contract closings happen through proper title/escrow channels off-site, not a web form | Keep all payment/closing steps off-site through the actual land contract process; site only generates leads |
| Automated instant-approval / "pre-qualify in 60 seconds" quiz that outputs a decision | Popular pattern on payday-loan and subprime-auto sites; looks slick | This pattern is exactly what rent-to-own/land-contract scam sites use (frictionless "yes" before any real underwriting) — replicating it undermines the trust-building the rest of the site is doing, and implies a lending decision the seller can't legally make via an automated tool | A short, honest inquiry form; qualification conversation happens by phone/showing with a real person |
| Live chat / AI chatbot at launch | Feels like it improves responsiveness | Explicitly scoped to Phase 2 in the spec (Zoho SalesIQ via integrations slot) — building it now duplicates effort before the base layout and lead pipeline are proven, and an under-supervised AI chat agent making implied commitments about financing terms is a compliance risk if deployed without guardrails | Ship the integrations slot now (already spec'd); add SalesIQ or similar in a dedicated later phase with reviewed scripts |
| Third-party MLS/IDX listing feed integration | Would look like a "real" real estate site with lots of inventory | Oak Homes sells its own 1–2 owned properties on land contract, not MLS-listed homes for buyer-side representation; IDX adds licensing cost, feed complexity, and misrepresents the business model | Keep the site focused on Oak's own inventory only |
| Heavy CRM features built into the site (pipeline views, deal stages, internal notes) | Since leads flow to Zoho anyway, seems efficient to view them "in one place" | Duplicates Zoho CRM, adds database/auth surface to a static site, and the admin panel's job is content publishing, not sales-pipeline management | Zoho CRM remains system of record for leads; admin panel stays scoped to content (already the spec's boundary) |
| Google Drive / spreadsheet content pipeline | Already existed before, feels familiar to the assistant | Explicitly rejected in spec already — no version control, easy to desync from the live site, no publish safety | Sveltia CMS admin panel (already chosen) |

## Feature Dependencies

```
Property listing grid (Browse Homes)
    └──requires──> Property content model (status, terms, photos, specs)
                       └──requires──> Admin panel property form (Sveltia CMS)

Property detail page (gallery, map, video, Inquire)
    └──requires──> Property content model
    └──requires──> Map pin field (lat/long) in admin form
    └──requires──> Zoho property pre-fill (URL parameter on Inquire button)

OpenGraph share previews
    └──requires──> Property detail page + cover photo field

FAQ / trust content
    └──enhances──> How It Works page (reduces bounce before Inquire)

Local SEO (structured data + NAP + GBP)
    └──requires──> Consistent NAP in site footer/settings file
    └──conflicts with──> nothing, but must stay in sync if phone/address ever changes (settings file is single source of truth — already spec'd)

Accessibility (WCAG 2.1 AA baseline)
    └──enhances──> every page, especially property listing filters and contact forms
    └──conflicts with──> none, but must be verified before launch, not retrofitted (cheaper to build in from the start)

AI chat agent / popups (Phase 2)
    └──requires──> Integrations slot in base layout (already spec'd, built now)
    └──conflicts with──> shipping now (explicitly deferred)
```

### Dependency Notes

- **Property listing grid requires the content model:** the grid can't render terms/status/photos until the Sveltia CMS property schema (already defined in §4 of the design spec) exists and the admin form captures every field the card needs. Build the content model and admin form before or alongside the listing/detail pages, not after.
- **FAQ enhances How It Works:** it's not a separate technical feature, just content — but it should exist before heavy promotion/traffic starts, since it's the main lever against the niche's scam reputation. Cheap to add now, costly to be missing when a skeptical buyer bounces.
- **Local SEO requires NAP consistency:** the settings file already centralizes phone/email (§4 of spec) — local SEO just requires that the footer and any structured data (JSON-LD `RealEstateListing`/`LocalBusiness`) always pull from that single settings source rather than being hand-typed per page.
- **Accessibility enhances everything and conflicts with nothing:** it's a cross-cutting quality bar (alt text, labels, contrast, keyboard nav), cheapest to enforce as a build-phase checklist item rather than a later audit, especially given real estate is a documented ADA-lawsuit target.
- **AI chat agent conflicts with shipping now:** already correctly deferred; the only in-scope work this phase is making sure the integrations slot exists and is easy to drop a script into later.

## MVP Definition

### Launch With (v1)

Minimum viable product — matches the approved spec closely, with two small additions surfaced by this research.

- [ ] Home, Browse Homes, per-property pages with gallery/map/terms/status — core browsing loop
- [ ] How It Works page with plain-language land-contract explainer and "What You'll Need" panel — primary trust/education device
- [ ] Short FAQ (3–6 questions) addressing "is this legit," "what if I miss a payment," "do I get the deed," folded into How It Works or its own short section — directly counters the niche's scam reputation; cheap, high trust payoff
- [ ] About, Contact, Schedule a Showing (phone CTA) — already spec'd
- [ ] Equal Housing Opportunity statement on every page footer, prominent not buried — non-negotiable compliance/trust signal
- [ ] Zoho contact form with property pre-fill — the lead-capture core
- [ ] OpenGraph tags on property pages — differentiator vs. Facebook-only competitors, low cost given Astro
- [ ] Admin panel (Sveltia CMS) for properties + blog — core operational value of the whole project
- [ ] WCAG 2.1 AA baseline (alt text, form labels, contrast, keyboard nav) treated as an explicit acceptance item, not an afterthought — real litigation risk for real estate specifically

### Add After Validation (v1.x)

- [ ] Blog/Learn cadence beyond the migration content — trigger: once admin panel workflow is proven comfortable for the assistant, start a light regular posting habit for local SEO compounding
- [ ] Structured data (JSON-LD RealEstateListing/LocalBusiness) — trigger: once the two current homes are live and stable, add markup to improve rich-result eligibility in local search
- [ ] Google Business Profile claim/optimization — trigger: immediately post-launch, in parallel with site work (not a code task, but should ride the same launch checklist so NAP matches)

### Future Consideration (v2+)

- [ ] AI chat agent (Zoho SalesIQ) — defer until lead volume/pipeline from the base site is validated; already spec'd as Phase 2
- [ ] Promotional popups / offer banners — defer for the same reason; risk of feeling pushy on a trust-sensitive niche before the base site has proven itself
- [ ] Multi-property comparison / saved search — only worth it if inventory grows well beyond a handful of homes at once; not justified for a 1–5 property inventory

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Property listing grid + detail pages | HIGH | LOW | P1 |
| How It Works + What You'll Need | HIGH | LOW | P1 |
| FAQ (scam-reputation counter) | HIGH | LOW | P1 |
| Equal Housing footer/compliance | HIGH (legal + trust) | LOW | P1 |
| Zoho contact form + property pre-fill | HIGH | LOW–MEDIUM | P1 |
| Admin panel (Sveltia CMS) | HIGH | MEDIUM | P1 |
| OpenGraph share previews | MEDIUM–HIGH | LOW | P1 |
| WCAG 2.1 AA baseline | MEDIUM (high downside if skipped) | LOW–MEDIUM | P1 |
| Local NAP consistency / GBP alignment | MEDIUM | LOW | P2 |
| Blog/Learn ongoing cadence | MEDIUM (compounds over time) | LOW (content) | P2 |
| Structured data (JSON-LD) | LOW–MEDIUM | LOW | P2 |
| AI chat agent / popups | MEDIUM | MEDIUM (Phase 2 scope) | P3 |
| Online credit application | — (anti-feature) | — | Do not build |
| User accounts / saved favorites | LOW (small inventory) | MEDIUM–HIGH | Do not build |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Typical small owner-financing seller (bare site / FB Marketplace) | Aggregator sites (LoopNet, OwnerWillCarry, RentUntilYouOwn) | Oak Homes approach |
|---------|--------------------------------------------------------------------|--------------------------------------------------------------|--------------------|
| Listing presentation | Photo album post, terms in caption text, no structured page | Searchable grid, filters by location/price, terms columns | Structured grid + dedicated detail page per home, terms visible on cards (already spec'd) |
| Trust/education content | None — usually just "owner financing available" one-liner | Generic "how owner financing works" boilerplate, not seller-specific | Seller-specific How It Works + FAQ in Oak's own refined legal language |
| Fair housing / compliance signal | Frequently absent entirely | Present but generic, often just footer boilerplate | Equal Housing statement on every page, integrated into the design (already spec'd) |
| Lead capture | Facebook Messenger / phone number in caption only | Web form, sometimes gated behind account creation | Short Zoho form with property pre-fill + prominent phone CTA — matches best-practice pattern without the friction of account walls |
| Content/SEO | None | Some blog content at the aggregator level, not seller-specific | Local blog (`/learn`) under Oak's own domain — differentiator versus both bare-site sellers and generic aggregators |
| Accessibility | Essentially never addressed | Inconsistent — larger sites have had ADA suits over search filters/forms | Built-in WCAG 2.1 AA baseline from the start — avoids the documented real-estate lawsuit pattern |

## Sources

- [Owner Financed Properties For Sale | LoopNet](https://www.loopnet.com/owner-financed-properties-for-sale/) — LOW confidence (single web search, not cross-verified)
- [Owner Financed, Rent-to-Own and Lease Option Homes for Sale | OwnerWillCarry](https://ownerwillcarry.com/) — LOW confidence
- [Rent To Own Homes | Owner Financed Houses | RentUntilYouOwn.com](https://www.rentuntilyouown.com/) — LOW confidence
- [Land contract — Wikipedia](https://en.wikipedia.org/wiki/Land_contract) — LOW confidence (encyclopedic, not primary legal source, but consistent with legal definition used in project spec)
- [Fair Housing in Real Estate: A Guide for Agents & Brokers — The Close](https://theclose.com/fair-housing-real-estate/) — LOW confidence
- [NAR — 6 Fair Housing (PDF)](https://www.nar.realtor/sites/default/files/documents/Fair-Housing-RE-Brokerage-Essentials-Chapter-06-2016.pdf) — MEDIUM confidence (industry association primary material)
- [Equal Housing Logo Requirements | 24 CFR § 109 — BuildMyListing](https://buildmylisting.com/equal-housing-opportunity-logo-advertising-requirements) — MEDIUM confidence (cites federal regulation directly; cross-checked against HUD's stated advertising guidance pattern)
- [5 Proven Strategies to Capture More Leads from Your Property Listing — SharpLaunch](https://www.sharplaunch.com/blog/capture-leads) — LOW confidence
- [Real Estate Call to Action Examples That Convert in 2026 — Luxury Presence](https://www.luxurypresence.com/blogs/call-to-action-real-estate-cta/) — LOW confidence
- [How to Protect Your Business from ADA Website Accessibility Lawsuits — US Chamber of Commerce](https://www.uschamber.com/co/run/technology/ada-website-accessibility-compliance) — MEDIUM confidence
- [ADA Compliance for Real Estate Websites — Listings — WCAG Safe](https://wcagsafe.com/ada-compliance/real-estate) — MEDIUM confidence (domain-specific, cross-checked against general ADA/WCAG guidance)
- [Local SEO Checklist: Why Your Business Gets Buried — The Small Business Expo](https://www.thesmallbusinessexpo.com/blog/local-seo-checklist/) — LOW confidence
- [Local SEO For Real Estate Businesses: Boost Ranking — WebxAdvisor](https://webxadvisor.com/guide/local-seo-for-real-estate-businesses-boost-ranking/) — LOW confidence
- [5 Signs of a Rent-to-Own Scam (and How to Avoid One) — ListWithClever](https://listwithclever.com/rent-to-own/rent-to-own-scams/) — LOW confidence
- [Owner Financing Scams: 9 Red Flags Every Buyer Must Know — HomesWithOwnerFinancing](https://homeswithownerfinancing.com/owner-financing-scams) — LOW confidence
- [From Dream to Deception: The Dark Side of Rent-to-Own Real Estate — TrustDALE](https://trustdale.com/blog/from-dream-to-deception-the-dark-side-of-rent-to-own-real-estate) — LOW confidence

**Confidence note:** No dedicated documentation provider (Context7/Ref/etc.) applies to this domain — findings come from general web search only, individually LOW confidence per the classify-confidence seam. Regulatory claims (Equal Housing advertising guidance, ADA/WCAG applicability to real estate) are elevated to MEDIUM because they were corroborated by multiple independent sources citing the same underlying federal rules (24 CFR Part 109; DOJ WCAG 2.1 AA rule). Competitive/UX pattern claims remain LOW confidence and should be treated as directional, not verified fact — reasonable industry-standard inference given consistent appearance across the sites reviewed.

---
*Feature research for: owner-financing / land-contract home sales website*
*Researched: 2026-08-28*
