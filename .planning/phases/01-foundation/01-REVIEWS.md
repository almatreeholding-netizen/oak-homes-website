---
phase: 1
reviewers: [claude]
reviewed_at: 2026-08-30T00:45:48Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md]
review_round: 2
---

# Cross-AI Plan Review — Phase 1

## Claude Review

# Cross-AI Plan Review — Phase 1: Foundation (revised set)

**Repo access:** yes, but **limited** — the worktree sandbox blocks reads outside `.claude/worktrees/peaceful-kepler-2c16f5`, so I could not verify the source-file byte sizes or the nine logo files. Those are downgraded to open questions below.

---

## 1. Summary

This is a strong revision. Every finding from the prior review round is genuinely incorporated rather than acknowledged — the shell contract is real and enforced (`SKELETON.md:114`), the resize is now a two-axis box constraint with a pre-write throw (`SKELETON.md:105-108`), the route is rebound to `entry.id` with a drift assertion (`SKELETON.md:109-111`), and the retired-phrasing grep that tested a paraphrase nobody would type was replaced with honest reasoning plus a judgment gate (`01-04-PLAN.md` allowlist note). The plans are unusually candid about their own weak spots. What remains are mostly *residues* of the revision: one hardcoded worktree path that is now wrong, one Bash pipeline that survived the shell-contract sweep, and one internal contradiction in the brand-asset criteria. None is architectural; all are cheap to fix before execution and expensive to hit at runtime.

---

## 2. Strengths

- **The shell contract is enforced, not just declared.** Every `<automated>` block across all five plans is a single `node scripts/verify/checks.mjs <id>` invocation, the CLI is created in the first plan before any `package.json` exists (`01-01-PLAN.md` Task 2), and it is required to exit non-zero on an unknown check id — closing the "typo reads as a pass" hole. Codified as skeleton invariant 8 (`SKELETON.md:114-116`).
- **The irreversible step now self-guards.** The photo write is protected by `fit: 'inside'` on both axes *and* a pre-`toFile` metadata re-read that throws, *and* an acceptance criterion that deliberately lowers the threshold to 200 to prove the guard fires (`01-03-PLAN.md` Task 1). Guard-then-prove is the correct ordering for a step git cannot undo.
- **Branch topology is stated and is factually correct.** I verified it: `git rev-list --count HEAD..main` → `0`, `main..HEAD` → `14`. `main` (a40b122) is a strict ancestor of this branch, so 01-01 Task 3's "fast-forward `main` from `origin/main`, never force-push over it" is accurate advice, not hopeful advice.
- **DESIGN-03 is enforced structurally rather than by policy.** The same literal is positive-grepped across `dist/` and negative-grepped under `src/content/` (`01-02-PLAN.md` Task 3, `01-04-PLAN.md` Task 2). Because Phase 2's CMS can only surface fields that exist in a collection, a field that does not exist cannot be edited into a compliance problem. That is a real mechanism.
- **The transcription check is now bidirectional.** `01-04-PLAN.md` Task 2 specifies the five-step normalisation pipeline *in order* and requires a deliberate one-word edit to make the comparison fail. A comparison that has never failed has not been shown to be a comparison — the plan says exactly that.
- **Verified environment claims hold.** `.gitignore` is exactly the two lines the plans describe (`.gitignore:1-2`, `.claude/*` + `!.claude/CLAUDE.md`), `git remote -v` returns nothing (no `origin` yet), and `docs/reference/` and `scripts/` do not exist — all consistent with 01-01's preconditions.

---

## 3. Concerns

**HIGH — 01-01 Task 1 hardcodes a worktree path that is not this worktree.**
The owner instruction reads: *"The worktree root is: `...\.claude\worktrees\suspicious-aryabhata-c256c8`"*, and Task 3 asserts *"This checkout is a git worktree on branch `claude/suspicious-aryabhata-c256c8`"*. Verified via `git worktree list`: that worktree **does exist** as a sibling at the same commit `0bb205f`, but the current checkout is `peaceful-kepler-2c16f5` on branch `claude/peaceful-kepler-2c16f5`. Five worktrees exist on this repo. This is worse than a stale path — the named directory is real, so an owner following the instruction literally will successfully stage the mockups, the one-pager, and the nine logo files into a *different* tree. Task 2's precondition then fails, and Task 2 explicitly forbids the executor from reaching outside its own worktree or reconstructing a missing file. The phase deadlocks at its first blocking gate, with the files visibly present on disk. This is the exact class of failure the prior review's sandbox finding was about, reintroduced by pinning an absolute path.

**MEDIUM — `01-05-PLAN.md` Task 2 still contains a Bash pipeline, violating its own shell contract.**
Acceptance criterion: *"`git ls-remote origin refs/heads/main | cut -f1` equals `git rev-parse HEAD`"*. `cut` does not exist in PowerShell 5.1 — it is on the plan's own list of absent utilities in its `<shell_contract>`. Notably `01-01-PLAN.md` Task 3 states the equivalent criterion correctly ("the first field of `git ls-remote ...`"), so the fix pattern already exists in the plan set. Low consequence (the `phase-complete` check implements it in Node), but it is a leftover of the sweep that just ran, and criteria are what a human re-runs by hand.

**MEDIUM — `01-02-PLAN.md` Task 4 contains an internal contradiction between the favicon and the `/brand/` grep.**
Two criteria in the same task: *"No `.astro` file under `src/` other than `BrandMark.astro` contains the substring `/brand/`"* and *"the built home page head references the favicon"*. The favicon set (32px, 180px apple-touch, 192px Android) is delivered via `<link rel="icon" href="/brand/...">` in the document head, which lives in `Layout.astro` — `BrandMark.astro` emits `<img>`, not head links. As written, satisfying either criterion breaks the other. Needs an explicit carve-out (favicon `<link>` tags in `Layout.astro` are exempt) or a `BrandMark` head-slot variant.

**MEDIUM — the `photos` schema shape conflicts between the plan and the research it tells the executor to read.**
`01-02-PLAN.md` Task 3 says *"`photos` defaults to an empty array deliberately rather than requiring at least one entry"* — required, because `01-03-PLAN.md` Task 3's zero-photo placeholder criterion temporarily empties the array and expects a passing build. But Task 3's `read_first` points at RESEARCH.md Pattern 1, which specifies `photos: z.array(z.string()).min(1)` (`01-RESEARCH.md:260`) with the comment "ordered; first = cover (PROP-01)". An executor transcribing the cited pattern gets `.min(1)` and the 01-03 criterion becomes unsatisfiable two plans later. The plan states the override, but the cited source contradicts it — worth an explicit "supersedes RESEARCH.md Pattern 1's `.min(1)`" note, exactly as Task 1 does for the resize recipe.

**MEDIUM — the extraction script can leave partial output if it throws mid-loop.**
`01-03-PLAN.md` Task 1's guard throws before `toFile` for the *offending* photo, but nothing prevents photos 1–4 from already being on disk when photo 5 throws. The threshold-lowering test happens to hide this (at 200 every photo fails, so photo-01 throws first and nothing is written), which means the proof does not exercise the partial case. The phase's entire safety argument is "nothing oversized reaches the working tree" — partial output plus a re-run is how a stale, wrongly-numbered file survives into the commit. Encode-and-validate all eleven into memory first, then write, or write to temp names and rename only after the full set validates.

**MEDIUM — whole-tree byte-identical rebuild is a fragile check whose likely failure mode is deletion.**
Both `01-03-PLAN.md` Task 2 and `01-05-PLAN.md` Task 2 require two consecutive builds to produce byte-identical HTML. What is actually being tested in 01-03 is *sort determinism* — that two Available homes tying on status and date do not swap. Whole-tree equality couples that narrow, valuable assertion to every incidental non-determinism Astro/Vite/sitemap may introduce across versions. If it false-fails, the plans' own stated worry applies: the tempting fix is to weaken the check. Scope 01-03's to the ordering of card identifiers within `dist/homes/index.html`.

**LOW-MEDIUM — the `entry.id === entry.data.slug` assertion assumes a flat collection but the loader glob is `**/*.md`.**
`01-RESEARCH.md:246` uses `pattern: '**/*.md'`. With that pattern, `properties/a/x.md` yields id `a/x`, which can never equal a `slug` satisfying the plan's lowercase-hyphen regex — so any nested file hard-fails the build with a message about slug drift rather than about nesting. The plan's premise ("two files cannot share one filename") is only true within one flat directory. Use `*.md` and say so, or make the assertion message name nesting as a cause.

**LOW-MEDIUM — the GCM credential-persistence check can hang rather than fail.**
`01-01-PLAN.md` Task 3 asserts a second `git ls-remote` succeeds "with no interactive prompt". Git Credential Manager surfaces a *GUI* dialog, not a console prompt — `spawnSync` will block on it indefinitely with no timeout specified, and the plan's own environment notes say stdin is null. Add an explicit `timeout` to that `spawnSync` so "GCM re-prompted" reports as a failure instead of a hung verification.

**LOW — `create-astro` flag combination may self-conflict.**
`01-02-PLAN.md` Task 2 pins `--template minimal --typescript strict --no-install --no-git --skip-houston --yes`. `--yes` is "accept all defaults", which in some `create-astro` versions implies install and git init — potentially fighting `--no-install`/`--no-git`. The plan does instruct falling back to `--help`, so this is caught, but since every answer is already supplied explicitly, `--yes` is redundant and is the flag most likely to cause a surprising default.

**LOW — `01-UI-SPEC.md:22` still names `tailwind.config.mjs`.**
The price-gold contradiction at line 160 was corrected in place with a "do not revert" note; the stale Tailwind-config reference at line 22 was left standing, contradicting `SKELETON.md:37`, `01-RESEARCH.md` Pitfall 2, and `01-02-PLAN.md` Task 2. The plans route around it correctly, but inconsistent remediation of the same document invites a future reader to follow the uncorrected line.

**LOW — the temp scaffold directory is not covered by `.gitignore`.**
The 01-02 fallback path creates `.astro-scaffold-tmp/`. If the cleanup step fails, it is untracked-but-not-ignored at the moment `git add` runs.

---

## 4. Suggestions

1. **Replace the absolute worktree path in 01-01 Task 1 with a derived one.** Have the executor print `git rev-parse --show-toplevel` at the top of the checkpoint and paste that into the owner instruction, and drop the hardcoded branch name from Task 3 in favour of `git rev-parse --abbrev-ref HEAD` recorded into the summary. Nothing about the phase should encode which worktree it ran in.
2. **Restate 01-05's remote-SHA criterion in 01-01's wording** ("the first field of `git ls-remote origin refs/heads/main`"), and grep the whole plan set once more for `|`, `&&`, `cut`, `grep`, `find`, `wc` inside criteria as well as inside verify blocks.
3. **Add a favicon carve-out to 01-02 Task 4's `/brand/` grep**, or move the head `<link>` tags behind a `BrandMark.astro` head-slot export so the "one consumer" invariant stays literally true.
4. **Add an explicit supersession note for `photos`** in 01-02 Task 3, mirroring the one Task 1 of 01-03 uses for the resize recipe — the same RESEARCH.md-is-a-sketch hazard, same fix.
5. **Make the photo extraction atomic:** decode and validate all eleven buffers, then write. Add a partial-failure test (make only photo 3 fail the threshold) so the proof covers the case the current test misses.
6. **Narrow the 01-03 determinism check** to the card ordering within the grid page; keep whole-tree reproducibility in 01-05 as informational rather than as a gate.
7. **Correct `01-UI-SPEC.md:22`** the same way line 160 was corrected, with the same "do not revert" annotation.

---

## 5. Risk Assessment

**Overall: MEDIUM-LOW** — down from the prior round's MEDIUM.

The architecture is sound and the two genuinely irreversible actions (public-repo push, the photo commit) are each guarded by a structural precondition plus a proof that the guard fires. The verification mechanism is now shell-independent and self-invalidating on unknown ids, which removes the previous round's dominant failure mode of silently skipped checks.

What keeps this above LOW is the hardcoded worktree path. It is the first instruction in the phase, it is given to the person least able to diagnose it, it names a directory that really exists, and its failure presents as "the files are right there but the executor says they're missing." Everything else is a cheap pre-execution text fix. Correct that one and the residual risk is ordinary execution risk on a well-specified greenfield build.

**Open questions (could not verify — sandbox blocked):** the asserted byte sizes 2,673,638 and 22,508, the presence of the nine files in `Logo/`, and the mockup's `window.PROPERTIES` photo counts (6/5). All three are load-bearing acceptance criteria; the executor will be the first party able to confirm them.

---

## Consensus Summary

Single-reviewer round (Claude only, headless separate session with repo access) — no cross-model consensus is possible; the findings below are one grounded reviewer's verdict on the revised plan set.

The reviewer confirms every finding from review round 1 was genuinely incorporated (shell contract enforced via `scripts/verify/checks.mjs`, two-axis resize guard with pre-write throw, `entry.id` route binding with drift assertion, transcription check made bidirectional). Overall risk dropped from MEDIUM to **MEDIUM-LOW**.

### Agreed Strengths

(Single reviewer — strengths as found, all verified against the repo:)
- Shell contract enforced structurally: every `<automated>` block is one `node scripts/verify/checks.mjs <id>` call that exits non-zero on unknown ids
- The irreversible photo write is guarded (`fit: 'inside'` + pre-`toFile` metadata throw) and the guard is proven to fire
- Branch topology claims verified factually correct (`main` is a strict ancestor; 14 commits ahead)
- DESIGN-03 owner-financing copy enforced structurally (positive grep in `dist/`, negative grep in `src/content/`), not by policy

### Agreed Concerns

(Top findings by severity:)
1. **HIGH — 01-01 Task 1 hardcodes the wrong worktree path** (`suspicious-aryabhata-c256c8` instead of the current `peaceful-kepler-2c16f5`). The named sibling worktree really exists, so the owner would stage assets into a different tree and the phase deadlocks at its first blocking gate. Replace with a derived path (`git rev-parse --show-toplevel`).
2. **MEDIUM — 01-05 Task 2 retains a Bash pipeline** (`| cut -f1`) violating the plan set's own shell contract; 01-01 Task 3 already shows the correct wording.
3. **MEDIUM — 01-02 Task 4 self-contradicts**: the favicon `<link>` tags in `Layout.astro` necessarily break the "only `BrandMark.astro` contains `/brand/`" grep. Needs a carve-out.
4. **MEDIUM — `photos` schema conflict**: plan requires a default-empty array but the cited RESEARCH.md Pattern 1 specifies `.min(1)`; needs an explicit supersession note.
5. **MEDIUM — photo extraction is not atomic**: a mid-loop throw leaves partial output on disk, and the current guard-proof test doesn't exercise that case.
6. **MEDIUM — whole-tree byte-identical rebuild gate is fragile**; scope 01-03's determinism check to card ordering in `dist/homes/index.html`.

### Divergent Views

None — single reviewer. Open questions the reviewer could not verify from inside the sandbox: the asserted source byte sizes (2,673,638 / 22,508), the nine `Logo/` files, and the mockup's `window.PROPERTIES` photo counts.
