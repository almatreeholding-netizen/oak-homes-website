# Phase 2 — API Coverage Decision Matrix

**Generated:** 2026-08-31 (gsd-planner, `api-coverage` contribution)
**Verdict:** External capability surfaces ARE integrated this phase — enumerated below.

## Detection Note

The deterministic detector (`gsd-core/bin/lib/api-coverage.cjs`) returned `detected: false` against
the ROADMAP phase text alone. That is a false negative for this phase: **no code in this repo calls
an external API**, but the phase's entire deliverable is *configuring* two third-party capability
surfaces (Sveltia CMS and the Netlify platform) plus delegating an OAuth handshake. Those surfaces
are enumerated here rather than skipped, because the opt-outs are the load-bearing decisions
(editorial workflow, Netlify Functions, external media libraries) and silently omitting them is how
a later phase re-litigates a settled choice.

**Who calls what:** Sveltia CMS (third-party, CDN-loaded, runs in the assistant's browser) calls the
GitHub REST/GraphQL API directly with an OAuth token. Netlify's OAuth broker calls GitHub's OAuth
service. This repository ships zero API-calling code — only configuration.

---

## Surface 1 — Sveltia CMS (`public/admin/config.yml`)

| Capability | Decision | Reason |
|------------|----------|--------|
| `backend: github` (repo, branch) | **INTEGRATE** | The whole point — git-backed publishing to `almatreeholding-netizen/oak-homes-website`, branch `main`. |
| Netlify built-in OAuth provider auth (no `base_url`) | **INTEGRATE** | Locked in CLAUDE.md; zero custom code, no hosted proxy. ADMIN-01. |
| Custom OAuth client / `sveltia-cms-auth` Worker (`base_url`) | **OPT-OUT** | Only needed off Netlify hosting; CLAUDE.md defers it explicitly. Adding `base_url` now would be dead config. |
| "Sign In with Token" (PAT) | **OPT-OUT** | A long-lived unscoped-feeling secret handed to a non-technical assistant; the OAuth flow is the friendly-panel requirement. |
| `folder:` collections (properties, blog) | **INTEGRATE** | ADMIN-02/03/04. |
| `files:` singleton collection (settings) | **INTEGRATE** | ADMIN-05 — `src/content/settings.json` is one fixed entry. |
| Widgets: `string`, `text`, `number`, `boolean`, `select`, `list`, `object`, `image`, `datetime`, `markdown` | **INTEGRATE** | Exactly the set the Phase-1 Zod schema requires. |
| Widgets: `relation`, `code`, `color`, `map`, `uuid`, `file`, `hidden` | **OPT-OUT** | No schema field needs them. `map` is Phase 3 (PROP-03, Leaflet), not this phase. |
| Field `pattern` / `required` validation | **INTEGRATE** | First line of defense before a broken commit lands (RESEARCH Pitfall 2). |
| Custom `slug:` template (`{{fields.slug}}`) | **INTEGRATE** | Required — the default title-derived slug drifts from frontmatter (RESEARCH Pitfall 3). |
| Per-field `media_folder` / `public_folder` override | **INTEGRATE** | RESEARCH Pattern 2 nests property photos per-slug. Flagged: CLAUDE.md notes Sveltia may not honor per-field overrides identically to Decap — proven at the 02-01 tracer checkpoint by uploading one real photo and inspecting where it landed. |
| `publish_mode` editorial workflow (draft → PR → merge) | **OPT-OUT** | Directly defeats the ~2-minute unaided-publish criterion. Leave the key absent (default direct-to-branch). |
| External media libraries (Cloudinary, Uploadcare) | **OPT-OUT** | Paid vendors; violates the $0/month constraint. Photos live in `public/uploads/`. |
| i18n / multi-locale | **OPT-OUT** | Single-locale English site; no requirement. |
| `preview_path` / custom previews / custom widgets | **OPT-OUT** | Static-build previews add config surface for a two-listing site; the live-site round trip is the preview. |
| Collection `filter` / custom `view_groups` | **OPT-OUT** | Two homes and one post — list volume does not justify it (UI-SPEC `populated`/`zero-one-many` rows). |
| `site_url` / `display_url` / `logo_url` branding of the panel | **OPT-OUT** | UI-SPEC is explicit: Sveltia's admin UI is not restyled or rebranded this phase. |
| Nested collections / `path:` templates | **OPT-OUT** | Phase 1 locked a flat `*.md` loader glob; a nested file yields an id with a path separator that can never satisfy `slugPattern`. |

## Surface 2 — Netlify platform

| Capability | Decision | Reason |
|------------|----------|--------|
| Continuous deploy from GitHub (build hook on push to `main`) | **INTEGRATE** | INFRA-03, the phase's first success criterion. |
| `netlify.toml` versioned build config | **INTEGRATE** | RESEARCH Pattern 5 — build settings in the repo, not tribal knowledge in a dashboard. |
| Atomic deploys + rollback to a prior deploy | **INTEGRATE** (inherited) | Netlify default; it is what makes a failed build leave the last good site serving. |
| Built-in OAuth provider (Access & security → OAuth) | **INTEGRATE** | ADMIN-01 auth broker. |
| Netlify Identity + Git Gateway | **OPT-OUT** | Officially deprecated by Netlify; bugs will no longer be fixed. |
| Netlify Functions / Edge Functions | **OPT-OUT** | No server-side code exists or is needed; static output only. |
| `@astrojs/netlify` adapter + Netlify Image CDN | **OPT-OUT** | Deferred to V2-03 in REQUIREMENTS.md; only justified once page weight is a *measured* problem. |
| Netlify Forms | **OPT-OUT** | Lead capture is Zoho Web-to-Lead (Phase 3, LEAD-01) — a second form backend would fragment lead data. |
| Deploy previews / branch deploys | **OPT-OUT** | The assistant publishes to `main` directly; a preview URL is one more thing to explain on a one-page cheat-sheet. |
| Build-failure notification email | **OPT-OUT** | Explicitly declined by the owner (D-22). The cheat-sheet's "wait ~10 minutes, then call" copy is the whole safety net this phase ships. |
| Netlify Analytics / Split Testing / Large Media | **OPT-OUT** | Paid or unneeded; analytics is V2-05 via the integrations slot. |
| Custom domain / DNS | **OPT-OUT (this phase)** | Phase 4 (LAUNCH-01). This phase uses the Netlify-provided HTTPS URL. |

## Surface 3 — GitHub

| Capability | Decision | Reason |
|------------|----------|--------|
| OAuth App (Homepage URL + callback `https://api.netlify.com/auth/done`) | **INTEGRATE** | The identity provider behind Netlify's broker. Registered by hand — GitHub has no API for creating OAuth Apps, and `gh` is not installed (verified this session). |
| Repository collaborator permissions as CMS access control | **INTEGRATE** | V4 Access Control is delegated to GitHub; the assistant gets Write, never Admin/Owner (D-18). |
| GitHub REST/GraphQL content API | **INTEGRATE (by Sveltia, not by us)** | Sveltia calls it from the browser on Publish. This repo writes no client for it — hand-rolling one is the explicit anti-pattern in RESEARCH "Don't Hand-Roll". |
| GitHub Actions | **OPT-OUT** | Netlify's own build runner is the CI; a second pipeline adds cost and drift for zero gain. |
| GitHub Pages | **OPT-OUT** | Netlify is the approved host; Pages would break the built-in OAuth provider path. |
