---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [astro, tailwindcss-v4, content-collections, sharp, fontsource, static-site]

# Dependency graph
requires:
  - phase: 01-foundation (plan 01-01)
    provides: repo connected to GitHub, mockup/one-pager/logo sources rescued into docs/reference/
provides:
  - Astro 7.2.9 static scaffold with Tailwind v4 @theme brand tokens, self-hosted Lora + Inter
  - src/content.config.ts — properties/blog/settings collection schemas (the Phase 2 CMS contract)
  - The Walking Skeleton — /homes/614-e-marengo-st rendered from a real content file through the shared Layout
  - src/components/BrandMark.astro and the exported public/brand/ asset set (ink/light/circle + favicons)
  - scripts/verify/checks.mjs check ids scaffold-clean, skeleton-e2e, brand-assets
affects: [01-03, 01-04, 01-05, phase-02-admin]

actuals:
  tokens: 63000
  tasks: 4
  commits: 6

tech-stack:
  added: [astro@7.2.9, tailwindcss@4, "@tailwindcss/vite", "@fontsource/lora", "@fontsource/inter", lucide-static@1.37.0, "@astrojs/sitemap", sharp@0.35.4 (devDependency)]
  patterns:
    - "Content collections at the Astro 5+ location (src/content.config.ts), flat *.md glob loaders, route params keyed on entry.id with an explicit entry.id === entry.data.slug drift assertion"
    - "Brand assets consumed only through a single component (BrandMark.astro) taking variant + size props, with one documented exemption for favicon <link> tags"
    - "scripts/verify/checks.mjs as the one shell-independent verification CLI — every <automated> plan block is `node scripts/verify/checks.mjs <id>`"

key-files:
  created:
    - src/content.config.ts
    - src/content/settings.json
    - src/content/properties/614-e-marengo-st.md
    - src/layouts/Layout.astro
    - src/components/Nav.astro
    - src/components/Button.astro
    - src/components/BrandMark.astro
    - src/pages/index.astro
    - src/pages/homes/[slug].astro
    - src/styles/global.css
    - astro.config.mjs
    - scripts/build-brand-assets.mjs
    - public/brand/ (27 exported files: 3 variants x 4 sizes x 2 formats, plus 3 favicon files)
  modified:
    - package.json
    - package-lock.json
    - tsconfig.json
    - .gitignore
    - scripts/verify/checks.mjs

key-decisions:
  - "Brand mark variants (ink/light/circle) are cropped to the circle-and-leaf icon only, excluding the source files' stacked 'Oak Homes' / tagline wordmark raster — the header instance carries the tagline as alt text instead, per the UI-SPEC's ban on re-typesetting the wordmark in a site UI font."
  - "Favicon set is sourced from the mark-only Android.png (196x196, no circle fill) rather than the colour-circle variant, per Task 4's explicit action text."
  - "photos field is z.array(z.string()).default([]), not RESEARCH.md Pattern 1's .min(1) — a zero-photo property is a designed empty state (UI-SPEC E3), not a build failure."
  - "Every collection's loader glob is the flat '*.md', not '**/*.md' — makes the id<->slug drift assertion sound and the 'two files cannot share one filename' route-uniqueness argument literally true."
  - "Route params for /homes/[slug] are keyed on entry.id (filename stem), never on the frontmatter slug field, with an explicit build-time equality assertion between the two."

patterns-established:
  - "BrandMark.astro variant+size prop API: consumers never hardcode a /brand/ path; a purely decorative mark gets no alt prop and renders empty-alt + aria-hidden=\"true\"."
  - "clearAstroCache() before every mutation/rebuild round-trip in checks.mjs — the content-layer data-store.json cache otherwise serves a stale error from the previous mutation."

requirements-completed: [DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-05, DESIGN-06, LEAD-03, BROWSE-02]

coverage:
  - id: D1
    description: "Astro 7.2.9 scaffolded non-interactively (no prompt, no --yes on create-astro), Tailwind v4 @theme brand tokens wired, self-hosted Lora/Inter, plan 01-01's .gitignore re-asserted after the scaffold overwrote it"
    requirement: DESIGN-05
    verification:
      - kind: automated_ui
        ref: "node scripts/verify/checks.mjs scaffold-clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Walking Skeleton: /homes/614-e-marengo-st rendered from a real, schema-validated content file through the shared Layout, with the Equal Housing line structurally unavoidable, the phone preceding <main>, the integrations slot present once, and malformed content/slug-drift/empty-collection/blank-phone edge cases all failing or succeeding the build as specified"
    requirement: BROWSE-02
    verification:
      - kind: automated_ui
        ref: "node scripts/verify/checks.mjs skeleton-e2e"
        status: pass
    human_judgment: false
  - id: D3
    description: "Owner's real logo exported as ink/light/circle variants (40/80/128/256px, WebP+PNG) plus a favicon set, consumed only through BrandMark.astro (favicon <link> tags in Layout.astro's head are the one documented exemption), header carries the tagline as alt text on every page, zero-photo placeholder renders the reduced-opacity mark, no exported file exceeds 100KB"
    requirement: DESIGN-01
    verification:
      - kind: automated_ui
        ref: "node scripts/verify/checks.mjs brand-assets"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rendered page actually looks right in a browser — header layout, nav, phone, footer, Equal Housing line, and the brand marks all visible and legible at real viewport sizes"
    verification: []
    human_judgment: true
    rationale: "The automated checks assert HTML substring presence and byte budgets, not actual visual layout, contrast, or legibility. A human needs to run `npm run preview` and look at the page."

duration: 3h10m
completed: 2026-08-31
status: complete
---

# Phase 1 Plan 2: Walking Skeleton + Brand System Summary

**Astro 7.2.9 static site with Tailwind v4 brand tokens, a real `/homes/614-e-marengo-st` page driven by a schema-validated content collection, and the owner's real logo exported as an ink/light/circle BrandMark component with a favicon set.**

## Performance

- **Duration:** ~3h10m (across three executor sessions — see Issues Encountered)
- **Tasks:** 4/4 complete (Task 1 human-verify gate, Task 2 scaffold, Task 3 tracer, Task 4 brand assets)
- **Files modified:** 44 files changed across the plan (6 task commits)

## Accomplishments

- Astro 7.2.9 scaffolded non-interactively into the existing git worktree with every `create-astro` wizard answer supplied as a flag (no `--yes`), dependencies installed (`astro`, `tailwindcss`, `@tailwindcss/vite`, `@fontsource/lora`, `@fontsource/inter`, `lucide-static`, `@astrojs/sitemap`; `sharp` as a devDependency), and plan 01-01's `.gitignore` re-asserted after the scaffold silently overwrote it.
- Tailwind v4 `@theme` token block in `src/styles/global.css` carrying all ten UI-SPEC brand tokens (`#FFD053` accent, `#A87E24` price-gold, etc.), self-hosted Lora/Inter 400+600 via `@fontsource`, zero requests to `fonts.googleapis.com`.
- `src/content.config.ts` defines the final `properties`/`blog`/`settings` schemas at the Astro 5+ location, with a flat `*.md` loader glob (superseding RESEARCH.md Pattern 1's recursive glob) and `photos: z.array(z.string()).default([])` (superseding Pattern 1's `.min(1)`, since a zero-photo home is a designed empty state).
- `src/pages/homes/[slug].astro` generates real static HTML for 614 E Marengo St from `src/content/properties/614-e-marengo-st.md`, keyed on `entry.id` with an explicit `entry.id === entry.data.slug` build-time assertion (and a message that distinguishes genuine drift from a nested-file id) rather than trusting Astro's untested duplicate-`getStaticPaths`-param behavior.
- `src/layouts/Layout.astro` is the single shared layout carrying the header (brand mark + 7-item nav + phone), the verbatim Equal Housing sentence in the footer, and a marked integrations slot — structurally unavoidable on every page.
- The owner's real dual-leaf logo is exported by a one-off `sharp` script (`scripts/build-brand-assets.mjs`) into `public/brand/`: three usage variants (ink on cream, light/white on ink, colour-in-yellow-circle) each at 40/80/128/256px in WebP+PNG, plus a 32px/180px/192px favicon set seeded from the source `Android.png`. All 27 files are well under the 100KB budget (largest is 29.8KB).
- `src/components/BrandMark.astro` is the single component naming a `/brand/` path (variant + size props); it is wired into the header (ink, carrying `Oak Homes — From Rent to Roots` as alt text — satisfying ROADMAP criterion 3), the footer (light, decorative), and the zero-photo placeholder frame (ink at 15% opacity, decorative). The only other `/brand/` references in `src/` are the three favicon `<link>` tags in `Layout.astro`'s head — the plan's one documented exemption.
- Three checks registered in `scripts/verify/checks.mjs` (`scaffold-clean`, `skeleton-e2e`, `brand-assets`), all passing; `npm run build` exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm package legitimacy before the first install** — checkpoint, no commit (owner explicitly approved `astro`/`sharp`/`lucide-static` against their npmjs.com registry pages; see Deviations)
2. **Task 2: Scaffold Astro non-interactively, wire brand tokens** — `56e84f8` (feat)
3. **Task 3: One real home, end to end** — `1979072` (feat, schema/content/settings — preserved by the orchestrator after an earlier executor was killed mid-task by an API error) and `dccaffa` (feat, layout/components/routes — completed by a fresh executor)
4. **Task 4: Export brand mark and wire BrandMark** — `09e9313` (feat, export script + exported assets + BrandMark.astro), `cce30ed` (feat, wired into Layout.astro/[slug].astro), `ff8779b` (test, brand-assets check)

**Plan metadata:** commit pending (this SUMMARY + STATE.md, by the orchestrator per this executor's scope boundary)

## Files Created/Modified

- `astro.config.mjs` — static output, `site: 'https://ownwithoak.com'`, Tailwind v4 vite plugin
- `src/styles/global.css` — `@theme` brand token block, self-hosted font imports
- `src/content.config.ts` — properties/blog/settings collection schemas
- `src/content/settings.json` — phone, phoneHref, email, Facebook link, homepage intro
- `src/content/properties/614-e-marengo-st.md` — the first real home (Available, $3,000 down, $950/mo, six feature bullets)
- `src/layouts/Layout.astro` — shared layout: header (BrandMark ink + Nav + phone), main, footer (BrandMark light + contact + nav + Equal Housing line), integrations slot, favicon `<link>` set
- `src/components/Nav.astro` — 7-item horizontal/drawer nav
- `src/components/Button.astro` — accent-fill/ghost anchor button, 44px hit area
- `src/components/BrandMark.astro` — variant (ink/light/circle) + size (sm/lg) prop component
- `src/pages/index.astro` — minimal homepage (intro + Browse Homes CTA)
- `src/pages/homes/[slug].astro` — dynamic property route, id<->slug drift assertion, zero-photo placeholder with BrandMark
- `scripts/build-brand-assets.mjs` — one-off sharp export script (source PNGs -> public/brand/)
- `public/brand/` — 27 exported files (mark-{ink,light,circle}-{40,80,128,256}.{png,webp}, favicon-32.png, apple-touch-icon-180.png, android-chrome-192.png)
- `scripts/verify/checks.mjs` — `scaffold-clean`, `skeleton-e2e`, `brand-assets` checks
- `.gitignore` — re-asserted post-scaffold: `.claude/*`, `!.claude/CLAUDE.md`, `node_modules/`, `dist/`, `.astro/`, `.env`, `.env.*`, `!.env.example`, `.astro-scaffold-tmp/`
- `package.json` / `package-lock.json` — resolved `astro@7.2.9`, `lucide-static@1.37.0`, `sharp@0.35.4`

**Exact `create-astro` invocation that worked (no non-empty-directory fallback needed):**
```
npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git --skip-houston
```

## Decisions Made

- **Brand mark crops exclude the wordmark raster.** The owner's source files (`Black logo - no background.png`, `White logo - no background.png`, `Color logo with background.png`) are all a single stacked lockup: circle-and-leaf mark on top, "Oak Homes" / tagline wordmark below, identical 3171x2772 canvas across all three. `scripts/build-brand-assets.mjs` crops each to a fixed 1878x1878 box (derived by scanning the colour variant's yellow-fill pixel bounds, then padding 40px) that isolates the circle mark only. This is why the header `BrandMark` instance carries `Oak Homes — From Rent to Roots` as `alt` text rather than the image showing it: Task 4's own action text explains the alt-text strategy is necessary specifically *because* the visual mark does not also show the tagline as baked-in pixels — baking it in would have made that explanation moot.
- **Favicon sourced from Android.png, not the circle variant.** Task 4's action text names the 196x196 `Android.png` (transparent background, mark-only, no circle fill) as the favicon seed, distinct from the colour-in-circle variant used for the `circle` prop value. Followed literally.
- **`photos: z.array(z.string()).default([])`, not `.min(1)`.** Documented supersession of RESEARCH.md Pattern 1 — a zero-photo property is UI-SPEC's designed E3 empty state, not a validation failure. Verified by a round-trip build with an emptied `photos` array.
- **Flat `*.md` loader glob, not `**/*.md`.** Also a documented Pattern 1 supersession — makes the `entry.id === entry.data.slug` drift assertion sound (a nested file's id could never satisfy the slug regex) and the "two files cannot share one filename" route-uniqueness argument literally true rather than dependent on untested Astro dedup behavior.
- **Route params keyed on `entry.id`, not the frontmatter `slug` field**, with an explicit build-time equality assertion between the two (and a message that distinguishes genuine drift from a nested-file id) — removes the plan's former dependency on RESEARCH.md assumption A1 (untested duplicate-`getStaticPaths`-param behavior).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Layout.astro` was missing the `global.css` import**
- **Found during:** Task 3
- **Issue:** Without the import, the `@theme` brand tokens from Task 2 never reached the built CSS.
- **Fix:** Added `import '../styles/global.css'` to `Layout.astro`.
- **Files modified:** `src/layouts/Layout.astro`
- **Committed in:** `dccaffa`

**2. [Rule 1 - Bug] Brand-token hex assertions made case-insensitive**
- **Found during:** Task 3
- **Issue:** Lightning CSS (Tailwind v4's minifier) lowercases hex literals in its output; the `scaffold-clean`/`skeleton-e2e` checks were asserting uppercase `#FFD053`/`#A87E24` against built CSS and failing.
- **Fix:** Checks compare against `content.toUpperCase()` when scanning built assets.
- **Files modified:** `scripts/verify/checks.mjs`
- **Committed in:** `dccaffa`

**3. [Rule 3 - Blocking] Astro content-layer cache cleared before every mutation round-trip**
- **Found during:** Task 3
- **Issue:** `node_modules/.astro/data-store.json` persisted a stale entry across the `skeleton-e2e` check's deliberate-mutation builds, so a reverted file's rebuild could still throw the *previous* mutation's error.
- **Fix:** Added `clearAstroCache()`, called before every mutation/rebuild pair in `skeleton-e2e`.
- **Files modified:** `scripts/verify/checks.mjs`
- **Committed in:** `dccaffa`

**4. [Rule 1 - Bug] A prose comment in `Layout.astro`/`BrandMark.astro` inadvertently spelled out literal strings the phase's own checks negative-grep for**
- **Found during:** Task 4, while writing the `brand-assets` check
- **Issue:** Explanatory comments used the literal phrase `FROM RENT TO ROOTS` (the wordmark-not-re-typeset check greps for this exact string) and the literal text `<img>` (which, because Astro preserves HTML comments in build output, caused the built page's own `<img>` alt/aria-hidden scan to false-positive on prose inside a comment rather than a real image element).
- **Fix:** Reworded both comments to describe the concepts without the literal strings; also hardened the `brand-assets` check itself to strip HTML comments before scanning for `<img>` tags, so prose in future comments can't cause the same false positive.
- **Files modified:** `src/components/BrandMark.astro`, `src/layouts/Layout.astro`, `scripts/verify/checks.mjs`
- **Committed in:** `cce30ed`, `ff8779b`

---

**Total deviations:** 4 auto-fixed (3 carried forward from Task 3's own summary note, 1 new in Task 4)
**Impact on plan:** All four are correctness fixes with no scope creep — a missing import, a check assertion made robust to a known minifier behavior, a cache-staleness fix in the verification tooling itself, and a self-inflicted false-positive in a check this same task added.

## Issues Encountered

- **Cross-session continuity.** This plan was executed across three separate executor sessions: one completed Task 1 (owner-approved gate) and started Task 2/3; that session was terminated mid-Task-3 by an API error, and the orchestrator committed its completed files (`1979072`) to avoid losing the work; a second executor finished Task 3 (`dccaffa`); this (third) executor picked up at Task 4 with Tasks 1–3 already complete and committed, per the `<continuation_state>` handoff. No rework was needed — verified by re-running `scaffold-clean` and `skeleton-e2e`, both still passing, before starting Task 4.
- **Fresh worktree had no `node_modules/`.** `node_modules/` is gitignored (correctly) and worktrees don't share it, so `npm install` had to be re-run in this worktree before `sharp` (needed for the brand-asset export script) was available. Not a deviation — expected worktree behavior, just noted for anyone re-running this plan.
- **Astro's scoped-style + child-component-class interaction.** `Layout.astro` and `[slug].astro` pass a `class` prop (`footer-mark`, `placeholder-mark`) into `BrandMark.astro`, but that class lands on an element inside BrandMark's own template, which carries BrandMark's own Astro scope hash — not the parent's. A plain scoped `.footer-mark { }` rule in the parent's `<style>` block would silently never match. Fixed by wrapping both rules in `:global(...)`, the standard Astro pattern for styling into a child component's output. Not a deviation from the plan (the plan didn't specify layout for these classes) but worth flagging for future components that take a `class` prop.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Walking Skeleton stands: `npm run build` exits 0, `/homes/614-e-marengo-st` renders real content, and all three verification checks (`scaffold-clean`, `skeleton-e2e`, `brand-assets`) pass.
- SKELETON.md's "Stack Touched in Phase 1" checkboxes this plan satisfies: **Project scaffold** (fully — Astro 7.2.x, Tailwind v4, self-hosted fonts, `@astrojs/sitemap`, clean build+preview), **Routing** (the real dynamic `/homes/[slug]` route; the 7 static nav destinations exist as links but most of their target pages are built in later plans — expected, per SKELETON.md's own note that the nav ships complete as a layout concern), **Data layer** (real read via `getCollection`/`getEntry`; real write is the git-committed markdown/JSON content file). **UI** (interactive gallery lightbox) is explicitly out of scope here — arrives in plan 01-03. **Deployment** (hosted URL) is explicitly Phase 2 (INFRA-03); the local `npm run build && npm run preview` path works.
- Plan 01-03 can proceed: it inherits a finalized `properties` schema (including the `photos` default-empty contract it needs for its own zero-photo proof), a working `BrandMark` component it can reuse for its gallery/lightbox work, and a `[slug].astro` route with the placeholder frame already wired to the mark it will replace with real photos.
- No blockers.

---
*Phase: 01-foundation*
*Completed: 2026-08-31*

## Self-Check: PASSED

All files claimed above (public/brand/ exports, BrandMark.astro, build-brand-assets.mjs,
content.config.ts, Layout.astro, [slug].astro, this SUMMARY.md) confirmed present on disk. All
six task commit hashes (56e84f8, 1979072, dccaffa, 09e9313, cce30ed, ff8779b) confirmed present
in git history via `git log --oneline --grep="01-02"`. `node scripts/verify/checks.mjs
scaffold-clean`, `... skeleton-e2e`, and `... brand-assets` all exit 0. `npm run build` exits 0.
