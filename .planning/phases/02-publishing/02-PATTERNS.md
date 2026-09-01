# Phase 2: Publishing - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 5
**Analogs found:** 3 / 5 (2 have no in-repo analog — CMS config is a new file type this phase; RESEARCH.md Patterns 1-5 are the authoritative source for those)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `public/admin/index.html` | config (static HTML shell) | request-response | none in repo | no-analog (use RESEARCH.md Pattern 1 verbatim) |
| `public/admin/config.yml` | config (schema-mapping) | CRUD (git-backed) | `src/content.config.ts` | role-match (schema source of truth, not a YAML analog, but the field-for-field contract) |
| `netlify.toml` | config | batch (build) | `astro.config.mjs` | role-match (only other repo-root build config file) |
| `src/pages/publishing-guide.astro` | route/component (static page) | request-response | `src/pages/about.astro` | exact (simple static content page through shared Layout) |
| `src/content/settings.json` (values may be edited via CMS, not code) | model (data file) | CRUD | *(itself, pre-existing)* | exact — this is the existing file the settings collection config must reproduce |

## Pattern Assignments

### `public/admin/config.yml` (config, CRUD via GitHub API)

**Analog:** `src/content.config.ts` (the Zod schema is the field-for-field contract this file must mirror) plus RESEARCH.md Patterns 2-4 (verified against official Sveltia docs, already codebase-specific).

**Schema fields to mirror exactly** (`src/content.config.ts:55-109`):
```typescript
// properties (lines 55-79) — title, address, slug, status(enum), featured,
// downPayment, monthlyPayment, beds?, baths?, sqft?, description, features[],
// photos[], publishDate. videoUrl/location/ogImage exist in schema but are
// Phase-3-only — deliberately OMITTED from config.yml this phase.

// blog (lines 84-90) — title, slug, date, coverImage?, ownerReviewed.
// Article prose is NOT a frontmatter field — it is markdown body content,
// matching src/content/blog/*.md's existing shape (frontmatter fence + body).

// settings (lines 100-108) — phone, phoneHref, email, social.facebook?,
// homepageIntro — nested under one "main" key in src/content/settings.json
// (see settings.json below). The file() loader treats top-level JSON keys
// as entry ids (content.config.ts:94-98 comment) — config.yml's settings
// collection MUST wrap all fields inside a single object-widget field named
// literally "main" (RESEARCH.md Pattern 4) or saves will write flat JSON
// and break the next build silently until then.
```

**slug pattern to copy verbatim** (`src/content.config.ts:20-23`):
```typescript
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
```
Use the equivalent regex as the CMS `pattern` validator on every `slug` field (properties and blog) — RESEARCH.md Pitfall 2/3 explain why the CMS's custom slug template does not auto-sanitize.

**Backend/repo values already verified this session** (RESEARCH.md Pattern 2, cross-checked against `git remote -v`):
```yaml
backend:
  name: github
  repo: almatreeholding-netizen/oak-homes-website
  branch: main
media_folder: /public/uploads
public_folder: /uploads
```

**Existing settings.json shape to reproduce** (`src/content/settings.json`, full file, 12 lines):
```json
{
  "main": {
    "phone": "(217) 269-0003",
    "phoneHref": "tel:+12172690003",
    "email": "hello@ownwithoak.com",
    "social": { "facebook": "https://www.facebook.com/profile.php?id=61585478873461" },
    "homepageIntro": "Skip the traditional hurdles. We offer homes with owner financing..."
  }
}
```
config.yml's settings file-collection must be built exactly as RESEARCH.md Pattern 4 shows (object widget named `main` wrapping every field) to reproduce this shape byte-for-byte.

**Full ready-to-use YAML for all three collections:** RESEARCH.md Patterns 2, 3, 4 (lines 160-268 of 02-RESEARCH.md) — copy verbatim, do not re-derive.

---

### `public/admin/index.html` (config, static HTML shell)

**No in-repo analog** — this is the first admin-panel file in the project. Use RESEARCH.md Pattern 1 verbatim (lines 140-158):
```html
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
Do NOT add `type="module"` to the script tag (Sveltia docs explicitly warn this causes unexpected behavior). This file does not go through `Layout.astro` — it is a standalone SPA shell, not an Astro page.

---

### `netlify.toml` (config, build)

**Analog:** `astro.config.mjs` (repo-root config file convention — plain, minimal, no comments beyond what's necessary).

**Pattern to copy** (RESEARCH.md Pattern 5, matches `astro.config.mjs`'s existing `site: 'https://ownwithoak.com'` value already set for the production domain):
```toml
[build]
  command = "npm run build"
  publish = "dist"
```

---

### `src/pages/publishing-guide.astro` (route, static content page)

**Analog:** `src/pages/about.astro` (full file read, 93 lines) — closest existing page: no CMS-driven collection data, pure static marketing/informational copy rendered through the shared `Layout`.

**Imports pattern** (`about.astro:8-9`):
```astro
---
import Layout from '../layouts/Layout.astro';
import Button from '../components/Button.astro';
---
```

**Layout usage + noindex requirement:** `Layout.astro` (`src/layouts/Layout.astro:14-19`) accepts `title` and optional `description` props but has **no built-in `noindex` support** — `publishing-guide.astro` needs a robots meta tag Layout does not currently emit. Two options: (a) add an optional `noindex` prop to `Layout.astro` Props interface (`interface Props { title: string; description?: string; noindex?: boolean }`) and conditionally render `<meta name="robots" content="noindex" />` in the `<head>` block (`Layout.astro:38-55`), following the same conditional-prop style already used for `description`; or (b) inline a second `<meta>` tag via Astro's `<head>` slot if Layout supports one (it does not currently — a head-injection prop would need to be added). Recommend option (a): smallest, most consistent change, matching how `description` already has a default + override pattern (`Layout.astro:19`).

**Content structure to copy** (`about.astro:12-49`) — single `<Layout>` wrapper, `<section>` with heading hierarchy (`h1` once, `h2` per subsection), `<p>` blocks with `max-width: 70ch` for readability, optional `<Button>` CTAs. The cheat-sheet page (per 02-UI-SPEC.md, not re-read here since D-19 confirms it's already locked) will follow this same section/heading/paragraph shape but with step-by-step illustrated instructions instead of marketing prose — reuse the `.about`-style scoped `<style>` block pattern (`about.astro:51-92`): flex column container, `max-width: 820px`, consistent `gap`/`padding` tokens already established.

**Style scoping convention** (`about.astro:51-92`): every page-specific style block is scoped (non-`is:global`) and keys off a single top-level class named after the page (`.about`), with nested selectors for headings/paragraphs — follow the same naming convention, e.g. `.publishing-guide`.

---

## Shared Patterns

### Layout / brand tokens (all new Astro pages)
**Source:** `src/layouts/Layout.astro` (full file read, 246 lines)
**Apply to:** `src/pages/publishing-guide.astro`
```astro
<Layout title="..." description="...">
  <!-- page content -->
</Layout>
```
Brand tokens (`--color-cream`, `--color-ink`, `--font-display`, `--font-body`, etc.) come from `src/styles/global.css`, imported once inside `Layout.astro:12` — no new page needs to re-import it.

### Settings singleton wrapper-key fix (CMS config only, highest-risk item this phase)
**Source:** `src/content.config.ts:93-99` (comment explaining `file()` loader's top-level-key-as-entry-id behavior) + RESEARCH.md Pattern 4 / Pitfall 1
**Apply to:** `public/admin/config.yml`'s `settings` collection exclusively
```yaml
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
            fields: [ ... ]   # phone, phoneHref, email, social.facebook, homepageIntro
```

### Slug validation (properties + blog collections)
**Source:** `src/content.config.ts:20-23` (`slugPattern` regex, verbatim source of truth)
**Apply to:** `slug` field in both `properties` and `blog` collections in `config.yml`
```yaml
pattern: ['^[a-z0-9]+(-[a-z0-9]+)*$', 'Lowercase letters, numbers, and single hyphens only']
```
Must be paired with `slug: '{{fields.slug}}'` at the collection level (not the default title-derived slug) — RESEARCH.md Pitfall 3.

### Config/schema co-change discipline
**Source:** carried forward from Phase 1 (`src/content.config.ts` header comment, lines 9-13) + RESEARCH.md Pitfall 4
**Apply to:** any future PR touching `src/content.config.ts` AND `public/admin/config.yml` — must land in the same commit, never independently.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `public/admin/index.html` | config | request-response | First admin-panel file in the project; no comparable static SPA-shell HTML exists in repo. Use RESEARCH.md Pattern 1 verbatim — it is already verified against official Sveltia docs. |
| `public/admin/config.yml` | config | CRUD | No YAML config files exist in repo yet; RESEARCH.md Patterns 2-4 are the ready-to-use source, cross-referenced against `src/content.config.ts` as the schema contract (documented above, not a blind copy). |

## Metadata

**Analog search scope:** `src/pages/`, `src/layouts/`, `src/content.config.ts`, `src/content/`, repo root (config files), `public/`
**Files scanned:** `src/content.config.ts`, `src/content/settings.json`, `src/pages/about.astro`, `src/layouts/Layout.astro`, `astro.config.mjs`, directory listing of `public/`, `src/pages/`, `src/components/`
**Pattern extraction date:** 2026-08-31
