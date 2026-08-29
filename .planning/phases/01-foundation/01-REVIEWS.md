---
phase: 1
reviewers: [claude]
reviewed_at: 2026-08-29T23:27:18Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md]
---

# Cross-AI Plan Review — Phase 1

## Claude Review

# Cross-AI Plan Review — Oak Homes Phase 1 (Foundation)

## 1. Summary

This is an unusually rigorous plan set: the dependency chain (own the repo → tracer slice → real content → remaining pages → sweep and push) is correct and non-reorderable, the compliance requirements (DESIGN-02/03) are enforced structurally rather than by convention, and the one irreversible step (committing photos) is correctly gated on a pre-`git add` resize. The plans read as production-grade. However, verification against the actual repo and environment surfaces several **execution-blocking defects that are mechanical, not conceptual**: every `<automated>` verify block is written in Bash for a PowerShell-only session; plan 01-01 reads from two absolute paths outside the sandbox's allowed working directories (I was blocked reading them); `npm create astro@latest .` is an interactive command that will also overwrite the `.gitignore` 01-01 just carefully constructed; and the sharp resize spec (width-only) does not implement the longest-edge constraint the plans assert. None of these invalidates the design — all are fixable in the plan text before execution.

## 2. Strengths

- **Ordering of the one-way door is enforced structurally, not by prose.** `01-01-PLAN.md:2` (Task 3 `<precondition>`) gates the first push behind the blocking `checkpoint:human-action` visibility flip. Verified the risk is real: `git remote -v` returns empty, so nothing has been pushed yet, and the repo is still public per D-13.
- **DESIGN-03 is enforced by absence, which is the only durable mechanism.** The legal copy is asserted present in `dist/` and absent under `src/content/` (`01-02-PLAN.md` acceptance; `01-04-PLAN.md:315`). Because Phase 2's Sveltia config can only surface fields that exist in a collection schema, a field that never exists cannot be edited into a compliance problem. This is materially stronger than a "don't edit this" comment.
- **Schema validation is proven, not assumed.** `01-02` requires deliberately breaking `status` and `downPayment`, confirming a non-zero exit, then reverting. This directly attacks RESEARCH.md Pitfall 1 (`src/content.config.ts` at the wrong path silently disables validation) — the failure mode that would otherwise defeat ROADMAP success criterion 5 invisibly.
- **Deterministic sort tiebreak is specified before it bites.** `01-03` Task 2 requires `publishDate desc` then `slug asc`, and asserts two consecutive builds are byte-identical. Both migrated homes are Available and tie on the primary key on day one, so this is a live problem, not a theoretical one.
- **The FAQ gap is correctly reclassified.** RESEARCH.md:353-357 verified by grep that no FAQ copy exists in either mockup; `01-04` treats EDU-02 as fresh authoring grounded in the locked wording rather than migration. This is exactly the kind of finding that silently produces an empty section otherwise.
- **Forward-fields (`location`, `videoUrl`, `ogImage`, `featured`) are defined now** with the two-file-contract risk explicitly deferred to Phase 2 where `admin/config.yml` first exists (`01-02` assumption_delta_decision). Correct call — the companion invariant test genuinely cannot be written this phase.

## 3. Concerns

**HIGH — every `<automated>` verify block is Bash; the session shell is PowerShell 5.1.**
`01-01-PLAN.md:119` uses `cmp`, `wc -l`, `test "$(...)"`, `&&` chaining. `01-05` uses `for f in $(find ...)` and `grep -rl $'<U+FFFD>'`. Per the environment contract, `&&` is a parser error in Windows PowerShell 5.1, and `cmp`/`wc`/`test`/`find`/`grep` do not exist. I confirmed the shell by running commands: `$()` subexpressions were rejected outright. Every verify block in all five plans will fail to parse, not fail to pass — the executor will either improvise or silently skip verification. Git Bash likely exists (git 2.55.0.windows.3) but no plan says to route through it.

**HIGH — 01-01 Task 1 reads from paths outside the sandbox.**
`01-01-PLAN.md:99` and `:101` require copying from `C:/Users/gcorso.EXPERIONDESIGN/Downloads/` and `C:/Users/.../OakHomeWebsite/Logo/`. I attempted `Get-ChildItem` on Downloads and was blocked: *"may only access files in the allowed working directories."* Both source directories are outside this worktree. Task 1 is the phase's first task and every later plan depends on its output. Note `Logo/` is at the *main* worktree root and untracked, so it is genuinely absent here — the plan acknowledges this at `:101` but does not solve the access problem.

**HIGH — `npm create astro@latest .` is interactive and will clobber `.gitignore`.**
`01-02-PLAN.md:263`. Two distinct problems: (a) the create wizard prompts (template, TypeScript, install, git init) and the tool runs with stdin at null — it will hang or EOF; `npx astro add sitemap` (`:266`) likewise prompts for confirmation. No non-interactive flags are specified. (b) The Astro scaffold writes its own `.gitignore`. I verified the current file is exactly two lines — `.claude/*` and `!.claude/CLAUDE.md` — and `01-01` Task 1 goes to explicit trouble to preserve that negation (`:113`+ asserts `grep -c '!.claude/CLAUDE.md'` returns 1). Nothing in `01-02` re-asserts it after the scaffold, so the scaffold silently undoes 01-01's work and starts tracking `.claude/`.

**MEDIUM — the resize does not implement the longest-edge constraint the plans assert.**
`01-03-PLAN.md:200` says "2000px longest-edge constraint," and `:238` asserts `Math.max(width, height) <= 2000`. But the inherited recipe (RESEARCH.md:392-394) is `.resize({ width: 2000, withoutEnlargement: true })`, which constrains **width only**. A portrait source at 1500×3000 passes through at 1500×3000 — longest edge 3000, failing the plan's own acceptance criterion. Because this is the phase's one irreversible step (D-03), the acceptance criterion catching it *after* the write is not enough. Needs `.resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })`.

**MEDIUM — the retired-phrasing greps are both self-contradictory and likely vacuous.**
`01-04-PLAN.md:143` states the three retired phrasings are "deliberately NOT quoted anywhere in this plan… so they cannot be reintroduced by being copied out of it." They are quoted verbatim at `:305`, `:315`, and `:371`. Separately, `purchase not a rental` is spec §6's *paraphrase* of the retired framing (design spec `:91`), not a literal string anyone would write — real drift would read "a purchase, not a rental." The negative grep will pass regardless of whether the risk is present, which is worse than no check because it reads as coverage.

**MEDIUM — verbatim-transcription check has no entity-decoding step.**
`01-04` Task 2 requires comparing the "What a land contract means" paragraph extracted from the source HTML against the built page after whitespace normalisation. Astro escapes `&` → `&amp;`, and the ported copy contains em dashes and curly apostrophes. Without an HTML-entity decode step the comparison will report a false mismatch on correct output — and the likely response is to weaken the check. This is the phase's highest-consequence content operation (its own T-01-19 rates it high), so the check needs to actually be runnable.

**MEDIUM — `slug` is duplicated between filename and frontmatter, and the duplicate-route claim is unverified.**
`01-02` defines `slug` as a schema field while files are named `614-e-marengo-st.md`. Nothing binds the two, so `2734-brown-st.md` can carry `slug: whatever`. `01-02` asserts "two property entries sharing one slug fail the build with a duplicate-route error" — that depends on Astro 7's `getStaticPaths` duplicate-param handling, which RESEARCH.md itself tags `[ASSUMED]` (A1) and did not test. If Astro dedupes rather than errors, one listing silently disappears. Deriving the route from the entry `id` would remove both the drift surface and the dependency on unverified behaviour.

**MEDIUM — 01-02 is oversized for one task.**
Task 2 covers scaffold + Tailwind v4 token wiring + three collection schemas + shared layout + Nav + Button + two routes + first content file, at a 95k estimate with `confidence: low`. That is the widest task in the set and the one whose output every later plan inherits. Splitting scaffold/tokens from schema/layout would make a mid-task failure recoverable.

**LOW — internal inconsistency: 01-02 says the gallery, lightbox, and Inquire CTA "arrive in plan 01-04"** (`01-02-PLAN.md:358`). They arrive in 01-03. Harmless to the build, but the executor reads these forward-references to decide what to stub.

**LOW — ROADMAP criterion 3 requires "From Rent to Roots" on every page; no plan asserts it appears at all.** `01-02` only prohibits re-typesetting it as a wordmark, and `01-05`'s whole-site sweep checks the Equal Housing line and the phone number but not the tagline.

**LOW — `dist/homes` counting check becomes wrong after 01-03.** `01-02`'s `find dist/homes -name index.html | wc -l` equals the property count only while `/homes/index.astro` does not exist. Correct when written, silently wrong if re-run as a regression check.

**LOW — UI-SPEC internal contradiction, correctly resolved by the plans.** UI-SPEC:160 says card price figures use "accent"; UI-SPEC:101/104 say price figures use price gold and accent is never text on cream. The plans follow the latter. Worth correcting UI-SPEC so a future reader does not follow line 160. (I independently computed `#A87E24` on `#FFFDF7` ≈ 3.7:1 — passes AA at 24px, fails at body size, exactly as UI-SPEC claims.)

**LOW — threat-model ceremony exceeds the risk surface.** Four STRIDE tables with "Denial of Service — accept" and "Elevation of Privilege — accept" rows on a static marketing site with no runtime. The genuinely load-bearing entries (T-01-01 push-before-private, T-01-12 photo blobs, T-01-19 copy tampering) are diluted by the boilerplate around them.

## 4. Suggestions

- **Add a shell contract to every plan's execution context**: either state that verify blocks run under `bash -lc` via Git Bash (`C:\Program Files\Git\bin\bash.exe`), or rewrite them as PowerShell / a single `node scripts/verify.mjs`. A Node verification script is probably best here — it is cross-platform, the project already depends on Node 24, and it makes the sharp-metadata and entity-decode checks natural rather than awkward.
- **Resolve the sandbox-path problem in 01-01 before execution**: add `C:/Users/gcorso.EXPERIONDESIGN/Downloads` and the main-worktree `Logo/` to additional working directories, or have the owner copy both into the worktree as part of the existing Task 2 checkpoint (they are already in a browser doing the visibility flip). Otherwise Task 1 blocks the entire phase.
- **Pin the scaffold non-interactively and re-assert `.gitignore` after it**: `npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git --yes` and `npx astro add sitemap --yes`, plus an explicit 01-02 acceptance criterion that `grep -c '!.claude/CLAUDE.md' .gitignore` still returns 1 post-scaffold. Consider moving the `.gitignore` edit from 01-01 to *after* the scaffold in 01-02, where it cannot be overwritten.
- **Fix the resize call in the 01-03 action text**, and add a pre-write assertion inside the extraction script (throw before `toFile` if `max(w,h) > 2000`) so the irreversible step self-guards rather than relying on a post-hoc check.
- **Replace the three literal negative greps with a pointer-plus-judgment check**: keep `equitable interest` and `honest terms` (real literals), drop `purchase not a rental` in favour of a reviewer confirmation against spec §6, and remove the self-contradicting allowlist note at `01-04-PLAN.md:143`.
- **Derive `/homes/<slug>` from the entry id** rather than a frontmatter `slug` field, or add an explicit build-time assertion that `entry.id === entry.data.slug`. Either removes the drift surface without waiting on unverified Astro duplicate-path behaviour.
- **Add the tagline to 01-05's whole-site sweep** alongside the Equal Housing and phone assertions, so ROADMAP criterion 3 is fully covered.
- **Split 01-02 Task 2** into "scaffold + tokens + config" and "schemas + layout + first route," so a failure in the noisiest step (scaffolding into a non-empty git worktree) does not strand the rest.
- **Note on branching**: this worktree is on `claude/suspicious-aryabhata-c256c8` at `c60ddc4`, while `main` sits at `a40b122` in the primary worktree, and four sibling worktrees exist. `01-01` Task 3 pushes "the current branch to remote `main`" and asserts `git ls-remote origin refs/heads/main == git rev-parse HEAD`. That will succeed here but leaves local `main` divergent. Worth making the intended branch topology explicit before the first push, since it defines the repo's permanent history.

## 5. Risk Assessment

**Overall: MEDIUM.**

The *design* risk is low — the phase decomposition is sound, dependencies are correctly ordered, the irreversible steps are identified and gated, and the compliance requirements are enforced by structure rather than discipline. Nothing here needs re-planning.

The *execution* risk is medium and concentrated in the first two plans. Three independent HIGH issues (Bash-vs-PowerShell verify blocks, out-of-sandbox source paths, interactive scaffold that overwrites `.gitignore`) all land in 01-01/01-02, and all three are the kind that produce *apparent* success — a skipped verify, an improvised copy, a silently replaced ignore file — rather than a clean failure. Because 01-02 is the tracer whose output every subsequent plan inherits, an unnoticed defect there propagates through the whole phase.

The MEDIUM findings (resize semantics, vacuous negative greps, entity-decode gap) share that same signature: checks that pass without proving anything. Fixing the plan text on those points before execution is cheap; discovering them afterwards costs a rewritten photo commit in permanent git history or a compliance defect that survives to launch.

---

## Consensus Summary

**Single-reviewer run.** Only the Claude lane was invoked (explicitly, via `--claude`); no cross-model consensus is possible, and the reviewer shares a model family with the planning session — treat agreement as weaker evidence than an independent-model review would provide. The sections below restate that single review's highest-signal findings rather than a multi-reviewer synthesis.

### Agreed Strengths

- Dependency ordering is correct and non-reorderable (repo → tracer → content → pages → sweep), with the one irreversible step (photo commit) gated on a pre-`git add` resize.
- Compliance requirements (DESIGN-02/03) are enforced structurally — legal copy exists only outside CMS-editable collections — rather than by convention.
- Schema validation and deterministic sort are proven by deliberate-failure checks, not assumed.

### Agreed Concerns

1. **HIGH — Shell mismatch:** every `<automated>` verify block in all five plans is Bash, but the execution session is PowerShell 5.1; verify blocks will fail to parse, not fail to pass, risking silently skipped verification.
2. **HIGH — Sandbox paths:** 01-01 Task 1 copies from `Downloads/` and the main worktree's untracked `Logo/`, both outside this worktree's allowed directories — blocks the phase's first task.
3. **HIGH — Interactive scaffold clobbers `.gitignore`:** `npm create astro@latest .` prompts (stdin is null) and its scaffold overwrites the `.gitignore` that 01-01 carefully constructed; no non-interactive flags and no post-scaffold re-assertion are specified.
4. **MEDIUM — Resize is width-only:** the sharp recipe does not implement the asserted 2000px longest-edge constraint; portrait photos pass through oversized into the irreversible photo commit.
5. **MEDIUM — Vacuous/self-contradictory checks:** retired-phrasing greps quote the strings they claim not to quote and test a paraphrase no one would type; the verbatim-transcription check lacks an HTML-entity decode step and will false-fail on correct output.

### Divergent Views

None — single reviewer.
