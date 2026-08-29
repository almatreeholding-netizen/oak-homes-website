# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 1-Foundation
**Areas discussed:** Source assets & mockup fidelity, Homes display details, GitHub sequencing & naming, Content open items

---

## Source assets & mockup fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch from old Netlify site | Fetch the deployed mockup from cool-semifreddo-760942 | |
| It's on this computer | Point Claude to the local file; copy into repo | ✓ |
| I'll provide it later | Drop the file before build starts | |

**User's choice:** It's on this computer
**Notes:** Claude located both `Oak-Homes-Website-SHARE.html` and `Oak-Homes-How-It-Works.html` in `C:/Users/gcorso.EXPERIONDESIGN/Downloads/`. Both to be copied into the repo as reference.

| Option | Description | Selected |
|--------|-------------|----------|
| Faithful port | Reproduce mockup layouts as closely as possible | |
| Directional guide | Keep brand; Claude may redesign layouts/UX | ✓ |
| Faithful + flagged upgrades | Port faithfully, list suggested improvements | |

**User's choice:** Directional guide

| Option | Description | Selected |
|--------|-------------|----------|
| On this computer | Full-res originals in a local folder | |
| Extract from mockup | Use photos embedded in the 2.5MB mockup | ✓ |
| I'll gather them | Collect originals later; placeholders meanwhile | |

**User's choice:** Extract from mockup
**Notes:** Compression caveat acknowledged — extracted photos become permanent listing photos unless replaced later.

| Option | Description | Selected |
|--------|-------------|----------|
| How-It-Works.html one-pager | The refined standalone file is canonical; port exactly | ✓ |
| Mockup's section | Use the full mockup's How It Works section | |
| Compare and flag | Diff both, pick line by line | |

**User's choice:** How-It-Works.html one-pager

---

## Homes display details

| Option | Description | Selected |
|--------|-------------|----------|
| Available first, Sold last | One grid sorted by status | ✓ |
| Separate Sold section | Distinct "Recently sold" section below | |
| Mixed, badge only | Publish-date order regardless of status | |

**User's choice:** Available first, Sold last

| Option | Description | Selected |
|--------|-------------|----------|
| Newest available | Auto-show most recent Available homes | |
| Featured checkbox | `featured` schema field, assistant-controlled | ✓ |
| All available homes | Homepage shows every Available home | |

**User's choice:** Featured checkbox
**Notes:** Field must be added to the schema in Phase 1 since the schema locks this phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to newest | No featured checked → newest Available shown | ✓ |
| Hide the section | No featured → no homes section | |

**User's choice:** Fall back to newest

| Option | Description | Selected |
|--------|-------------|----------|
| Cover + thumbnails, lightbox | Thumbnail strip; full-screen lightbox with swipe | ✓ |
| Simple scroll stack | Full-width stacked photos, zero JS | |
| Carousel/slider | One photo at a time, inline arrows | |

**User's choice:** Cover + thumbnails, lightbox

| Option | Description | Selected |
|--------|-------------|----------|
| Available + Pending | Inquire on both; Sold links to grid | ✓ |
| Available only | Inquire only on Available | |
| Always active | Inquire on every home | |

**User's choice:** Available + Pending

| Option | Description | Selected |
|--------|-------------|----------|
| Hide missing specs | Only show specs that exist | |
| Show placeholder | Missing specs render a placeholder | ✓ |

**User's choice:** Show placeholder

| Option | Description | Selected |
|--------|-------------|----------|
| — (em dash) | Neutral 'Beds: —' | |
| Call for details | Gap becomes a phone CTA | ✓ |

**User's choice:** Call for details

---

## GitHub sequencing & naming

| Option | Description | Selected |
|--------|-------------|----------|
| Build first, push later | Build locally; connect GitHub when owner free | |
| Walkthrough first | Connect GitHub up front | ✓ |

**User's choice:** Walkthrough first (GitHub connect happens at phase start)

**User's choice (account/repo):** Free-text — "We already have a GitHub account... i already created it https://github.com/almatreeholding-netizen/oak-homes-website.git"
**Notes:** Account `almatreeholding-netizen` and repo `oak-homes-website` already exist. Original options (almatreeholding / ownwithoak / oakhomes usernames; repo-name choices) superseded. Claude verified via GitHub API: repo exists, currently public. No `gh` CLI on this machine; auth will go through Git Credential Manager browser sign-in on first push.

| Option | Description | Selected |
|--------|-------------|----------|
| Make it private | Matches INFRA-02; toggle in repo Settings | ✓ |
| Keep it public | Acceptable but exposes drafts/history | |

**User's choice:** Make it private

---

## Content open items

| Option | Description | Selected |
|--------|-------------|----------|
| 2734 | 2734 Brown St, Flint MI | ✓ |
| 2437 | 2437 Brown St, Flint MI | |
| Need to verify | TODO slug until confirmed | |

**User's choice:** 2734 — long-standing open item resolved.

| Option | Description | Selected |
|--------|-------------|----------|
| Land contract basics | "What is a land contract?" evergreen post | ✓ |
| Renter-to-owner guide | Prep steps for target customer | |
| Welcome post | Company/mission intro | |

**User's choice:** Free-text — "do the first one as placeholder, ill review before launch" → land-contract basics, drafted by Claude as placeholder, owner review gated at launch (Phase 4).

| Option | Description | Selected |
|--------|-------------|----------|
| Geocode both now | Fill lat/long from addresses now | |
| Leave empty until Phase 3 | Field exists, stays blank until maps render | ✓ |

**User's choice:** Leave empty until Phase 3

| Option | Description | Selected |
|--------|-------------|----------|
| Facebook only | Just the Facebook page | ✓ (via correction) |
| Facebook + Instagram | Both platforms | (initially selected) |
| None yet | Empty until added via admin panel | |

**User's choice:** Initially "Facebook + Instagram", then corrected via free text: "https://www.facebook.com/profile.php?id=61585478873461  actually only fb" → Facebook only, URL provided.

---

## Claude's Discretion

- Layout/component design within the brand system (directional-guide mandate)
- Leaf logo extraction, homepage intro seed text, About copy porting, home description wording
- Astro project structure, schema syntax, slug format, technical implementation

## Deferred Ideas

- Replacing mockup-extracted photos with full-res originals (assistant task once Phase 2 admin panel exists)
- Geocoding + map pins (Phase 3)
- Owner review of placeholder Learn post; attorney review of legal copy (Phase 4 launch checklist)
