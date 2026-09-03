---
phase: quick-260902-txo
plan: 01
subsystem: legal-compliance
tags: [astro, 10dlc, sms, privacy-policy, compliance, static-pages]

requires:
  - phase: 02-01
    provides: settings collection (getEntry('settings','main')) and shared Layout.astro footer pattern
provides:
  - "/privacy route: full privacy policy with the SMS-consent non-sharing statement 10DLC vetting looks for"
  - "/sms-terms route: CTIA/carrier-expected disclosures (frequency, rates, STOP, HELP, not-a-condition-of-purchase, carrier liability)"
  - "src/data/legal.ts: single source for the two unresolved legal facts and the effective date"
  - "legal-placeholders verification check: fails by file:line while either legal fact is unresolved"
  - "footer links to /privacy and /sms-terms on every page site-wide"
affects: [phase-04-launch, 10dlc-brand-registration, attorney-review]

actuals:
  tokens: 4081
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Legal/compliance prose lives only in src/pages/*.astro + src/data/*.ts, never in src/content/ or as a CMS field (DESIGN-03 precedent, now applied a third time)"
    - "Unresolved real-world facts shipped as loud [[BRACKETED_TOKEN]] placeholders, guarded by a self-testing verification check rather than a code comment or TODO"

key-files:
  created:
    - src/data/legal.ts
    - src/pages/privacy.astro
    - src/pages/sms-terms.astro
  modified:
    - src/layouts/Layout.astro
    - scripts/verify/checks.mjs

key-decisions:
  - "Did not fabricate the legal entity name or business mailing address; shipped as bracketed placeholder tokens with a dedicated red-by-design verification check instead of guessing"
  - "legal-placeholders scans src/data/legal.ts + the two new .astro source files always, and dist/*.html only when a dist directory exists, so the same check works in this build-broken worktree and in a real CI build"
  - "legal-placeholders does not scan checks.mjs itself, since its own self-test fixture contains a bracketed token by construction"

patterns-established:
  - "A verification check can self-test its own detector (two in-memory fixtures) before scanning real files, so a broken regex reports itself instead of silently passing"

requirements-completed: [COMPLIANCE-10DLC-01, COMPLIANCE-10DLC-02, COMPLIANCE-10DLC-03]

coverage:
  - id: D1
    description: "/privacy and /sms-terms both build, are footer-linked from every page, are crawlable (no robots directive), and both appear in the generated sitemap"
    requirement: COMPLIANCE-10DLC-01
    verification:
      - kind: e2e
        ref: "sandbox build assertion (build.log): dist/privacy/index.html, dist/sms-terms/index.html, dist/about/index.html footer links, dist/sitemap-0.xml"
        status: pass
    human_judgment: false
  - id: D2
    description: "Privacy Policy carries the mobile-information non-sharing statement verbatim, including the text-messaging-originator-opt-in-data carve-out"
    requirement: COMPLIANCE-10DLC-02
    verification:
      - kind: e2e
        ref: "grep -qF verbatim-string assertion against dist/privacy/index.html (build.log)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SMS Terms carries all six carrier-expected disclosures verbatim: sender identity/message type, frequency, rates, STOP, HELP, not-a-condition-of-purchase, plus carrier liability notice"
    requirement: COMPLIANCE-10DLC-03
    verification:
      - kind: e2e
        ref: "grep -qF verbatim-string assertions against dist/sms-terms/index.html (build.log)"
        status: pass
    human_judgment: false
  - id: D4
    description: "legal-placeholders check is registered, self-tests its own detector on every run, and fails by file:line for both unresolved facts in source and (once built) in dist HTML"
    verification:
      - kind: other
        ref: "node scripts/verify/checks.mjs legal-placeholders (source + sandbox-dist runs, both captured in this task's terminal output)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The two unknown legal facts (registering entity name, mailing address) are supplied by the owner and the site is not published with them still bracketed"
    verification: []
    human_judgment: true
    rationale: "Only the owner knows the exact legal entity name as filed with the EIN and the physical mailing address; no automated check can supply or validate these facts, only detect their absence. This is the single blocking pre-launch follow-up."

duration: ~20min
completed: 2026-09-02
status: complete
---

# Quick Task 260902-txo: Privacy Policy and SMS Terms Pages Summary

**Two footer-linked static legal pages (`/privacy`, `/sms-terms`) carrying every 10DLC-vetting-expected disclosure verbatim, gated for launch by a self-testing `legal-placeholders` check that is intentionally red until the owner supplies the real legal entity name and mailing address.**

**Blocking pre-launch follow-up:** `src/data/legal.ts` ships two unresolved placeholders,
`[[LEGAL_ENTITY_NAME]]` and `[[BUSINESS_ADDRESS]]`. The owner must supply the exact legal entity
name as it appears on the EIN (Oak Homes may be a DBA) and the physical business mailing address,
before the site goes live on ownwithoak.com and before the 10DLC brand registration is submitted.
`node scripts/verify/checks.mjs legal-placeholders` is red until both are replaced and is the gate.
Both tokens currently live at `src/data/legal.ts:25` (`LEGAL_ENTITY_NAME`) and
`src/data/legal.ts:26` (`BUSINESS_ADDRESS`), and are echoed onto the two rendered pages
(`dist/privacy/index.html`, `dist/sms-terms/index.html`) once built.

**Not legal advice:** these pages are standard-practice compliance copy drafted to what carrier and
TCR vetting look for, not legal advice. Add them to the attorney review already pending on the
land-contract wording (ROADMAP Phase 4 carried-forward note).

## Performance

- **Duration:** ~20 min
- **Tasks:** 3/3 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `/privacy` renders a complete privacy policy: who we are, what we collect, how we use it, the SMS-consent non-sharing carve-out (verbatim), named service providers (Zoho CRM, Netlify), retention, deletion requests, children's privacy, and contact info -- all sourced from the existing `settings` collection for phone/email so it can never drift from the header/footer.
- `/sms-terms` renders all CTIA/carrier-expected disclosures verbatim: sender identity and message type, "Message frequency varies.", "Message and data rates may apply.", STOP opt-out, HELP, "Consent to receive text messages from Oak Homes is not a condition of any purchase.", and "Carriers are not liable for delayed or undelivered messages."
- Both pages are linked from `Layout.astro`'s `footer-nav`, so every page on the site (proven against `/about` in the sandbox build) carries both links, and both routes appear in `dist/sitemap-0.xml`.
- A new `legal-placeholders` verification check was added to `scripts/verify/checks.mjs`: it self-tests its own placeholder-detector regex against two in-memory fixtures before trusting it, then scans `src/data/legal.ts` + both new pages (plus built `dist/*.html` once a build exists) for any `[[UPPERCASE_TOKEN]]` and fails by file:line. It currently fails, by design, naming `LEGAL_ENTITY_NAME` and `BUSINESS_ADDRESS`.
- Proved the whole thing in a real build: exported the committed tree with `git archive HEAD` into a shallow-path sandbox (`/c/tmp/oak-legal-260902-build`) to work around this worktree's pre-existing Rolldown/Windows deep-path build crash, ran `npm install` + `npm run build`, and verified every disclosure string, single-`<h1>` structure, no robots meta tag, footer links on `/about`, sitemap entries, and the dist-half of the placeholder scan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Both legal pages live, footer-linked, single-sourced facts** - `55f1930` (feat)
2. **Task 2: legal-placeholders check** - `984774b` (feat)
3. **Task 3: Prove it in a real build** - no repo files modified (verification-only task); evidence captured in `.planning/quick/260902-txo-add-privacy-policy-and-sms-terms-pages-f/build.log`

**Plan metadata:** left to the orchestrator (SUMMARY.md/STATE.md/WINDOWS.md docs commit is not made by this executor per its explicit constraints).

## Files Created/Modified

- `src/data/legal.ts` - single source for `LEGAL_ENTITY_NAME`, `BUSINESS_ADDRESS` (bracketed placeholder tokens), and `LEGAL_EFFECTIVE_DATE` (hardcoded literal, "September 2, 2026")
- `src/pages/privacy.astro` - `/privacy` route, full privacy policy including the SMS-consent non-sharing statement
- `src/pages/sms-terms.astro` - `/sms-terms` route, all CTIA/carrier-expected SMS disclosures
- `src/layouts/Layout.astro` - two new footer-nav anchors (`/privacy`, `/sms-terms`); nothing else in the file changed
- `scripts/verify/checks.mjs` - new `legal-placeholders` check id, appended as the last property of the `checks` object; no existing check modified

## Decisions Made

- Did not invent the legal entity name or business address under any circumstance -- both are 10DLC-rejection-critical facts that must match the EIN/registration exactly, so guessing would be worse than leaving them visibly unresolved.
- `LEGAL_EFFECTIVE_DATE` is a hardcoded string literal (not `new Date()`), so the effective date does not silently change on every deploy.
- Left `astro.config.mjs` and `src/content/` completely untouched, per the plan's explicit boundary with 02-03's future sitemap `filter` work and DESIGN-03 (legal prose never becomes CMS-editable).

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed line-wrapped verbatim sentences in `privacy.astro`**
- **Found during:** Task 1's own `<verify>` block (first run)
- **Issue:** The plan's required verbatim sentence ("No mobile information will be sold or shared... this information will not be shared with any third parties.") was authored wrapped across three source lines in the `.astro` file. `grep -qF` (and any line-based literal match) cannot match a string split across newlines, so the exact-match verification failed even though the rendered text was correct in substance.
- **Fix:** Reflowed the paragraph onto a single source line so the verbatim string is grep-matchable exactly as specified.
- **Files modified:** `src/pages/privacy.astro`
- **Verification:** Re-ran Task 1's `<verify>` block; passed.
- **Committed in:** `55f1930` (Task 1 commit; caught before commit, not a follow-up fix)

---

**Total deviations:** 1 auto-fixed (1 bug, Rule 1)
**Impact on plan:** No scope change; a pre-commit self-catch of an authoring mistake in the same task.

## Issues Encountered

None beyond the deviation above. The pre-existing Rolldown/Windows deep-path build crash (documented in `02-01-SUMMARY.md`) was worked around exactly as the plan specified, via `git archive HEAD` into a shallow-path sandbox -- not something this task needed to fix.

## Verification Evidence (Task 3)

Ran in a fresh shallow-path sandbox (`/c/tmp/oak-legal-260902-build`), built from `git archive HEAD` of this task's own commits (`55f1930`, `984774b`):

- `npm run build` exited 0; `dist/privacy/index.html` and `dist/sms-terms/index.html` both emitted.
- All eight required disclosure sentences present verbatim in built HTML.
- Neither built page has a robots meta tag; each has exactly one `<h1>`; neither contains U+FFFD.
- `dist/about/index.html` (untouched by this change) carries both new footer links -- proves the links are site-wide via the shared layout, not just on the two new pages.
- `dist/sitemap-0.xml` lists both `ownwithoak.com/privacy` and `ownwithoak.com/sms-terms`.
- `legal-placeholders` run against the sandbox (where `dist/` now exists) still fails, and its failure additionally names `dist/privacy/index.html:9` and `dist/sms-terms/index.html:9` alongside the two source-file findings -- proving the dist-scan path is live, not just the source-scan path.
- `build.log` copied into `.planning/quick/260902-txo-add-privacy-policy-and-sms-terms-pages-f/build.log` as verbatim evidence.

### Pre-existing check-suite failures (classified, not fixed)

Ran the full existing check suite in the same sandbox. Eight checks were already failing before this task (`.planning/WINDOWS.md` deviations 1-8, all open); adding two pages moves the built-HTML count from 11 to 13:

| Check | Result | Cause |
|---|---|---|
| `a11y-sweep` | still fails | its literal-count assertion now says "found 13" instead of "found 11" -- same pre-existing defect (deviation 1), larger number, not a new break. Because it aborts at the count assertion, its per-page a11y sweep never actually runs against the two new pages -- this task's verify block independently reproduced those specific assertions (single h1, lang, charset, skip-link, no U+FFFD) directly against the new pages' built HTML, so the accessibility properties are proven, not assumed. |
| `phase-complete` | still fails | same count assertion, same cause (deviation 4), now says "found 13" |
| `skeleton-e2e` | still fails | `dist/admin/index.html` (02-01's CMS shell) still lacks the Equal Housing sentence -- unrelated to this task (deviation 2). The two new pages themselves carry the Equal Housing line correctly via the shared Layout, so they neither cause nor worsen this failure. |
| `brand-assets` | still fails | same `dist/admin/index.html` gap, missing tagline alt text (deviation 3) -- unrelated, and the two new pages carry the tagline correctly via Layout. |
| `photos-resized` | still fails | Sveltia writes `sqft: null` rather than omitting the key on Brown Street (deviation 5) -- unrelated to legal pages. |
| `homes-grid` | still fails | CMS-written content unquoted YAML strings, so the check's literal `.replace` no-ops (deviation 6) -- unrelated. |
| `property-page` | still fails | both real homes are genuinely `Sold`, so no Inquire button renders (deviation 7) -- unrelated. |
| `content-pages` | still fails | same Sold-homes cause, no Inquire link renders (deviation 8) -- unrelated. |
| `learn-section`, `cms-null-tolerance`, `hero-contrast` | pass | unaffected by this task. |
| `cms-tracer-config` | fails in sandbox only | the throwaway sandbox has no `origin` git remote (expected for a `git archive` + `git init` sandbox with no push target) -- not a real-repo failure and not related to this task; not logged as a new WINDOWS entry since it is a sandbox-environment artifact, not a defect in the checked-out tree. |

All eight pre-existing failures were reported, not fixed -- outside this task's scope per the plan.

## Known Stubs

`src/data/legal.ts` intentionally ships two placeholder values, by design, per the plan:

- `LEGAL_ENTITY_NAME` = `[[LEGAL_ENTITY_NAME]]` (line 25)
- `BUSINESS_ADDRESS` = `[[BUSINESS_ADDRESS]]` (line 26)

These are not oversights: the plan's explicit intent for this task was to ship the pages with these two facts as loud, greppable, un-fabricated placeholders, guarded by the new `legal-placeholders` check (which is intentionally RED right now). The plan's stated goal for this task -- both pages built, footer-linked, disclosure-complete, and the launch gate proven to catch a missing fact -- is fully achieved. Resolution requires the owner to supply the real legal entity name (as filed on the EIN; Oak Homes may be a DBA) and the physical business mailing address in `src/data/legal.ts`, after which `node scripts/verify/checks.mjs legal-placeholders` turns green. Also recorded in `.planning/WINDOWS.md` (entry 9, kind `todo`, open) so it stays visible at ship time.

## User Setup Required

**Owner action required before launch and before 10DLC brand registration submission:**
1. Supply the exact legal entity name as filed on the business's EIN (Oak Homes may be a DBA, not the registering entity).
2. Supply the physical business mailing address.
3. Edit both into `src/data/legal.ts` (`LEGAL_ENTITY_NAME`, `BUSINESS_ADDRESS`), replacing the bracketed tokens.
4. Run `node scripts/verify/checks.mjs legal-placeholders` and confirm it passes.
5. Route both pages' text to the attorney already reviewing the land-contract wording -- this is standard-practice compliance copy, not legal advice.

No other external service configuration is required; both pages use the existing `settings` collection and no new dependency was added.

## Next Phase Readiness

- Both `/privacy` and `/sms-terms` are code-complete, disclosure-complete, crawlable, and sitemap-listed -- ready to go live as soon as the two legal facts are supplied.
- The owner can now proceed with 10DLC brand/campaign vetting submission once (a) the two placeholders are resolved and (b) the live site is confirmed deployed with these pages (Phase 2's pending Netlify/GitHub dashboard setup, tracked separately in STATE.md, governs when that happens).
- No blockers introduced for other in-flight work; `astro.config.mjs` and `src/content/` were left untouched exactly as the plan required, so this task does not collide with 02-03's planned sitemap filter.

## Self-Check: PASSED

All created/modified files (`src/data/legal.ts`, `src/pages/privacy.astro`, `src/pages/sms-terms.astro`, `src/layouts/Layout.astro`, `scripts/verify/checks.mjs`, `.planning/quick/260902-txo-add-privacy-policy-and-sms-terms-pages-f/build.log`) confirmed present on disk. Both task commits (`55f1930`, `984774b`) confirmed present in git log.

---
*Quick task: 260902-txo*
*Completed: 2026-09-02*
