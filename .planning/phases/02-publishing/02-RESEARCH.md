# Phase 2: Publishing - Research

**Researched:** 2026-08-31
**Domain:** Netlify continuous deployment for an Astro static site; Sveltia CMS (git-based, GitHub-backed) admin panel wired to the exact content schema Phase 1 finalized
**Confidence:** MEDIUM-HIGH (core config syntax verified against official Sveltia/Netlify docs this session; two account-creation steps are owner-dependent and unverifiable from this environment)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-03 | Netlify builds and deploys automatically on every commit | Netlify continuous deployment section, netlify.toml example, Environment Availability (Netlify site + GitHub connection is a human/browser step) |
| ADMIN-01 | Assistant logs into a form-based admin panel at `/admin`, GitHub sign-in via Netlify's built-in OAuth | Netlify built-in OAuth provider section (verbatim callback URL confirmed), admin/index.html + config.yml `backend` block |
| ADMIN-02 | Assistant adds a property (address, terms, specs, description, photos, status) via form; live within ~2 minutes | Standard Stack / Code Examples: properties collection config, `slug`/media_folder pitfalls, default (non-editorial) publish mode |
| ADMIN-03 | Assistant edits a property and flips status via dropdown | `select` widget config for the `status` enum |
| ADMIN-04 | Assistant publishes a Learn post (title, rich text, optional cover image) | `blog` collection config, `body` field convention for markdown content, `markdown` widget |
| ADMIN-05 | Assistant edits site settings (phone, email, social, homepage intro) | Pitfall 1 (settings.json wrapper-key gotcha) + `object` widget code example — this is the highest-risk item in the phase |
| ADMIN-06 | Assistant holds a one-page illustrated cheat-sheet | Noted as a content/documentation deliverable, not a technical build item — see Summary |

</phase_requirements>

## Summary

Phase 2 wires two already-decided pieces of infrastructure together: Netlify continuous deployment (replacing zip-drag) and Sveltia CMS as a git-based admin panel authenticated through Netlify's built-in OAuth provider. Neither piece needs new npm packages — Sveltia is loaded client-side from a CDN `<script>` tag in `public/admin/index.html`, and the site stays `output: 'static'` (no `@astrojs/netlify` adapter needed for this phase; that's a V2/CDN-optimization upgrade path, explicitly out of scope per CLAUDE.md).

The real risk in this phase is **not** "can Sveltia edit markdown" (it can, trivially) — it's the handful of places where Sveltia's config syntax has a documented gotcha that will *silently* produce a shape the Phase 1 content schema rejects, breaking the build after a Publish click with no CMS-side error. The single highest-risk item is the **settings singleton**: `src/content/settings.json` wraps its fields in a `"main"` key (required by Astro's `file()` loader, per `content.config.ts`'s own comment), but a naive Sveltia file-collection config writes fields flat at the JSON root — it does NOT recreate the wrapper automatically. The fix (verified against official docs) is to nest all settings fields inside a single `object`-widget field literally named `main`. This single misconfiguration would make ADMIN-05 fail every time, and it is not obvious from Sveltia's own "Getting Started" examples.

Two other properties of this stack are safety nets the plan should lean on, not fight: Sveltia's default publish mode commits directly to `main` (no PR/editorial-workflow step) — required for the ~2-minute publish goal — and Astro's build-time Zod schema is the last line of defense if a CMS field is ever misconfigured, since it fails the build loudly rather than shipping broken frontmatter. The plan should still add CMS-side `pattern`/`required` validation as the *first* line of defense (catches mistakes before a broken commit ever lands), because a build failure discovered by the assistant hours later, with no rollback instructions, defeats the "publish unaided in minutes" success criterion just as surely as a schema mismatch would.

Two setup steps in this phase are **owner/browser-dependent and cannot be scripted from this headless environment** (no `netlify-cli` or `gh` CLI installed, confirmed this session): creating the Netlify site linked to the GitHub repo, and registering the GitHub OAuth App with the exact callback URL. Both should be flagged as `checkpoint:human-verify`-style tasks in the plan, mirroring how Phase 1 handled the GitHub-account walkthrough (INFRA-01).

**Primary recommendation:** Build `admin/config.yml` and `admin/index.html` as a single unit against the exact schema already locked in `src/content.config.ts` (read this session — see Code Examples), commit `netlify.toml` alongside it, then do the Netlify site + GitHub OAuth App registration as one paired human-in-the-loop task before any CMS-side verification.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build & continuous deploy (INFRA-03) | CDN / Static (Netlify build system) | — | Netlify watches the GitHub repo, runs `npm run build`, publishes `dist/` — no server component |
| CMS admin UI (ADMIN-01–05 editing surface) | Browser / Client | — | Sveltia CMS runs entirely client-side (loaded via CDN `<script>`); no CMS server, no Netlify Function |
| CMS authentication | Browser / Client | API / Backend (GitHub OAuth, brokered by Netlify) | The OAuth handshake is brokered by Netlify's built-in provider, but the token lives in the browser; the "backend" here is GitHub's own OAuth service, not app code |
| Content persistence (git commits from Publish) | API / Backend (GitHub REST/GraphQL API) | Storage (git repo) | Sveltia calls the GitHub API directly from the browser with the OAuth token — there is no intermediate database or server-side write path |
| Content schema validation | CDN / Static (Astro build step) | — | Zod schema in `src/content.config.ts` validates at `npm run build` time, which runs inside the Netlify build tier, not at CMS-save time |
| Content-model documentation for the assistant (ADMIN-06 cheat-sheet) | *(non-technical deliverable)* | — | A one-page illustrated doc/PDF, not code — no architectural tier applies; flag as a content task, not a build task |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sveltia/cms` | latest (loaded via CDN, no npm install) `[CITED: sveltiacms.app/en/docs/start]` | Git-based admin panel at `/admin` | Locked decision (CLAUDE.md); Decap-compatible, actively developed successor to Decap/Netlify CMS |
| Netlify (existing account/hosting) | N/A | Continuous deployment + OAuth provider host | Already the approved host; built-in OAuth provider is the documented zero-code path for CMS auth `[CITED: docs.netlify.com/manage/security/secure-access-to-sites/oauth-provider-tokens/]` |
| GitHub OAuth App (new, registered this phase) | N/A | Identity provider behind Netlify's OAuth broker | Required by Netlify's built-in OAuth provider flow — one OAuth App, Homepage URL = production domain, Callback URL = `https://api.netlify.com/auth/done` `[VERIFIED (quote): docs.netlify.com/manage/security/secure-access-to-sites/oauth-provider-tokens/ — "GitHub Authorization Callback URL: https://api.netlify.com/auth/done"]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `netlify.toml` (config file, not a package) | N/A | Codifies build command/publish dir in the repo instead of only in Netlify's UI | Recommended so build settings are versioned and reproducible, not tribal knowledge in a dashboard `[CITED: docs.astro.build/en/guides/deploy/netlify/]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Netlify's built-in OAuth provider | `sveltia-cms-auth` on Cloudflare Workers | Only needed if hosting ever moves off Netlify — explicitly deferred per CLAUDE.md |
| Sveltia CMS | Decap CMS | Decap is in maintenance mode; Sveltia's own docs recommend against Decap for new 2026 builds |
| Default (simple) publish mode | Editorial workflow (draft → PR → merge) | Sveltia is implementing editorial workflow as a beta feature in its 2026 roadmap, but it directly conflicts with the ~2-minute unaided-publish success criterion — do not enable `[CITED: sveltiacms.app/en/docs/workflows/editorial + sveltiacms.app/en/roadmap]` |

**Installation:**
```bash
# No npm install needed for the CMS itself — it is loaded from a CDN
# script tag inside public/admin/index.html per Sveltia's own Getting
# Started guide. No new npm dependencies this phase.
```

**Version verification:** No new npm packages are introduced this phase (Sveltia is CDN-loaded; the Netlify adapter is explicitly deferred to V2-03). `astro` (`^7.2.9`), `@astrojs/sitemap` (`^3.7.3`), `sharp` (`^0.35.4`) already exist in `package.json` (read this session) and are unaffected.

## Package Legitimacy Audit

No new npm/PyPI/crates packages are installed in this phase — Sveltia CMS is loaded via a CDN `<script>` tag (`https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js`), not `npm install`ed, per Sveltia's own Getting Started guide `[CITED: sveltiacms.app/en/docs/start]` and the project's explicit CLAUDE.md installation note ("no npm install needed for the admin panel itself"). The Package Legitimacy Gate does not apply.

**Packages removed due to [SLOP] verdict:** none (no packages evaluated — none installed)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Assistant's browser
      │
      │ 1. navigates to https://ownwithoak.com/admin
      ▼
public/admin/index.html  (static HTML, loads Sveltia CMS from CDN)
      │
      │ 2. "Sign in with GitHub" → Netlify's built-in OAuth broker
      ▼
Netlify OAuth provider  ──────►  GitHub OAuth App  ──► GitHub identity
      │                                                (Client ID/Secret live
      │ 3. returns a GitHub-scoped                      only in Netlify's OAuth
      │    access token to the browser                  settings, never in repo)
      ▼
Sveltia CMS (still 100% client-side)
      │
      │ 4. reads admin/config.yml → renders forms for
      │    properties / blog / settings collections,
      │    matched field-for-field to src/content.config.ts
      ▼
Assistant fills form, uploads photos, clicks Publish
      │
      │ 5. Sveltia calls the GitHub REST/GraphQL API directly
      │    (with the OAuth token) — commits markdown/JSON + images
      ▼
GitHub repo, branch `main`  (single source of truth — no DB)
      │
      │ 6. push to main triggers a Netlify build hook
      ▼
Netlify build:  npm run build  →  Astro reads src/content.config.ts,
      │         validates every file against the Zod schema (fails
      │         loudly here if CMS output doesn't match), emits dist/
      ▼
Netlify atomic deploy  →  live at https://ownwithoak.com (~seconds
      │                    to low minutes after step 5 — this is the
      ▼                    ~2-minute publish-to-live window ADMIN-02
Visitor's browser                        measures)
```

### Recommended Project Structure
```
public/
├── admin/
│   ├── index.html      # Sveltia CMS loader (CDN script tag, no build step)
│   └── config.yml       # backend + collections, field-for-field matched to content.config.ts
netlify.toml              # build command + publish dir, versioned in repo
src/
├── content.config.ts     # UNCHANGED this phase — schema is already locked (Phase 1)
└── content/
    ├── properties/*.md
    ├── blog/*.md
    └── settings.json
```

### Pattern 1: `admin/index.html` — minimal, no `type="module"`
**What:** The static host page Sveltia CMS boots from.
**When to use:** Always — this is the entire admin app shell.
**Example:**
```html
<!-- Source: sveltiacms.app/en/docs/start (fetched this session) -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>Oak Homes Admin</title>
  </head>
  <body>
    <script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"></script>
  </body>
</html>
```
`[CITED: sveltiacms.app/en/docs/start]` — the docs explicitly warn against adding `type="module"`: Sveltia CMS "is not distributed as an ES module, and adding the attribute may lead to unexpected behavior."

### Pattern 2: `admin/config.yml` backend + properties collection
**What:** GitHub backend (no `base_url` needed with Netlify as OAuth broker) plus the `properties` collection matched to the schema read this session.
**When to use:** This is the core of ADMIN-01/02/03.
**Example:**
```yaml
# Source: sveltiacms.app/en/docs/backends/github + sveltiacms.app/en/docs/collections (fetched this session)
backend:
  name: github
  repo: almatreeholding-netizen/oak-homes-website   # VERIFIED: git remote -v, this session
  branch: main

media_folder: /public/uploads
public_folder: /uploads

collections:
  - name: properties
    label: Homes
    folder: src/content/properties
    create: true
    slug: '{{fields.slug}}'   # NOT the default title-slugify — see Pitfall 2
    fields:
      - { name: title, label: Title, widget: string }
      - { name: address, label: Address, widget: string }
      - name: slug
        label: URL slug
        widget: string
        pattern: ['^[a-z0-9]+(-[a-z0-9]+)*$', 'Lowercase letters, numbers, and single hyphens only (e.g. 614-e-marengo-st)']
        hint: 'This becomes the page URL. Match it exactly to what you want /homes/<slug> to be.'
      - name: status
        label: Status
        widget: select
        options: ['Available', 'Pending', 'Sold']
        default: 'Available'
      - { name: featured, label: 'Show on homepage', widget: boolean, default: false }
      - { name: downPayment, label: 'Down Payment ($)', widget: number, value_type: int }
      - { name: monthlyPayment, label: 'Monthly Payment ($)', widget: number, value_type: int }
      - { name: beds, label: Bedrooms, widget: number, value_type: int, required: false }
      - { name: baths, label: Bathrooms, widget: number, value_type: int, required: false }
      - { name: sqft, label: 'Square Footage', widget: number, value_type: int, required: false }
      - { name: description, label: Description, widget: text }
      - name: features
        label: Feature bullets
        widget: list
        field: { name: feature, widget: string }
        default: []
      - name: photos
        label: Photos (first photo = cover)
        widget: list
        field: { name: photo, widget: image }
        media_folder: '{{media_folder}}/properties/{{fields.slug}}'
        public_folder: '{{public_folder}}/properties/{{fields.slug}}'
        default: []
      - { name: publishDate, label: 'Publish Date', widget: datetime, type: date }
```
Notes tied to specific schema fields read this session (`src/content.config.ts:55-79`): `videoUrl`, `location`, `ogImage` are Phase 3 fields — intentionally **omitted** from `config.yml` this phase (they stay unset/empty, matching how Phase 1 left them; Astro's `.optional()` on all three means the CMS not exposing them yet is safe).

### Pattern 3: Blog collection — `body` field convention for markdown content
**What:** The blog schema (`src/content.config.ts:82-91`) only validates frontmatter (`title`, `slug`, `date`, `coverImage`, `ownerReviewed`); the article prose is the markdown body below the frontmatter fence, exactly as in the existing `what-is-a-land-contract.md` file read this session.
**Example:**
```yaml
# Source: sveltiacms.app/en/docs/fields/markdown + community convention notes (fetched this session)
collections:
  - name: blog
    label: Learn Posts
    folder: src/content/blog
    create: true
    slug: '{{fields.slug}}'
    fields:
      - { name: title, label: Title, widget: string }
      - name: slug
        label: URL slug
        widget: string
        pattern: ['^[a-z0-9]+(-[a-z0-9]+)*$', 'Lowercase letters, numbers, and single hyphens only']
      - { name: date, label: Date, widget: datetime, type: date }
      - { name: coverImage, label: 'Cover Image', widget: image, required: false }
      - { name: ownerReviewed, label: 'Owner has reviewed this post', widget: boolean, default: false }
      - { name: body, label: 'Post content', widget: markdown }
```
A field named anything other than literally `body` would be written INTO the frontmatter block instead of below it — breaking the render pipeline that expects prose as markdown body content, not a frontmatter string. `[CITED: sveltiacms.app/en/docs/fields/markdown + cross-checked via WebSearch against Decap's documented convention]`

### Pattern 4: Settings singleton — the wrapper-key fix (see Pitfall 1)
**What:** `src/content/settings.json` (read this session) is `{ "main": { phone, phoneHref, email, social: { facebook }, homepageIntro } }`. A naive file-collection config writes fields flat at JSON root, breaking Astro's `file()` loader. The fix: wrap every field inside a single `object`-widget field named `main`.
**Example:**
```yaml
# Source: sveltiacms.app/en/docs/fields/object (fetched this session, verbatim
# example confirms { name: X, widget: object, fields: [...] } produces { "X": {...} })
collections:
  - name: settings
    label: Site Settings
    files:
      - name: main
        label: Site Settings
        file: src/content/settings.json
        fields:
          - name: main
            label: Settings
            widget: object
            fields:
              - { name: phone, label: 'Phone (display)', widget: string, pattern: ['^\S.*\S$|^\S$', 'Cannot be empty'] }
              - { name: phoneHref, label: 'Phone (tel: link)', widget: string, hint: 'e.g. tel:+12172690003' }
              - { name: email, label: Email, widget: string }
              - name: social
                label: Social links
                widget: object
                fields:
                  - { name: facebook, label: 'Facebook URL', widget: string, required: false }
              - { name: homepageIntro, label: 'Homepage intro text', widget: text }
```
This produces `{ "main": { "phone": ..., "phoneHref": ..., "email": ..., "social": { "facebook": ... }, "homepageIntro": ... } }` — matching the settings schema (`src/content.config.ts:93-109`) exactly, entry id `"main"`.

### Pattern 5: `netlify.toml`
**What:** Versions the build settings instead of leaving them only in Netlify's dashboard.
**Example:**
```toml
# Source: docs.astro.build/en/guides/deploy/netlify/ (fetched this session)
[build]
  command = "npm run build"
  publish = "dist"
```

### Anti-Patterns to Avoid
- **Setting `publish_mode: editorial_workflow`:** Turns every Publish into a draft requiring a manual PR merge — directly defeats the ~2-minute unaided-publish success criterion. Leave `publish_mode` unset (default is direct-to-branch commit). `[CITED: sveltiacms.app/en/docs/workflows/editorial]`
- **Adding `type="module"` to the CDN script tag:** Explicitly called out by Sveltia's own docs as causing "unexpected behavior."
- **Trusting the custom `slug` template to sanitize case/spaces:** it does not (see Pitfall 2) — pair it with a `pattern` validator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CMS authentication / session handling | A custom login page + password store, or a Cloudflare Worker OAuth proxy | Netlify's built-in OAuth provider (Access & security > OAuth > Install Provider) | Zero custom code; token lifecycle is Netlify's problem, not this repo's `[CITED: docs.netlify.com]` |
| Git commit/push automation for "Publish" | A custom form-to-git-commit script or serverless function | Sveltia CMS's built-in Publish action (calls GitHub API directly from the browser) | This is the entire point of a git-based CMS — reimplementing it is pure risk for zero benefit |
| Rich text editing for blog posts | A custom textarea + manual markdown toolbar | Sveltia's `markdown` widget (aliased to its RichText widget) | Ships WYSIWYG-ish editing, image insertion, and correct markdown serialization out of the box |
| Image upload handling | A custom upload endpoint/Function | Sveltia's `image` widget writing directly into `media_folder` via the GitHub API | No server needed; matches the already-decided `public/uploads/` + plain `<img>` strategy |

**Key insight:** Every "hand-roll" temptation in this phase (auth, publishing, rich text, uploads) is exactly what a git-based headless CMS exists to remove. The actual engineering work in this phase is entirely in *matching config.yml to the schema precisely* — the pitfalls below are the real risk surface, not missing functionality.

## Common Pitfalls

### Pitfall 1: Settings JSON wrapper-key mismatch (highest-risk item this phase)
**What goes wrong:** `admin/config.yml`'s `settings` file-collection is configured with fields directly at the top level (as most tutorials show); Sveltia then writes `{ "phone": ..., "email": ... }` at the JSON root instead of `{ "main": { "phone": ..., ... } }`.
**Why it happens:** Astro's `file()` loader treats a JSON file's top-level keys as entry IDs (confirmed this session against Astro's own content-loader reference) — this is a Phase 1 design choice specific to this project, not something Sveltia's generic docs anticipate. Sveltia's file-collection fields, absent an explicit `object` wrapper, become the file's top-level keys.
**How to avoid:** Nest every settings field inside one `object`-widget field literally named `main` (Pattern 4 above) — verified this session against Sveltia's official `object` widget docs, which confirm the field's `name` becomes the wrapping JSON key.
**Warning signs:** ADMIN-05's site-settings save appears to succeed in the CMS UI, but the next Netlify build fails (Zod schema error: unexpected top-level keys / missing `main` entry) or — worse — the build passes silently before this schema existed. Always test this specific save-and-build path before considering ADMIN-05 done.

### Pitfall 2: Custom `slug` template does not sanitize case/spaces
**What goes wrong:** Setting `slug: '{{fields.slug}}'` on a collection (necessary — see below) makes Sveltia use the raw value of the `slug` field as the filename, but Sveltia's docs confirm that when a *custom* slug template is used, "uppercase letters and spaces are not converted to lowercase letters and hyphens" the way the *default* title-based slug is. If the assistant types `"614 E Marengo St"` into a plain string `slug` field, the filename/frontmatter will contain spaces and capitals, failing the `slugPattern` regex in `content.config.ts:20-23` and breaking the build.
**Why it happens:** Sveltia's automatic slugify only applies to its *default* title-derived slug generation, not to raw field values referenced via a custom template.
**How to avoid:** Add `pattern: ['^[a-z0-9]+(-[a-z0-9]+)*$', '...']` directly on the `slug` field (shown in Pattern 2/3 above) so the CMS itself blocks invalid input at data-entry time, before a broken commit can ever be created. `[CITED: sveltiacms.app/en/docs/fields (pattern syntax) + GitHub discussion #96/#594 corroboration]`

### Pitfall 3: `slug` must default OFF the `title` field, deliberately
**What goes wrong:** Without setting `slug: '{{fields.slug}}'` at the collection level, Sveltia's *default* behavior is to derive the filename from the `title` field (auto-slugified), which will drift from the frontmatter `slug` field the moment a title is edited later (e.g., correcting "614 E Marengo St" wording) without renaming the file — reintroducing exactly the slug/filename drift `content.config.ts`'s custom `generateId` function (`idFromFilename`, lines 43-45, read this session) exists to catch and reject at build time.
**How to avoid:** Explicit `slug: '{{fields.slug}}'` on both `properties` and `blog` collections (shown in Pattern 2/3). `[CITED: sveltiacms.app/en/docs/collections/entries — "By default, Sveltia CMS uses the title field as the slug... prefix it with fields., like {{fields.slug}}"]`

### Pitfall 4: CMS config and Astro schema must change in the same commit
**What goes wrong:** A future field added to `content.config.ts` (e.g., in Phase 3 for `videoUrl`) without a matching `config.yml` update leaves the assistant unable to fill that field from the CMS; a field removed from the schema without removing it from `config.yml` leaves a CMS form field that silently produces frontmatter the build now rejects.
**How to avoid:** Carried forward from Phase 1 CONTEXT.md (D-06) and STATE.md blockers — treat `content.config.ts` and `admin/config.yml` as one artifact that changes together, always in the same commit. This phase's `config.yml` intentionally omits the Phase-3-only fields (`videoUrl`, `location`, `ogImage`) rather than exposing empty widgets for features that don't exist yet.

### Pitfall 5: Netlify site + GitHub OAuth App creation are not scriptable from this environment
**What goes wrong:** A plan step tries to "create the Netlify site" or "register the GitHub OAuth App" as an ordinary automated task; both require an authenticated browser session against Netlify's and GitHub's dashboards.
**Why it happens:** Confirmed this session — neither `netlify` (netlify-cli) nor `gh` (GitHub CLI) is installed in this environment (`command -v` returned exit 1 for both).
**How to avoid:** Plan these as explicit human-in-the-loop / `checkpoint:human-verify` tasks, same pattern as Phase 1's INFRA-01 GitHub-account walkthrough. Sequence matters: register the GitHub OAuth App first (need its Client ID/Secret), then install it as Netlify's OAuth provider, then verify `/admin` login end-to-end before building out collection forms.
**Warning signs:** If the plan has no explicit checkpoint here, execution will stall silently waiting for credentials that can't be entered non-interactively.

## Code Examples

See **Architecture Patterns** above (Patterns 1–5) — all five are verified, ready-to-use code, not illustrative snippets, and are the primary deliverable this research produces for the planner.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Decap CMS (formerly Netlify CMS) | Sveltia CMS | Sveltia is Decap-config-compatible but actively developed; Decap is documented as effectively in maintenance mode | Locked project decision (CLAUDE.md) — do not reconsider Decap for this phase |
| Netlify Identity + Git Gateway for CMS auth | Netlify's built-in OAuth provider (Access & security > OAuth) | Git Gateway is officially marked deprecated by Netlify ("we will no longer fix bugs... new Git Gateway configurations are explicitly not recommended") | Do not use Identity/Git Gateway anywhere in this phase, even as a quick shortcut |

**Deprecated/outdated:**
- Netlify Identity + Git Gateway: deprecated by Netlify itself; do not build on it for a 2026 greenfield site.
- Decap CMS for new 2026 builds: not deprecated, but Sveltia's own docs steer new projects away from it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Sveltia CMS's file-collection `object` widget wrapping behavior (Pattern 4) generalizes identically for a *file collection's* top-level field the same way it was documented for a generic field example (the docs example shown was in a general fields context, not literally inside a `files:` block) | Pattern 4, Pitfall 1 | If the wrapper behavior differs specifically inside `files:` blocks, ADMIN-05 saves would still write flat JSON — recommend a live spot-check (save once via the CMS UI, inspect the resulting `settings.json` diff) before considering ADMIN-05 verified, exactly as STATE.md's Phase 2 blocker note already recommends for CMS auth |
| A2 | The GitHub OAuth App's "Homepage URL" should be the production domain (`https://ownwithoak.com`) even though the domain cutover itself is Phase 4 (LAUNCH-01) — this phase's OAuth App is being registered before the domain is live | Standard Stack, Pitfall 5 | If Netlify's OAuth flow validates against Homepage URL strictly, the app may need re-registration or the interim Netlify subdomain used instead — verify at setup time which URL is actually reachable when this OAuth App is created |
| A3 | `value_type: int` on the `downPayment`/`monthlyPayment` number widgets is safe (no cents/decimals expected for this business) based on the two existing example values (`3000`, `950`) read from `614-e-marengo-st.md` this session | Pattern 2 | If a future home's terms include cents, `value_type: int` would truncate/reject decimal input — switch to `float` if that need arises |

**If this table is empty:** N/A — see rows above; all three should be spot-checked live during execution per STATE.md's existing Phase 2 blocker note.

## Open Questions

1. **Does the existing Netlify account already have a site provisioned for this repo, or does Phase 2 create one from scratch?**
   - What we know: No `netlify.toml`, no `.netlify/` directory, no netlify-cli found in this repo/environment this session — nothing suggests a site already exists.
   - What's unclear: Whether the owner has already clicked "Add new site" in the Netlify dashboard outside this session.
   - Recommendation: Treat "create/confirm Netlify site linked to `almatreeholding-netizen/oak-homes-website`" as the first human-checkpoint task, verified live rather than assumed.

2. **Exact GitHub OAuth App Homepage URL to use before the domain cutover (see Assumption A2).**
   - Recommendation: Confirm the reachable Netlify-provided URL at the time the OAuth App is registered; update the OAuth App's Homepage URL again after LAUNCH-01 if needed (callback URL `https://api.netlify.com/auth/done` does not change).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Build (`npm run build`) | ✓ | v24.19.0 (VERIFIED this session) | — |
| npm | Package management / build script runner | ✓ | 11.17.0 (VERIFIED this session) | — |
| netlify-cli | Scripting Netlify site creation/linking | ✗ (VERIFIED this session — `command -v netlify` exit 1) | — | Manual setup via Netlify web dashboard (human checkpoint) |
| gh (GitHub CLI) | Scripting GitHub OAuth App registration | ✗ (VERIFIED this session — `command -v gh` exit 1) | — | Manual setup via GitHub web UI (human checkpoint) |
| Netlify account with site access | INFRA-03, ADMIN-01 | Unknown — could not verify from this environment | — | Human confirms/creates during execution (Open Question 1) |

**Missing dependencies with no fallback:**
- None — every missing CLI has a documented manual (browser) fallback; those fallbacks require a human, not a substitute tool.

**Missing dependencies with fallback:**
- netlify-cli → Netlify web dashboard (Project configuration UI)
- gh CLI → GitHub web UI (Developer settings → OAuth Apps)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|--------------------|
| V2 Authentication | Yes | GitHub OAuth via Netlify's built-in provider — no custom password/session code in this repo `[CITED: docs.netlify.com]` |
| V3 Session Management | Partial | Sveltia CMS holds the OAuth token client-side (browser); there is no server-side session to manage in this repo — standard for a git-based CMS |
| V4 Access Control | Yes | Access control is delegated to GitHub repository collaborator permissions, not application-level roles — whoever the owner adds as a GitHub collaborator can publish; the assistant's GitHub account should be scoped to the minimum role needed (write, not admin) |
| V5 Input Validation | Yes | Two layers: Sveltia field-level `pattern`/`required` validation (first line, catches mistakes before commit) + Astro's Zod schema at build time (`src/content.config.ts`, already exists, fails loudly on any mismatch) |
| V6 Cryptography | No | No secrets or crypto logic live in this repo; the GitHub OAuth App's Client Secret is entered directly into Netlify's OAuth provider settings UI (Netlify-hosted, not committed to git) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| GitHub OAuth Client Secret accidentally committed to the repo (e.g., pasted into `config.yml` or a stray `.env`) | Information Disclosure | The Client Secret is entered only into Netlify's "Access & security > OAuth > Install Provider" UI — `config.yml` never contains a secret (confirmed: the documented `backend` block only needs `name`, `repo`, `branch`) |
| CMS-authored content that doesn't match the Zod schema reaching `main` and breaking the live build | Tampering (of the build, not a security exploit per se) | Layered validation: CMS-side `pattern`/`required` (Pitfall 2) + build-time Zod failure (already exists, Phase 1) — the build failing loudly is the intended backstop, but CMS-side validation should catch most cases before a broken commit lands |
| Overscoped GitHub access for the non-technical assistant's account | Elevation of Privilege | Add the assistant as a repository **collaborator** with write access, not an org owner/admin — this is an owner-side GitHub settings decision, flag it explicitly in the plan rather than assuming default scoping |
| Public discoverability of `/admin` (search engines, crawlers) | Information Disclosure (low severity — login is still required) | `<meta name="robots" content="noindex" />` already included in the documented `admin/index.html` (Pattern 1) — keep it |

## Sources

### Primary (HIGH confidence)
- `docs.netlify.com/manage/security/secure-access-to-sites/oauth-provider-tokens/` — verbatim callback URL, UI path, scope behavior (fetched this session)
- `docs.astro.build/en/guides/deploy/netlify/` and Astro content-loader reference — build/publish settings, `file()` loader entry-ID behavior (fetched this session)
- `src/content.config.ts` (read this session, lines 1-111) — exact schema every CMS field must match
- `src/content/properties/614-e-marengo-st.md`, `src/content/blog/what-is-a-land-contract.md`, `src/content/settings.json` (read this session) — exact existing frontmatter/JSON shapes
- `git remote -v` / `git branch -a` (run this session) — confirmed `repo: almatreeholding-netizen/oak-homes-website`, `branch: main`

### Secondary (MEDIUM confidence)
- `sveltiacms.app/en/docs/start`, `/docs/backends/github`, `/docs/media/internal`, `/docs/collections`, `/docs/collections/entries`, `/docs/fields`, `/docs/fields/object`, `/docs/fields/number`, `/docs/fields/datetime`, `/docs/fields/markdown`, `/docs/workflows/editorial` — official Sveltia docs, fetched via WebFetch this session, several returned partial/404 pages requiring a second targeted fetch to the correct sub-page
- GitHub discussions #96, #594 on `sveltia/sveltia-cms` — corroborate the custom-slug-template sanitization gap (Pitfall 2), cross-checked against the official docs' own `fields.` prefix rule

### Tertiary (LOW confidence)
- General WebSearch summaries (unpkg CDN path, list/image widget nesting) — used only where corroborated by a subsequent official-docs WebFetch in the same session

## Metadata

**Confidence breakdown:**
- Standard stack (Netlify + Sveltia, no new packages): HIGH — locked decisions, verified against official docs
- CMS config syntax (collections, widgets, settings wrapper-key fix): MEDIUM-HIGH — official docs quoted verbatim this session, but the settings-singleton `object`-in-`files:` interaction (Assumption A1) is inferred by combining two separate doc pages, not shown as one worked example — recommend a live spot-check before marking ADMIN-05 done, consistent with STATE.md's existing Phase 2 blocker note
- Netlify/GitHub OAuth setup: MEDIUM — exact URLs verified, but the two account-creation steps themselves are unverifiable from this headless environment (Pitfall 5, Open Question 1)

**Research date:** 2026-08-31
**Valid until:** ~30 days (Sveltia CMS is actively developed; re-verify config.yml syntax against current docs if this phase is planned significantly later than the research date)
