# Phase 1: Foundation - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A visitor can browse the complete Oak Homes site — homepage, Browse Homes grid, both real homes at `/homes/<slug>`, How It Works (+FAQ), About, Learn (index + one post), and Schedule a Showing — served from a real, owned git repo pushed to GitHub. Branding, exact legal wording, the shared layout with integrations slot, and the full content schema (including Phase 3 forward-fields) are locked here. Admin panel (Phase 2), Zoho/maps/video/OpenGraph rendering (Phase 3), and DNS/launch (Phase 4) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Source assets & mockup fidelity
- **D-01:** The mockup `Oak-Homes-Website-SHARE.html` and the refined one-pager `Oak-Homes-How-It-Works.html` both live at `C:/Users/gcorso.EXPERIONDESIGN/Downloads/`. Copy both into the repo (e.g. `docs/reference/`) at phase start so they can't be lost.
- **D-02:** The mockup is a **directional guide**, not a pixel target: colors, fonts, leaf logo, and overall feel are preserved, but Claude may redesign layouts and components where it improves UX, hierarchy, or mobile behavior.
- **D-03:** Property photos are **extracted from the mockup's embedded images** (6 Marengo, 5 Brown St). Quality caveat accepted: they are likely compressed; they become the permanent listing photos unless replaced later. Still pre-process to the ~2000px convention before commit. — **Reversibility:** costly — git history retains every committed image forever; replacing photos later works, but the originals stay in repo history permanently.
- **D-04:** The **How-It-Works one-pager is the canonical source** for the legally-sensitive land-contract copy — port its wording exactly (per DESIGN-03, this copy lives in code, never in the CMS).

### Homes display
- **D-05:** Browse Homes is **one grid sorted by status**: Available first, then Pending, then Sold (with badge) at the bottom — Sold homes stay visible as social proof.
- **D-06:** Homepage featured homes are chosen via a **`featured` boolean field on the Property schema** that the assistant will check in the admin form. — **Reversibility:** costly — the schema finalized this phase is what Phase 2's CMS config is written against; removing or renaming the field later desynchronizes the two files.
- **D-07:** If no Available home is marked featured, the homepage section **falls back to the newest Available homes** — it never looks empty by accident.
- **D-08:** Property page gallery: **large cover photo + thumbnail strip, clicking opens a full-screen lightbox** with arrows/swipe (small client-side JS island; classic real-estate pattern).
- **D-09:** The **Inquire button is active on Available and Pending** homes (capture backup leads for fall-throughs); **Sold pages replace it with a "See available homes" link**.
- **D-10:** Missing optional specs (beds/baths/sqft) render a **"Call for details" placeholder** — every card stays visually complete and the gap becomes a phone CTA.

### GitHub setup
- **D-11:** A GitHub account **already exists**: `almatreeholding-netizen`. The repo **already exists**: `oak-homes-website` (`https://github.com/almatreeholding-netizen/oak-homes-website.git`). No account-creation walkthrough is needed — the roadmap's INFRA-01 checkpoint reduces to connecting this computer and pushing.
- **D-12:** **Connect GitHub first**: setting the remote, completing the one-time Git Credential Manager browser sign-in (no `gh` CLI installed on this machine), and the first push happen at the very start of the phase, before the site build.
- **D-13:** The repo is currently **public** (verified via GitHub API 2026-08-28) and must be **flipped to private** as part of the phase-start connect step (Settings → change visibility), satisfying INFRA-02.

### Content
- **D-14:** Brown Street house number **confirmed: 2734** (resolves the 2734-vs-2437 open item carried from the spec). Slug: `2734-brown-st` (or equivalent) is safe to make permanent.
- **D-15:** First Learn post: Claude drafts **"What is a land contract?" (land-contract basics)** as placeholder content; the owner reviews it **before launch** (Phase 4 gate, not a Phase 1 gate).
- **D-16:** The `location` (lat/long) schema field is created this phase but **left empty for both homes until Phase 3**, when map pins are actually rendered and can be visually verified.
- **D-17:** Site settings seed **Facebook only** as the social link: `https://www.facebook.com/profile.php?id=61585478873461`. No Instagram link. (Editable by the assistant from Phase 2 on.)

### Claude's Discretion
- Exact layout/component design within the brand system (per D-02 directional-guide mandate).
- Leaf logo extraction/recreation from the mockup, homepage intro seed text, About page copy porting, home description wording (sourced from the mockup's listings).
- Astro project structure, content collection schema syntax, slug format details, and all technical implementation choices.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design & requirements
- `docs/specs/2026-08-28-oak-homes-website-design.md` — the approved design spec: architecture, content model (§4), page list (§5), branding + exact legal wording (§6), assistant workflow acceptance test (§8), integrations slot (§9).
- `.planning/REQUIREMENTS.md` — the 20 Phase-1 requirement IDs (INFRA-01/02/04, BROWSE-01..03, PROP-01/02, EDU-01..05, LEAD-03, DESIGN-01..06).

### Source material (copy into repo at phase start, then treat repo copies as canonical)
- `C:/Users/gcorso.EXPERIONDESIGN/Downloads/Oak-Homes-Website-SHARE.html` — the 2.5MB visual mockup: branding, copy, embedded property photos to extract, leaf logo. Directional guide per D-02.
- `C:/Users/gcorso.EXPERIONDESIGN/Downloads/Oak-Homes-How-It-Works.html` — the refined one-pager; **canonical, port-exactly source** for the land-contract legal copy per D-04.

### Stack guidance
- `.claude/CLAUDE.md` (Technology Stack section) — locked stack decisions: Astro 7.x, Sveltia CMS, Netlify built-in OAuth, `public/uploads/` for CMS images, Leaflet/OSM for Phase 3 maps, Zoho Web-to-Lead prefill caveat.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repo. Only `docs/specs/` and `.planning/` exist; no site code has been written.

### Established Patterns
- None yet — this phase establishes them. Stack patterns are pre-decided in `.claude/CLAUDE.md` (content in `src/content/` collections, CMS-bound images in `public/uploads/`, Astro Content Layer schemas validating frontmatter so a malformed entry fails the build loudly — success criterion 5).

### Integration Points
- Local git repo (branch `main` at the project root) → remote `https://github.com/almatreeholding-netizen/oak-homes-website.git` (private after D-13).
- Content schema written this phase is the contract Phase 2's `admin/config.yml` and Phase 3's map/video/OpenGraph rendering are built against — include `location`, `videoUrl`, `featured`, and OpenGraph-relevant fields now.
- Shared base layout must carry the marked integrations slot (DESIGN-06) for Phase 2 chat/popups.

</code_context>

<specifics>
## Specific Ideas

- "Call for details" as the missing-spec placeholder — deliberately turns data gaps into phone CTAs, consistent with the phone-first conversion strategy ((217) 269-0003 prominent on mobile).
- Sold homes as a trophy/social-proof element at the bottom of the single grid — not hidden, not a separate page.
- The gallery should feel like a classic real-estate listing: cover photo dominant, thumbnails below, full-screen lightbox on tap.

</specifics>

<deferred>
## Deferred Ideas

- Replacing mockup-extracted photos with full-resolution originals — owner may gather originals later; the admin panel (Phase 2) makes swapping them an assistant-level task.
- Map pin rendering and geocoding both homes — Phase 3 (field exists but stays empty per D-16).
- Owner review of the placeholder Learn post — Phase 4 launch checklist item, alongside the attorney review of land-contract copy.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-08-28*
