# Architecture Research

**Domain:** Content-driven static site with git-based CMS (Astro + Sveltia CMS + Netlify + GitHub)
**Researched:** 2026-08-28
**Confidence:** HIGH (Astro content collections, Netlify build pipeline — official docs, stable for 2+ years) / MEDIUM (Sveltia CMS OAuth specifics — newer project, fewer authoritative sources, cross-checked across 2+ independent sources)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  EDITOR LAYER (assistant's only touchpoint)                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Sveltia CMS UI  (ownwithoak.com/admin — static JS app)         │  │
│  │  reads/writes via config.yml → GitHub REST API                  │  │
│  └───────────────────────────┬────────────────────────────────────┘  │
│                               │ OAuth popup (login only)              │
│                               ▼                                       │
│                    ┌─────────────────────┐                           │
│                    │ Netlify OAuth proxy  │  (built-in, no code)      │
│                    │ or sveltia-cms-auth  │  (fallback: 1-file worker)│
│                    └─────────────────────┘                           │
├──────────────────────────────┬─────────────────────────────────────────┤
│  SOURCE OF TRUTH               │  GitHub repo (single source of truth) │
│  ┌────────────────────────────▼───────────────────────────────────┐  │
│  │  /src/content/properties/*.md   /src/content/blog/*.md          │  │
│  │  /public/images/... or /src/assets/...                          │  │
│  │  /src/content/config.ts  (zod schema)                            │  │
│  │  /public/admin/config.yml (CMS field definitions — must mirror)  │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │ webhook on push                       │
├───────────────────────────────┼─────────────────────────────────────┤
│  BUILD LAYER                  ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Netlify build: npm install → astro build                       │  │
│  │  - astro:content loads + validates markdown against zod schema  │  │
│  │  - astro:assets (sharp) resizes/optimizes referenced images     │  │
│  │  - pages pre-rendered to static HTML per route                  │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
├───────────────────────────────┼─────────────────────────────────────┤
│  DELIVERY LAYER                ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Netlify CDN — static HTML/CSS/JS/images, global edge cache      │  │
│  └────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────┤
│  RUNTIME INTEGRATIONS (client-side, in the browser, no server)       │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────────────────────┐ │
│  │ Zoho form  │  │ Leaflet   │  │ Integrations slot (base layout)  │ │
│  │ (iframe/   │  │ map       │  │ — Phase 2: Zoho SalesIQ script,  │ │
│  │  embed)    │  │ (OSM tiles)│  │  analytics, popups                │ │
│  └───────────┘  └───────────┘  └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|-----------------|-------------------------|
| Sveltia CMS UI | Form-based create/edit/publish UI for non-technical assistant; commits directly to GitHub via its REST API (no server-side CMS backend) | Static bundle loaded at `/admin/index.html`, driven entirely by `/admin/config.yml` |
| OAuth bridge | Exchanges GitHub OAuth code for an access token so the CMS can write to the repo as the Oak Homes GitHub user | Either Netlify's built-in external-OAuth-client proxy (zero code, a site setting) or `sveltia-cms-auth`, a small one-file Cloudflare Worker, if not using Netlify's proxy |
| GitHub repo | Single source of truth for all content (markdown, images, static page copy) and for the Astro codebase itself | Private repo owned by the Oak Homes GitHub account; `main` branch is the published branch |
| Astro content collections | Validates every markdown file against a typed schema at build time; fails the build if the CMS ever writes malformed content | `src/content/config.ts` using `defineCollection` + Zod, one collection per content type |
| Astro build (Netlify) | Turns markdown + images into pre-rendered static HTML, one file per route; resizes/optimizes images | Netlify's Astro build plugin runs `astro build`; triggered by GitHub push webhook |
| Netlify CDN | Serves the built static output globally; handles the custom domain, TLS, and redirects | Standard Netlify site, connected to the GitHub repo (not zip-drag) |
| Zoho web-to-lead embed | Captures contact form submissions directly into Zoho CRM, no server round-trip through this site | `<iframe>` or embed script from Zoho, with pre-fill via URL query params |
| Leaflet map | Renders the pinned lat/long for a property using free OSM tiles | Client-side JS component (Leaflet or `@astro/leaflet`-style wrapper), given `lat`/`long` as props from frontmatter |
| Integrations slot | Single, explicit insertion point in the base layout for future scripts (Zoho SalesIQ, analytics, popups) without touching page templates | An Astro slot or `<Fragment>` in `BaseLayout.astro`, e.g. `<slot name="integrations" />`, empty in this milestone |

## Recommended Project Structure

```
oak-home-website/
├── astro.config.mjs           # site config, integrations (sitemap, image service)
├── package.json
├── public/
│   ├── admin/
│   │   ├── index.html          # Sveltia CMS loader (script tag to CDN build or vendored copy)
│   │   └── config.yml           # CMS collections/fields — MUST mirror src/content/config.ts
│   ├── favicon, robots.txt, etc.
├── src/
│   ├── content/
│   │   ├── config.ts            # zod schemas: properties, blog, settings
│   │   ├── properties/          # one .md per home (assistant-authored via CMS)
│   │   │   └── 614-e-marengo-st.md
│   │   ├── blog/                # one .md per post (assistant-authored via CMS)
│   │   └── settings/
│   │       └── site.json        # phone, email, social links, homepage intro (CMS-editable singleton)
│   ├── pages/
│   │   ├── index.astro          # Home
│   │   ├── homes/
│   │   │   ├── index.astro      # Browse Homes (grid of PropertyCard)
│   │   │   └── [slug].astro     # Property page (dynamic route from content collection)
│   │   ├── how-it-works.astro   # static copy, edited via Claude not CMS
│   │   ├── about.astro
│   │   ├── learn/
│   │   │   ├── index.astro      # Blog index
│   │   │   └── [slug].astro     # Blog post page
│   │   ├── schedule.astro
│   │   └── contact.astro
│   ├── layouts/
│   │   └── BaseLayout.astro     # header/nav/footer + <slot name="integrations" />
│   ├── components/
│   │   ├── PropertyCard.astro   # used on Home + Browse Homes
│   │   ├── StatusBadge.astro    # Available/Pending/Sold pill
│   │   ├── Gallery.astro        # ordered photo carousel/grid, cover-first
│   │   ├── MapPin.astro         # Leaflet wrapper, client:load
│   │   ├── InquireButton.astro  # links to /contact?property=<slug>
│   │   └── ZohoForm.astro       # embeds the web-to-lead form, reads ?property= param
│   └── assets/                  # (optional) images imported via `image()` schema for optimization
└── netlify.toml                 # build command, publish dir, redirects
```

### Structure Rationale

- **`public/admin/`:** Sveltia CMS must be served as static files reachable at `/admin` — Astro's `public/` folder is copied verbatim to the build output, which is exactly what an unbundled admin app needs.
- **`src/content/{properties,blog,settings}/`:** One collection per content type mirrors how the CMS organizes "collections" — this 1:1 mapping is what keeps `config.ts` and `config.yml` easy to reason about (see next section).
- **`src/content/settings/site.json`:** Modeled as a content collection with exactly one entry (a common Astro pattern for "singleton" editable settings) rather than a special case — keeps the CMS config uniform (a "file" collection type in Decap/Sveltia terms, vs. "folder" collections for properties/blog).
- **`src/pages/homes/[slug].astro`:** Dynamic route driven by `getStaticPaths()` over the properties collection — one static HTML page per home, which is what makes OpenGraph/social previews and per-home SEO work (the reason Astro was chosen over an SPA).
- **`src/components/`:** Each name in the milestone's requirements (property card, gallery, map, status badge) gets its own component — keeps `PropertyPage.astro` a thin composition layer, and lets the map/gallery be reused identically on the property page.
- **Static page copy (How It Works, About, legal footer) lives directly in `.astro` files, not in a content collection** — per the design spec, this content changes rarely, carries legal weight, and is deliberately excluded from the assistant's CMS panel.

## Architectural Patterns

### Pattern 1: Git as the CMS backend (no database, no server)

**What:** All editable content is markdown/JSON in the repo; "publishing" is a git commit; the CMS is a browser app that talks to the GitHub API directly, not to a custom backend.
**When to use:** Low-to-medium content volume, small non-technical team, cost-sensitive, no need for real-time collaborative editing or role-based workflows beyond "everyone with a GitHub login can publish."
**Trade-offs:** No draft/review workflow beyond git branches (Sveltia does support an "editorial workflow" via PRs if wanted later); every publish is a full site rebuild (fine at this scale — build time stays under a minute for a few dozen pages); content history is git history, which is a feature (free audit trail, easy rollback) not a limitation.

### Pattern 2: Content collections as the schema contract

**What:** `src/content/config.ts` defines a Zod schema per collection; Astro validates every markdown file against it at build time and fails loudly on mismatch (missing required field, wrong type).
**When to use:** Any Astro site with more than a couple of hand-authored pages, and essential once a CMS is writing the files instead of a developer.
**Trade-offs:** Adds a small amount of upfront schema-design work, but is what turns "assistant filled out a form wrong" into a clear build failure instead of a broken page in production.

**Example:**
```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const properties = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    address: z.string(),
    status: z.enum(['Available', 'Pending', 'Sold']),
    downPayment: z.number(),
    monthlyPayment: z.number(),
    beds: z.number().optional(),
    baths: z.number().optional(),
    sqft: z.number().optional(),
    photos: z.array(z.string()).min(1),   // paths under public/, or z.array(image()) if using src/assets
    videoUrl: z.string().url().optional(),
    location: z.object({ lat: z.number(), long: z.number() }).optional(),
    publishDate: z.coerce.date(),
  }),
});

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    coverImage: z.string().optional(),
  }),
});

export const collections = { properties, blog };
```

### Pattern 3: CMS config mirrors the content schema — by convention, not by tooling

**What:** `public/admin/config.yml` defines Sveltia's collections/fields (widget types, required flags, default values). There is no build-time link between this file and `src/content/config.ts` — they are two independent files describing the same shape, kept in sync by discipline.
**When to use:** Always, for any git-based CMS on top of a typed static site generator (this is inherent to Decap/Sveltia; no tooling auto-generates one from the other as of this research).
**Trade-offs:** The sync burden is real but small and infrequent (only changes when the content model changes). Mitigate it by treating `config.ts` as the source of truth and updating `config.yml` immediately after any schema change, in the same commit; name fields identically in both files (e.g., `downPayment` in both, not `down_payment` in one) so mapping is visually obvious; add `required: true` in `config.yml` for every non-optional Zod field so the CMS form itself prevents most invalid submissions before they ever reach Astro's build-time validation.

**Example (excerpt):**
```yaml
# public/admin/config.yml
collections:
  - name: properties
    label: Properties
    folder: src/content/properties
    create: true
    slug: '{{fields.address | slugify}}'
    fields:
      - { name: title, label: Title, widget: string }
      - { name: address, label: Address, widget: string }
      - { name: status, label: Status, widget: select, options: [Available, Pending, Sold], default: Available }
      - { name: downPayment, label: Down Payment, widget: number }
      - { name: monthlyPayment, label: Monthly Payment, widget: number }
      - { name: beds, label: Beds, widget: number, required: false }
      - { name: baths, label: Baths, widget: number, required: false }
      - { name: sqft, label: Sqft, widget: number, required: false }
      - { name: photos, label: Photos, widget: list, field: { name: photo, widget: image } }
      - { name: videoUrl, label: Video URL, widget: string, required: false }
      - { name: location, label: Location, widget: map, output_type: 'reverseGeocode' }  # or a custom lat/long pair
      - { name: publishDate, label: Publish Date, widget: datetime }
      - { name: body, label: Description, widget: markdown }
```

## Data Flow

### Publish Flow (the core loop this whole system exists to support)

```
Assistant logs in at ownwithoak.com/admin
    ↓ (GitHub OAuth popup — one-time per session)
Assistant fills form, drags photos, clicks Publish
    ↓
Sveltia CMS commits markdown + image files to GitHub repo (main branch)
    ↓ (GitHub → Netlify build webhook, near-instant)
Netlify starts build: npm install → astro build
    ↓
astro:content parses & validates the new/changed markdown against config.ts schema
astro:assets (sharp) resizes/optimizes any new images referenced via image()
    ↓
Astro emits static HTML for every route, including the new/changed property or post page
    ↓
Netlify publishes the new build to its CDN (atomic deploy, ~30–60s typical for a small site)
    ↓
Live at ownwithoak.com — assistant refreshes the public page to confirm
```

### Lead Flow (independent of the build pipeline — pure client-side)

```
Visitor clicks "Inquire" on a property page
    ↓
Browser navigates to /contact?property=<address> (or similar query param)
    ↓
ZohoForm.astro reads the query param client-side, pre-fills the hidden/visible field
    ↓
Visitor submits the embedded Zoho web-to-lead form
    ↓
Form POSTs directly to Zoho (no round-trip through Netlify or this site's code)
    ↓
Lead appears in Zoho CRM, tagged "Website Lead"
```

### Where image optimization happens

Build time, on Netlify's servers, as part of `astro build` — not at request time and not via an external image CDN. If images are referenced through the `image()` Zod helper (imported from `src/assets/` or resolved relative paths) and rendered with Astro's `<Image />` component, Astro's built-in `astro:assets` pipeline (backed by `sharp`) resizes and re-encodes them once per build, and the static files ship as part of the deploy. This is deliberately simpler than wiring up Netlify's Image CDN (which needs the `@astrojs/netlify` adapter and is built for on-demand/SSR image requests) — a pure static site with a couple dozen properties doesn't need on-demand transforms, and avoiding the adapter keeps the site 100% static output with the simplest possible Netlify config. Photos uploaded through the CMS's `image` widget land as plain files (typically under `public/images/` or `src/assets/`); the schema decision of "plain string path" vs. "`image()`-validated import" determines whether Astro's optimizer touches them at all — for this project, routing property/blog photos through `src/assets/` + `image()` is the recommended default so every assistant-uploaded photo gets automatically resized/compressed without any manual step.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| 2–50 properties (this project, launch state) | Current architecture as designed — no changes needed. Build times stay well under Netlify's free-tier build minutes. |
| 50–500 properties / high blog cadence | Consider Astro's incremental/content-layer caching (already default in recent Astro versions) to keep build times reasonable; watch Netlify free-tier build-minute budget; no structural change needed. |
| Multi-editor with review workflow | Enable Sveltia's editorial workflow (drafts open a PR instead of committing straight to `main`) rather than re-architecting; this is a config change (`publish_mode: editorial_workflow` in `config.yml`), not a new component. |

### Scaling Priorities

1. **First bottleneck (unlikely at this project's scale, but the honest answer):** Netlify's free-tier build minutes, if the assistant publishes very frequently and each build re-optimizes many images. Mitigation: Astro's build caching already avoids re-processing unchanged images between builds.
2. **Second bottleneck:** None realistically expected at Oak Homes' scale (a handful of homes, occasional blog posts). This architecture is intentionally over-provisioned for headroom, not a constraint to plan around.

## Anti-Patterns

### Anti-Pattern 1: Treating `config.yml` and `config.ts` as independently maintained

**What people do:** Update the Astro content schema when a new field is needed, ship it, and forget to add the matching field to the CMS config — or vice versa, add a CMS field with no corresponding schema field.
**Why it's wrong:** Either the assistant can't edit a field that exists in the data model (schema has it, CMS doesn't expose it), or the CMS writes a field Astro's build silently ignores or — worse — the build fails because the new CMS field violates a strict Zod schema (e.g., `.strict()` mode) that doesn't know about it.
**Do this instead:** Change both files in the same commit, every time. Keep field names identical across both. If using a passthrough/loose schema during early iteration, tighten to `.strict()` only once the content model has stabilized.

### Anti-Pattern 2: Reaching for git-gateway with Sveltia CMS

**What people do:** Follow older Decap/Netlify CMS tutorials that configure `backend: { name: git-gateway }`, assuming Sveltia (a Decap-compatible fork) supports the same backend.
**Why it's wrong:** Sveltia CMS does not implement the git-gateway backend; `name: git-gateway` in `config.yml` will not authenticate. This is a documented divergence from Decap CMS, not a bug.
**Do this instead:** Use `backend: { name: github, repo: <owner>/<repo>, branch: main }` and let Sveltia use Netlify as the OAuth client (the default, zero-code path when the site is hosted on Netlify), or deploy the lightweight `sveltia-cms-auth` Cloudflare Worker and point `base_url` at it if not using Netlify's proxy.

### Anti-Pattern 3: Putting legally-sensitive copy through the assistant's CMS panel

**What people do:** Make every piece of site text CMS-editable "for consistency," including compliance-critical language (Equal Housing footer, land-contract disclosures).
**Why it's wrong:** A non-technical assistant could inadvertently alter carefully-reviewed legal wording through a simple text field, with no build-time check that the specific required phrasing survived.
**Do this instead:** Keep static/legal page copy in `.astro` files edited only by/with Claude (as the design spec already specifies), and reserve the CMS for structured, low-risk data: property specs, status, photos, and blog posts.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| GitHub | Repo hosts code + content; Sveltia CMS commits via GitHub REST API using an OAuth-issued token | Must exist and be owned by the Oak Homes account before CMS or Netlify wiring — see build order below |
| Netlify | Hosts the built site; also acts as the (code-free) OAuth proxy between Sveltia CMS and GitHub; auto-builds on every push | Connect the *GitHub repo* to Netlify (not zip-drag) as the deploy source; enable "external OAuth clients" in Site Configuration → Access Control for the CMS login to work |
| Zoho CRM (web-to-lead) | Client-side form embed; POSTs directly from the browser to Zoho, no server code on this site | Pre-fill via URL query param read client-side; already tested end-to-end per PROJECT.md |
| Leaflet / OSM tiles | Client-side map component, no API key needed for basic OSM tiles | Lat/long comes from the property's frontmatter, set via the CMS's map/coordinate widget |
| Cloudflare (DNS only) | Not part of the app architecture — DNS/domain layer sitting in front of Netlify | Must not touch existing MX/SPF records for Google Workspace during the domain cutover (Launch phase) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| Sveltia CMS ↔ GitHub repo | GitHub REST API (HTTPS), authenticated via OAuth token | No Astro code is involved in this exchange at all — the CMS never talks to the built site |
| GitHub repo ↔ Netlify build | Git push webhook triggers `astro build` | One-directional; Netlify never writes back to GitHub |
| Content collections ↔ Page templates | `getCollection()` / `getEntry()` calls at build time, typed by the Zod schema | Build-time only — no client-side fetch of content, which is what keeps the site fully static |
| BaseLayout ↔ integrations slot | Astro named `<slot>` | Deliberately inert in this milestone; Phase 2 fills it with a Zoho SalesIQ `<script>` tag with zero changes to page templates |

## Suggested Build Order

The dependency chain is strict enough that skipping ahead causes rework:

1. **GitHub account + repo first.** Everything else (Astro scaffold commits, Netlify's deploy source, Sveltia's OAuth backend target, the CMS's write target) depends on a repo existing and being owned by Oak Homes. This is also the one step requiring a human (owner) in the loop for account creation — do it first so it isn't a blocker later.
2. **Astro scaffold + content collections + pages, committed to the repo.** Build the site structure, schema, layout, and components against local/sample content before wiring any CMS — this lets page/component work be verified with `astro dev` without any external dependency.
3. **Netlify site connected to the GitHub repo (not zip-drag).** Confirms the build pipeline works end-to-end (push → build → live) before adding CMS complexity on top. This also produces the Netlify site needed for step 4's OAuth proxy.
4. **Sveltia CMS (`/admin`, `config.yml`) + OAuth.** Depends on both the repo (step 1) and a working Netlify site (step 3) for the OAuth proxy. Build the CMS config to mirror the already-finalized content schema from step 2 — doing this after the schema is stable avoids the config.yml/config.ts sync churn described above.
5. **Integrations (Zoho form + pre-fill, map, OpenGraph tags).** Layered on top of working pages/components; independent of the CMS, so can proceed in parallel with step 4 if resourcing allows.
6. **Domain/launch (Cloudflare DNS cutover, SPF verification, end-to-end lead test).** Last, and only after the Netlify site (step 3) is stable — DNS changes are the highest-blast-radius step (risk to Google Workspace email) and should touch a proven, working site, not a work-in-progress one.

## Sources

- [Sveltia CMS — GitHub Backend docs](https://sveltiacms.app/en/docs/backends/github) — MEDIUM confidence (official project docs, newer/smaller project than Decap)
- [sveltia/sveltia-cms-auth (GitHub repo)](https://github.com/sveltia/sveltia-cms-auth) — MEDIUM confidence, cross-checked against multiple community forks describing the same base_url pattern
- [Astro Docs — Content Collections Guide](https://docs.astro.build/en/guides/content-collections/) — HIGH confidence (official docs)
- [Astro Docs — Images Guide](https://docs.astro.build/en/guides/images/) — HIGH confidence (official docs)
- [Astro Docs — astrojs/netlify integration](https://docs.astro.build/en/guides/integrations-guide/netlify/) — HIGH confidence (official docs)
- Project design spec: `docs/specs/2026-08-28-oak-homes-website-design.md` — authoritative for this project's decided architecture
- Domain knowledge (Astro static-site conventions, Decap-family CMS patterns) — HIGH confidence, stable/well-established patterns as of research date

---
*Architecture research for: Astro + git-based CMS static real-estate site*
*Researched: 2026-08-28*
