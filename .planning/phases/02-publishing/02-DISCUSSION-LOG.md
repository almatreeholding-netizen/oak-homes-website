# Phase 2: Publishing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 2-Publishing
**Areas discussed:** Assistant's GitHub access, Cheat-sheet delivery & support contact, Netlify site setup, Build-failure safety net

---

## Assistant's GitHub access

| Option | Description | Selected |
|--------|-------------|----------|
| Separate GitHub account | Assistant creates their own free GitHub account; added as a collaborator with Write access (not Admin). Matches research's security recommendation. | |
| Share the Oak Homes account | Assistant signs in with the same almatreeholding-netizen account used for the repo. Simpler, but full owner-level access. | |
| You decide later | Leave as an open task for the owner to resolve during execution; Claude proceeds assuming a collaborator invite is possible and flags it as a checkpoint. | ✓ |

**User's choice:** You decide later
**Notes:** Owner is not sure yet which account model to use — deferred to an execution-time checkpoint rather than decided now.

---

## Cheat-sheet delivery & support contact

| Option | Description | Selected |
|--------|-------------|----------|
| Astro page, print/PDF (as designed) | Stays in repo, uses site's brand tokens, developer prints/exports to PDF once. No new tools, $0 cost. | ✓ |
| Google Doc instead | Easier to skim/edit later, but a second source of truth that can drift from the CMS. | |
| Canva handout instead | More visually polished, but adds a design-tool dependency and manual re-export step. | |

**User's choice:** Astro page, print/PDF (as designed)
**Notes:** Confirms the 02-UI-SPEC.md design as-is — no change to the cheat-sheet delivery format.

**Follow-up — developer contact placeholder:**

| Option | Description | Selected |
|--------|-------------|----------|
| You (the owner) | Use owner's own name and the existing (217) 269-0003 number. | ✓ |
| A developer/technical contact | Separate name/number for whoever handles the code. | |

**User's choice:** You (the owner)
**Notes:** The `[developer contact]` placeholder in the Troubleshooting Copy resolves to the owner, using the phone number already public on the site.

---

## Netlify site setup

| Option | Description | Selected |
|--------|-------------|----------|
| Not set up yet — do it this phase | Browser walkthrough to create the Netlify site, connect the repo, register the GitHub OAuth App. | |
| Already set up | A Netlify site already exists (e.g. from the original zip-drag deploy account, cool-semifreddo-760942) — just needs reconfiguring. | |
| Not sure | Flag as a checkpoint to verify live at the start of execution. | ✓ |

**User's choice:** Not sure
**Notes:** Owner doesn't know current Netlify state — plan this as a live-verify checkpoint before assuming create-new vs. reconfigure-existing.

---

## Build-failure safety net

| Option | Description | Selected |
|--------|-------------|----------|
| Cheat-sheet instruction is enough | No extra automation — assistant checks the live site after publish; matches UI-SPEC as approved. | ✓ |
| Add Netlify build-failure email | Turn on Netlify's built-in failed-deploy notification email as a backup. | |

**User's choice:** Cheat-sheet instruction is enough
**Notes:** Owner explicitly declined the extra notification layer — keep this phase's scope as researched/designed.

---

## Claude's Discretion

- Exact GitHub OAuth App Homepage URL to use before domain cutover — verify the reachable Netlify-provided URL at setup time.
- All CMS `config.yml` field syntax, widget choices, and the settings wrapper-key fix — fully specified in 02-RESEARCH.md; not re-discussed.
- Sequencing of GitHub OAuth App registration → Netlify OAuth provider install → `/admin` login verification.

## Deferred Ideas

- Automated build-failure notifications (Netlify failed-deploy email) — explicitly declined this phase; revisit only if the cheat-sheet's "wait 10 minutes" instruction proves unreliable in practice.
- Assigning the assistant a permanent, separate GitHub identity — left as an execution-time checkpoint; may inform a future phase's access-control notes if it changes.
