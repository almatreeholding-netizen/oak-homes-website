# Oak Homes Website (ownwithoak.com)

Oak Homes sells homes in Flint, MI on owner financing / land contracts ("From Rent to
Roots"). This repository is a fast, fully-owned static site built with **Astro 7** where
buyers browse homes and inquire, and where a non-technical assistant will publish new
properties and blog posts through a friendly admin panel from Phase 2 onward — no coding,
no Claude, no Google Drive.

There is no database. The repository *is* the content store: every home, blog post, and
site-wide setting lives as a markdown or JSON file under `src/content/`, and every publish
is a git commit.

**Phase 1's definition of done is a clean local build plus a push to this private repo —
not a live URL.** Hosting, the Netlify build/deploy pipeline, and the `/admin` CMS are
Phase 2 (INFRA-03, ADMIN-01..06). Nothing in this README describes a deployed site because
nothing is deployed yet.

## Local commands

```bash
npm install       # install dependencies
npm run dev       # local dev server with hot reload
npm run build     # production build -- emits static HTML to dist/
npm run preview   # serve the dist/ build locally, exactly as it will be hosted
```

`npm run build` must exit 0 with zero warnings before any commit that touches `src/`,
`public/`, or content. `node scripts/verify/checks.mjs <check-id>` runs this project's
verification suite (see that file's header comment for the full list of check ids); it is
the one shell-independent way to re-run this phase's acceptance checks, since the
executor session's shell here is Windows PowerShell 5.1, where `&&`, `grep`, `find`, and
`wc` don't work the way a Bash-authored script would expect.

## Content model

Three Astro content collections, defined in `src/content.config.ts` (the Astro 5+
location — **not** `src/content/config.ts`, which is silently ignored):

| Collection | Location | One entry per |
|---|---|---|
| `properties` | `src/content/properties/*.md` | home for sale |
| `blog` | `src/content/blog/*.md` | Learn post |
| `settings` | `src/content/settings.json` | site (a single `"main"` entry: phone, email, social links, homepage intro) |

Every entry's URL is its filename stem (e.g. `src/content/properties/614-e-marengo-st.md`
becomes `/homes/614-e-marengo-st`) — never the frontmatter `slug` field, which exists only
so Phase 2's CMS form has something to bind to. A build-time assertion in
`src/pages/homes/[slug].astro` and `src/pages/learn/[slug].astro` fails loudly if a file's
name and its own `slug` field ever drift apart.

### Adding a home

Add a new home by adding **one markdown file** to `src/content/properties/` — no template
edit required. Copy an existing file (e.g. `614-e-marengo-st.md`) as a starting point, set
its frontmatter fields (`title`, `address`, `slug`, `status`, `downPayment`,
`monthlyPayment`, `beds`/`baths`/`sqft` if known, `description`, `features`, `photos`,
`publishDate`), and add its photos (see below). The Zod schema in `src/content.config.ts`
validates every field at **build time** — a malformed entry fails the build with a clear
error rather than shipping a broken page.

`featured`, `location`, `videoUrl`, and `ogImage` are already in the schema even though
they render nothing yet (see "Extension points" below) — leave them unset on a new home
unless a later phase's feature is live.

### Photo convention

Property and post photos live under `public/uploads/` (Sveltia CMS's media picker targets
Astro's `/public` directory, not `src/assets` — this is deliberate, not a workaround).

**Pre-resize every photo to roughly 2000px on its longest edge before committing it.**
Git keeps every committed blob forever — a full-resolution phone photo committed once
stays in the repository's history at full size even if it is later replaced or deleted.
Resizing before the first `git add` is the only point at which an oversized photo can be
avoided cheaply; `scripts/extract-mockup-photos.mjs` (`npm run extract:photos`, plan 01-03)
demonstrates the pattern this project follows for any future photo import — a two-axis box
constraint (`width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true`, never a
width-only resize, which lets a portrait photo through oversized) and an all-or-nothing
write: every photo is decoded, resized, and threshold-checked in memory before any file is
written, so a failure partway through never leaves a stale, wrongly-numbered file on disk.

## Extension points for later phases

These exist in the schema or layout now so Phase 2's CMS config and Phase 3's features
never have to change this project's shape, only fill it in:

- **The site-wide integrations slot** — a marked HTML comment (`integrations-slot`) at the
  end of `<body>` in `src/layouts/Layout.astro`. Renders nothing in Phase 1; this is where
  Phase 2/3 site-wide scripts and widgets land.
- **The Zoho embed slot** — a marked HTML comment on `src/pages/contact.astro`, just below
  the phone card. LEAD-01 (the Zoho web-to-lead embed) and LEAD-02 (the
  `?property=<slug>` query-parameter prefill script) are Phase 3.
- **`location` (lat/lng), `videoUrl`, and `ogImage`** — already defined on the `properties`
  schema and unset on both seeded homes. PROP-03 (Leaflet map pin), PROP-04 (embedded
  video), and PROP-05 (OpenGraph card rendering) are Phase 3.

## What's deliberately not here yet

- No hosting, no Netlify build, no live URL, no CI workflow (INFRA-03, Phase 2)
- No `/admin` panel, no Sveltia CMS config, no GitHub OAuth sign-in (ADMIN-01..06, Phase 2)
- No Zoho lead form embed, no map pin rendering, no embedded video (Phase 3, see above)
- No DNS cutover, no Google Workspace verification, no sitemap submission (LAUNCH-01..04, Phase 4)

See `.planning/phases/01-foundation/SKELETON.md` for the full list and the architectural
decisions behind it.
