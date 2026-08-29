# Technology Stack

**Project:** Oak Homes Website (ownwithoak.com)
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH (cross-verified against official docs for Astro, Netlify, Sveltia; single-source community evidence flagged where relevant)

Scope note: the framework/CMS/hosting direction is already approved (Astro + Sveltia CMS + Netlify + GitHub + Zoho web-to-lead). This document firms up **how** to build it: exact versions, the correct auth pattern given Netlify Identity/Git Gateway's deprecation, image-handling tradeoffs for a CMS-driven photo-heavy site, mapping, and the Zoho pre-fill mechanism.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Astro | ^7.2 (latest patch, e.g. 7.2.9) | Static site generator, page rendering | Current stable major line as of Aug 2026 (Astro 6 shipped Feb 2026, Astro 7.0 shipped June 2026 with Vite 8 + a Rust compiler). Zero-JS-by-default output matches the "fast, pre-rendered HTML, real social previews" requirement exactly. Use `npm create astro@latest` so the scaffold always pins the newest 7.x. |
| @sveltia/cms | latest (0.11x line moving to a 2026 v1.0) | Git-based admin panel at `/admin` | Actively developed, Decap-compatible successor to Netlify/Decap CMS. Sveltia's own docs now say Decap should not be used for new projects — Decap is effectively in maintenance mode. Sveltia ships a ~5x smaller bundle, faster GitHub API usage (GraphQL), a more modern editing UI, and better mobile support — all of which matter for a non-technical assistant's day-to-day use. |
| Netlify | N/A (hosting platform, existing account) | Build, deploy, hosting, OAuth provider | Already the approved host; free tier covers this traffic level. Its **built-in OAuth provider** (not a custom function) is the cleanest way to authenticate Sveltia CMS against GitHub — see Admin/CMS Auth below. |
| GitHub | N/A (new free account, one private repo) | Content + code source of truth | Repo holds markdown/JSON content, images, and site code; every Sveltia CMS "Publish" is a git commit. No database needed. |

### Admin/CMS Authentication (the part the design spec left fuzzy)

The design spec says "OAuth handled by a small Netlify function." **Correction based on current docs: no custom function is needed at all when Netlify is the host.**

| Approach | Verdict | Why |
|----------|---------|-----|
| **Netlify's built-in OAuth provider** | **Use this** | Register one GitHub OAuth App (Homepage URL = `https://ownwithoak.com`, Callback URL = `https://api.netlify.com/auth/done`), then paste its Client ID/Secret into **Netlify → Project configuration → Access & security → OAuth → Install provider → GitHub**. `admin/config.yml` just needs `backend: { name: github, repo: <owner>/<repo>, branch: main }` — **no `base_url` needed**. This is a few clicks, zero code, zero extra hosting surface. |
| Netlify Identity + Git Gateway | **Do not use** | Netlify's own docs mark Git Gateway as **deprecated**: existing sites keep working and get security patches, but "we will no longer fix bugs in the functionality of Git Gateway," and new Git Gateway configurations are explicitly not recommended. Netlify Identity is being wound down as Git Gateway's companion. Building a brand-new site on this pairing in 2026 means building on a foundation Netlify has already stopped improving. |
| External OAuth proxy (e.g. `sveltia-cms-auth` on Cloudflare Workers) | Reserve for later / off-Netlify scenarios | Needed only if the site ever moves off Netlify hosting (e.g. to Cloudflare Pages or GitHub Pages), since it requires `base_url` in `config.yml` pointing at the deployed Worker plus its own env vars (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_DOMAINS`). Unnecessary complexity here — skip it. |
| Personal Access Token sign-in | Fallback only | Sveltia supports "Sign In with Token" (paste a GitHub PAT) with no OAuth app at all. Fine for a single technical admin doing a quick edit, but a PAT is a long-lived, unscoped-feeling secret to hand to a non-technical assistant — the OAuth flow is the right default for this project's "friendly admin panel" requirement. |

**Confidence:** MEDIUM — Netlify's own docs confirm Git Gateway's deprecated status (HIGH within that specific claim); the "no base_url needed with Netlify's built-in provider" detail is corroborated by Sveltia's GitHub backend docs and multiple independent setup guides, but verify the exact menu path at build time since Netlify has renamed its settings UI more than once ("Site settings" → "Project configuration").

### Content Model & Image Handling (biggest real gotcha in this stack)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Astro Content Collections + Content Layer API | built into Astro 7.x | Typed schemas for Property and Blog Post content | Stable since Astro 5; validates frontmatter (`status` enum, numeric `downPayment`/`monthlyPayment`, etc.) at build time so a malformed CMS entry fails the build loudly instead of shipping a broken page. |
| `@astrojs/sitemap` | latest matching Astro 7 | `sitemap-index.xml` generation | One-command install (`npx astro add sitemap`); requires `site: 'https://ownwithoak.com'` set in `astro.config.mjs`. |
| `astro:assets` (`<Image>` / `<Picture>`) | built-in | Build-time image optimization | Astro's native image pipeline — but see the constraint below before wiring it to CMS uploads. |

**The constraint:** Astro's `image()` Zod schema helper and the `<Image>`/`<Picture>` optimization pipeline only work on images that live under `src/` and are resolvable as ESM imports at build time. **Sveltia CMS's media/public folder settings are documented as targeting Astro's `/public` directory** (`media_folder: /public/uploads`, `public_folder: /uploads`) — Sveltia does not write into `src/assets`. That means CMS-uploaded property photos land in `public/`, which Astro serves as-is, unoptimized (no resizing, no format conversion, no lazy `srcset` generation) if you use plain image paths.

**Recommendation for this project (in priority order):**
1. **Default / simplest — ship this first.** Store property photos in `public/uploads/<slug>/`, reference them as plain string paths in the `photos` frontmatter array (not through the `image()` helper), and render with a normal `<img loading="lazy" decoding="async">` (or Astro's `<Image>` in its "just embed a URL" mode, which skips build-time processing but still lets you set `width`/`height` to avoid layout shift). Add one line to the assistant's cheat-sheet: "keep photos under ~2MB, landscape orientation." This has zero moving parts and zero risk of breaking the CMS-to-build handoff — appropriate for a 2-listing-today, slow-growing catalog.
2. **Upgrade path if page-weight becomes a real problem** — add the `@astrojs/netlify` adapter and enable Netlify's **Image CDN**, which transforms *any* image under `public/` on-the-fly (resize + modern format negotiation) via a request-time endpoint, with no change to how the CMS uploads files. This is the correct fix for "photo-heavy listings load slow on mobile" if it ever becomes true, without asking the non-technical assistant to pre-resize anything. Note it does add a Netlify Functions layer to an otherwise fully static site — worth deferring until there's a real page-weight problem to justify it.
3. **Do not** try to force Sveltia's `media_folder` into `src/assets/...` to unlock the native `image()` schema helper — Sveltia's own docs describe this as unsupported/fragile for Astro today; chasing it burns build time for marginal gain versus option 1 or 2.

**Confidence:** MEDIUM-HIGH on the core constraint (directly sourced from Sveltia's own "Internal Media Storage" docs); MEDIUM on the Netlify Image CDN recommendation (confirmed it exists and works with `public/` assets on static Astro sites via the Netlify adapter, but verify the adapter's current output-mode requirements against the Astro version in use at implementation time).

### Mapping

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Leaflet.js | latest 1.9.x | Interactive map rendering | Fully free — no API key, no account, no usage cap — using OpenStreetMap raster tiles as the base layer. Matches the "$0/month" constraint exactly (Google Maps/Mapbox both require billing setup even on free tiers). |
| `astro-leaflet` (or a thin custom Leaflet wrapper component) | latest | Astro component wrapping Leaflet for both the public property-page map and the admin location-picker widget | A dedicated Astro component avoids re-deriving Leaflet's SSR/hydration quirks (Leaflet touches `window`/DOM directly, so it must be a client-hydrated island — `client:load` or `client:visible`). |
| OpenStreetMap tile servers (`{s}.tile.openstreetmap.org`) | N/A | Map tile source | Free for low-traffic use under OSM's tile usage policy; attribution string is required in the map footer (small "© OpenStreetMap contributors" — standard Leaflet default attribution control satisfies this). |

**CMS-friendly location storage:** store `location` as a simple `{ lat: number, lng: number }` pair in the Property frontmatter (matches the design spec's "assistant picks the spot on a small map widget"). Sveltia/Decap don't ship a native "map picker" widget out of the box, so this needs a small **custom CMS widget** (a Preact/vanilla-JS component registered via `CMS.registerWidget`) that renders a Leaflet map with a draggable pin inside the admin form and writes back `lat`/`lng` numbers — this is a known, well-trodden pattern for Decap-family CMSs, not a novel build.

**Known gotcha:** Leaflet's default marker icon images (`marker-icon.png`, `marker-shadow.png`, etc.) get tree-shaken by Vite's bundler unless copied into `public/` or imported explicitly — a broken/invisible marker pin is the most common Leaflet-in-a-modern-bundler symptom; budget for this one fix during the Integrations phase.

**Confidence:** MEDIUM — the free/no-API-key claim and the Vite/marker-icon gotcha are both well-documented and cross-verified across independent sources; the custom-widget approach for lat/lng picking is a standard pattern but should get a quick spike during planning rather than being treated as a solved problem.

### Lead Form (Zoho Web-to-Lead)

| Component | Purpose | Notes |
|-----------|---------|-------|
| Zoho CRM **Web-to-Lead** form (existing, already tested) | Contact page lead capture | This is Zoho CRM's own generated HTML form (Leads → Web Forms), **not** the separate "Zoho Forms" product. Important distinction: Zoho Forms has a native "Static Prefill URL" feature; **Web-to-Lead does not**. |
| Small inline `<script>` on the Contact page | Pre-fill the property field from a URL parameter | Web-to-Lead ships hidden `<input type="hidden" name="..." value="...">` fields with static default values baked into the generated embed code. To make "Inquire" buttons pass the specific property through, add a short script that reads `new URLSearchParams(location.search)` on page load and sets that hidden input's `.value` before the visitor submits (or before the field renders, if using the iframe/JS embed). This is a standard, well-documented pattern for Zoho Web-to-Lead — not a Zoho-native capability, but not exotic either. |
| Inquire button links | `Astro` `<a href="/contact?property=614-e-marengo-st">` | Simple query-string handoff from each property page's Inquire button to the Contact page; the script above reads it. |

**Confidence:** MEDIUM — confirmed via Zoho's own Web-to-Lead FAQ that hidden fields only carry *static* default values and there is no documented native URL-param prefill for this specific form type (as opposed to Zoho Forms, which does have one) — this distinction is easy to miss and worth flagging explicitly to whoever wires up the embed.

## Installation

```bash
# Scaffold
npm create astro@latest -- --template minimal

# Core integrations
npx astro add sitemap
npm install leaflet
npm install astro-leaflet   # or hand-roll a thin Leaflet wrapper component

# CMS (no npm install needed for the admin panel itself —
# Sveltia CMS is loaded client-side from /admin via a CDN script tag
# referenced in admin/index.html, per its Getting Started docs)

# Dev dependencies
npm install -D @astrojs/check typescript
```

No `@astrojs/netlify` adapter is needed for the MVP (pure static output, `output: 'static'` — the default). Only add it later if the Netlify Image CDN upgrade path (above) is adopted.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|--------------|-------------|--------------------------|
| Sveltia CMS | Decap CMS | Only if a specific Decap-only plugin/widget is required that Sveltia hasn't reimplemented yet — check Sveltia's compatibility notes first, since Sveltia explicitly targets Decap config.yml compatibility. For a greenfield build in 2026, Sveltia is the better default. |
| Netlify's built-in OAuth provider | `sveltia-cms-auth` on Cloudflare Workers | Only if the site later moves hosting off Netlify (e.g., to Cloudflare Pages) while keeping the GitHub backend — then a self-hosted OAuth proxy becomes necessary since Netlify's built-in provider is Netlify-hosting-specific. |
| CMS uploads to `public/uploads/`, unoptimized | Netlify Image CDN (`@astrojs/netlify` adapter) | Once photo count/resolution grows enough that mobile page-weight becomes a measurable problem (e.g., Lighthouse flags LCP/image-weight); adds a Functions layer, so don't reach for it prematurely. |
| Leaflet + OpenStreetMap | Mapbox GL JS / Google Maps Embed | Only if a business need emerges for richer map styling, geocoding-as-a-service, or traffic data — all of which come with either an API key + billing account or usage caps, conflicting with the $0/month constraint. |
| Zoho Web-to-Lead + small prefill script | Zoho Forms | If the team is willing to rebuild the already-tested, already-working lead form from scratch to get native Prefill URL support — not worth it given "already tested end-to-end" is an explicit decision rationale in PROJECT.md. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Netlify Identity + Git Gateway for CMS login | Officially deprecated by Netlify; functionality bugs will no longer be fixed; building new on it in 2026 means inheriting a feature Netlify has stopped investing in. | Netlify's built-in OAuth provider (GitHub OAuth App registered directly in Netlify's Access & Security settings) — zero custom code. |
| Decap CMS for a brand-new 2026 build | Sveltia's own docs recommend against using Decap for new projects; Decap is effectively in maintenance mode relative to Sveltia's active development. | Sveltia CMS (Decap-config-compatible, so migration risk is low if ever needed). |
| Forcing CMS uploads into `src/assets` to use Astro's `image()` schema helper | Sveltia CMS's media/public folder settings target Astro's `/public` directory, not `src/`; fighting this is fragile and undocumented as a supported path. | Store photos in `public/uploads/`, use plain `<img>`/`<Image>` with explicit `width`/`height`; upgrade to Netlify Image CDN later if optimization becomes necessary. |
| Google Maps / Mapbox for the property location map | Both require an API key and a billing-enabled account even on "free tier," conflicting with the project's explicit $0/month hosting constraint and adding an external vendor dependency the project is otherwise avoiding (see PROJECT.md's rejection of hosted CMS for the same reason). | Leaflet + OpenStreetMap tiles — genuinely free, no account, no key. |
| Assuming Zoho Web-to-Lead has native URL-param prefill | It doesn't (that's a Zoho Forms feature, a different product); assuming it does will silently ship a non-functional "Inquire" pre-fill. | Small inline script reading `URLSearchParams` to set the hidden field's value before submit. |

## Stack Patterns by Variant

**If the photo catalog stays small (roughly the current 2 homes, low double digits of photos):**
- Use the plain `public/uploads/` + unoptimized `<img>` path.
- Because the added complexity of the Netlify Image CDN / `@astrojs/netlify` adapter isn't justified by the page weight involved.

**If Oak Homes scales to dozens of active listings with many photos each:**
- Add the `@astrojs/netlify` adapter and Netlify Image CDN for on-the-fly resizing/format negotiation.
- Because unoptimized full-resolution phone photos across many listings will start hurting mobile LCP and Lighthouse SEO scores, which the design spec calls out as a marketing channel.

**If the site ever migrates hosting away from Netlify (e.g., to Cloudflare Pages):**
- Switch CMS auth from Netlify's built-in OAuth provider to a self-hosted OAuth proxy (`sveltia-cms-auth` on Cloudflare Workers) and add `base_url` to `admin/config.yml`.
- Because Netlify's built-in OAuth provider only functions for Netlify-hosted sites.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| Astro 7.x | Node.js 18.20.8+ / 20.3.0+ / 22.0.0+ (check Astro 7's exact floor at scaffold time) | Astro has periodically raised its minimum Node version at major releases; confirm against `npm create astro@latest`'s own engine check rather than assuming. |
| Sveltia CMS (`admin/config.yml`) | Decap CMS config schema | Sveltia targets Decap config-file compatibility, so widget/collection syntax from Decap docs largely transfers — except the `media_folder`/`public_folder` per-field override nuance noted above, which is reported as not fully honored by Sveltia the same way it is by Decap. |
| `@astrojs/netlify` adapter | Astro's `output: 'static'` vs `'server'`/`'hybrid'` modes | Only needed if adopting the Netlify Image CDN upgrade path; verify the adapter's current minimum output-mode requirement against whatever Astro 7.x minor is in use, since Netlify's adapter has changed its static/SSR handling across versions. |

## Sources

- https://astro.build/blog/ — Astro 6/7 release timeline (Feb 2026, June 2026), confirmed via WebFetch of the blog index — MEDIUM confidence (single-source but official)
- https://github.com/withastro/astro/releases — exact latest patch version (7.2.9, Aug 27 2026) — HIGH confidence (primary GitHub releases page)
- https://www.npmjs.com/package/astro — corroborates 7.2.x as current published line — MEDIUM confidence
- https://sveltiacms.app/en/docs/backends/github — GitHub backend auth options (PAT, custom OAuth client, Netlify as OAuth provider), `base_url` usage — MEDIUM confidence (official Sveltia docs, fetched via WebFetch summary)
- https://sveltiacms.app/en/docs/media/internal — media_folder/public_folder constraints, `/public` requirement for Astro — MEDIUM-HIGH confidence (official docs)
- https://docs.netlify.com/manage/security/secure-access-to-sites/git-gateway/ — Git Gateway deprecation status, direct quote — HIGH confidence (primary Netlify docs)
- https://docs.netlify.com/manage/security/secure-access-to-sites/oauth-provider-tokens/ and related search results — Netlify's built-in OAuth provider setup path (Access & Security > OAuth > Install Provider) — MEDIUM confidence (cross-verified across multiple independent guides plus Sveltia's own docs)
- https://github.com/sveltia/sveltia-cms-auth — external OAuth proxy setup (Cloudflare Workers, env vars, callback URL) — MEDIUM confidence (official repo README, fetched via WebFetch)
- https://docs.astro.build/en/guides/images/ and https://docs.astro.build/en/guides/integrations-guide/sitemap/ — `image()` schema helper pattern, sitemap integration config — MEDIUM confidence (official docs, fetched via WebFetch summary)
- GitHub search results (bryanhogan.com Sveltia/Astro blog setup, sveltia/sveltia-cms issue #497, withastro/docs Decap CMS guide) — media_folder/src-vs-public gotcha corroboration — MEDIUM confidence (community sources cross-checked against official Sveltia docs)
- https://help.zoho.com/portal/en/kb/crm/faqs/channels/articles/faqs-webforms — Web-to-Lead hidden field / default value behavior, absence of native URL-param prefill — MEDIUM confidence (official Zoho help doc, fetched via WebFetch summary)
- https://www.zoho.com/forms/prefill-forms.html and related Zoho community threads — confirms Prefill URL is a Zoho Forms feature, distinct from Web-to-Lead — MEDIUM confidence
- Leaflet + OpenStreetMap free/no-API-key claim, `astro-leaflet` package, Vite marker-icon tree-shaking gotcha — cross-verified across multiple independent web sources (rodneylab.com, GitHub astro-leaflet repo, publicapis.io) — MEDIUM confidence
- Netlify Image CDN + `@astrojs/netlify` adapter on-the-fly transform of `public/` images — MEDIUM confidence (Netlify's own blog/docs plus jim-nielsen.com corroboration); recommend a short implementation-time spike before committing if this upgrade path is pursued

---
*Stack research for: Real-estate marketing site — owner-financing/land-contract home sales, static site + git-based CMS*
*Researched: 2026-08-28*
