# Phase 2: Publishing - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

The assistant can add a home through a form and watch it appear on the live site about two minutes later, without touching code or asking anyone. This phase wires two already-decided pieces of infrastructure together: Netlify continuous deployment (replacing zip-drag) and Sveltia CMS as a git-based admin panel authenticated through Netlify's built-in OAuth provider. Covers INFRA-03, ADMIN-01 through ADMIN-06. Zoho leads, map pins, video embeds, and OpenGraph rendering are Phase 3; DNS/domain launch is Phase 4.

02-RESEARCH.md and 02-UI-SPEC.md are already complete and verified for this phase — this discussion only resolves the vision-level gray areas those documents flagged as open (contact info, delivery format, account-access model, notification scope). It does not re-litigate the locked technical config (config.yml patterns, wrapper-key fix, publish mode, OAuth callback URL) — those are Claude's to implement as researched.

</domain>

<decisions>
## Implementation Decisions

### Assistant's GitHub access
- **D-18:** Deferred to a checkpoint during execution rather than decided now — the owner is not sure yet whether the assistant will use a separate GitHub account (added as a repo collaborator with Write access, per 02-RESEARCH.md's security recommendation) or share the Oak Homes account. Plan this as an explicit human-in-the-loop checkpoint (same pattern as Phase 1's INFRA-01 GitHub walkthrough), not an assumption. Whichever is chosen, the assistant's account should get Write access only, never Admin/Owner.

### Cheat-sheet delivery & support contact
- **D-19:** Cheat-sheet delivery confirmed as designed in 02-UI-SPEC.md: a single Astro page at `/publishing-guide`, `noindex`, styled with Phase 1's brand tokens, printed/exported to PDF once by the developer and handed to the assistant. No Google Doc or Canva alternative — stays in-repo as the single source of truth.
- **D-20:** The `[developer contact]` placeholder in the Troubleshooting Copy (02-UI-SPEC.md) resolves to **the owner**, using the existing public phone number (217) 269-0003 already on the site — no separate technical contact. The cheat-sheet's "Build not reflected," "CMS won't let you save," and "Sign-in fails" rows all route back to this same number.

### Netlify site setup
- **D-21:** Whether a Netlify site already exists and is linked to `almatreeholding-netizen/oak-homes-website` is **unconfirmed** — the owner doesn't know either (the site may or may not already be connected from the original zip-drag deploy account, `cool-semifreddo-760942`). Plan this as a live-verify checkpoint at the start of execution (per 02-RESEARCH.md Open Question 1 and Pitfall 5): check first, then either reconfigure the existing site for continuous deployment or create a new one — don't assume either path.

### Build-failure safety net
- **D-22:** No additional automation beyond the cheat-sheet's existing troubleshooting copy ("wait ~10 minutes after Publish, then call [developer contact] if nothing changed"). The owner explicitly chose not to add a Netlify build-failure notification email — keep it simple, $0 cost, matches 02-UI-SPEC.md as already approved. Do not add build-status tooling this phase.

### Claude's Discretion
- Exact GitHub OAuth App Homepage URL to use before domain cutover (02-RESEARCH.md Assumption A2) — verify the reachable Netlify-provided URL at setup time.
- All CMS config.yml field syntax, widget choices, and the settings wrapper-key fix — fully specified in 02-RESEARCH.md Patterns 1-5 and 02-UI-SPEC.md's locked copy contract; implement as researched, not open for re-discussion.
- Sequencing of the GitHub OAuth App registration → Netlify OAuth provider install → `/admin` login verification (02-RESEARCH.md Pitfall 5).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 research & design (primary — read first)
- `.planning/phases/02-publishing/02-RESEARCH.md` — Netlify/Sveltia CMS implementation research: architecture diagram, config.yml patterns (properties/blog/settings collections), the settings wrapper-key fix (Pitfall 1), slug sanitization pitfalls (2-3), OAuth setup sequencing (Pitfall 5), security domain (ASVS), assumptions log
- `.planning/phases/02-publishing/02-UI-SPEC.md` — UI design contract: cheat-sheet page design (`/publishing-guide`), locked CMS field labels/hints/validation-message copy (must match config.yml verbatim), troubleshooting copy, UI considerations probe results

### Requirements & project context
- `.planning/REQUIREMENTS.md` — Phase 2 requirement IDs: INFRA-03, ADMIN-01 through ADMIN-06
- `.planning/PROJECT.md` — project constraints ($0/month, non-technical assistant, ≤2-minute publish-to-live), Key Decisions table
- `.claude/CLAUDE.md` (Technology Stack section) — locked stack decisions referenced by 02-RESEARCH.md

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-06 (featured field / schema-desync reversibility risk), D-17 (settings seed values) — the content schema and settings.json shape this phase's CMS config must match exactly

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/content.config.ts` — Property, blog, and settings Zod schemas already finalized (Phase 1); this phase's `admin/config.yml` must match field-for-field, including Phase-3-only fields (`videoUrl`, `location`, `ogImage`) that stay intentionally omitted from the CMS this phase.
- `src/content/settings.json` — existing `{ "main": { ... } }` shape that the settings collection's `object`-widget wrapper (Pattern 4) must reproduce exactly.
- Phase 1's brand tokens (`src/styles/global.css`) — reused unchanged for the `/publishing-guide` cheat-sheet page; no new design tokens introduced this phase.

### Established Patterns
- Content lives in `src/content/{properties,blog}/*.md` + `src/content/settings.json`; CMS-bound images in `public/uploads/` — both set in Phase 1, unchanged this phase.
- `public/admin/` does not exist yet — this phase creates it (`index.html` CDN loader + `config.yml`).

### Integration Points
- `admin/config.yml` ↔ `src/content.config.ts`: must always change together in the same commit (carried forward from Phase 1 D-06 and STATE.md blockers; restated as 02-RESEARCH.md Pitfall 4).
- Netlify build hook ← GitHub push to `main` (no PR/editorial workflow — direct commit, per the ~2-minute publish goal).

</code_context>

<specifics>
## Specific Ideas

- The cheat-sheet's troubleshooting section should read as calling the owner personally, not a generic "support" line — reinforces the small, personal nature of the business.
- Netlify site verification should happen early in execution (a real live check, not an assumption) since the answer changes whether this phase creates a new site or reconfigures an old one.

</specifics>

<deferred>
## Deferred Ideas

- Automated build-failure notifications (e.g., Netlify's built-in failed-deploy email) — explicitly declined this phase; revisit only if the "wait 10 minutes" cheat-sheet instruction proves unreliable in practice.
- Assigning the assistant a permanent, separate GitHub identity — left as an execution-time checkpoint rather than a phase-level decision; may inform a future phase's access-control notes if it changes.

### Reviewed Todos (not folded)
None — no pending todos matched this phase's scope.

</deferred>

---

*Phase: 2-Publishing*
*Context gathered: 2026-08-31*
