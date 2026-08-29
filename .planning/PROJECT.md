# Oak Homes Website (ownwithoak.com)

## What This Is

The real website for Oak Homes, a company selling homes in Flint, MI on owner financing / land contracts ("From Rent to Roots"). It replaces a single-file HTML mockup with a fast, fully-owned static site where buyers browse homes and inquire, and where a non-technical assistant publishes new properties and blog posts through a friendly admin panel — no coding, no Claude, no Google Drive.

## Core Value

A visitor can find a home and become a lead in Zoho CRM — and the assistant can publish a new home unaided in minutes.

## Business Context

- **Customer**: Renters in the Flint, MI area seeking a path to homeownership without bank financing
- **Revenue model**: Homes sold on land contracts (down payment + monthly payments); the site generates buyer leads
- **Success metric**: Website leads arriving in Zoho CRM tagged "Website Lead"
- **Strategy notes**: Full design spec at `docs/specs/2026-08-28-oak-homes-website-design.md` (approved 2026-08-28)

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Buyers can browse available homes with photos, terms (down/monthly), specs, and status badges
- [ ] Each home has its own shareable page (`/homes/<slug>`) with gallery, map, optional video, and Inquire button — with OpenGraph tags so Facebook/Instagram shares show photo + terms
- [ ] Assistant can add/edit/mark-sold properties and write blog posts through a login-protected admin panel at `/admin`
- [ ] Contact form feeds Zoho CRM (existing web-to-lead form, "Website Lead" tag); Inquire buttons pre-fill the property
- [ ] Site ports the mockup's branding, copy, and legally-careful owner-financing wording (Equal Housing footer on every page)
- [ ] Site auto-deploys on every publish (GitHub → Netlify) and goes live on ownwithoak.com (domain transfer + DNS + SPF)
- [ ] Base layout includes an integrations slot ready for Phase 2 chat agent / popups

### Out of Scope

- User accounts, saved favorites, payment processing — leads go to Zoho; transactions happen off-site
- Online credit applications — legal exposure; handled off-site
- Google Drive content pipeline — explicitly replaced by the admin panel
- AI chat agent + promotional popups — Phase 2 (site is designed to host them via the integrations slot; Zoho SalesIQ is the recommended path)
- Vanilla-JS SPA architecture — rejected: breaks social link previews, weaker SEO, no per-home URLs
- Hosted CMS (Sanity etc.) / WordPress — rejected: vendor lock-in, cost, maintenance burden vs. "light and owned"

## Context

- Company: Oak Homes (Alma Tree Holding umbrella). Phone (217) 269-0003, email hello@ownwithoak.com, Google Workspace email must keep working through all DNS changes.
- Prior state: 2.5MB single-file HTML mockup deployed by zip-drag to Netlify (`cool-semifreddo-760942`). Mockup defines the UX: yellow #F6C84C / ink #1A1A1A / warm cream, Lora + Inter, leaf logo, 7-page structure.
- Domain `ownwithoak.com`: now unlocked at registrar (was REI-locked); Oak-owned Cloudflare account ready with all DNS imported (nameservers harvey/raegan.ns.cloudflare.com). Netlify A record 75.2.60.5.
- Zoho web-to-lead form exists and was tested end-to-end (Leads module, "Website Lead" tag).
- Two homes to migrate: 614 E Marengo St, Flint MI ($3,000 down / $950/mo, 6 photos); Brown Street, Flint MI ($3,000 down / $1,250/mo, 5 photos — confirm 2734 vs 2437).
- No GitHub account exists yet; owner will create one (browser walkthrough) in the foundation phase. Owner is non-technical; Claude does all git work.
- Legal wording was deliberately refined: land contract (agreement for deed), consequences-of-nonpayment note, Equal Housing Opportunity footer; avoid "equitable interest", "honest terms", "purchase not a rental". Attorney review pending before heavy promotion.

## Constraints

- **Tech stack**: Astro static site + Sveltia CMS (Decap-compatible) + Netlify + GitHub — approved in spec; content as markdown/images in the repo, no database
- **Cost**: ~$0/month hosting (Netlify free tier, free CMS) — small business, no recurring vendor fees
- **Usability**: Assistant is non-technical — the admin panel is the only content interface; publish-to-live ≤ ~2 minutes
- **Compliance**: Owner-financing copy must keep the refined legal wording exactly; Equal Housing footer on every page
- **Continuity**: Google Workspace email must never break during domain/DNS transitions
- **Performance/SEO**: Pre-rendered static HTML, optimized images, OpenGraph tags — social sharing and local search are the marketing channels

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Astro static site over vanilla-JS SPA | Social previews, SEO, per-home URLs; SPA needs a build step anyway | — Pending |
| Sveltia CMS (git-based) over Google Drive pipeline | Form-based publishing for non-technical assistant; content owned in repo | — Pending |
| Netlify hosting (existing account) over Cloudflare Pages | Simplest CMS auth integration; already familiar | — Pending |
| Keep existing Zoho web-to-lead form | Already tested end-to-end; no new lead plumbing | — Pending |
| Standalone git repo at Claude_Gin/OakHomeWebsite | Site needs its own repo for Netlify builds + CMS commits + GitHub push; separate from personal writing repo | — Pending |
| Chat agent/popups deferred to Phase 2 via integrations slot | Zoho SalesIQ drops in with a script tag; no architecture change needed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-28 after initialization*
