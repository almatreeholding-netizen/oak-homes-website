# Project Research Summary

**Project:** Oak Homes Website (ownwithoak.com)
**Domain:** Owner-financing real estate marketing site — static site + git-based CMS for non-technical content management
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH (stack verified against official docs; features researched via industry patterns; architecture high-confidence on Astro/Netlify, medium on Sveltia specifics; pitfalls require phase-level spot-checks)

## Executive Summary

Oak Homes is a property marketing site built on Astro (static, zero-JS-by-default) + Sveltia CMS (git-based admin panel) + Netlify hosting, serving a small local market with 1–5 active owner-financed homes. The core value proposition is enabling a non-technical assistant to manage listings, photos, and blog posts without developer intervention or database infrastructure. The recommended stack (Astro 7.2, Sveltia CMS, Netlify OAuth, GitHub, Leaflet+OpenStreetMap, Zoho Web-to-Lead) is cost-effective ($0/month hosting), operationally simple (fully static delivery, no server-side code), and well-suited to the small inventory and editorial workflow described in the spec.

The architecture is a strict dependency chain: Git repo → Astro build → Netlify deploy → live static site. Every time the assistant publishes via the CMS, Sveltia commits markdown to GitHub, triggering a rebuild and atomic deploy to the CDN within ~60 seconds. This model scales efficiently for the expected load and keeps operational complexity low — a key win for a small team with no dedicated DevOps.

**Key risks are operational, not technical:** Zoho Web-to-Lead requires custom JavaScript for URL-parameter prefill (not a built-in feature), demanding explicit testing on both preview and production domains. DNS migration to Cloudflare risks breaking Google Workspace email if MX/SPF/DKIM records aren't manually verified and re-entered. CMS configuration must stay synchronized with the Astro content schema or publish errors will silently corrupt the site. Photo optimization requires discipline upfront (pre-resize images before upload) to avoid permanently bloating the git repository. **Mitigation for all of these is straightforward and documented in PITFALLS.md** — they require deliberate attention during their respective phases, not architectural rework.

## Key Findings

### Recommended Stack

The research strongly favors a minimal, "pay-as-you-go" technology set. **Astro 7.x** is the core framework — it ships zero JavaScript by default, rendering all content to static HTML at build time, which delivers the "fast, real social previews" requirement exactly and fits Netlify's free tier. **Sveltia CMS** (not Decap, which is in maintenance mode) is a lightweight, actively developed Decap-compatible admin panel served as static files at `/admin`, authenticating via **Netlify's built-in OAuth provider** (zero custom code, a few clicks in Netlify's settings to register a GitHub OAuth App). **GitHub** holds the single source of truth for all content and code in a private repo; every CMS "Publish" is a git commit. **Netlify** provides hosting, OAuth proxy, and the build pipeline (npm install → astro build → CDN deploy). **Leaflet.js + OpenStreetMap** supply the free, no-API-key mapping solution (Mapbox and Google Maps both require billing, violating the project's $0/month constraint). **Zoho Web-to-Lead** captures leads directly into CRM, pre-filled via custom JavaScript reading URL query parameters.

**Core technologies:**
- **Astro ^7.2** — Static site generator, zero-JS-by-default output matching fast-load + rich social-preview requirement
- **Sveltia CMS 0.11x+** — Git-based admin panel, Decap-compatible, actively maintained (Decap is deprecated)
- **Netlify** — Hosting, OAuth proxy (built-in, no custom function needed), and build pipeline; free tier covers this traffic
- **GitHub** — Private repo, single source of truth for content + code; every publish is a git commit
- **Leaflet.js + OpenStreetMap** — Free mapping (no API key, no billing account) for property location pins
- **Zoho Web-to-Lead** — Lead capture embedded form (requires custom JS prefill, unlike Zoho Forms)

**Image handling conflict resolved:** ARCHITECTURE.md recommended routing CMS uploads through `src/assets/` + Astro's `image()` optimization pipeline, but STACK.md correctly identified that Sveltia CMS's media_folder settings target Astro's `/public` directory and don't write into `src/`. **Recommendation: ship with the simpler `public/uploads/` + plain `<img>` approach first** (zero moving parts, zero build-breaking risk when the CMS uploads files). Upgrade to Netlify Image CDN on-the-fly transforms later *only* if page-weight becomes a measurable mobile LCP problem — this defers added complexity until justified by real data. For a 2-home launch with lightweight maintenance, the simple path is correct.

### Expected Features

**Table stakes:**
- Property listing grid with cover photo, address, status badge, financing terms visible upfront
- Per-property detail page with full gallery, specs, description, and map pin
- How It Works page with plain-language land-contract explanation
- FAQ countering scam fears ("Is this legit?", "Do I get the deed?", "What if I miss a payment?")
- Equal Housing Opportunity statement on every page
- Phone number visible on every page, especially mobile
- Mobile-first design with fast load times
- Accessible (WCAG 2.1 AA) forms and property filters
- Zoho contact form with property pre-fill via Inquire button
- Status badges (Available/Pending/Sold)
- Admin panel for self-service updates

**Differentiators:**
- Rich OpenGraph previews on property URLs (social share cards with cover photo + price)
- Blog/Learn content for SEO and buyer education
- Self-service admin panel for non-technical staff
- Embedded map pins per property
- Optional video embed support

**Explicitly defer (v2+):**
- Online credit/financial application (regulatory exposure)
- User accounts / saved favorites (too much infrastructure for small inventory)
- Payment collection on-site (legal/PCI complexity)
- AI chat agent / live chat (Phase 2 scope)
- Third-party MLS/IDX feeds (misrepresents business model)

### Architecture Approach

The architecture follows a strict dependency chain: GitHub repo → Sveltia CMS admin panel → GitHub REST API commits → Netlify webhook trigger → Astro build (validates markdown against Zod schemas) → static HTML output → Netlify CDN serve. No database, no server-side code, no custom CMS backend. This simplicity is the core strength: scales from 1 to 100+ properties with zero infrastructure changes, no auth/session/database secrets to manage, every publish is auditable via git history.

**Major components:**
1. **Sveltia CMS UI** (`/admin/index.html`) — form-based create/edit/publish; commits directly to GitHub via OAuth token
2. **Content Collections + Zod Validation** (`src/content/config.ts`) — typed schemas; Astro validates markdown at build time
3. **Astro Page Generation** (`src/pages/`, `[slug].astro` routes) — pre-renders static HTML per property/blog post
4. **Netlify Build Pipeline** — runs `astro build` on GitHub push, validates against schema, deploys to CDN
5. **Netlify CDN** — serves static files globally with TLS and custom domain; atomic deploy (~30–60s)
6. **GitHub OAuth + Netlify Proxy** — Sveltia login flow; no custom backend needed
7. **Zoho Web-to-Lead Embed** — client-side form POSTs directly to Zoho CRM
8. **Leaflet Map Component** — client-side rendering of property pins; free OSM tiles

**Build order is strict** (cannot skip ahead): (1) GitHub repo, (2) Astro scaffold with stable schema, (3) Netlify connected, (4) Sveltia CMS + config.yml, (5) integrations (Zoho, maps, OpenGraph), (6) domain/launch.

### Critical Pitfalls

1. **Zoho Web-to-Lead has no built-in URL-parameter prefill** — This is a Zoho *Forms* feature, not the CRM web-to-lead embed. Requires custom JavaScript to read query parameter and set hidden field value before submit. Test on both preview and production domains.

2. **DNS cutover breaks Google Workspace email if MX/SPF/DKIM aren't manually re-entered** — Nameserver migration moves the entire authoritative DNS zone. Easy to miss email records while focusing on A/CNAME. Verify and re-stage MX, SPF, DKIM before cutover; send/receive test email immediately after.

3. **CMS config.yml drifts from Astro content schema** — Two independent files describing the same shape. If schema changes without updating config.yml (or vice versa), admin form breaks or produces frontmatter that Astro rejects at build time. Always update both in the same commit; use strict Zod validation so drift is caught loudly.

4. **Uncompressed photos permanently bloat the git repository** — Full-resolution photos (3–8MB) committed to git history bloat repo size forever. Pre-resize photos to ~2000px wide before upload; document in assistant cheat-sheet. For migrated homes, pre-resize before committing to set precedent.

5. **Fair housing wording regression if footer isn't structurally required** — If Equal Housing footer is copy-pasted per page rather than in base layout, new page templates can ship without it. Define footer exactly once in shared BaseLayout.astro so it's structurally impossible to omit.

## Implications for Roadmap

Strict dependency chain dictates sequencing. Build order (GitHub → Astro → Netlify → CMS → Integrations → Launch) is not flexible.

### Phase 1: Foundation (GitHub + Astro Scaffold + Content Schema)
**Rationale:** Everything else depends on repo + finalized, validated content model.
**Delivers:** GitHub repo, Astro 7.x with page templates, content collections with Zod schemas, 2 migrated homes, Equal Housing footer in base layout
**Addresses:** Property grids, detail pages, How It Works, About, Blog
**Avoids:** Photo strategy decided upfront; schema finalized before CMS config
**Research flags:** Standard Astro patterns — skip research-phase

### Phase 2: Build & Integration
**Rationale:** Once schema is stable, integrate Zoho, maps, OpenGraph tags.
**Delivers:** Netlify connected with end-to-end build verified, Sveltia CMS configured, Zoho prefill script with custom JS, Leaflet maps, per-property OpenGraph tags, integrations slot
**Addresses:** Admin panel, property pages with maps, Inquire button, social shares
**Avoids:** Zoho tested on preview domain; config.yml/schema aligned
**Research flags:** Zoho prefill needs hands-on testing (account-specific field names); verify OAuth callback URL exactly

### Phase 3: Admin Panel Launch & Documentation
**Rationale:** Assistant needs working admin before day-to-day content management.
**Delivers:** Assistant trained on CMS workflow, one-page cheat-sheet (photo sizing, single-tab workflow, publish verification, git recovery), Fair Housing compliance verified, WCAG 2.1 AA baseline verified
**Addresses:** Admin panel operational, workflow validated
**Avoids:** Pre-resize discipline established; config.yml/schema sync as standing rule
**Research flags:** None — process/documentation

### Phase 4: Integration Testing (Zoho + Preview Domain)
**Rationale:** Lead capture is mission-critical; test on preview domain before production.
**Delivers:** Zoho form wired with custom prefill, test lead verified in CRM (not silently dropped), social-share preview verified with actual tool, Leaflet maps tested
**Addresses:** Lead capture, Inquire button, maps, social shares
**Avoids:** Zoho prefill explicitly tested; source-URL validated (flagged for re-verification in Phase 5)
**Research flags:** Zoho field naming account-specific; test social-preview tools with real URLs

### Phase 5: Launch (Domain Cutover, Email Verification, Production Testing)
**Rationale:** Last, highest-risk step. DNS cutover, email verification, Zoho re-testing on production must be orchestrated carefully.
**Delivers:** Cloudflare nameserver cutover, MX/SPF/DKIM verified live, test email sent/received on production domain, Zoho lead test re-run on production, old redirects checked, final compliance check, attorney review gate confirmed
**Addresses:** All features live under production domain
**Avoids:** DNS-email regression caught; Zoho source-URL confirmed on production; fair housing wording verified
**Research flags:** None — execution/verification

### Phase Ordering Rationale

1. **Phase 1 first:** GitHub must exist before anything targets it; schema must be stable before CMS config written
2. **Phase 2 follows:** Netlify can't wire without repo; Sveltia can't configure without finalized schema
3. **Phase 3 after CMS wired:** Can't train on something that doesn't work yet
4. **Phase 4 before Phase 5:** Need confidence Zoho works before moving domain
5. **Phase 5 last:** DNS is highest-risk; touches only after everything prior verified

### Research Flags

**Phases needing deeper research:**
- **Phase 2, Zoho integration:** Custom prefill script needs hands-on testing (field naming account-specific)
- **Phase 4, OpenGraph preview testing:** Use actual tools (Facebook Sharing Debugger), not just meta tags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Astro static generation — well-documented, stable patterns
- **Phase 3:** Admin training + cheat-sheet — process, not technical research
- **Phase 5:** DNS cutover — follow documented steps, spot-check during execution

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | MEDIUM-HIGH | Core tech verified against official docs. Sveltia CMS specifics (OAuth, callbacks) are MEDIUM — newer project, spot-check during Phase 2 |
| **Features** | MEDIUM | Regulatory items (Equal Housing, WCAG, ADA patterns) cross-checked against HUD/DOJ. Competitive patterns LOW individually, MEDIUM in aggregate (consistent across multiple sites) |
| **Architecture** | HIGH (Astro/Netlify) / MEDIUM (Sveltia) | Astro patterns HIGH, stable 2+ years. Sveltia OAuth MEDIUM — official docs but newer project |
| **Pitfalls** | MEDIUM | Most from official docs or established knowledge. Zoho/Sveltia account-specific behaviors should be spot-checked live during relevant phases |

**Overall confidence:** **MEDIUM-HIGH**

### Gaps to Address

1. **Zoho Web-to-Lead behavior is account-specific** — Prefill approach is established, but field naming/validation vary. **Handling:** Phase 2 spike testing against live form embed; confirm source-URL validation during Phase 4–5 testing on preview and production domains.

2. **Sveltia CMS edge cases in Decap compatibility** — **Handling:** Phase 2 spike validating config.yml against Sveltia's actual GitHub backend docs + independent example.

3. **Google Workspace email post-DNS is silent on failure** — MX issues manifest as silent loss. **Handling:** Phase 5 explicit checklist with side-by-side staging of MX/SPF/DKIM, lowered TTLs 24h ahead, send/receive test immediately post-cutover.

4. **Netlify free-tier hard cutoffs** — Exceeding limits takes site offline with no warning. **Handling:** Phase 5 launch notes Netlify usage dashboard as post-launch monitoring item.

5. **Photo compression is process, not infrastructure** — Relies on assistant actually resizing. **Handling:** Phase 1 pre-resizes migrated homes' photos as reference; Phase 3 cheat-sheet states 2000px guidance. Netlify Image CDN upgrade documented for future if needed.

## Sources

**Primary (HIGH confidence):**
- Astro official docs (https://docs.astro.build/) — Content collections, images, Netlify integration
- Netlify official docs (https://docs.netlify.com/) — Build pipeline, Git Gateway deprecation, OAuth, domains, free-tier limits
- Google Workspace official docs (https://knowledge.workspace.google.com/) — MX/SPF/DKIM setup
- Astro GitHub releases (https://github.com/withastro/astro/releases) — Version availability

**Secondary (MEDIUM confidence):**
- Sveltia CMS official docs (https://sveltiacms.app/en/docs/) — GitHub backend, OAuth, media folder behavior
- Netlify community forums — Git Gateway deprecation, OAuth patterns, limits behavior
- Zoho help portal (https://help.zoho.com/) — Web-to-lead features, Forms vs. CRM distinction
- Google Workspace community — MX behavior, DNS migration best practices

**Tertiary (LOW confidence, validate during execution):**
- Sveltia community forks and independent setup guides — Custom OAuth patterns, edge cases
- Zoho community threads — Web-to-lead custom script workarounds, source-URL validation variations
- Independent blog posts — Netlify free-tier limits, image optimization best practices
