---
phase: 01-foundation
plan: 05
subsystem: ui
tags: [astro, accessibility, wcag, a11y, tailwind-v4, static-site]

# Dependency graph
requires:
  - phase: 01-foundation (plans 01-01..01-04)
    provides: the complete seven-page Astro site, both real homes, the brand token system, and the shell-independent verify CLI
provides:
  - Site-wide WCAG 2.1 AA-basics sweep (alt text, contrast, keyboard operability, landmarks, skip link)
  - Accessible mobile nav drawer (real button, focus trap, Escape, focus return) replacing the checkbox+label hack
  - a11y-sweep and phase-complete verification checks
  - README.md handing off to Phase 2
  - Phase 1 completion evidence (all five ROADMAP success criteria confirmed as a set)
affects: [phase-02-publishing]

# Actuals (#2632)
actuals:
  tokens: 10338
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side islands use a real interactive element (<button>) plus a small inline <script> implementing trap-Tab/Escape/return-focus, never a checkbox+label CSS-only hack -- the latter is invisible to Tab in a way that looks fine visually but fails keyboard operability."
    - "Verification checks that assert exact DOM shape (script counts, element counts) must be re-run and updated whenever a component's architecture changes, even if the change is a pure accessibility fix with no visible behavior difference."

key-files:
  created:
    - README.md
  modified:
    - src/layouts/Layout.astro
    - src/components/Nav.astro
    - src/components/StepList.astro
    - src/pages/about.astro
    - src/pages/contact.astro
    - src/pages/how-it-works.astro
    - src/pages/learn/index.astro
    - src/pages/schedule.astro
    - scripts/verify/checks.mjs

key-decisions:
  - "Converted the mobile nav drawer from a checkbox+label CSS toggle to a real <button> with a focus-trap/Escape/return-focus script, matching the lightbox's existing contract -- the checkbox hack was invisible to Tab-only navigation despite looking correct visually."
  - "Fixed accent-as-text on how-it-works.astro's phone callout (was #FFD053 at 700 weight/26px) rather than accepting it as a pre-existing pattern, because the plan's acceptance criteria explicitly forbid the accent as a text color anywhere in the built site, not just on cream."
  - "Brought five pages' .lead paragraphs and two components' one-off font sizes (19px, 18px, 12px) back onto the declared 4-size/2-weight type scale by choosing the nearest existing role (mostly Body/16px) rather than adding a fifth size, per the plan's explicit instruction to change layout/spacing instead of the token set."
  - "Left three pre-existing off-token colors on the how-it-works.astro dark CTA panel (#fff, #e7e2d6, #a49e91) unchanged -- all pass AA contrast by a wide margin (13:1-17:1) and are a token-hygiene nit, not an accessibility failure; fixing them was out of this sweep's scope."
  - "phase-complete's remote-main-matches-HEAD assertion is written to the plan's literal contract rather than weakened or removed, even though it is known to fail in this run -- the push is a deferred owner action (see below), and a human re-running the check after pushing needs an honest pass/fail signal."

requirements-completed: [DESIGN-04, DESIGN-05, INFRA-02]

coverage:
  - id: D1
    description: "Site-wide accessibility sweep: alt text, contrast, keyboard operability, landmarks, skip link, encoding survival, and status-as-text across all ten built pages"
    requirement: "DESIGN-04"
    verification:
      - kind: automated_ui
        ref: "node scripts/verify/checks.mjs a11y-sweep"
        status: pass
    human_judgment: true
    rationale: "This is a headless executor session -- horizontal-scroll behavior at 320/375/768/1280px, measured 44px hit areas in devtools, and an actual keyboard walk-through cannot be verified without a browser. The automated check proves everything structurally checkable from built HTML/CSS; the remaining items are listed under Deferred Verification below and need a human with a browser."
  - id: D2
    description: "Mobile nav drawer rebuilt as an accessible island: real button, aria-expanded/aria-controls, Tab trap, Escape closes, focus returns to the toggle"
    requirement: "DESIGN-04"
    verification:
      - kind: unit
        ref: "node scripts/verify/checks.mjs a11y-sweep (skip-link + landmark structural assertions)"
        status: pass
    human_judgment: true
    rationale: "The trap/Escape/focus-return keyboard contract is implemented per the same pattern as the already-shipped gallery lightbox, but actually operating it with a real keyboard (not simulated) is a human verification step -- see Deferred Verification."
  - id: D3
    description: "Phase 1 completion gate: all ten routes + sitemap emit, ROADMAP criterion 3 confirmed as a complete four-literal set, retired-phrasing/superseded-color sweeps, every internal link resolves, README present and complete, working tree clean"
    requirement: "INFRA-02"
    verification:
      - kind: automated_ui
        ref: "node scripts/verify/checks.mjs phase-complete"
        status: fail
    human_judgment: true
    rationale: "phase-complete fails on exactly one assertion (remote main SHA == local HEAD) because the push is a deferred owner action this executor is not permitted to perform (see Deferred to the Owner below). Every other assertion in the check passes. A human must run the push, then re-run this check to get a genuine full pass."

duration: ~50min
completed: 2026-08-31
status: complete
---

# Phase 1 Plan 5: Site-Wide Accessibility Sweep and Phase Completion Summary

**Converted the checkbox-only mobile nav drawer to a real keyboard-trappable button island, fixed five type-scale/accent-as-text violations across the site, added the `a11y-sweep` and `phase-complete` verify checks, wrote the handoff README, and confirmed all five ROADMAP Phase 1 success criteria as a set — with the push itself deferred to the owner.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-31T22:49:00Z
- **Tasks:** 2 (Task 1: accessibility/responsive sweep; Task 2: phase-level proof + README)
- **Files modified:** 9 (1 created: README.md)

## Accomplishments

- Site-wide WCAG 2.1 AA-basics sweep: every image has alt text (with Astro's bare-`alt` empty-string rendering correctly recognized as a deliberate empty alt paired with `aria-hidden`), every page declares `lang="en"` and `utf-8`, every page has exactly one `<h1>` and `<main>`/`<nav>`/`<footer>` landmarks, and a skip-to-content link is now the first focusable element on every page.
- Rebuilt the mobile nav drawer around a real `<button>` (`aria-expanded`, `aria-controls`) driven by a small script that traps Tab among the toggle plus the 7 links, closes on Escape, and returns focus to the toggle — the same contract the gallery lightbox already implemented. The prior checkbox+label CSS toggle was invisible to keyboard-only Tab navigation in a way that was not visually obvious.
- Fixed a real accent-as-text violation and three type-scale drifts (26px/700 weight callout, 19px lead paragraphs on five pages, 18px step-number and checkmark glyphs, 12px legal note) discovered during the sweep — all now within the declared 4-size/2-weight scale, with contrast independently verified for every badge/button/price-figure combination (all were already passing, 8.8:1 to 17.9:1).
- Added `a11y-sweep` (Task 1's check) and `phase-complete` (Task 2's check) to `scripts/verify/checks.mjs`, following the file's existing Node-only, mutate-build-assert-revert conventions.
- Confirmed all five ROADMAP Phase 1 success criteria as a set (see below), with `npm run build` exiting 0 and all ten routes plus the sitemap emitting.
- Wrote `README.md` covering local commands, the three content collections, the ~2000px photo convention, how to add a home, and the three Phase 2/3 extension points.

## Task Commits

Each task was committed atomically:

1. **Task 1: Site-wide accessibility and responsive sweep** — `a1f1927` (fix) — component/page fixes
2. **Task 1: verification check** — `18ed928` (test) — adds `a11y-sweep` and `phase-complete` to checks.mjs
3. **Task 2: README** — `98a6361` (docs)
4. **Bugfix found while re-running the full check suite** — `4730f15` (fix) — `property-page`'s stale script-count assertion

_No further plan-metadata commit was requested by the orchestrator's instructions for this executor — STATE.md/ROADMAP.md updates are the orchestrator's responsibility._

## Files Created/Modified

- `README.md` — new: local commands, content model, photo convention, extension points, explicit Phase 2/3 deferral statement
- `src/layouts/Layout.astro` — skip link, `id="main-content"`/`tabindex="-1"` on `<main>`, global `:focus-visible` ring for header/footer links
- `src/components/Nav.astro` — checkbox+label drawer replaced with a real button + focus-trap script
- `src/components/StepList.astro` — step-number glyph 18px → 16px (type-scale compliance)
- `src/pages/about.astro`, `src/pages/contact.astro`, `src/pages/how-it-works.astro`, `src/pages/learn/index.astro`, `src/pages/schedule.astro` — `.lead` paragraph 19px → 16px; how-it-works.astro additionally fixes the accent-as-text/700-weight/26px phone callout, the 12px legal note, and the 1.7:1-contrast checkmark glyph
- `scripts/verify/checks.mjs` — adds `a11y-sweep`, `phase-complete`; fixes `property-page`'s stale "exactly 1 script tag" assertion (now 2, matching the corrected two-island architecture)

## Decisions Made

See `key-decisions` in frontmatter above. In summary: fixed accessibility/type-scale defects at the token/component level rather than patching individual pages; kept `phase-complete`'s literal push-dependent assertion rather than weakening it, since the failure is expected and documented, not a real defect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mobile nav drawer was not keyboard-operable in a way its own visual design implied**
- **Found during:** Task 1
- **Issue:** The drawer toggle was a `<label>` associated with a visually-hidden `<input type="checkbox">`. The checkbox itself is natively focusable and the label describes it via `for`, but a keyboard user's visible focus ring would land on the invisible, `opacity:0` checkbox rather than the visible hamburger icon, and there was no Escape-to-close or focus-trap/return behavior at all — the drawer, once open, let Tab wander into the page behind it.
- **Fix:** Replaced the checkbox+label pair with a real `<button>` (`aria-expanded`, `aria-controls`) driven by a script implementing the same trap-Tab/Escape/return-focus contract the gallery lightbox already had.
- **Files modified:** `src/components/Nav.astro`
- **Verification:** `node scripts/verify/checks.mjs a11y-sweep` (skip-link/landmark assertions); code-level review against `gallery-lightbox.ts`'s existing, working pattern. Actual keyboard operation is deferred (see below) — no browser available in this session.
- **Committed in:** `a1f1927`

**2. [Rule 1 - Bug] Accent color used as text, violating the plan's explicit "fill only" rule**
- **Found during:** Task 1
- **Issue:** `how-it-works.astro`'s `.contact-line` set `color: var(--color-accent)` at `font-weight: 700` and `font-size: 26px` — three violations at once (accent-as-text is explicitly forbidden regardless of contrast; 700 is not an allowed weight; 26px is not one of the four declared sizes).
- **Fix:** Changed to `color: var(--color-cream)` at the in-scale `24px/600` (Heading role). Contrast against the ink CTA background is 17.1:1, comfortably above the 3:1 needed at that size.
- **Files modified:** `src/pages/how-it-works.astro`
- **Verification:** `node scripts/verify/checks.mjs a11y-sweep` (accent-never-text regex scan of both built CSS and every source `.astro` file)
- **Committed in:** `a1f1927`

**3. [Rule 1 - Bug] Five pages' `.lead` paragraphs and two glyph sizes drifted off the declared type scale**
- **Found during:** Task 1
- **Issue:** `about.astro`, `contact.astro`, `how-it-works.astro`, `learn/index.astro`, and `schedule.astro` all used an identical `.lead { font-size: 19px }` rule; `StepList.astro`'s step-number circle used `18px`; `how-it-works.astro`'s `.legal-note` used `12px`. UI-SPEC declares exactly 4 sizes (14/16/24/36) and instructs changing layout/spacing instead of introducing a fifth.
- **Fix:** `.lead` and the step-number glyph moved to `16px` (Body); `.legal-note` moved to `14px` (Label). The decorative checkmark glyph (`.need li::before`) was left at its existing `18px` since icon glyphs are not literally "text" under the type-scale's Body/Label/Heading/Display roles, but its color was fixed for a separate reason below.
- **Files modified:** `src/pages/about.astro`, `src/pages/contact.astro`, `src/pages/how-it-works.astro`, `src/pages/learn/index.astro`, `src/pages/schedule.astro`, `src/components/StepList.astro`
- **Verification:** `grep` sweep of `src/**/*.astro` for `font-size:` values outside `{14px,16px,24px,36px}` returned no remaining hits in prose text roles after the fix.
- **Committed in:** `a1f1927`

**4. [Rule 1 - Bug] Decorative checkmark glyph failed the 3:1 non-text-contrast minimum**
- **Found during:** Task 1
- **Issue:** `how-it-works.astro`'s `.need li::before` checkmark used `var(--color-accent-hover)` (`#EDB52F`) against the cream-deep panel background — measured 1.7:1, below the WCAG 1.4.11 minimum of 3:1 for a meaningful graphic.
- **Fix:** Changed to `var(--color-ink)`, which measures 15.9:1 against the same background.
- **Files modified:** `src/pages/how-it-works.astro`
- **Verification:** Contrast computed programmatically via the WCAG relative-luminance formula (scratch script, not committed).
- **Committed in:** `a1f1927`

**5. [Rule 1 - Bug] `property-page`'s check asserted a stale script-tag count**
- **Found during:** re-running the full existing check suite after Task 1's sweep (not caught by this plan's own new checks)
- **Issue:** `property-page` asserted exactly 1 `<script>` tag per property page, with a comment stating "the nav drawer toggle is pure CSS." That was true before this plan's Task 1; after converting the drawer to a real button+script island, every page renders the Nav script and property pages additionally render the Gallery script, so the correct count is 2.
- **Fix:** Updated the assertion and its comment to expect 2, citing SKELETON.md's own "two client-side islands" language (which the old checkbox-only implementation was itself quietly out of step with).
- **Files modified:** `scripts/verify/checks.mjs`
- **Verification:** `node scripts/verify/checks.mjs property-page` passes; full suite (`sources-staged`, `scaffold-clean`, `skeleton-e2e`, `brand-assets`, `photos-resized`, `homes-grid`, `property-page`, `content-pages`, `learn-section`, `a11y-sweep`) re-run and all pass.
- **Committed in:** `4730f15`

---

**Total deviations:** 5 auto-fixed (all Rule 1 — bug fixes discovered during the cross-cutting sweep this plan exists to perform)
**Impact on plan:** All five were pre-existing defects from earlier plans that only became visible once the whole site was swept together, which is exactly this plan's stated purpose. No scope creep — no page content, copy, or architecture changed beyond what was needed to fix these specific issues.

## Issues Encountered

`node_modules/` was not present at the start of this session (fresh worktree) and required `npm install` before any build or check could run. Not a plan issue — routine worktree setup.

## Deferred Verification (requires a human with a browser — this was a headless session)

Per the plan's own `<verify><human-check>` and the two UI-SPEC backstop items this plan's `<output>` asks to be recorded:

1. **No horizontal scroll at 320px/375px/768px/1280px.** Structurally, every layout uses `minmax(280px, 1fr)` grids, `max-width` prose containers, and `word-wrap: break-word` on the card address — no fixed-width element wider than the viewport was found by source review — but this has not been rendered in a browser at any of the four widths.
2. **44px minimum hit area for the phone CTA, nav hamburger, lightbox arrows, and Inquire button, measured at 320px.** Structural evidence: `.header-phone` (`min-height: 44px`), `.nav-hamburger` (`width/height: 44px`), `.lightbox-prev`/`.lightbox-next`/`.lightbox-close` (`min-width/min-height: 44px`), and `.btn` (`min-height: 44px`, used by the Inquire button) all declare the 44px minimum in CSS. Not measured in devtools at 320px.
3. **Exactly one phone CTA visible at any given width, swept across the 768px boundary.** Structural evidence: `.header-phone` in `Layout.astro` is unconditional (no media query hides or duplicates it at any breakpoint), and no other "persistent mobile phone element" exists anywhere in the codebase — `contact.astro`'s and `schedule.astro`'s `.phone-line` are ordinary page-body content on those two pages specifically, not a floating/persistent element that could collide with the header CTA. Not visually swept across 768px in a browser.
4. **All 7 nav labels fit on one line at exactly 768px without wrapping.** Not measured; this is the UI-SPEC's own pre-existing backstop item for surface E4 and was not newly introduced by this plan.
5. **Actual keyboard walk-through of `/homes/614-e-marengo-st`** — skip link first, Tab order matches visual order, focus indicators visible throughout, lightbox and drawer both trap focus and return it on Escape. The code implements this contract (and the drawer's implementation was fixed in this plan specifically because it didn't), but it has not been operated with a real keyboard in a real browser.

None of the above could be verified with the tools available in this headless executor session (no browser, no devtools). They are recorded here per the environment's own instruction to defer genuinely visual verification rather than claim it as passing.

## Reproducibility Observation

Two consecutive `npm run build` runs (inside `phase-complete`) produced **byte-identical `dist/` HTML for all 10 files**. No non-determinism observed. (Informational only, per this plan's `<review_response>` — not a gate; the sort-stability assertion this used to stand in for is gated in 01-03 Task 2 against the card-identifier sequence.)

## ROADMAP Phase 1 Success Criteria — Confirmed as a Set

1. **Private repo holds the site source as the single source of truth.** Confirmed by `sources-staged` (PASS) and `remote-private`/`phase-complete`'s remote checks, which succeed on every assertion except the one requiring a completed push (see Deferred to the Owner).
2. **Homepage → Homes grid → either real home's `/homes/<slug>` page**, with cover photo/address/status badge/down payment/monthly payment on cards and gallery/terms/specs/description on property pages. Confirmed by `homes-grid` and `property-page` (both PASS) and `phase-complete`'s route-emission assertion (all ten routes present).
3. **Branding, phone, Equal Housing footer, and integrations slot on every page — checked as a complete four-literal set.** Confirmed by `phase-complete`: all 10 built pages carry the exact Equal Housing sentence once, the display phone `(217) 269-0003`, the tagline `Oak Homes — From Rent to Roots` as the header brand mark's accessible name, and the integrations-slot marker exactly once. (Note: criterion 3's own wording still names the superseded design-spec yellow `#F6C84C`; the owner-approved replacement `#FFD053` is what's actually shipped and asserted, per UI-SPEC's documented color supersession from plan 01-02 — this is a pre-existing, already-resolved documentation lag in ROADMAP.md itself, not a defect in this plan.)
4. **How It Works/FAQ, About, Learn, Schedule reachable from nav, phone-width-correct, WCAG 2.1 AA basics.** Confirmed by `content-pages`, `learn-section`, and this plan's own `a11y-sweep` (all PASS) — alt text, contrast, keyboard-navigable menus (drawer rebuilt this plan), landmarks, and skip link all verified structurally.
5. **Adding a home requires only a markdown file + photos; malformed content fails the build loudly.** Confirmed by `skeleton-e2e`'s schema-validation-fires assertions (unchanged this plan, still passing) and this plan's README, which documents the exact procedure.

## Deferred to the Owner

**The push itself.** Per this plan's explicit scope boundary, the executor session cannot run `git push` — that permission is denied to executor sessions by design, and pushes in this project are performed manually by the repository owner.

Everything up to the push is done: the working tree is clean, all four of this plan's commits are on the current branch, and `npm run build` exits 0. Two checks fail for the identical, expected, single reason — local HEAD is ahead of `origin/main` — and both document this in their failure message:

- `node scripts/verify/checks.mjs remote-private` → `FAIL ... remote main SHA (...) does not equal this worktree's HEAD (...)`
- `node scripts/verify/checks.mjs phase-complete` → same shape of failure, on its own remote-SHA assertion; every other assertion in `phase-complete` passes.

**The owner should run**, from this worktree, once the phase's work is otherwise approved:

```
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push origin "$BRANCH"
```

(If the branch this executor worked on should land on `origin/main` directly rather than as a feature branch, replace `"$BRANCH"` with `HEAD:main`, or push normally and let the orchestrator's own merge step handle it — this executor does not know which convention this run's orchestrator uses.)

After pushing, re-run `node scripts/verify/checks.mjs remote-private` and `node scripts/verify/checks.mjs phase-complete` — both should report `PASS` with no further action, completing Phase 1's INFRA-02 success criterion (remote main matches local HEAD on a repository confirmed Private).

## Known Stubs

None introduced by this plan. This plan only touched accessibility/type-scale correctness, verification tooling, and documentation — no new UI surfaces or data paths were added.

## Threat Flags

None. This plan's `<threat_model>` register (T-01-26 through T-01-31) is fully covered by existing mitigations; no new network endpoint, auth path, file-access pattern, or schema change was introduced.

## User Setup Required

None — no external service configuration required. (The push above is a git operation on an already-configured private remote, not an external-service setup step.)

## Next Phase Readiness

Phase 1 (Foundation) is functionally complete pending the owner's push. Phase 2 (Publishing) can begin planning against:
- The finalized `properties`/`blog`/`settings` schema in `src/content.config.ts` (unchanged by this plan)
- The three named extension points in README.md: the site-wide integrations slot, the Zoho embed slot on `/contact`, and the `location`/`videoUrl`/`ogImage` schema fields
- A site that already passes WCAG 2.1 AA basics, so Phase 2's admin-panel UI has an accessible baseline to extend rather than retrofit

No blockers for Phase 2 planning. The only open item is the deferred push, which does not block planning work (it blocks only the literal "remote main matches HEAD" success-criterion check).

## Self-Check: PASSED

- FOUND: `README.md`
- FOUND: `src/layouts/Layout.astro` (skip-link + main id/tabindex present)
- FOUND: `src/components/Nav.astro` (button + script present)
- FOUND: `scripts/verify/checks.mjs` (`a11y-sweep`, `phase-complete` present; `property-page` fix present)
- FOUND commit `a1f1927` (fix: site-wide sweep)
- FOUND commit `18ed928` (test: a11y-sweep + phase-complete checks)
- FOUND commit `98a6361` (docs: README)
- FOUND commit `4730f15` (fix: property-page script-count assertion)
- `git status --short` — clean at time of this SUMMARY's authoring (verified immediately before writing this file)
- `npm run build` exits 0 (last verified during `phase-complete`'s run)
- All 10 pre-existing checks re-run and pass: `sources-staged`, `scaffold-clean`, `skeleton-e2e`, `brand-assets`, `photos-resized`, `homes-grid`, `property-page`, `content-pages`, `learn-section`
- This plan's 2 new checks: `a11y-sweep` PASS, `phase-complete` FAILS only on the expected, documented remote-SHA assertion
- 1 pre-existing check expected-fails for the identical reason: `remote-private`

---
*Phase: 01-foundation*
*Completed: 2026-08-31*
