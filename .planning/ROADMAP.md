# Roadmap: Oak Homes Website (ownwithoak.com)

## Overview

The site is built along a dependency chain that cannot be reordered: a repo must exist before anything can target it, the content schema must be final before the admin panel is configured against it, the admin panel must work before integrations are layered on, and the domain moves last because DNS is the only step that can break something already working (Google Workspace email). Four phases follow that chain. Phase 1 produces a real, browsable site with both real homes in a real repo. Phase 2 makes it deploy itself and hands the assistant a form-based admin panel. Phase 3 turns visitors into Zoho leads and makes shared links look right on Facebook. Phase 4 puts it all on ownwithoak.com without dropping a single email.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Real repo, real site, both real homes — browsable end to end
- [ ] **Phase 2: Publishing** - Auto-deploy on every commit plus a form-based admin panel the assistant can use unaided
- [ ] **Phase 3: Integrations** - Zoho leads with property prefill, map pins, video embeds, and rich social previews
- [ ] **Phase 4: Launch** - ownwithoak.com live with Google Workspace email intact and leads verified in production

## Phase Details

### Phase 1: Foundation

**Goal**: A visitor can browse the complete Oak Homes site — homepage, both real homes, and every content page — served from a real, owned git repo
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-04, BROWSE-01, BROWSE-02, BROWSE-03, PROP-01, PROP-02, EDU-01, EDU-02, EDU-03, EDU-04, EDU-05, LEAD-03, DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04, DESIGN-05, DESIGN-06
**Success Criteria** (what must be TRUE):

  1. An Oak Homes GitHub account exists, this computer pushes to it, and a private repo holds the site source and content as the single source of truth.
  2. From the homepage a visitor can click through to the Homes grid — each card showing cover photo, address, status badge, down payment, and monthly payment — and open either real home at its own `/homes/<slug>` URL with an ordered gallery, terms, beds/baths/square footage, and a rich description.
  3. Every page carries the mockup's branding (yellow #F6C84C / ink #1A1A1A / warm cream, Lora + Inter, leaf logo, "From Rent to Roots"), the phone number (217) 269-0003, the Equal Housing Opportunity footer with the refined legal wording, and a marked integrations slot — all inherited from one shared layout, so a new page template structurally cannot ship without them.
  4. How It Works (with the FAQ folded in), About, Learn (index plus at least one post), and Schedule a Showing are reachable from the navigation, read correctly at phone width, and pass WCAG 2.1 AA basics — alt text, contrast, keyboard-navigable forms and menus.
  5. Adding or changing a home requires editing only its markdown file and photos — no template edits — and the build fails loudly when a required field is missing or malformed.

**Plans**: 3/5 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Own the repo before anything ships: owner stages the mockups and logo sources into the worktree and flips the repo to Private, then verify, commit, and push (also creates `scripts/verify/checks.mjs`, the phase's shell-independent verification CLI)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Walking Skeleton: non-interactive Astro scaffold + Tailwind v4 tokens (Task 2), then the tracer proper — full content schema + shared layout + route rendering one real home end to end (Task 3) — plus the brand mark export (Task 4)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Both real homes: extract and resize the eleven photos, build the Browse Homes grid and the full property page with gallery and lightbox

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-04-PLAN.md — Every content page reachable: homepage, How It Works with the FAQ folded in, About, Schedule, Contact shell, and the Learn section

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-05-PLAN.md — Accessible, mobile-first, and pushed: WCAG 2.1 AA sweep, whole-phase verification, README, and the final push

**UI hint**: yes

**User-collaboration checkpoint** *(reduced during planning — see D-11/D-13; re-scoped after cross-AI review)*: the Oak Homes GitHub account `almatreeholding-netizen` and the repo `oak-homes-website` **already exist**, so no account-creation walkthrough is needed. Two owner-facing actions remain, bundled into one blocking `checkpoint:human-action` at the very top of 01-01: (1) copying the two source HTML files and the nine logo files into the worktree — review found both source paths sit outside the executor's allowed working directories, so an executor cannot reach them and would otherwise either halt the phase or improvise substitutes for the property photos and the legally-refined copy; and (2) flipping the repo from Public to Private (GitHub Settings → Danger Zone), which has no CLI path on this machine. The push is gated behind the checkpoint by a precondition. Local scaffold work does not block on it.

**Carried-forward notes**:

- Land-contract and Equal Housing copy lives in code, never in the CMS (DESIGN-03) — the assistant must not be able to edit it into a compliance problem.
- The content schema finalized here must already include the fields Phase 3 reads (map coordinates, optional video URL, OpenGraph fields). Adding them later would desynchronize the CMS config written in Phase 2 — the exact drift pitfall research flagged.
- Both migrated homes' photos are pre-resized to ~2000px before their first commit, setting the precedent the Phase 2 cheat-sheet documents. Git history keeps oversized images forever.
- ~~Confirm the Brown Street house number (2734 vs 2437) with the owner before it becomes a permanent slug.~~ **Resolved: 2734** (D-14), independently corroborated by the mockup's own `address` field (`2734 Brown Street`). Permanent slug: `2734-brown-st`.
- Accent yellow is `#FFD053`, sampled from the owner's real logo files (UI-SPEC, 2026-08-29). This supersedes the `#F6C84C` estimate that still appears in the DESIGN-01 prose above and in REQUIREMENTS.md. Price figures use `#A87E24`, which passes AA on both cream surfaces.
- Deployment is **not** in this phase. Phase 1's definition of done is a clean local `npm run build` plus a push to the private repo; INFRA-03 (Netlify auto-deploy) is Phase 2.

### Phase 2: Publishing

**Goal**: The assistant can add a home through a form and watch it appear on the live site about two minutes later, without touching code or asking anyone
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: INFRA-03, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06
**Success Criteria** (what must be TRUE):

  1. Every commit to the repo triggers a Netlify build and an atomic deploy; the site is reachable at a live HTTPS preview URL and zip-drag deploys are retired.
  2. The assistant can open `/admin`, sign in with GitHub, and land in a form-based panel — no terminal, no code, no Claude in the loop.
  3. The assistant can add a home (address, terms, specs, description, photos, status) and see it on the live listing grid and its own page within about two minutes of pressing Publish.
  4. The assistant can edit an existing home and flip its status to Pending or Sold from a dropdown, publish a Learn post with title, rich text, and optional cover image, and change site settings (phone, email, social links, homepage intro) — each change visible on the live site after Publish.
  5. The assistant holds a one-page illustrated cheat-sheet covering photo pre-resizing (~2000px), the publish-and-verify loop, and what to do when something looks wrong.

**Plans**: TBD

**Carried-forward notes**:

- The CMS config and the Astro content schema describe the same shape in two files. They change together, in the same commit, always — otherwise the admin form silently produces frontmatter the build rejects.
- Sveltia CMS over Decap (Decap is in maintenance mode); authentication uses Netlify's built-in OAuth provider, so no custom function is needed. Verify the OAuth callback URL character-for-character — research rates this area MEDIUM confidence and worth a live spot-check.
- Success criterion 3 is the real test of this phase: have the assistant do it, unaided, while someone watches without helping.

### Phase 3: Integrations

**Goal**: A visitor on a home page can become a Zoho lead in one click, see where the home sits on a map, and share a link that renders as a proper card
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: LEAD-01, LEAD-02, PROP-03, PROP-04, PROP-05
**Success Criteria** (what must be TRUE):

  1. A submission from the Contact page arrives in Zoho CRM as a Lead tagged "Website Lead" — verified with a real test submission on the preview domain, then deleted.
  2. Clicking Inquire on a home page opens the contact form with that home's address already filled in.
  3. Each home page shows a map pin at the correct location, rendered from OpenStreetMap tiles with no API key and no billing account attached.
  4. Pasting a home's URL into the Facebook Sharing Debugger returns a preview card showing the cover photo, address, and terms.
  5. A home with a video link shows the embedded video on its page; a home without one shows nothing — no empty slot, no broken frame.

**Plans**: TBD

**Carried-forward notes**:

- Zoho Web-to-Lead has no built-in URL-parameter prefill — that is a Zoho *Forms* feature. Criterion 2 requires custom JavaScript that reads the query parameter and sets the hidden field before submit. Field naming is account-specific, so this needs hands-on testing against the live embed rather than a paper design.
- Criterion 4 must be proven with the actual Sharing Debugger, not by eyeballing meta tags in the page source.
- Everything verified here gets re-verified on the production hostname in Phase 4. Zoho's source-URL validation can behave differently under a different domain.

### Phase 4: Launch

**Goal**: The site serves the public at ownwithoak.com with Google Workspace email unbroken and a real lead confirmed arriving from the production domain
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04
**Success Criteria** (what must be TRUE):

  1. Before any nameserver change, every existing MX, SPF, DKIM, and DMARC record is staged side by side in Oak's Cloudflare zone and TTLs are lowered — captured as a written pre-cutover checklist the owner reviews and approves.
  2. `ownwithoak.com` and `www.ownwithoak.com` serve the new site over HTTPS (A → 75.2.60.5, www → Netlify), and the old zip-drag Netlify URL no longer serves a stale copy.
  3. A test email is sent and received on an @ownwithoak.com address immediately after cutover, and SPF (`v=spf1 include:_spf.google.com ~all`) resolves correctly.
  4. A test inquiry submitted from the production domain arrives in Zoho tagged "Website Lead" and is then deleted — confirming the prefill script and Zoho's source-URL validation still work under the real hostname.
  5. Google Business Profile is claimed with name, address, and phone matching the site exactly, and the sitemap is submitted to Google Search Console.

**Plans**: TBD

**Highest-risk step — sequence it last**: LAUNCH-02 (email-safe DNS cutover) is the one action in this project that can break something already working. Google Workspace email fails *silently* when MX records are lost — nothing errors, mail simply stops arriving. Everything verifiable without touching DNS (criterion 1 staging, Google Business Profile claim, sitemap generation) happens first; the nameserver change and its email verification are the final gate, followed immediately by criteria 3 and 4. Do not begin the cutover until the owner is available to confirm mail flow within the hour.

**Carried-forward notes**:

- Attorney review of the land-contract wording is pending and gates heavy promotion — surface it as a launch checklist item, not a blocker on going live.
- Note Netlify's free-tier usage dashboard as a post-launch monitoring item; exceeding limits takes the site offline without warning.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/5 | In Progress|  |
| 2. Publishing | 0/TBD | Not started | - |
| 3. Integrations | 0/TBD | Not started | - |
| 4. Launch | 0/TBD | Not started | - |

## Requirement Coverage

All 36 v1 requirements map to exactly one phase. No orphans, no duplicates.

| Phase | Requirements | Count |
|-------|--------------|-------|
| 1. Foundation | INFRA-01, INFRA-02, INFRA-04, BROWSE-01, BROWSE-02, BROWSE-03, PROP-01, PROP-02, EDU-01, EDU-02, EDU-03, EDU-04, EDU-05, LEAD-03, DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04, DESIGN-05, DESIGN-06 | 20 |
| 2. Publishing | INFRA-03, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06 | 7 |
| 3. Integrations | LEAD-01, LEAD-02, PROP-03, PROP-04, PROP-05 | 5 |
| 4. Launch | LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04 | 4 |
| **Total** | | **36** |
