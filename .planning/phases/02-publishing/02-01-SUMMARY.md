---
phase: 02-publishing
plan: 01
subsystem: infra
tags: [netlify, sveltia-cms, github-oauth, astro-content-collections, yaml]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "src/content.config.ts Zod schema (properties collection), astro.config.mjs static output, live GitHub remote"
provides:
  - "netlify.toml build config committed and ready for continuous deployment"
  - "public/admin/index.html + public/admin/config.yml — Sveltia CMS admin shell and Homes (properties) collection, matched field-for-field to the Zod schema"
  - "scripts/verify/checks.mjs cms-tracer-config check id, proving deploy config + admin shell + schema/CMS parity, with a demonstrated non-vacuous drift assertion"
affects: [02-02-publishing, 02-03-publishing, 04-launch]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 4908
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: ["@sveltia/cms@0.204.0 (CDN-loaded, no npm install)"]
  patterns:
    - "public/admin/ static shell + config.yml, no build step, served verbatim by Astro's public/ passthrough"
    - "CMS field set is derived-and-diffed against src/content.config.ts's schema at verify time, not hand-maintained separately"

key-files:
  created:
    - netlify.toml
    - public/admin/index.html
    - public/admin/config.yml
  modified:
    - scripts/verify/checks.mjs

key-decisions:
  - "Pinned the Sveltia CDN script to the exact published version 0.204.0 (resolved live via `npm view @sveltia/cms version` at execution time) rather than a floating unpkg latest tag — closes threat T-02-SC (supply-chain path to the assistant's GitHub OAuth token)."
  - "cms-tracer-config's properties-field parity check is schema-driven (extracts field names from src/content.config.ts at check-runtime and subtracts the three known Phase-3-only fields) rather than a hardcoded list alone, so a future schema change that isn't mirrored in config.yml fails the check by name — proven non-vacuous during this execution by mutating one field name and observing the named failure."
  - "This plan wires only the properties (Homes) collection this task, per plan scope — blog and settings collections are 02-02's responsibility, deliberately not added early."

requirements-completed: [INFRA-03, ADMIN-01, ADMIN-02, ADMIN-03]

coverage:
  - id: D1
    description: "netlify.toml versions the build command/publish dir in the repo (Astro static output, no adapter)."
    requirement: INFRA-03
    verification:
      - kind: unit
        ref: "node scripts/verify/checks.mjs cms-tracer-config"
        status: pass
    human_judgment: true
    rationale: "Repo-side config is proven correct by the check, but INFRA-03's actual claim (every push triggers a live Netlify build) cannot be proven until a Netlify site exists — that is Task 2, still open. Deferred to the Task 2/3 checkpoint."
  - id: D2
    description: "public/admin/index.html + config.yml expose a GitHub-backed, form-based Homes collection with the exact 14-field set the Zod schema validates, slug validation locked to UI-SPEC copy, and no OAuth secret or editorial-workflow key present."
    requirement: ADMIN-01
    verification:
      - kind: unit
        ref: "node scripts/verify/checks.mjs cms-tracer-config"
        status: pass
      - kind: integration
        ref: "npm run build (verified in a short-path mirror of this worktree — see Issues Encountered; dist/admin/index.html and dist/admin/config.yml produced with expected content)"
        status: pass
    human_judgment: true
    rationale: "The config is proven structurally correct and the build proven to succeed on identical source, but ADMIN-01's actual claim (assistant can sign in with GitHub and land in the panel) requires the live Netlify site + OAuth App from Task 2, not yet created."
  - id: D3
    description: "ADMIN-02/ADMIN-03 form fields (status dropdown, add-property flow) are wired in config.yml but unexercised end-to-end."
    requirement: ADMIN-02
    verification: []
    human_judgment: true
    rationale: "Requires the Task 3 tracer checkpoint (live CMS sign-in + a real Publish) which cannot run until Task 2's Netlify/GitHub setup exists."

# Metrics
duration: 21min
completed: 2026-09-01
status: halted
---

# Phase 2 Plan 1: Publishing Pipeline Tracer Summary

**netlify.toml + Sveltia CMS admin shell + Homes collection committed and schema-verified; Netlify/GitHub dashboard setup (Task 2) and the live end-to-end tracer proof (Task 3) remain, both requiring a human with browser/dashboard access this environment cannot provide.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-01T23:05:00Z
- **Completed:** 2026-09-01T23:26:00Z
- **Tasks:** 1 of 3 completed (Task 1); Task 2 halted at its precondition, Task 3 not started
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `netlify.toml` versions the build command (`npm run build`) and publish dir (`dist`) in the repo, matching `package.json`'s `build` script and Astro's default static output directory.
- `public/admin/index.html` is a minimal Sveltia CMS shell pinned to `@sveltia/cms@0.204.0` (resolved live from the npm registry this session), with a robots `noindex` meta tag and no `type="module"` on the script tag.
- `public/admin/config.yml` wires the `properties` collection (labelled Homes) with the exact 14 non-Phase-3 fields from `src/content.config.ts`'s Zod schema, a `slug: '{{fields.slug}}'` collection-level slug template paired with a `pattern` validator byte-identical to `slugPattern`, the locked UI-SPEC rejection message, `status`/`featured`/`features`/`photos` defaults matching the schema's `.default()` values, and per-field `media_folder`/`public_folder` overrides nesting photo uploads under `properties/<slug>`.
- `scripts/verify/checks.mjs` gained a new `cms-tracer-config` check id (Node built-ins only, no new npm dependency) that hand-parses `netlify.toml` and `public/admin/config.yml`, asserts backend repo/branch match `git remote get-url origin` and `main`, asserts no OAuth broker override key and no editorial `publish_mode` key, asserts no secret-shaped value under `public/admin/`, and — the core parity assertion — extracts the properties schema's field names directly from `src/content.config.ts` at check-runtime and diffs them (minus the three known Phase-3-only fields) against the CMS field set, so a drift on either side fails by naming the field.

## Task Commits

Each task was committed atomically:

1. **Task 1: Repo-side tracer — build config, admin shell, and the Homes collection** - `e076b56` (feat)

Task 2 (checkpoint:human-action) and Task 3 (checkpoint:human-verify) were not executed this run — see Deviations/Issues below. No plan-metadata "docs: complete plan" commit was made because the plan did not reach completion.

## Files Created/Modified
- `netlify.toml` - `[build] command = "npm run build"`, `publish = "dist"`
- `public/admin/index.html` - Sveltia CMS admin shell served at `/admin`, script pinned to `@sveltia/cms@0.204.0`
- `public/admin/config.yml` - GitHub backend (`almatreeholding-netizen/oak-homes-website`, branch `main`) + `properties` (Homes) collection, 14 fields
- `scripts/verify/checks.mjs` - added `cms-tracer-config` check id (+318 lines)

## Decisions Made
- Pinned Sveltia's CDN script to the exact published version `0.204.0` rather than a floating tag, resolved live via `npm view @sveltia/cms version` and confirmed reachable via `curl -sI` against unpkg before committing — closes threat T-02-SC.
- Made the `cms-tracer-config` parity assertion schema-driven (parses `src/content.config.ts` at check-runtime) rather than only a hardcoded 14-name literal, satisfying the plan's "must be a set equality against names extracted from src/content.config.ts's properties schema" requirement; both the hardcoded-14 check and the schema-driven check are present and were both proven to fail (naming the drifted field) when a single field name was mutated in a throwaway test, then reverted.
- Scoped this plan strictly to the `properties` (Homes) collection per the plan's own artifact list; `blog` and `settings` collections are left for 02-02, matching the plan's stated scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm install` was required before any check/build could run**
- **Found during:** Task 1 verification
- **Issue:** This worktree had no `node_modules/` — `node scripts/verify/checks.mjs` failed immediately with `ERR_MODULE_NOT_FOUND` for `sharp`.
- **Fix:** Ran `npm install` (no new packages added or changed versions — installs exactly what `package-lock.json` already specifies).
- **Files modified:** none (node_modules/ is gitignored; package.json/package-lock.json unchanged)
- **Verification:** `node scripts/verify/checks.mjs cms-tracer-config` then ran successfully.
- **Committed in:** N/A (no file changes to commit; this is a local dependency install, not a package.json edit)

**2. [Rule 1 - Bug] Two regex bugs in the new `cms-tracer-config` check's YAML field extraction**
- **Found during:** Task 1 verification (first run of the new check failed on its own `status` field)
- **Issue:** The `status`-field and `features`/`photos`-default regexes in the new check assumed the next key (`options:`, `default:`) began at column 0, but `public/admin/config.yml`'s nested list-item fields are indented — the regexes needed `\s*` before those keys to match real file indentation.
- **Fix:** Added `\s*` before `options:` in the status regex and before `default:` in the list-default regex.
- **Files modified:** scripts/verify/checks.mjs
- **Verification:** `node scripts/verify/checks.mjs cms-tracer-config` passes; drift-mutation test (see below) confirms the parity assertion still fires correctly.
- **Committed in:** e076b56 (part of Task 1 commit — the check was written and fixed before ever being committed)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency install, 1 blocking regex bug in newly-written code). Neither touched files outside this task's scope; no scope creep.
**Impact on plan:** Both fixes were necessary to get the plan's own verification passing. No architectural changes.

## Issues Encountered

**`npm run build` cannot run to completion inside this exact worktree path — proven to be a path-specific Windows/native-binary artifact, not a defect in this plan's files.**

Running `npm run build` in this worktree (`C:\Users\gcorso.EXPERIONDESIGN\Claude_Gin\OakHomeWebsite\.claude\worktrees\gracious-visvesvaraya-31c4a6`) fails during Astro's content-collection type sync with `GenerateContentTypesError: Tsconfig not found astro/tsconfigs/strict`, followed by a native `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` crash from a Rolldown native binary (`@rolldown/binding-win32-x64-msvc`) that Vite 8.2.2 uses internally for tsconfig-extends resolution.

Investigation (all read-only or scratch-directory, no repo files affected by the investigation itself):
- The failing string ("Tsconfig not found ...") exists nowhere in any JS source under `node_modules` — it is only found inside the compiled Rolldown native `.node` binary, confirming this is a native-resolver bug, not something fixable via `tsconfig.json`/`astro.config.mjs` edits (temporarily changing or removing `tsconfig.json`'s `extends` key had zero effect on the error, then was reverted with no net diff).
- A brand-new, freshly scaffolded Astro project at a short path (`C:\tmp\astro-test`) with the identical `"extends": "astro/tsconfigs/strict"` tsconfig, same Node v24.19.0, same OS, **built successfully** — ruling out a categorical Node/Astro/Vite/Windows incompatibility.
- Copying this worktree's exact tracked files (via `git ls-files`) plus this plan's three new files and the updated `checks.mjs`, to a short path (`C:\tmp\oak-test`), then running `npm install && npm run build` there **succeeded completely**: 10 pages built, `dist/admin/index.html` and `dist/admin/config.yml` produced with the expected content (Sveltia script tag, pinned version, backend block). This is direct evidence that the plan's deliverables are correct and that `npm run build` will succeed in a normal (non-deeply-nested-dotted-path) environment — including Netlify's own Linux-based CI, which has no relationship to this Windows path artifact.
- The root cause appears tied to this worktree's specific absolute path (`...\gcorso.EXPERIONDESIGN\...\.claude\worktrees\...`, which contains a dotted username segment and a hidden `.claude` directory segment) confusing Rolldown's native path/package-exports resolver on Windows. This is an execution-environment characteristic of this specific worktree, not a defect introduced by this plan's file changes, and is out of scope to fix per the deviation rules' scope boundary (it is not caused by this task's changes, and "fixing" it would mean relocating the worktree, which is outside a plan executor's authority).

**Practical effect on this plan's verification:** `node scripts/verify/checks.mjs cms-tracer-config` — which does not itself invoke a build — passes cleanly in this worktree and was proven non-vacuous (fails and names the drifted field when a field name is mutated, then passes again after revert). The second `<verify>` line, a literal `npm run build` in this exact directory, cannot be run to a `0` exit code here; the mirrored short-path build stands as the evidence that the committed config produces a correct build. This is recorded here rather than silently claimed as passing.

## User Setup Required

**External services require manual, browser-only configuration before Task 2/3 can proceed.** No USER-SETUP.md was generated (that mechanism is for phases with `user_setup` completion at plan-summary time); instead, per this plan's own frontmatter `user_setup` block, two dashboards need the owner:

1. **Netlify** — decide (per D-21) whether to reconfigure the existing zip-drag site or create a new one linked to `almatreeholding-netizen/oak-homes-website`, confirm production branch `main` and that build settings are inherited from `netlify.toml`, capture the live URL.
2. **GitHub** — register a new OAuth App (`Oak Homes CMS`), Homepage URL = the live Netlify URL from step 1, Authorization callback URL = `https://api.netlify.com/auth/done` exactly, then install it as Netlify's GitHub OAuth provider.

Neither `netlify` nor `gh` CLI is installed in this environment (re-confirmed this session is not different from RESEARCH's findings), and GitHub has no API for OAuth App creation — this is genuinely human/browser-only work, matching the plan's own Task 2 design.

## Next Phase Readiness

**Not ready to proceed past this plan.** Task 2's own `<precondition>` requires the Task 1 commit to be reachable from `origin/main` (`git log origin/main --oneline` must contain it) before any dashboard work begins — this worktree's commit (`e076b56`) is currently only on the local branch `claude/gracious-visvesvaraya-31c4a6`, not on `origin/main`. That precondition is unmet right now, independent of the dashboard work itself, and per the executor's precondition protocol this halts Task 2 before any browser-driven action is attempted.

**Blockers for continuing this plan, in order:**
1. The `claude/gracious-visvesvaraya-31c4a6` branch (containing commit `e076b56`) needs to be merged/pushed to `origin/main` — an orchestrator/user action outside this execution.
2. Once merged, a human with Netlify and GitHub dashboard access must complete Task 2's four steps (Netlify site decision, live URL capture, GitHub OAuth App registration, Netlify OAuth provider install).
3. Task 3 (the tracer proof: sign in, flip a status, add a home with a photo, verify slug validation, verify empty-state defaults, measure publish-to-live time, clean up) can then run — also human-browser-only, per this plan's own design.

**What's ready once Task 2/3 unblock:** the CMS config itself is proven correct (schema parity, locked copy, no leaked secrets, correct build output) — Task 2/3 exercise the already-correct configuration against live infrastructure, not additional repo changes.

---
*Phase: 02-publishing*
*Completed: 2026-09-01 (Task 1 only; plan halted at Task 2's precondition)*

## Self-Check: PASSED

- FOUND: netlify.toml
- FOUND: public/admin/index.html
- FOUND: public/admin/config.yml
- FOUND: scripts/verify/checks.mjs
- FOUND: .planning/phases/02-publishing/02-01-SUMMARY.md
- FOUND commit: e076b56
