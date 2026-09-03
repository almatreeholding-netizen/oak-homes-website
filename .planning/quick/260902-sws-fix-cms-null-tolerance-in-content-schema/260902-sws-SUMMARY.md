---
phase: quick-260902-sws
plan: 01
subsystem: content-schema
tags: [astro, zod, content-collections, sveltia-cms, hotfix]

requires:
  - phase: quick-260901-t59
    provides: public/uploads/hero/home-hero.jpg and the hero-contrast check, unaffected by this fix
provides:
  - "cmsOptional() helper in src/content.config.ts that normalizes CMS-blank values (null/'') to undefined before Zod validation runs"
  - "the eight optional content fields (properties beds/baths/sqft/videoUrl/location/ogImage, blog coverImage, settings social.facebook) now tolerate null, '', and absent interchangeably"
  - "cms-null-tolerance regression check in scripts/verify/checks.mjs, proving both directions (optional tolerance and required-field strictness) via a static audit plus six real builds"
affects: [02-publishing, 02-02-cms-collections-complete]

actuals:
  tokens: 8780
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "cmsOptional(inner) = z.preprocess(v => (v === null || v === '') ? undefined : v, inner.optional()) — the standard shape for any future CMS-writable optional field in this schema"

key-files:
  created:
    - .planning/quick/260902-sws-fix-cms-null-tolerance-in-content-schema/reproduce.log
  modified:
    - src/content.config.ts
    - scripts/verify/checks.mjs
    - .planning/WINDOWS.md

key-decisions:
  - "Used z.preprocess (not .nullish()) because normalization must run BEFORE the inner validator — .nullish() still hands '' to .url() and null straight through to a nested object, which would not have fixed the bug"
  - "Scoped cmsOptional to exactly the 8 pre-existing optional fields; left all required/defaulted fields and the status enum untouched"
  - "Corrected the plan's badge-count verification method: Astro emits a component's full scoped <style> block (all three status-badge variants) into every page regardless of which variant is actually used, so a raw substring count of 'status-available'/'status-pending' is a false positive against CSS selector text. Asserted against actual rendered <span class=\"status-badge ...\"> elements instead."

requirements-completed: [HOTFIX-CMS-NULL]

coverage:
  - id: D1
    description: "cmsOptional() helper added and applied to all 8 optional content fields; required fields untouched"
    requirement: HOTFIX-CMS-NULL
    verification:
      - kind: integration
        ref: "sandbox build: cd /c/tmp/oak-null-260902 && rm -rf node_modules/.astro && npm run build (exit 0, post-fix, same sandbox that reproduced the failure pre-fix)"
        status: pass
    human_judgment: false
  - id: D2
    description: "cms-null-tolerance regression check registered, passing, and proven non-vacuous in both directions (fails naming 'sqft' when unwrapped, fails naming 'nickname' when an unclassified field is added)"
    requirement: HOTFIX-CMS-NULL
    verification:
      - kind: integration
        ref: "node scripts/verify/checks.mjs cms-null-tolerance"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fix merged and pushed to origin/main so Netlify redeploys and the live site stops showing stale Available badges on two sold homes"
    verification: []
    human_judgment: true
    rationale: "Merging/pushing to main is an explicit developer decision this plan is instructed not to take silently (plan <verification> step 5); requires human action via /gsd-ship or an explicit merge."

duration: 24min
completed: 2026-09-03
status: complete
---

# Quick Task 260902-sws: Fix CMS Null Tolerance in Content Schema Summary

**Added a `cmsOptional()` Zod preprocess helper so Sveltia CMS's blank-field serialization (`null` for numbers, `""` for text) survives schema validation, restoring the broken Netlify build — proven red-then-green in a clean sandbox and locked in by a new `cms-null-tolerance` regression gate.**

## Performance

- **Duration:** ~24 min (first sandbox archive 21:08 → final Task 3 commit 21:23, plus verification/logging after)
- **Started:** 2026-09-02T21:08:03Z (first sandbox build attempt)
- **Completed:** 2026-09-03T01:23Z (Task 3 commit + WINDOWS.md logging)
- **Tasks:** 3/3
- **Files modified:** 3 (`src/content.config.ts`, `scripts/verify/checks.mjs`, `.planning/WINDOWS.md`) + 1 created (`reproduce.log`)

## Accomplishments

- Reproduced the exact production build failure in a clean, throwaway sandbox against the real CMS-committed content (HEAD `45da85e`), before touching any source — proving the schema, not the environment, was the cause.
- Added `cmsOptional()`: a `z.preprocess`-based helper that normalizes `null`/`""` to `undefined` before Zod's inner validator runs, applied to exactly the 8 fields the schema already declared optional.
- Proved green in the same sandbox: the identical build that failed pre-fix now exits 0, both real homes render a single `Sold` badge each, and every blank spec renders `Call for details`.
- Added `cms-null-tolerance` to `scripts/verify/checks.mjs`: a static schema-partition audit (Layer A) plus six real mutate-build-assert-revert round trips against the actual content files (Layer B), proving both directions — optional fields tolerate null/empty/absent, required fields still reject them by name.
- Ran the full verification suite (14 checks total) and classified every result; found and logged 7 previously-unrecorded pre-existing failures (bucket b) unrelated to this fix, confirmed against a pre-CMS-commit baseline build.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reproduce the failing build against the real null-bearing content** — `42e4bcd` (docs)
2. **Task 2: Add cmsOptional() and apply it to the eight optional fields — prove green** — `ea4ae07` (fix)
3. **Task 3: Add the cms-null-tolerance regression gate and report the full suite** — `87f2264` (test)

**Plan metadata:** not yet committed — per this execution's explicit orchestrator instructions, SUMMARY.md/STATE.md/PLAN.md are left for the orchestrator's own docs commit. `.planning/STATE.md` currently has uncommitted edits (Pending Todo + Blockers notes) awaiting that commit; `.planning/WINDOWS.md` was committed as part of Task 3 (it is not one of the three excluded docs files).

## Files Created/Modified

- `.planning/quick/260902-sws-fix-cms-null-tolerance-in-content-schema/reproduce.log` — verbatim captured build failure (Task 1 evidence)
- `src/content.config.ts` — added `cmsOptional()` helper; applied to `beds`, `baths`, `sqft`, `videoUrl`, `location`, `ogImage` (properties), `coverImage` (blog), `social.facebook` (settings)
- `scripts/verify/checks.mjs` — added the `cms-null-tolerance` check (Layer A static audit + Layer B six-build round trip)
- `.planning/WINDOWS.md` — 7 new deviation entries (ids 2-8) for pre-existing, out-of-scope check failures discovered while running the full suite

## Decisions Made

- **`z.preprocess`, not `.nullish()`:** normalization must run before the inner validator. `.nullish()` still hands `''` to `.url()` (fails) and `null` straight through to a nested object schema (fails) — it would not have fixed the actual bug.
- **`undefined` is the sole normalization target:** every consuming template (`PropertyCard.astro`, `[slug].astro`, `learn/*.astro`, `Layout.astro`) already guards on `undefined`/truthiness, so no `.astro` file needed to change.
- **Scope held at exactly 8 fields:** no required field, defaulted field, or the `status` enum was touched — verified via grep against `cms-null-tolerance`'s hardcoded partition and via `git diff --name-only`.
- **Widened `social.facebook` here, not in 02-02:** 02-02-PLAN.md Task 2 already planned this exact widening; delivering it now via the shared `cmsOptional()` helper satisfies that intent without creating a second, divergent implementation. Recorded as a Pending Todo in `.planning/STATE.md` so 02-02's executor reuses the helper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in verification method] Corrected the badge-count assertion in Task 2's `<verify>` block**
- **Found during:** Task 2 (proving green)
- **Issue:** The plan's own verify one-liner counts raw substring occurrences of `status-available`/`status-pending` in `dist/homes/index.html`. Astro's scoped-CSS output for `StatusBadge.astro` emits the component's *entire* `<style>` block — including the `.status-available { ... }` and `.status-pending { ... }` CSS selector rules — into every page that uses the component, regardless of which status variant is actually rendered. A raw substring count therefore returns 1 for each, even though zero `<span>` elements carry those classes.
- **Fix:** Verified the true behavior with an element-scoped assertion (`<span class="status-badge ...">` extraction) instead of a raw substring count. Confirmed: 2 rendered spans, both `status-badge status-sold`, zero spans with `status-available` or `status-pending`. The functional fix in `src/content.config.ts` was correct throughout; only the verification method needed correction.
- **Files modified:** none (verification-only; no source change)
- **Verification:** `node -e` script parsing `<span class="...status-badge...">` elements — see raw output below.
- **Committed in:** n/a (verification step, not a code change)

**2. [Rule 1 - Discovered discrepancy] Actual Zod/Astro error wording differs from `<planning_evidence>`'s prediction**
- **Found during:** Task 1 (reproduction)
- **Issue:** `<planning_evidence>` predicted raw Zod 4 phrasing `Invalid input: expected number, received null`. The actual build failure — because Astro's content-layer wraps the Zod error in its own `InvalidContentEntryDataError` formatter — reads `Expected type "number", received "object"` (since `typeof null === 'object'` in JS). The literal word "null" never appears in the real error text; the plan's own verify grep (`grep -qi null reproduce.out`) passes only by coincidence, because the throwaway sandbox directory `oak-null-260902` contains the substring "null" in every file path in the stack trace.
- **Fix:** None needed — the reproduction is still valid (build fails, non-zero exit, names the `sqft`/`beds`/`baths` fields, references the real content file). Documented the actual wording here per the plan's own instruction to let a measured, contradicting observation override the planning evidence.
- **Files modified:** none
- **Verification:** `grep -in null reproduce.log` shows the only matches are in file-path segments, not in the reported value.
- **Committed in:** n/a (documentation only)

**3. [Rule 2 - Constraint from orchestrator] Excluded `.planning/STATE.md` from Task 3's commit**
- **Found during:** Task 3 (commit step)
- **Issue:** The plan's own Task 3 `<action>` instructs `git add scripts/verify/checks.mjs .planning/STATE.md .planning/WINDOWS.md`. This specific execution's orchestrator instructions explicitly state: "Do NOT commit docs artifacts (SUMMARY.md, STATE.md, PLAN.md) — the orchestrator handles the docs commit." The orchestrator constraint takes precedence for this run.
- **Fix:** Edited `.planning/STATE.md` with the required Pending Todo and Blockers content (satisfying the plan's acceptance criteria that the content exists), but committed only `scripts/verify/checks.mjs` and `.planning/WINDOWS.md` in Task 3 — `.planning/WINDOWS.md` is not in the orchestrator's three-file exclusion list, so it was committed normally. `.planning/STATE.md` remains modified-but-uncommitted, ready for the orchestrator's docs commit.
- **Files modified:** `.planning/STATE.md` (content only, not part of Task 3's commit)
- **Verification:** `git status --porcelain` shows `.planning/STATE.md` as modified after Task 3's commit; `git show 87f2264 --stat` confirms it is not in that commit.
- **Committed in:** n/a — awaiting orchestrator's docs commit

**4. [Rule 1 - Discovered additional pre-existing failures beyond the plan's prediction] `photos-resized`, `property-page`, and `content-pages` fail for reasons the plan did not name**
- **Found during:** Task 3 (full-suite run)
- **Issue:** The plan predicted bucket-(b) failures for `a11y-sweep`, `skeleton-e2e`, `homes-grid`, `property-page`, `content-pages`, `learn-section`, and `phase-complete` (quoted-literal/Sold-status causes) but did not anticipate `photos-resized` failing at all. Investigation found `photos-resized` asserts Brown Street's `sqft` KEY is entirely absent from frontmatter — but Sveltia (CMS commit `45da85e`) writes `sqft: null` explicitly rather than omitting the key, which the check's `/^sqft:/m` test cannot distinguish from a real value. `property-page`/`content-pages` do fail as predicted, but for the specific, confirmed cause of `canInquire = status === 'Available' || status === 'Pending'` (D-09) being false for both real homes now that both are genuinely Sold — not a quoted-literal issue on those two checks specifically.
- **Fix:** None — out of scope per the plan's explicit "do NOT repair any of these checks" instruction. Confirmed each cause precisely (not guessed) by running the same checks against a fresh sandbox at baseline commit `b796b7d` (the last commit before the CMS wrote real content), where all of them PASS. Logged all 7 as new WINDOWS.md deviations (ids 2-8) with the confirmed root cause.
- **Files modified:** `.planning/WINDOWS.md` only
- **Verification:** Side-by-side sandbox comparison, `b796b7d` vs. `HEAD` (`87f2264`), documented per-check below.
- **Committed in:** `87f2264` (Task 3 commit)

---

**Total deviations:** 4 (1 verification-method bug, 1 documented factual discrepancy, 1 orchestrator-constraint scope adjustment, 1 broader-than-predicted pre-existing-failure discovery)
**Impact on plan:** None of these touch the functional fix. The schema change and the new regression check are exactly as specified; all deviations are either verification-method corrections, documentation of measured reality overriding a prediction, or classification of failures this plan was explicitly told not to fix.

## Reproduced Zod/Astro Error (Task 1, verbatim from `reproduce.log`)

Captured against HEAD `45da85e` in a clean `/c/tmp/oak-null-260902` sandbox, before any source change (ANSI color codes stripped for readability; the committed `reproduce.log` has the raw codes):

```
> oak-homes-website@0.0.1 build
> astro build

[content] Syncing content
[InvalidContentEntryDataError] properties → 614-e-marengo-st data does not match collection schema.

  beds: beds: Expected type "number", received "object"
  baths: baths: Expected type "number", received "object"
  sqft: sqft: Expected type "number", received "object"

  Hint:
    See https://docs.astro.build/en/guides/content-collections/ for more information on content schemas.
  Error reference:
    https://docs.astro.build/en/reference/errors/invalid-content-entry-data-error/
  Location:
    C:\tmp\oak-null-260902\src\content\properties\614-e-marengo-st.md:0:0
  Stack trace:
    at getEntryData (...\node_modules\astro\dist\content\utils.js:121:9)
    at async eval (...\node_modules\astro\dist\content\loaders\glob.js:225:13)
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
```

(The `typeof null === 'object'` quirk explains "received object" rather than raw Zod's "received null" — see Deviation 2 above. The trailing `Assertion failed` line is the same pre-existing Windows/Rolldown native crash documented in `02-01-SUMMARY.md`; it surfaces during process teardown after the content error, is out of scope, and did not block reproduction — exit code was non-zero either way.)

## Post-Fix Build Result (Task 2)

- **Build command:** `cd /c/tmp/oak-null-260902 && rm -rf node_modules/.astro && npm run build`
- **Exit code:** `0` (was non-zero pre-fix, same sandbox, only `src/content.config.ts` changed)
- **`dist/homes/index.html` counts:**
  | Assertion | Raw substring count | Rendered `<span class="status-badge ...">` count |
  |---|---|---|
  | `status-badge status-sold` | 2 | 2 (both real homes) |
  | `status-available` | 1 *(CSS selector text in `StatusBadge.astro`'s scoped `<style>` block — no `<span>` uses this class; see Deviation 1)* | **0** |
  | `status-pending` | 1 *(same CSS-selector artifact; see Deviation 1)* | **0** |
  | `Call for details` | 4 | n/a (text, not an element) |
- **Per-home pages:** `dist/homes/614-e-marengo-st/index.html` and `dist/homes/2734-brown-st/index.html` both exist, each contains exactly 1 `status-sold` badge.
- **Real business data confirmed untouched:** `status: Sold` present, byte-identical, in both `.md` files after the fix.

## Full Check Suite Results (Task 3)

Ran in `/c/tmp/oak-null-260902` (builds work there) unless noted. `sources-staged`/`remote-private`/`phase-complete` need real git-remote state; `phase-complete` also needs a real build, so it was run in the sandbox with `origin` temporarily added as a remote.

| Check | Result | Bucket | Notes |
|---|---|---|---|
| `scaffold-clean` | PASS | — | |
| `skeleton-e2e` | FAIL | (b) pre-existing | `dist/admin/index.html` has 0 occurrences of the Equal Housing sentence — 02-01's admin shell was never templated with it. Confirmed pre-existing at baseline `b796b7d`. WINDOWS #2. |
| `brand-assets` | FAIL | (b) pre-existing | `dist/admin/index.html` missing the tagline alt text. Same root cause as `skeleton-e2e`. Confirmed at baseline `b796b7d`. WINDOWS #3. |
| `photos-resized` | FAIL | (b) pre-existing | Asserts Brown Street's `sqft` key is absent; CMS commit `45da85e` writes `sqft: null` explicitly instead. PASSED at baseline `b796b7d` (pre-CMS-write). WINDOWS #5. |
| `homes-grid` | FAIL | (b) pre-existing | Mutates via `.replace('status: "Available"', ...)`; CMS commits unquoted all string values, so the mutation no-ops. PASSED at baseline `b796b7d` (still quoted). WINDOWS #6. |
| `property-page` | FAIL | (b) pre-existing | `Inquire About This Home` absent — both real homes are genuinely Sold, so D-09's `canInquire` guard correctly hides it. PASSED at baseline `b796b7d` (both Available). WINDOWS #7. |
| `content-pages` | FAIL | (b) pre-existing | No `/contact?property=` links anywhere — same D-09/Sold cause. PASSED at baseline `b796b7d`. WINDOWS #8. |
| `learn-section` | PASS | — | |
| `a11y-sweep` | FAIL | (b) pre-existing | 11 built `.html` files vs. expected 10 (`public/admin/index.html`). Already logged, WINDOWS #1 (open, pre-dates this plan). |
| `cms-null-tolerance` | **PASS** | (a) this change | New check; proven non-vacuous both directions (see below). |
| `sources-staged` | FAIL | (c) environment-limited | `git status --porcelain` not empty — this plan's own in-progress SUMMARY/PLAN files are uncommitted by design until the orchestrator's docs commit. Expected to resolve after that commit. |
| `remote-private` | FAIL | (c) environment-limited | Origin `main` SHA does not equal local HEAD — commits are not yet pushed. This is exactly the deploy-handoff gap described below, not a defect. |
| `cms-tracer-config` | **PASS** | — | Confirms CMS↔schema field-name parity is unchanged. Required to pass; it does. |
| `hero-contrast` | PASS | — | Unrelated to this fix; unaffected. |
| `phase-complete` | FAIL | (b) pre-existing | 11 vs. 10 built files, same root cause as `a11y-sweep`. Confirmed at baseline `b796b7d` (with `origin` remote added to the sandbox to let the check run). WINDOWS #4. |

**Non-vacuity proof for `cms-null-tolerance`** (sandbox copy only, restored after each):
- Reverted `sqft: cmsOptional(z.number())` → `sqft: z.number().optional()`: check FAILS — `optional field 'sqft' (properties) does not start with 'cmsOptional('`.
- Added `nickname: cmsOptional(z.string())` to the properties schema: check FAILS — `new field 'nickname' in the properties schema is not classified`.
- Both reverted; clean re-run: `PASS cms-null-tolerance`.
- `node scripts/verify/checks.mjs` (no argument) lists `cms-null-tolerance` among known ids.

**7 new WINDOWS.md entries** (ids 2-8) were added for the bucket-(b) failures above that were not already logged. Each was confirmed — not assumed — by running the same check against a sandbox built from commit `b796b7d` (the last commit before the CMS wrote real content), where all 7 PASS. `.planning/WINDOWS.md` open_count is now 8.

## Issues Encountered

Handled inline via the deviations above. No unresolved blockers from this plan's own scope.

## User Setup Required

None — no external service configuration required.

## Deploy Handoff — REQUIRED NEXT STEP

**The live production bug is NOT resolved for site visitors yet.** This fix (commits `42e4bcd`, `ea4ae07`, `87f2264`) lives on branch `claude/gracious-visvesvaraya-31c4a6`. Netlify builds `main`. Until these commits are merged and pushed to `origin/main`, ownwithoak.com keeps serving the stale build that shows both sold homes as Available.

**Do not merge/push automatically — this was explicitly out of scope for this plan.** The developer should run `/gsd-ship` or perform an explicit merge to `main` next. `remote-private`'s FAIL above (`origin main SHA does not equal HEAD`) is the machine-readable confirmation of this exact gap.

## Next Phase Readiness

- The null-tolerance fix and its regression gate are complete, committed, and proven — ready to ship once merged.
- Phase 02 (publishing) Plan 1 remains in progress independently (Task 2 halted at a Netlify/GitHub dashboard precondition per `STATE.md`); unaffected by this hotfix.
- 02-02-PLAN.md Task 2 should reuse `cmsOptional()` for its planned `social.facebook` widening rather than re-implementing it (Pending Todo recorded in `.planning/STATE.md`).
- 7 newly-logged WINDOWS.md deviations (ids 2-8) are open and should be triaged by whoever next touches `scripts/verify/checks.mjs`'s admin-shell assertions or the Available/Pending-dependent checks — none block this hotfix or the deploy handoff above.

## Self-Check: PASSED

All claimed files exist (`src/content.config.ts`, `scripts/verify/checks.mjs`, `.planning/WINDOWS.md`, `reproduce.log`, this SUMMARY.md). All claimed commits (`42e4bcd`, `ea4ae07`, `87f2264`) exist in `git log --oneline --all`.

---
*Phase: quick-260902-sws*
*Completed: 2026-09-03*
