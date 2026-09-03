---
phase: quick-260902-sws
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/content.config.ts
  - scripts/verify/checks.mjs
autonomous: true
requirements: [HOTFIX-CMS-NULL]

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A property whose optional numeric spec is left blank in the CMS (`sqft: null`) builds successfully and renders 'Call for details' for that spec — the same fallback a genuinely absent key renders today."
    - "All eight optional fields (properties beds/baths/sqft/videoUrl/location/ogImage, blog coverImage, settings social.facebook) accept an absent key, `null`, and `\"\"` interchangeably, all normalizing to undefined before the inner validator runs."
    - "Every required field (properties title/address/slug/status/downPayment/monthlyPayment/description/publishDate, blog title/slug/date, settings phone/phoneHref/email/homepageIntro) still fails the build loudly and by name when set to null or removed."
    - "`npm run build` against the real, null-bearing content in src/content/properties/ exits 0, where it exited non-zero before this change."
    - "The rebuilt /homes page shows both homes with a Sold badge and neither with an Available or Pending badge — the owner's real status data reaches the public page."
    - "`node scripts/verify/checks.mjs cms-null-tolerance` passes, and fails loudly and by name if a future field is added to any collection schema without being classified as required, defaulted, or cmsOptional-wrapped."
  artifacts:
    - path: "src/content.config.ts"
      provides: "a single `cmsOptional()` helper stating the CMS-empty-value rule once, applied to all eight optional field declarations; required fields untouched"
      contains: "cmsOptional"
    - path: "scripts/verify/checks.mjs"
      provides: "the `cms-null-tolerance` check id — a static schema-partition audit plus six mutate-build-assert-revert round trips proving both directions"
      contains: "cms-null-tolerance"
  key_links:
    - from: "src/content.config.ts cmsOptional()"
      to: "each of the eight optional field declarations"
      via: "z.preprocess maps null and empty string to undefined BEFORE the inner validator, which is what lets `.url()` and the nested location object survive an empty value"
      pattern: "cmsOptional("
    - from: "src/content.config.ts field declarations"
      to: "scripts/verify/checks.mjs cms-null-tolerance Layer A"
      via: "the check hardcodes the required/defaulted/optional partition and asserts it equals the field set actually extracted from the file — an unclassified new field is a loud failure"
      pattern: "cms-null-tolerance"
    - from: "entry.data.beds/baths/sqft === undefined"
      to: "src/components/PropertyCard.astro `detail()` and src/pages/homes/[slug].astro"
      via: "the existing `n === undefined ? 'Call for details'` guard — unchanged, and the reason normalizing to undefined (not null, not '') is the only safe target"
      pattern: "Call for details"
---

<objective>
Fix the live production bug: Sveltia CMS writes `sqft: null` (and, for text fields, `""`)
into frontmatter when the assistant leaves an optional field blank; the Zod schema declares
those fields `.optional()`, which admits `undefined` only. `z.number().optional().safeParse(null)`
fails with "expected number, received null", so the Netlify build never completes and
ownwithoak.com keeps serving stale HTML showing two homes as Available that the owner has
already marked Sold.

Purpose: restore the deploy and make the schema tolerate what a form-based CMS actually emits,
without loosening a single required field.

Output:
- `src/content.config.ts` — one `cmsOptional()` helper applied to eight optional declarations.
- `scripts/verify/checks.mjs` — a new `cms-null-tolerance` check asserting both directions.
- A proven-red-then-green build against the real null-bearing content.

Non-goals, explicitly out of scope (do NOT do these):
- Do NOT revert `status: Sold` on either home. Both homes genuinely sold. That is real business data.
- Do NOT re-quote the string values Sveltia unquoted (`title: 2734 Brown Street`). It is valid YAML,
  parses identically, and is the CMS's normal serialization.
- Do NOT touch any `.astro` template. Every consumer already guards with `n === undefined` or `&&`,
  which is exactly why undefined is the normalization target.
- Do NOT change the `status` enum, `photos`, or `features`.
- Do NOT fix the Rolldown build crash in this worktree, or the pre-existing check failures catalogued
  in Task 3.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<shell_contract>
The session shell is PowerShell; every command in this plan is **Bash (Git Bash)** and must be run
through the Bash tool. This follows the established workaround in
`.planning/phases/02-publishing/02-01-SUMMARY.md`, which is itself Bash (`git archive HEAD | tar -x`).

Phase 01 plans held every `<automated>` block to a single argument-free command
(`node scripts/verify/checks.mjs <id>`) precisely to dodge shell ambiguity. This plan keeps that rule
for its one durable gate — Task 3's `cms-null-tolerance` — but Tasks 1 and 2 verify a
build-in-a-sandbox, which is irreducibly a short Bash pipeline. Those two blocks are written as
literal Bash one-liners: run them verbatim in Git Bash, and read `&&` as `&&` (no HTML escaping
anywhere in this plan).

Sandbox path is `/c/tmp/oak-null-260902` in Git Bash notation throughout.
</shell_contract>

<context>
@.planning/STATE.md
@.planning/WINDOWS.md
@./.claude/CLAUDE.md

@src/content.config.ts
@scripts/verify/checks.mjs
@src/content/properties/2734-brown-st.md
@src/content/properties/614-e-marengo-st.md
</context>

<planning_evidence>
Facts established during planning by reading the files and running the installed Zod. Treat these
as verified — do not re-derive them, but do let a contradicting observation override them.

1. **Zod version is 4.5.4** (`node_modules/zod/package.json`), re-exported by Astro 7.2.9 as
   `z` from `astro:content`. Zod 4's phrasing is `Invalid input: expected number, received null`,
   matching the reported error.

2. **The helper shape below was executed against that exact installed Zod and produced these
   results** — this is measured, not assumed:

   | input | result |
   |---|---|
   | key absent | PASS, value `undefined` |
   | `null` | PASS, value `undefined` |
   | `""` | PASS, value `undefined` |
   | real value (`1200`, `https://x.com/a`, `{lat,lng}`) | PASS, value preserved |
   | `"abc"` for a number field | FAIL — `expected number, received string` |
   | `"notaurl"` for a `.url()` field | FAIL — `Invalid URL` |
   | required `title: null` | FAIL — `expected string, received null` |
   | required `title` absent | FAIL — `expected string, received undefined` |

   Nesting works too: `cmsOptional(z.object({lat,lng}))` accepts null/`""`/absent and still
   rejects a malformed object. And `social.facebook` wrapped this way accepts null/`""`/absent
   while `facebook: 'nope'` is still rejected and `phone: null` still fails.

3. **A single parse reports every failing required field.** Nulling all 8 property required
   fields yielded issues for `title,address,slug,status,downPayment,monthlyPayment,description,publishDate`
   in one pass; removing all 8 did the same. This is what makes the one-build-per-direction design
   in Task 3 non-vacuous. Precedent already in this repo: `skeleton-e2e` step 7 mutates `status`
   and `downPayment` in one build and asserts the output names both.

4. **Templates need no change.** `PropertyCard.astro` uses
   `const detail = (n: number | undefined, unit: string) => (n === undefined ? 'Call for details' : ...)`;
   `learn/index.astro`, `learn/[slug].astro`, and `Layout.astro` all use `&&` truthiness guards on
   `coverImage` / `social.facebook`. Normalizing to `undefined` preserves every one of them exactly.

5. **`cms-tracer-config` extracts schema field names with `/^ {4}([a-zA-Z0-9_]+):\s*\S/gm`.**
   Keeping every field declaration on one 4-space-indented line (`    sqft: cmsOptional(z.number()),`)
   keeps that check passing. Do not reformat declarations across multiple lines.

6. **A bare grep for `Available` in `dist/homes/index.html` is WRONG.** `src/pages/homes/index.astro`
   renders a literal `<h1 class="grid-heading">Available Homes</h1>` section heading on every
   populated build. Status must be asserted through the badge markup that `StatusBadge.astro`
   emits — `<span class="status-badge status-sold ...">Sold</span>` — never through the bare word.

7. **Both property `.md` files were rewritten by the CMS commits and are now fully unquoted**
   (`status: Sold`, `slug: 614-e-marengo-st`). Several existing checks mutate them via literal
   replacements like `.replace('status: "Available"', ...)` and `.replace('slug: "614-e-marengo-st"', ...)`,
   which no longer match and now silently no-op. Task 3 catalogues the consequences; they are
   pre-existing and out of scope.
</planning_evidence>

<overlap_with_02_02>
`.planning/phases/02-publishing/02-02-PLAN.md` Task 2 already plans to widen `settings.social.facebook`
for the cleared/empty-string case, and to add a `cms-collections-complete` check with round trips
covering the cleared Facebook URL and the absent cover image.

This hotfix lands that widening early, through the shared `cmsOptional()` helper, because the same
root cause is taking the site down now. Rules for the executor:

- Widen `social.facebook` here **via `cmsOptional`**, not via a bespoke one-off union. This satisfies
  02-02's intent and does not contradict it.
- Do **not** create `cms-collections-complete` here. That check id belongs to 02-02 and covers a
  broader surface (settings `main` wrapper shape, blog `body` field, CMS config parity). Only
  `cms-null-tolerance` is in scope.
- Do **not** edit `02-02-PLAN.md`. Instead, record the overlap in this plan's SUMMARY and add a
  Pending Todo to `.planning/STATE.md` so 02-02's executor reuses `cmsOptional` rather than
  re-widening the field a second way.
</overlap_with_02_02>

<tasks>

<task type="tracer">
  <name>Task 1: Reproduce the failing build against the real null-bearing content</name>
  <files>.planning/quick/260902-sws-fix-cms-null-tolerance-in-content-schema/reproduce.log (new; no repo source file is modified by this task)</files>

  <precondition>
    `/c/tmp` is writable, `node -v` and `npm -v` both resolve, and `git log --oneline -2` in the
    worktree shows the two CMS commits `45da85e` and `e3d7077` at HEAD. If HEAD does not contain
    them, halt — the real null-bearing content is not present and nothing below proves anything.
  </precondition>

  <read_first>
    - `src/content.config.ts` (the unfixed schema — read it before changing anything)
    - `src/content/properties/614-e-marengo-st.md` (has `beds: null`, `baths: null`, `sqft: null`)
    - `src/content/properties/2734-brown-st.md` (has `sqft: null`)
    - `.planning/phases/02-publishing/02-01-SUMMARY.md` (documents the worktree build crash)
  </read_first>

  <action>
    Build a clean sandbox outside the deeply-nested worktree path and prove the CURRENT schema fails,
    before touching a single line of source. A fix never proven to fix anything is not a fix, and this
    step also proves the broken deploy is genuinely this and not something else.

    `npm run build` and `astro dev` crash inside this worktree with the Rolldown native assertion
    `!(handle->flags & UV_HANDLE_CLOSING)` because of the deeply-nested `.claude\worktrees` Windows
    path. That is pre-existing and documented in `.planning/phases/02-publishing/02-01-SUMMARY.md`.
    It is NOT yours to fix. Use the established archive-to-shallow-path workaround.

    From the worktree root, in Git Bash:

        rm -rf /c/tmp/oak-null-260902
        mkdir -p /c/tmp/oak-null-260902
        git archive HEAD | tar -x -C /c/tmp/oak-null-260902
        cd /c/tmp/oak-null-260902
        git init -q
        npm install
        npm run build

    Notes on each step:
    - The directory MUST be fresh (`rm -rf` first). A stale sandbox from an earlier quick task
      (`/c/tmp/oak-verify` exists) would invalidate the reproduction.
    - `git archive HEAD` captures committed content only. That is what we want here: HEAD is
      `45da85e`, which carries the real CMS-written frontmatter and the unfixed schema.
    - `git init -q` is required only so `runGit(['rev-parse','--show-toplevel'])` inside
      `scripts/verify/checks.mjs` resolves later. No commit is needed.
    - `public/uploads/` is tracked (12 files), so photos come along and page rendering is realistic.

    Capture the FULL verbatim build failure output. The `<verify>` one-liner redirects both streams
    to `/c/tmp/oak-null-260902/reproduce.out`; copy that file into the planning directory as
    `.planning/quick/260902-sws-fix-cms-null-tolerance-in-content-schema/reproduce.log` so the
    evidence survives the throwaway sandbox:

        cp /c/tmp/oak-null-260902/reproduce.out .planning/quick/260902-sws-fix-cms-null-tolerance-in-content-schema/reproduce.log

    Do not paraphrase it — the verbatim text is the evidence that the fix in Task 2 fixed this
    specific thing, and it goes into the SUMMARY unedited.

    Do not modify any file in the worktree during this task.
  </action>

  <verify>
    <automated>cd /c/tmp/oak-null-260902 && npm run build > reproduce.out 2>&1; test $? -ne 0 && grep -qi sqft reproduce.out && grep -qi null reproduce.out && echo "REPRODUCED: build failed naming sqft and null"</automated>
  </verify>

  <acceptance_criteria>
    - `/c/tmp/oak-null-260902` exists, was created fresh this run, and contains `src/content.config.ts`,
      `src/content/properties/614-e-marengo-st.md`, and `scripts/verify/checks.mjs`.
    - `grep -c 'sqft: null' /c/tmp/oak-null-260902/src/content/properties/*.md` totals 2 — the sandbox
      really does carry the null-bearing content.
    - `npm run build` in the sandbox exits NON-ZERO.
    - The captured output names the field `sqft` and the word `null`, and references at least one of
      `614-e-marengo-st` or `2734-brown-st`. Expected Zod 4 phrasing is
      `Invalid input: expected number, received null`; accept an equivalent message that still names
      the field and the null value, but record the actual text verbatim.
    - `reproduce.log` exists and contains that verbatim output.
    - `git status --porcelain` in the worktree is unchanged from the start of the task (no source edits).
  </acceptance_criteria>

  <done>
    The build failure is reproduced on demand, in a clean environment, against the owner's real
    content, with the exact Zod error captured verbatim to `reproduce.log`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add cmsOptional() and apply it to the eight optional fields — prove green</name>
  <files>src/content.config.ts</files>

  <read_first>
    - `src/content.config.ts` — full file. Note the existing comment style: every non-obvious
      decision is documented with its reason and its source (D-06, RESEARCH.md Pitfall 1,
      SKELETON.md invariant 6). Match it.
    - `reproduce.log` from Task 1 — the failure this task must turn green.
  </read_first>

  <behavior>
    Behavior the change must produce, all of it already measured against the installed Zod 4.5.4
    (see `<planning_evidence>` item 2) — these are the expectations, verified by the Task 2 build
    and then locked in by Task 3's check:

    - `sqft: null` → `entry.data.sqft === undefined` → card renders `Call for details`
    - `sqft: ""` → `undefined` → `Call for details`
    - `sqft:` key absent → `undefined` → `Call for details`
    - `sqft: 1200` → `1200` → renders `1200 sqft`
    - `sqft: "abc"` → build FAILS (`expected number, received string`)
    - `videoUrl: ""` → `undefined` (NOT a `.url()` failure — the whole reason for preprocess)
    - `videoUrl: "notaurl"` → build FAILS (`Invalid URL`)
    - `location: null` / `""` / absent → `undefined`; a malformed object still FAILS
    - `social.facebook: null` / `""` / absent → `undefined` → footer renders no link
    - `social.facebook: "nope"` → build FAILS
    - `title: null` → build FAILS (`expected string, received null`)
    - `title` absent → build FAILS (`expected string, received undefined`)
    - `phone: null` → build FAILS
  </behavior>

  <action>
    Edit `src/content.config.ts` and nothing else in this task.

    **Step 1 — add the helper.** Insert it immediately after the `slugSchema` declaration (after the
    line ending `'slug must be lowercase ASCII words separated by single hyphens, with no leading or trailing hyphen'`
    and its closing `);`), before the `idFromFilename` JSDoc block.

    Exact shape:

        function cmsOptional<T extends z.ZodType>(inner: T) {
          return z.preprocess(
            (value) => (value === null || value === '' ? undefined : value),
            inner.optional(),
          );
        }

    Use `z.ZodType` for the constraint, not `ZodTypeAny` — `z.ZodType` exists in both Zod 3 and
    Zod 4 and this project is on Zod 4.5.4. (`astro build` does not typecheck `.ts`, so a type-name
    mistake would fail silently in the editor rather than in CI — get it right here.)

    `z.preprocess` is load-bearing and NOT interchangeable with `.nullish()`. The normalization must
    run BEFORE the inner validator: `z.string().url().nullish()` still hands `""` to `.url()` and
    fails. Same reason it is what makes the nested `location` object work.

    **Step 2 — write the doc comment above the helper**, in this file's established voice: say what
    it does, why it exists (Sveltia and form-based CMSes generally cannot express "this key is
    absent"; a blank number field serializes as `null`, a blank text field as `""`), why `z.preprocess`
    and not `.nullish()`, that `undefined` is the deliberate target because every consuming template
    already guards on `undefined`/truthiness, and — most important for the next person — that this
    must NEVER be wrapped around a required field, pointing at the `cms-null-tolerance` check in
    `scripts/verify/checks.mjs` as the thing that enforces both directions. Reference the production
    incident and commits `e3d7077` / `45da85e` so the reason survives.

    Two hard constraints on the comment text:
    - Do NOT write the literal recursive-glob string (two asterisks, slash, star, dot, md) anywhere
      in it. `skeleton-e2e` asserts that literal is absent from the whole file, and a comment
      mentioning it would fail an unrelated check. The existing comments escape it deliberately.
    - Keep every field declaration on ONE line at exactly 4-space indent, so
      `cms-tracer-config`'s `/^ {4}([a-zA-Z0-9_]+):\s*\S/gm` extraction keeps working.

    **Step 3 — apply it to exactly eight declarations. These, and no others:**

    In the `properties` schema (preserve each existing trailing comment verbatim):

        beds: cmsOptional(z.number()), // D-10: absent -> "Call for details"
        baths: cmsOptional(z.number()),
        sqft: cmsOptional(z.number()),
        videoUrl: cmsOptional(z.string().url()), // Phase 3 field, unused this phase
        location: cmsOptional(z.object({ lat: z.number(), lng: z.number() })), // D-16: created, empty
        ogImage: cmsOptional(z.string()), // Phase 3 OpenGraph field, included now

    In the `blog` schema:

        coverImage: cmsOptional(z.string()),

    In the `settings` schema, nested inside `social`:

        facebook: cmsOptional(z.string().url()), // D-17: Facebook only, no Instagram

    **Step 4 — leave these exactly as they are.** Changing any of them is a worse bug than the one
    being fixed:
    - properties required: `title`, `address`, `slug`, `status`, `downPayment`, `monthlyPayment`,
      `description`, `publishDate`
    - properties defaulted (already tolerate absence): `featured`, `features`, `photos`
    - the `status` enum values
    - blog required: `title`, `slug`, `date`; blog defaulted: `ownerReviewed`
    - settings required: `phone`, `phoneHref`, `email`, `homepageIntro`, and the `social` object itself

    **Step 5 — prove green in the same sandbox, same environment as the red run.** Reusing the
    sandbox (rather than making a second one) keeps everything but the schema identical, so the
    before/after difference is attributable to this change alone:

        cp src/content.config.ts /c/tmp/oak-null-260902/src/content.config.ts
        cd /c/tmp/oak-null-260902
        rm -rf node_modules/.astro
        npm run build

    `rm -rf node_modules/.astro` is mandatory. Astro's content layer persists a data store across
    builds; a stale entry from the failed run can survive the sync step and be handed to
    `getStaticPaths` anyway, producing a build that reports the previous run's error. This repo's
    own `clearAstroCache()` helper exists for exactly this reason.

    **Step 6 — assert the built output.** Read `/c/tmp/oak-null-260902/dist/homes/index.html` and
    assert on the badge markup `StatusBadge.astro` emits, not on bare words:
    - the substring `status-badge status-sold` occurs exactly 2 times
    - the substring `status-available` occurs 0 times <!-- planner-discipline-allow: status-available -->
    - the substring `status-pending` occurs 0 times
    - `Call for details` occurs at least 4 times (Marengo's three null specs plus Brown Street's one)

    A bare grep for the word `Available` is WRONG and will report a false failure: the page renders
    its own `<h1 class="grid-heading">Available Homes</h1>` section heading on every populated build.

    Also assert both per-home pages exist and each carries exactly one Sold badge:
    `dist/homes/614-e-marengo-st/index.html` and `dist/homes/2734-brown-st/index.html`.

    **Step 7 — commit** (source only; the sandbox is throwaway and must not be committed):

        git add src/content.config.ts
        git commit -m "fix(quick-260902-sws): tolerate CMS null and empty values on optional content fields"
  </action>

  <verify>
    <automated>cp src/content.config.ts /c/tmp/oak-null-260902/src/content.config.ts && cd /c/tmp/oak-null-260902 && rm -rf node_modules/.astro && npm run build && node -e "const fs=require('fs');const h=fs.readFileSync('dist/homes/index.html','utf8');const c=(s)=>h.split(s).length-1;const r={sold:c('status-badge status-sold'),avail:c('status-available'),pend:c('status-pending'),cfd:c('Call for details')};console.log(r);if(r.sold!==2||r.avail!==0||r.pend!==0||r.cfd<4){throw new Error('badge/fallback assertion failed: '+JSON.stringify(r))}console.log('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `src/content.config.ts` declares exactly one `function cmsOptional`, whose body contains
      `z.preprocess`, a `=== null` test, and an empty-string test.
    - Exactly 8 field declarations contain `cmsOptional(` — `beds`, `baths`, `sqft`, `videoUrl`,
      `location`, `ogImage`, `coverImage`, `facebook`. Verify with
      `grep -c 'cmsOptional(' src/content.config.ts` returning 9 (8 uses + 1 declaration), and
      confirm the identity of each by reading the matched lines.
    - No declaration line for `title`, `address`, `slug`, `status`, `downPayment`, `monthlyPayment`,
      `description`, `publishDate`, `date`, `phone`, `phoneHref`, `email`, or `homepageIntro`
      contains `cmsOptional`, `.optional(`, `.nullish(`, `.nullable(`, or `.default(`.
      <!-- planner-discipline-allow: .optional( --> <!-- planner-discipline-allow: .nullish( -->
    - `photos` still reads `z.array(z.string()).default([])` and `features` still reads
      `z.array(z.string()).default([])`; the `status` enum is byte-identical to before.
    - Every field declaration is still a single line at 4-space indent (6-space for `facebook`), so
      `cms-tracer-config`'s extraction regex still matches.
    - The file does not contain the literal recursive-glob string that `skeleton-e2e` forbids.
    - `npm run build` in `/c/tmp/oak-null-260902` exits 0 after `rm -rf node_modules/.astro`.
    - `dist/homes/index.html`: `status-badge status-sold` × 2, `status-available` × 0,
      `status-pending` × 0, `Call for details` ≥ 4.
    - `dist/homes/614-e-marengo-st/index.html` and `dist/homes/2734-brown-st/index.html` both exist
      and each contain exactly one `status-sold` occurrence.
    - No `.astro` file was modified: `git diff --name-only HEAD~1 HEAD` lists only
      `src/content.config.ts`.
    - `status: Sold` is still present in both property `.md` files, unmodified.
  </acceptance_criteria>

  <done>
    The same sandbox that failed in Task 1 now builds clean with only `src/content.config.ts` changed,
    both homes render a Sold badge, no home renders as Available or Pending, blank specs render
    "Call for details", and the change is committed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add the cms-null-tolerance regression gate and report the full suite</name>
  <files>scripts/verify/checks.mjs, .planning/STATE.md, .planning/WINDOWS.md</files>

  <read_first>
    - `scripts/verify/checks.mjs` — the shared helpers block (lines ~25–215: `readUtf8File`,
      `countOccurrences`, `runGit`, `fail`, `pass`, `walkFiles`, `runBuild`, `clearAstroCache`,
      `withPhotosField`) and the dispatch block at the end of the file. Follow these conventions
      exactly.
    - `skeleton-e2e` (starts ~line 620) — the reference implementation for
      backup → mutate → clearAstroCache → build → restore-immediately → assert, wrapped in
      `try { ... } finally { restoreAll() }`.
    - `cms-tracer-config` (starts ~line 3171) — the reference implementation for extracting field
      names out of `src/content.config.ts` with `/^ {4}([a-zA-Z0-9_]+):\s*\S/gm` against a
      `schema: z.object({` … `\n  }),` slice, including its non-vacuity guard that fails when zero
      field names are extracted.
  </read_first>

  <action>
    Add ONE new check id, `cms-null-tolerance`, to the `checks` object in `scripts/verify/checks.mjs`.
    Place it directly after `cms-tracer-config` and before `hero-contrast`. Node built-ins only plus
    the already-present `sharp` import — add no npm dependency. Exit 0 with `pass(id)`; fail through
    the existing `fail(id, reason)` helper so an unrecognised id can never be mistaken for a pass.

    Write a JSDoc header above it in this file's voice: what incident it exists to prevent
    (commits `e3d7077` / `45da85e` wrote `sqft: null` and took the deploy down), and — stated plainly
    — that it asserts BOTH directions, because a "fix" that loosens a required field into optionality
    is a worse bug than the one being fixed.

    **Add two small frontmatter helpers** next to `withPhotosField`, sharing its style and its
    `fail(checkId, ...)` behaviour on an unexpected shape:

    - `upsertFrontmatterKey(content, key, literal)` — operate only inside the leading `---` … `---`
      block. If a line matching `^{key}:` exists, replace it (and any immediately following
      more-indented continuation lines) with `{key}: {literal}`. If no such line exists, insert
      `{key}: {literal}` immediately before the closing `---`. This insert path is required:
      `videoUrl`, `location`, `ogImage`, and `coverImage` are absent from the real files today, so
      the null and empty-string rounds must add them.
    - `removeFrontmatterKey(content, key)` — delete that line and any immediately following
      more-indented continuation lines. No-op if the key is absent.

    **Layer A — static schema-partition audit (no build, runs first, cheap and total).**

    Read `src/content.config.ts`. Assert a single `function cmsOptional` exists and that its body
    contains `z.preprocess`, a `=== null` comparison, and an empty-string comparison. Fail naming
    the missing piece.

    Slice out three schema blocks using the `cms-tracer-config` anchors — `const properties =
    defineCollection({`, `const blog = defineCollection({`, `const settings = defineCollection({`,
    each followed by `schema: z.object({` and terminated at the next `\n  }),`. Extract field
    declarations as `name` → `declaration text` from lines matching `^ {4}([a-zA-Z0-9_]+):\s*(.+)$`,
    plus `^ {6}([a-zA-Z0-9_]+):\s*(.+)$` inside the settings `social` block to reach `facebook`
    (record it as `social.facebook`). Fail if any block yields zero fields — that means the
    extraction regex no longer matches this file's formatting, and a silently-empty audit is worse
    than no audit.

    Compare against this hardcoded partition, written out in the check:

        REQUIRED:
          properties: title, address, slug, status, downPayment, monthlyPayment, description, publishDate
          blog:       title, slug, date
          settings:   phone, phoneHref, email, homepageIntro
        DEFAULTED:
          properties: featured, features, photos
          blog:       ownerReviewed
        CONTAINER:
          settings:   social
        OPTIONAL:
          properties: beds, baths, sqft, videoUrl, location, ogImage
          blog:       coverImage
          settings:   social.facebook

    Assertions:
    1. The extracted field-name set equals the union of the four lists EXACTLY. A field present in
       the file but in no list fails with:
       `new field '{name}' in the {collection} schema is not classified — add it to cms-null-tolerance's
       required/defaulted/container/optional lists before shipping`. **This is the guarantee that a
       future optional field cannot skip the helper unnoticed.** A field in a list but missing from
       the file fails symmetrically as stale.
    2. Every OPTIONAL field's declaration text starts with `cmsOptional(`.
    3. No REQUIRED field's declaration text contains `cmsOptional`, `.optional(`, `.nullish(`,
       `.nullable(`, or `.default(`.
    4. Every DEFAULTED field's declaration text contains `.default(` and does not contain `cmsOptional`.

    Scope assertions 2–4 to the extracted declaration lines only. Never grep the whole file for these
    substrings: the helper's own body legitimately contains `inner.optional()` and its doc comment
    legitimately names `.nullish()`, and a whole-file gate would fail on correct code.

    **Layer B — behavioural round trips against the real content.**

    Files touched: `src/content/properties/614-e-marengo-st.md`, `src/content/properties/2734-brown-st.md`,
    `src/content/blog/what-is-a-land-contract.md`, `src/content/settings.json`. Back up all four
    contents up front, define `restoreAll()`, and wrap every round trip in
    `try { ... } finally { restoreAll() }`. Inside each round trip, restore the mutated file
    IMMEDIATELY after the build that consumes it and BEFORE any assertion — `fail()` calls
    `process.exit()` directly, so an assertion placed before the restore would leave the tree corrupt.
    Call `clearAstroCache(toplevel)` before every build. Mutate `settings.json` via
    `JSON.parse` / `JSON.stringify` (it is JSON, not YAML); restore from the saved original string.

    Six builds:

    - **R1 — optional = null.** In both property files upsert `beds`, `baths`, `sqft`, `videoUrl`,
      `location`, `ogImage` to `null`; in the blog file upsert `coverImage: null`; set
      `main.social.facebook` to `null` in settings.json. Build MUST exit 0. Then assert
      `dist/homes/index.html` contains `Call for details` at least 6 times (2 cards × 3 specs) —
      proof the nulls actually normalized to undefined and reached the template's fallback, not
      merely that the build survived.
    - **R2 — optional = empty string.** Same fields, literal `""`. Build MUST exit 0; same
      `Call for details` ≥ 6 assertion.
    - **R3 — optional absent.** `removeFrontmatterKey` for all six property optionals and
      `coverImage`; `delete` the `facebook` key from settings.json. Build MUST exit 0; same
      `Call for details` ≥ 6 assertion.
    - **R4 — properties required = null.** In `614-e-marengo-st.md` only, upsert all eight required
      fields to `null`. Build MUST exit NON-ZERO, and the combined lowercased stdout+stderr must
      name every one of the eight (compare lowercased, e.g. `downpayment` — matching the existing
      `skeleton-e2e` convention). Fail naming any field that is missing from the output, since a
      missing name is exactly what a silently-loosened required field looks like.
    - **R5 — properties required absent.** In `614-e-marengo-st.md` only, remove all eight required
      keys. Build MUST exit NON-ZERO and name all eight. R4 and R5 are both needed: nulling alone
      would not catch someone changing `title: z.string()` to `title: z.string().optional()`, and
      removal alone would not catch a `cmsOptional` wrap.
    - **R6 — final rebuild** with everything restored. MUST exit 0, leaving the tree in a
      known-good built state, exactly as `skeleton-e2e` and `homes-grid` end.

    Blog and settings required fields are covered by Layer A only, not by their own build round trips.
    That is a deliberate, budgeted scope call for a hotfix — state it in a comment: Layer A already
    fails loudly if any of them gains a tolerance modifier, `skeleton-e2e` step 11 already proves the
    settings `phone` field rejects a blank at build time, and adding four more builds would roughly
    double this check's runtime for a strictly weaker marginal guarantee.

    **Run it, in the sandbox** (the check calls `runBuild`, which crashes in this worktree):

        cp scripts/verify/checks.mjs /c/tmp/oak-null-260902/scripts/verify/checks.mjs
        cp src/content.config.ts /c/tmp/oak-null-260902/src/content.config.ts
        cd /c/tmp/oak-null-260902
        node scripts/verify/checks.mjs cms-null-tolerance

    Expect `PASS cms-null-tolerance`. Also prove the gate is not vacuous: temporarily change
    `sqft: cmsOptional(z.number())` back to `sqft: z.number().optional()` in the SANDBOX COPY ONLY
    (never in the worktree), re-run the check, confirm it FAILS naming `sqft`, then restore the
    sandbox copy from the worktree file. Record both outputs.

    **Then run the whole suite and report.** Split by what each check needs:
    - In `/c/tmp/oak-null-260902` (builds work there): `scaffold-clean`, `skeleton-e2e`,
      `brand-assets`, `photos-resized`, `homes-grid`, `property-page`, `content-pages`,
      `learn-section`, `a11y-sweep`, `cms-null-tolerance`.
    - In the real worktree (git-state checks that need a real `origin`, and that do not build):
      `sources-staged`, `remote-private`, `cms-tracer-config`, `hero-contrast`, `phase-complete`.

    Report every check's id and PASS/FAIL with its reason. Classify each FAIL into exactly one bucket:

    (a) **Caused by this change** — fix it before finishing. Only `cms-null-tolerance` and
        `cms-tracer-config` are plausibly in this bucket; `cms-tracer-config` compares the CMS field
        set to the schema field set and must still PASS, because field NAMES are unchanged.

    (b) **Pre-existing, out of scope — report, log, do not fix.** Predicted, from reading the checks
        during planning; confirm each against what you actually observe rather than assuming:
        - `a11y-sweep` — "expected exactly 10 built .html files, found 11" (02-01 added
          `public/admin/index.html`). Already logged as `.planning/WINDOWS.md` deviation 1, status open.
        - `skeleton-e2e` — steps 7/8/9 mutate via `.replace('status: "Available"', ...)` and
          `.replace('slug: "614-e-marengo-st"', ...)`. The CMS commits unquoted every string value,
          so those replacements now no-op, the mutated build succeeds, and the check reports
          "build exited 0 — validation did not fire". The check is stale, the schema is fine.
        - `homes-grid` — step 4 mutates via the same quoted literals to produce a Pending badge;
          the no-op leaves both homes Sold, so the Pending-badge assertion cannot be satisfied.
        - `property-page`, `content-pages`, `learn-section`, `phase-complete` — may fail for the same
          quoted-literal or Sold-status reasons, or (for `phase-complete`) because HEAD is ahead of
          `origin/main`. Report what you see.
        For every bucket-(b) failure not already in `.planning/WINDOWS.md`, add a deviation entry via
        the windows tooling with a one-line description naming the check id and the stale-literal or
        status cause. Do NOT repair any of these checks in this plan — re-quoting content or rewriting
        those mutations is a separate, larger piece of work and would put real business data at risk.

    (c) **Environment-limited** — e.g. a git-state check run in the sandbox where there is no `origin`.
        Re-run it in the worktree instead; if it still cannot run, say so plainly rather than
        recording a PASS.

    Finally, add a Pending Todo to `.planning/STATE.md`: *"02-02 Task 2's `social.facebook` widening
    is already delivered by `cmsOptional()` in `src/content.config.ts` (quick-260902-sws) — reuse the
    helper, do not re-widen the field a second way. `cms-collections-complete` is still unbuilt and
    still belongs to 02-02."*

    **Commit:**

        git add scripts/verify/checks.mjs .planning/STATE.md .planning/WINDOWS.md
        git commit -m "test(quick-260902-sws): add cms-null-tolerance regression gate"
  </action>

  <verify>
    <automated>cp scripts/verify/checks.mjs /c/tmp/oak-null-260902/scripts/verify/checks.mjs && cp src/content.config.ts /c/tmp/oak-null-260902/src/content.config.ts && cd /c/tmp/oak-null-260902 && node scripts/verify/checks.mjs cms-null-tolerance</automated>
  </verify>

  <acceptance_criteria>
    - `node scripts/verify/checks.mjs cms-null-tolerance` in the sandbox prints
      `PASS cms-null-tolerance` and exits 0.
    - `node scripts/verify/checks.mjs` with no argument still lists `cms-null-tolerance` among the
      known ids in its failure message — the check is genuinely registered on the `checks` object.
    - Non-vacuity proven: with the sandbox copy's `sqft` reverted to `z.number().optional()`, the
      check FAILS and its reason names `sqft`. The sandbox copy is restored afterwards.
    - Layer A fails loudly on an unclassified field. Prove this in the sandbox copy only: add a
      throwaway `    nickname: cmsOptional(z.string()),` line to the properties schema, re-run,
      confirm the failure names `nickname` and says it is unclassified, then restore.
    - R4 and R5 each report a NON-ZERO build whose output names all eight properties required fields.
    - R1, R2, R3, and R6 each report a zero-exit build, and R1–R3 each observe `Call for details`
      at least 6 times in `dist/homes/index.html`.
    - The working tree is clean of check-induced mutations afterwards: `git status --porcelain` in
      the sandbox shows no modification to any file under `src/content/`, and the same holds in the
      worktree (the check was never run there).
    - No npm dependency was added: `package.json` is unmodified, and the new code imports nothing
      beyond what `scripts/verify/checks.mjs` already imports.
    - Every check id in the suite has a reported PASS/FAIL with a bucket label (a/b/c). No check is
      left unreported, and no failure is reported as a pass.
    - `cms-tracer-config` PASSES — field names are unchanged, so CMS↔schema parity must still hold.
      If it fails, that is bucket (a) and must be fixed here.
    - Every bucket-(b) failure not already present in `.planning/WINDOWS.md` has a new deviation entry.
    - `.planning/STATE.md` carries the 02-02 `cmsOptional` reuse todo under Pending Todos.
  </acceptance_criteria>

  <done>
    `cms-null-tolerance` exists, passes against the real content, proves both directions with real
    builds, and has been demonstrated to fail when the helper is removed from a field and when an
    unclassified field is added. The full suite has been run and every result reported and classified,
    with pre-existing failures logged rather than fixed.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| assistant → CMS form → git commit → build | The assistant's form input is serialized by Sveltia into repo frontmatter and consumed by the build. It is semi-trusted content, not code, but it fully controls whether the build succeeds. |
| repo content → Zod schema → rendered HTML | The schema is the only validation layer between CMS-authored data and the public site. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-SWS-01 | Denial of Service | `src/content.config.ts` optional fields | critical | mitigate | This is the realized incident: a blank optional CMS field halts every deploy, freezing the public site on stale data indefinitely. `cmsOptional()` removes the failure mode; `cms-null-tolerance` R1–R3 prove it stays removed. |
| T-SWS-02 | Tampering | `src/content.config.ts` required fields | high | mitigate | The natural over-correction is to blanket-loosen the schema, letting a home publish with no price or no status and silently rendering a broken card. Mitigated by scoping `cmsOptional` to exactly eight named declarations and by `cms-null-tolerance` Layer A assertions 1/3 plus R4/R5, which fail by name if any required field gains a tolerance modifier. |
| T-SWS-03 | Tampering | `scripts/verify/checks.mjs` Layer A negative gates | medium | mitigate | A whole-file grep for `.optional(` would match the helper's own body and doc comment, making the gate fail on correct code and inviting someone to delete it. Mitigated by scoping every negative assertion to extracted field-declaration lines. |
| T-SWS-04 | Information Disclosure | `src/content/properties/*.md` | high | accept | Reverting `status: Sold` would republish two sold homes as available, generating false leads and misrepresenting inventory. Accepted risk is zero: the plan forbids touching status in three places and Task 2's acceptance criteria assert `Sold` survives in both files. |
| T-SWS-05 | Repudiation | check mutation round trips | medium | mitigate | `cms-null-tolerance` rewrites four real content files during its run. A mid-run `fail()` calls `process.exit()` and could leave the owner's real data corrupted in the worktree. Mitigated by the `try`/`finally` `restoreAll()` wrapper plus restore-immediately-after-build discipline, copied from `skeleton-e2e`. |
| T-SWS-SC | Tampering | npm/pip/cargo installs | high | mitigate | Not applicable this plan — no package is installed. `npm install` in the sandbox resolves the existing committed `package-lock.json` only; `package.json` is asserted unmodified in Task 3's acceptance criteria. No new dependency is introduced, so no legitimacy audit is triggered. |
</threat_model>

<verification>
Run in order. Steps 1–4 are the plan's own gates; step 5 is the deploy handoff.

1. **Red proven** — `reproduce.log` exists and holds the verbatim Zod failure naming `sqft` and `null`.
2. **Green proven** — `cd /c/tmp/oak-null-260902 && rm -rf node_modules/.astro && npm run build` exits 0
   with only `src/content.config.ts` changed between the two runs.
3. **Output correct** — `dist/homes/index.html`: `status-badge status-sold` × 2,
   `status-available` × 0, `status-pending` × 0, `Call for details` ≥ 4.
   Do not grep the bare word `Available`; the page's own `Available Homes` heading makes that a
   guaranteed false failure.
4. **Gate live** — `node scripts/verify/checks.mjs cms-null-tolerance` prints
   `PASS cms-null-tolerance`, and demonstrably fails when `sqft`'s helper is removed and when an
   unclassified field is added.
5. **Deploy handoff — the fix is inert until it reaches `main`.** Netlify builds `main`; this work is
   on `claude/gracious-visvesvaraya-31c4a6`. Until these commits are merged and pushed to
   `origin/main`, the public site keeps serving the stale HTML that shows two sold homes as
   Available. Do NOT merge or push silently as part of this plan — surface it to the developer as the
   final, required step (`/gsd-ship` or an explicit merge), and state plainly in the SUMMARY that the
   production bug is not resolved for visitors until that happens.
</verification>

<success_criteria>
- The build fails before the change and succeeds after it, in the same sandbox, against the owner's
  real null-bearing content, with the failure captured verbatim.
- `src/content.config.ts` gained exactly one helper and eight `cmsOptional(` call sites; no required
  field, no defaulted field, no enum, and no `.astro` template changed.
- `cms-null-tolerance` is registered, passes, and is proven non-vacuous in both directions.
- Both homes render a Sold badge on `/homes`; neither renders Available or Pending.
- Blank specs render `Call for details`, exactly as an absent key renders today.
- Every existing check has a reported result, classified as caused-by-this-change, pre-existing, or
  environment-limited; pre-existing failures are logged to `.planning/WINDOWS.md`, not fixed.
- The 02-02 overlap is recorded in `.planning/STATE.md` so the phase-02 executor reuses `cmsOptional`.
- The developer is told, unambiguously, that the live site is still broken until these commits reach
  `origin/main`.
</success_criteria>

<output>
Create `.planning/quick/260902-sws-fix-cms-null-tolerance-in-content-schema/260902-sws-SUMMARY.md` when done.

The SUMMARY must include, verbatim and not paraphrased:
- the reproduced Zod error from Task 1
- the post-fix build exit code and the four `dist/homes/index.html` counts
- the full check-by-check suite results table with bucket labels
- the deploy handoff statement from `<verification>` step 5
</output>
