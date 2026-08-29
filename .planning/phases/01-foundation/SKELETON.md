# Walking Skeleton — Oak Homes Website (ownwithoak.com)

**Phase:** 1 (Foundation)
**Generated:** 2026-08-29
**Raised by:** `01-02-PLAN.md` Task 3 (`type="tracer"`), standing on the scaffold and token system
from `01-02-PLAN.md` Task 2
**Revised:** 2026-08-29, after cross-AI plan review — the tracer task was split into
scaffold-and-tokens (Task 2) and schema-layout-route (Task 3) so a scaffold failure does not strand
the slice; the property route was rebound from the frontmatter `slug` field to the entry `id`

> This is the Phase-1 special case of the tracer: a whole-application slice wired
> through every layer the project has. Every later phase adds vertical slices on
> top of these decisions without re-litigating them. Treat this file as a
> contract, not a scratchpad.

---

## Capability Proven End-to-End

**A visitor can open `/homes/614-e-marengo-st` in a browser and see the real 614 E Marengo St
listing — its address, its $3,000 down / $950 monthly terms, its feature bullets, the Oak Homes
header with the phone number, and the Equal Housing footer — rendered as static HTML that Astro
built from a real markdown content file validated against a real Zod schema.**

That single path exercises: content file → content-collection loader → Zod schema validation →
dynamic route (`getStaticPaths`) → shared layout → brand token system → static HTML in `dist/`.
Nothing in the path is faked. There is no database and no server in this project, so a validated
content read plus a pre-rendered route *is* the full stack.

---

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Astro 7.2.x, `output: 'static'`, no adapter | Locked stack (`.claude/CLAUDE.md`); zero-JS-by-default satisfies DESIGN-05. Node ≥22.12 required; machine runs v24.19.0. |
| Styling / design tokens | Tailwind CSS v4 via `@tailwindcss/vite`, brand tokens in a CSS `@theme` block in `src/styles/global.css` | Tailwind v4 is CSS-first — there is **no** `tailwind.config.mjs` by default and `@astrojs/tailwind` is deprecated. Supersedes UI-SPEC's passing `tailwind.config.mjs` reference (RESEARCH.md Pitfall 2). |
| Content / data layer | Astro Content Layer collections defined in **`src/content.config.ts`** (Astro 5+ location, directly under `src/`) | The repo *is* the database (INFRA-02). Zod schemas make a malformed entry fail the **build**, satisfying phase success criterion 5. The old `src/content/config.ts` path is silently ignored — never use it. |
| Content storage | `src/content/properties/*.md`, `src/content/blog/*.md`, `src/content/settings.json` | One file per home / post; a single settings file the assistant edits from Phase 2 on. |
| Image storage | `public/uploads/properties/<slug>/photo-NN.jpg`, pre-resized to ≤2000px longest edge | Sveltia CMS media targets `/public`, not `src/assets` — fighting this is unsupported. Git keeps every committed blob forever, so the resize happens *before* the first commit (D-03). |
| Brand assets | `public/brand/` — exported from `docs/reference/logo-source/` PNGs | The owner's PDFs wrap raster images; the PNGs are the usable source (UI-SPEC Brand Mark). |
| Legal / compliance copy | Hardcoded in `.astro` components — `src/layouts/Layout.astro` (Equal Housing) and `src/pages/how-it-works.astro` (land contract) | DESIGN-03: copy the CMS could edit into a compliance problem must not exist as a content-collection field. Phase 2's CMS config literally cannot expose a field that isn't in a collection. |
| Client-side JavaScript | Two islands only: gallery lightbox (`client:visible`) and the mobile nav drawer toggle | Everything else is pre-rendered. Any new JS in a later phase must justify itself against this baseline. |
| Auth | **None in Phase 1.** CMS auth is Phase 2 via Netlify's built-in OAuth provider (never Netlify Identity + Git Gateway — deprecated). | No auth surface exists in a static marketing site. |
| Deployment target | **Not in Phase 1.** Netlify auto-deploy is INFRA-03 (Phase 2). | Phase 1's Definition of Done is a clean local `npm run build` + a push to the private GitHub repo — not a live URL. |
| Source of truth | Private GitHub repo `almatreeholding-netizen/oak-homes-website`, branch `main`, HTTPS remote authenticated by Git Credential Manager 2.9.0 | No `gh` CLI on this machine; GCM is already the system credential helper, so the first push opens a browser sign-in and needs no extra setup (D-11/D-12). |
| Directory layout | `src/{content.config.ts, content/, layouts/, components/, pages/, styles/}` + `public/{brand/, uploads/}` + `scripts/` + `scripts/verify/` + `docs/reference/` | Flat and conventional; matches RESEARCH.md's recommended structure so Phase 2's CMS config maps cleanly onto it. |
| Route ↔ content binding | `/homes/<slug>` and `/learn/<slug>` route params come from the entry **`id`** (the filename stem); a build-time assertion requires `entry.id === entry.data.slug` | Two files cannot share a filename, so route collisions are impossible by construction rather than by trusting Astro's untested duplicate-param behaviour (RESEARCH.md A1). The `slug` field still exists for Phase 2's CMS form to bind to, and the assertion is what keeps the two from drifting. |
| Verification | One shell-independent Node CLI, `scripts/verify/checks.mjs`, invoked as `node scripts/verify/checks.mjs <check-id>`; every plan's `<automated>` block is exactly one such invocation | The executor session's shell is Windows PowerShell 5.1, where `&&`, `grep`, `find`, `wc`, and `test` do not work. Bash verify blocks fail to *parse* there rather than to *pass*, which invites verification to be silently skipped. Node is already a hard project dependency and parses the same everywhere. |

---

## Stack Touched in Phase 1

- [ ] **Project scaffold** — Astro 7.2.x, Tailwind v4, self-hosted Lora + Inter, `@astrojs/sitemap`, `npm run build` and `npm run preview` both clean
- [ ] **Routing** — real dynamic route `/homes/[slug]` generated by `getStaticPaths()` from the properties collection, plus 7 static routes
- [ ] **Data layer** — real read: `getCollection('properties')` and `src/content/settings.json` both drive rendered output. Real write: content authored as markdown/JSON files committed to git (the repo is the persistence layer — there is no database in this architecture)
- [ ] **UI** — interactive element wired to real data: the gallery lightbox island opens over the real extracted property photos; the mobile nav drawer toggles the real 7-item nav
- [ ] **Deployment** — documented local full-stack run command (`npm run build && npm run preview`) **plus** a push to the private GitHub repo. Hosted deployment is deliberately Phase 2 (INFRA-03)

---

## Out of Scope (Deferred to Later Slices)

Explicit, so no future phase re-litigates Phase 1's minimalism:

- **Netlify build/deploy pipeline and any live URL** — INFRA-03, Phase 2
- **The `/admin` panel, Sveltia CMS config, GitHub OAuth sign-in, the assistant cheat-sheet** — ADMIN-01..06, Phase 2
- **Zoho web-to-lead embed and the URL-parameter prefill script** — LEAD-01/LEAD-02, Phase 3. Phase 1 ships the `/contact` page shell (so the 7-item nav and every Inquire button resolve) with a marked slot where the embed lands
- **Leaflet map pins** — PROP-03, Phase 3. The `location` lat/long schema field is created now and left empty for both homes (D-16), because a pin can only be verified when it renders
- **Embedded video** — PROP-04, Phase 3. The `videoUrl` schema field exists now and is unset on both homes
- **OpenGraph card rendering and Facebook Sharing Debugger verification** — PROP-05, Phase 3. The `ogImage` schema field exists now
- **DNS cutover, Google Workspace email verification, Google Business Profile, sitemap submission** — LAUNCH-01..04, Phase 4
- **Replacing the mockup-extracted photos with full-resolution originals** — deferred; Phase 2's admin panel makes this an assistant-level swap
- **Owner review of the seeded Learn post and attorney review of land-contract copy** — Phase 4 launch checklist
- **Image CDN / on-the-fly optimization** — V2-03, only if page weight becomes a *measured* problem

### Why the Phase 3 fields exist now

`featured`, `location`, `videoUrl`, and `ogImage` are defined in `src/content.config.ts` **this phase**
even though three of them render nothing yet. Phase 2 writes `admin/config.yml` against this exact
schema; the two files describe the same shape and must change together in the same commit forever
after. Adding a field in Phase 3 would desynchronize a CMS config written in Phase 2 — the precise
drift pitfall the research flagged. Paying for the empty fields now is cheaper than the migration.

---

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton **without altering the
architectural decisions above**:

- **Phase 2 — Publishing:** every commit auto-deploys via Netlify; the assistant signs into `/admin` and publishes a home through a form. Adds a hosting layer and a CMS layer; changes no content schema.
- **Phase 3 — Integrations:** a visitor becomes a Zoho lead in one click, sees a map pin, and shares a link that renders a proper card. Fills the `location` / `videoUrl` / `ogImage` fields already defined here and populates the `/contact` embed slot.
- **Phase 4 — Launch:** `ownwithoak.com` serves the site over HTTPS with Google Workspace email intact and a real lead confirmed from the production hostname. Changes DNS only.

---

## Skeleton Invariants (a later phase breaking one of these is a regression)

1. `src/content.config.ts` stays at that exact path. Moving it to `src/content/config.ts` silently disables all schema validation.
2. Legally-sensitive copy stays in `.astro` files. The moment it becomes a content-collection field, the CMS can edit it (DESIGN-03).
3. The shared layout stays the only source of the header, footer, Equal Housing line, phone number, and integrations slot. A page template that renders without them is structurally impossible, which is the point.
4. `output: 'static'` with no adapter. Adding SSR changes the security model from "no runtime attack surface" to "a server", and nothing in the roadmap needs it.
5. Property photos are resized before `git add`, never after — with a two-axis box constraint
   (`width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true`) and a pre-write throw, not
   a width-only resize. A width-only constraint lets a portrait photo through oversized, and git
   keeps it forever.
6. A route parameter is derived from the entry `id`, never from a frontmatter field, and every
   collection route asserts `entry.id === entry.data.slug`. Removing that assertion re-opens a silent
   drift between a home's permanent URL and the file that claims it.
7. `.gitignore` keeps the `!.claude/CLAUDE.md` negation. Any tool that rewrites the file — the Astro
   scaffold did — must be followed by re-asserting it.
8. Every `<automated>` verification is one `node scripts/verify/checks.mjs <check-id>` invocation.
   Reintroducing shell-syntax verify blocks reintroduces the failure mode where verification is
   skipped rather than run.
