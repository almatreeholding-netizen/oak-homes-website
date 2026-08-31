---
phase: 01-foundation
plan: 04
subsystem: ui
tags: [astro, content-collections, tailwindcss-v4, compliance-copy, blog]

# Dependency graph
requires:
  - phase: 01-foundation (plan 01-02)
    provides: Layout.astro, Nav.astro, Button.astro, BrandMark.astro, content.config.ts (blog + settings schemas)
  - phase: 01-foundation (plan 01-03)
    provides: PropertyCard.astro, StatusBadge.astro, both real property entries (for the homepage featured-homes section)
provides:
  - The full homepage — brand intro, 3-step overview, featured homes with a never-empty fallback
  - How It Works (FAQ folded in), About, Schedule, and the Contact shell
  - The Learn section — index plus [slug] route — with its seeded first post
  - src/components/StepList.astro
  - scripts/verify/checks.mjs check ids homepage, content-pages, learn-section
affects: [phase-2-publishing, phase-3-integrations]

# Actuals (#2632) — pairs with the plan's estimate to calibrate future estimates.
# chars/4 over the realized diff (git diff bf8dd4b..b26cc30), whole plan.
actuals:
  tokens: 16126
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Owner-financing copy is transcribed verbatim from docs/reference/Oak-Homes-How-It-Works.html rather than re-authored; the content-pages check asserts the exact source strings so a future paraphrase fails the build"
    - "Featured-homes fallback: the homepage queries featured entries and falls back to the newest available homes, so the section can never render empty regardless of how the assistant flags properties"
    - "Contact remains a shell this phase — no form markup is invented ahead of the Zoho Web-to-Lead embed that lands in a later phase"

key-files:
  created:
    - src/pages/how-it-works.astro
    - src/pages/about.astro
    - src/pages/schedule.astro
    - src/pages/contact.astro
    - src/pages/learn/index.astro
    - src/pages/learn/[slug].astro
    - src/content/blog/what-is-a-land-contract.md
    - src/components/StepList.astro
  modified:
    - src/pages/index.astro
    - scripts/verify/checks.mjs
---

## What was built

Every destination in the site's 7-item nav is now a real page. The site builds 10 static pages:
`/`, `/about`, `/contact`, `/homes`, `/homes/614-e-marengo-st`, `/homes/2734-brown-st`,
`/how-it-works`, `/learn`, `/learn/what-is-a-land-contract`, and `/schedule`. No nav link is dead.

**Task 1 — the homepage.** Replaced plan 01-02's minimal tracer homepage with the full version:
brand intro driven by `settings.json`'s `homepageIntro`, the 3-step overview rendered through the
new `StepList.astro`, and a featured-homes section that falls back to the newest available homes
when nothing is flagged featured, so it can never look empty.

**Task 2 — How It Works, About, Schedule, Contact.** How It Works carries the owner-financing
explanation with the FAQ folded in. About and Schedule are real content pages. Contact is a
deliberate shell: the Zoho Web-to-Lead embed and its URL-param prefill script belong to a later
phase, so no form markup was invented here.

**Task 3 — the Learn section.** Index and `[slug]` route over the existing `blog` collection,
seeded with the first post, `what-is-a-land-contract`.

## Compliance

The owner-financing legal wording is transcribed **verbatim** from the owner's one-pager
(`docs/reference/Oak-Homes-How-It-Works.html`), not paraphrased. Verified after merge by diffing
the rendered `/how-it-works` text against the source: the "agreement for deed" passages are
byte-identical, including the em dashes and the "what happens if payments aren't made" clause.

The Equal Housing sentence renders exactly once on all 10 built pages, inherited from
`Layout.astro` rather than duplicated per page.

## Deviations

1. **Retired framing reintroduced and then removed (commit `b26cc30`, self-caught).** The seeded
   Learn post's draft included a "How it's different from renting" section that drew the same
   purchase-vs-rental contrast the design spec (section 6) had explicitly retired — the same idea in
   different words. Reworded to "What the agreement spells out", which conveys the same terms
   without the rental comparison. Worth noting because the framing was retired for a reason and
   re-derived itself naturally during drafting; the `content-pages` check now guards it.

2. **SUMMARY.md written by the orchestrator, not the executor.** The executor was terminated by an
   API error ("Connection lost mid-response") immediately after its final build passed and before it
   could write this file. All five of its commits were already on the branch and the working tree was
   clean, so no implementation work was lost. The orchestrator merged the branch, independently
   re-verified the result (build exit 0, 10 pages, all 10 applicable checks passing, legal wording
   diffed against source, every nav link resolved), and wrote this summary from the verified state.

## Verification

- `npm run build` → exit 0, 10 pages built.
- All applicable checks pass: `sources-staged`, `scaffold-clean`, `skeleton-e2e`, `brand-assets`,
  `photos-resized`, `homes-grid`, `property-page`, `homepage`, `content-pages`, `learn-section`.
- `remote-private` fails for the expected environment reason only — local HEAD is ahead of
  `origin/main` because pushes are batched and performed manually by the owner (the sandbox
  classifier denies `git push`). Not a code defect.

## Deferred

- Pushing the accumulated phase commits to `origin/main` — requires the owner, since the sandbox
  denies `git push`.
