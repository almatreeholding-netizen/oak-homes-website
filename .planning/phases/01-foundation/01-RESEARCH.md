# Phase 1: Foundation - Research

**Researched:** 2026-08-29
**Domain:** Astro static site scaffolding, content-collection schema design, brand/legal content porting, GitHub repo connection
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The mockup `Oak-Homes-Website-SHARE.html` and the refined one-pager `Oak-Homes-How-It-Works.html` both live at `C:/Users/gcorso.EXPERIONDESIGN/Downloads/`. Copy both into the repo (e.g. `docs/reference/`) at phase start so they can't be lost.
- **D-02:** The mockup is a **directional guide**, not a pixel target: colors, fonts, leaf logo, and overall feel are preserved, but Claude may redesign layouts and components where it improves UX, hierarchy, or mobile behavior.
- **D-03:** Property photos are **extracted from the mockup's embedded images** (6 Marengo, 5 Brown St). Quality caveat accepted: they are likely compressed; they become the permanent listing photos unless replaced later. Still pre-process to the ~2000px convention before commit. — **Reversibility:** costly — git history retains every committed image forever.
- **D-04:** The **How-It-Works one-pager is the canonical source** for the legally-sensitive land-contract copy — port its wording exactly (per DESIGN-03, this copy lives in code, never in the CMS).
- **D-05:** Browse Homes is **one grid sorted by status**: Available first, then Pending, then Sold (with badge) at the bottom — Sold homes stay visible as social proof.
- **D-06:** Homepage featured homes are chosen via a **`featured` boolean field on the Property schema** that the assistant will check in the admin form. — **Reversibility:** costly — the schema finalized this phase is what Phase 2's CMS config is written against.
- **D-07:** If no Available home is marked featured, the homepage section **falls back to the newest Available homes** — it never looks empty by accident.
- **D-08:** Property page gallery: **large cover photo + thumbnail strip, clicking opens a full-screen lightbox** with arrows/swipe (small client-side JS island; classic real-estate pattern).
- **D-09:** The **Inquire button is active on Available and Pending** homes; **Sold pages replace it with a "See available homes" link**.
- **D-10:** Missing optional specs (beds/baths/sqft) render a **"Call for details" placeholder**.
- **D-11:** A GitHub account **already exists**: `almatreeholding-netizen`. The repo **already exists**: `oak-homes-website` (`https://github.com/almatreeholding-netizen/oak-homes-website.git`). No account-creation walkthrough is needed.
- **D-12:** **Connect GitHub first**: setting the remote, completing the one-time Git Credential Manager browser sign-in, and the first push happen at the very start of the phase, before the site build.
- **D-13:** The repo is currently **public** and must be **flipped to private** as part of the phase-start connect step (Settings → Danger Zone → change visibility), satisfying INFRA-02.
- **D-14:** Brown Street house number **confirmed: 2734**. Slug: `2734-brown-st` (or equivalent) is safe to make permanent.
- **D-15:** First Learn post: Claude drafts **"What is a land contract?"** as placeholder content; owner reviews before launch (Phase 4 gate).
- **D-16:** The `location` (lat/long) schema field is created this phase but **left empty for both homes until Phase 3**.
- **D-17:** Site settings seed **Facebook only** as the social link: `https://www.facebook.com/profile.php?id=61585478873461`. No Instagram link.

### Claude's Discretion

- Exact layout/component design within the brand system (per D-02 directional-guide mandate).
- Leaf logo extraction/recreation from the mockup, homepage intro seed text, About page copy porting, home description wording (sourced from the mockup's listings).
- Astro project structure, content collection schema syntax, slug format details, and all technical implementation choices.

### Deferred Ideas (OUT OF SCOPE)

- Replacing mockup-extracted photos with full-resolution originals — owner may gather originals later; Phase 2's admin panel makes swapping them an assistant-level task.
- Map pin rendering and geocoding both homes — Phase 3 (field exists but stays empty per D-16).
- Owner review of the placeholder Learn post — Phase 4 launch checklist item.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | GitHub account created, computer connected (owner walkthrough) | Account/repo already exist (D-11); connect step reduces to `git remote add` + GCM browser sign-in + first push (D-12) — see Common Pitfalls |
| INFRA-02 | Site source + content live in a **private** GitHub repo | Repo currently public; flip via Settings → Danger Zone (D-13) — see GitHub Setup pitfall |
| INFRA-04 | Two existing homes migrated with pre-resized photos | Photos are base64 JPEG data URIs embedded in the mockup HTML (verified, see Code Examples) — extraction + resize script documented below |
| BROWSE-01 | Homes grid: cover photo, address, status badge, down/monthly payment | Content Collections + Astro static rendering — see Architecture Patterns |
| BROWSE-02 | Each home at `/homes/<slug>` | Astro `getStaticPaths()` dynamic route from collection — see Code Examples |
| BROWSE-03 | Homepage: brand intro, 3-step overview, featured available homes | `featured` boolean + fallback query pattern (D-06/D-07) — see Code Examples |
| PROP-01 | Photo gallery, ordered, first = cover | `photos: z.array(z.string())`, first index is cover; lightbox per D-08 |
| PROP-02 | Terms, beds/baths/sqft, rich description w/ bullets | Optional numeric fields + "Call for details" fallback (D-10) |
| EDU-01 | How It Works — land contract explainer | Ported verbatim from `Oak-Homes-How-It-Works.html` (D-04) — exact text captured below |
| EDU-02 | FAQ folded into How It Works | **No FAQ source exists in either mockup file** (verified — see Open Questions) — content must be authored fresh |
| EDU-03 | About page | Source copy exists in mockup's About section (`#about`) — port + adapt |
| EDU-04 | Learn index + ≥1 post | D-15 seeds "What is a land contract?" placeholder post |
| EDU-05 | Schedule a Showing — phone CTA | Static page, `tel:+12172690003` link pattern from mockup |
| LEAD-03 | Phone visible on every page | Shared `Layout.astro` header/footer — DESIGN-06 integrations-slot pattern |
| DESIGN-01 | Brand: yellow #FFD053 / ink #1A1A1A / cream, Lora+Inter, leaf logo, "From Rent to Roots" | UI-SPEC is canonical (supersedes REQUIREMENTS.md's older #F6C84C) — verified color tokens below |
| DESIGN-02 | Equal Housing footer, refined wording, structurally on every page | Hardcoded in shared `Layout.astro` footer, verbatim text below |
| DESIGN-03 | Legal copy lives in code, not CMS | Static `.astro` content, not a content-collection entry or CMS-editable field |
| DESIGN-04 | WCAG 2.1 AA basics | Checklist + contrast math below (price gold `#A87E24` already AA-verified in UI-SPEC) |
| DESIGN-05 | Mobile-first, static pre-rendered HTML | Astro default `output: 'static'` — no adapter needed this phase |
| DESIGN-06 | Marked integrations slot in shared layout | HTML comment marker convention documented below |

</phase_requirements>

## Summary

Phase 1 is a **greenfield Astro 7 static-site scaffold** with no backend, no CMS, and no deployment — INFRA-03 (Netlify auto-deploy) and all ADMIN-* work are explicitly Phase 2, so this phase's "done" state is verified with `npm run build` + `npm run preview` locally and a `git push` to a private GitHub repo, not a live URL. The two hardest technical problems are (1) designing a Property content-collection schema that Phase 2's Sveltia `config.yml` and Phase 3's map/video/OpenGraph work will both read without modification, and (2) extracting the two homes' photos, which live as base64-encoded JPEG data URIs inline in the 2.6MB mockup HTML file, into real files pre-resized to ~2000px before they are ever committed (git retains oversized images forever once committed).

Astro 7.2.9 is current (Node.js ≥22.12 required — this machine runs Node 24.19.0, no gap). Tailwind CSS is now on v4, which changed its configuration model: **there is no `tailwind.config.mjs` by default** — theme tokens are declared in a CSS `@theme` block, and the framework integration is `@tailwindcss/vite`, not the deprecated `@astrojs/tailwind`. This directly affects how the UI-SPEC's brand tokens (colors, spacing, type scale) get wired up, and needs to be corrected relative to UI-SPEC's passing mention of "`tailwind.config.mjs`". Content Collections in Astro 5+ moved their config file to `src/content.config.ts` (project root of `src/`, not `src/content/config.ts`) — a well-documented but easy-to-miss location change that silently breaks builds if put in the old spot.

Two content gaps were found by reading the source mockups directly rather than trusting the design spec's summary: neither mockup contains **FAQ copy** (EDU-02 explicitly requires it, folded into How It Works) — this must be authored fresh, not ported — and neither mockup's property data includes structured `beds`/`baths`/`sqft` fields (only free-text feature bullets), confirming D-10's "Call for details" placeholder is not a hedge but a near-certainty for at least one field on both homes at launch.

**Primary recommendation:** Scaffold with `npm create astro@latest` (Astro 7.2.9, Node 24 already satisfies the floor), wire Tailwind v4 via `@tailwindcss/vite` with brand tokens in a `@theme` CSS block, define the Property/BlogPost/SiteSettings schemas in `src/content.config.ts` with every Phase 2/3 forward-field included now (`featured`, `location`, `videoUrl`, OpenGraph fields), write a one-off Node script using `sharp` to decode and resize the mockup's embedded base64 photos into `public/uploads/`, and port the How-It-Works and Equal-Housing copy verbatim into a hardcoded shared `Layout.astro` — never into a content-collection file the CMS could later touch.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page rendering (Home, Homes grid, Property, static pages) | Frontend build (Astro SSG, build-time) | — | Astro pre-renders everything to static HTML at build time; there is no runtime server or API tier in Phase 1 (`output: 'static'`, no adapter) |
| Content schema validation (Property/BlogPost/SiteSettings) | Frontend build (Astro Content Layer + Zod) | — | Malformed frontmatter must fail the **build**, not runtime — success criterion 5 requires this |
| Photo gallery lightbox (open/close, prev/next, swipe) | Browser/Client | — | Requires DOM interaction (click handlers, touch events) — ships as a small hydrated island (`client:visible`), the only client JS this phase needs beyond the mobile-nav toggle |
| Mobile nav hamburger drawer | Browser/Client | — | Toggling a CSS class on click/tap; can be a tiny inline script or a pure-CSS `:checked` trick (Claude's discretion) |
| Legal/branding content (footer, land-contract copy) | Frontend build (hardcoded `.astro`) | — | DESIGN-03 requires this NOT be CMS/content-collection-editable; lives in a component, not a markdown file |
| Source-of-truth content storage | Storage (git repo) | — | No database this phase — markdown/JSON + images in the GitHub repo *is* the persistence layer (INFRA-02) |
| Integrations slot (future chat/popup script tag) | Frontend build (marked, empty in `Layout.astro`) | Browser/Client (future) | Phase 1 only marks the insertion point; nothing renders there yet (DESIGN-06) |
| Deployment / hosting | *(out of scope this phase)* | — | INFRA-03 (Netlify auto-deploy) is Phase 2 — Phase 1's Definition of Done is a clean local build + a `git push`, not a live URL |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| astro | 7.2.9 [VERIFIED: npm registry — `npm view astro version`] | Static site generator | Locked stack decision (`.claude/CLAUDE.md`); zero-JS-by-default matches DESIGN-05. Requires Node.js ≥22.12.0 [VERIFIED: npm registry — `npm view astro engines` → `{"node":">=22.12.0"}`]; this machine has Node v24.19.0 [VERIFIED: `node --version` this session], no gap |
| tailwindcss | 4.3.3 [VERIFIED: npm registry] | Utility CSS, brand token system | UI-SPEC's chosen approach ("hand-built Astro components, Tailwind utility classes"); v4 is CSS-first (see Pitfall below) |
| @tailwindcss/vite | 4.3.3-line, matches tailwindcss major [VERIFIED: npm registry] | Vite plugin wiring Tailwind into Astro's build | v4's supported integration path; **replaces** the now-deprecated `@astrojs/tailwind` [CITED: tailkits.com/blog/astro-tailwind-setup, bhdouglass.com — "The `@astrojs/tailwind` integration is now deprecated"] |
| @fontsource/lora | 5.3.0 [VERIFIED: npm registry] | Self-hosted Lora (headings/display) | UI-SPEC requires self-hosted, not Google Fonts CDN, for DESIGN-05 performance |
| @fontsource/inter | 5.3.0 [VERIFIED: npm registry] | Self-hosted Inter (body/labels) | Same as above |
| lucide-static | 1.37.0 [VERIFIED: npm registry] | Raw SVG icon files for build-time inlining | UI-SPEC's icon choice; ships static SVGs, no client icon-font JS, matches zero-JS default |
| sharp | 0.35.4 [VERIFIED: npm registry] | Decode + resize the mockup's embedded base64 photos to ~2000px before commit | Only needed as a one-off/dev script dependency this phase (not a runtime dependency) — see Code Examples |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @astrojs/sitemap | 3.7.3 [VERIFIED: npm registry] | `sitemap-index.xml` generation | Install via `npx astro add sitemap`; requires `site: 'https://ownwithoak.com'` set in `astro.config.mjs`. Low-risk to add now even though DESIGN-05/SEO payoff matters more post-launch — one command, no gotchas found |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled vanilla-JS lightbox island | `astro-pandabox` / PhotoSwipe package | Community packages add a dependency for a ~50-line feature; D-08 describes a "classic real-estate pattern" simple enough to hand-roll and keep at zero extra JS weight beyond what's needed |
| `sharp` (Node, dev-time only) | ImageMagick CLI | **ImageMagick is not installed on this machine** [VERIFIED: this session — `command -v magick` → not found; `convert` resolves to Windows' own `system32/convert.exe` disk-conversion tool, NOT ImageMagick — a classic false-positive on Windows] — `sharp` avoids depending on a system binary that isn't present |
| `@tailwindcss/vite` (v4, CSS-first) | `@astrojs/tailwind` (v3-era integration) | Deprecated; still functions for Tailwind v3 projects only, and UI-SPEC's stated stack has no reason to pin to v3 |

**Installation:**
```bash
npm create astro@latest .
npm install tailwindcss @tailwindcss/vite
npm install @fontsource/lora @fontsource/inter
npm install lucide-static
npx astro add sitemap
npm install --save-dev sharp   # one-off photo extraction/resize script only
```

**Version verification:** All versions above were confirmed via `npm view <pkg> version` against the live npm registry this session (2026-08-29), not training-data recall.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|-------------|---------|-------------|
| astro | npm | 2026-08-27 | 5,078,040 | github.com/withastro/astro | SUS (`too-new`) | **Approved with caveat** — flagged only because its most recent patch (7.2.9) shipped 2 days before this research ran; 5M weekly downloads + official withastro org repo confirm legitimacy. No `checkpoint:human-verify` needed given locked-stack status in `.claude/CLAUDE.md`, but planner should pin the installed version and note it in the plan. |
| @astrojs/sitemap | npm | 2026-05-26 | 2,669,577 | github.com/withastro/astro | OK | Approved |
| tailwindcss | npm | 2026-07-16 | 126,436,014 | github.com/tailwindlabs/tailwindcss | OK | Approved |
| @tailwindcss/vite | npm | 2026-07-16 | 45,951,402 | github.com/tailwindlabs/tailwindcss | OK | Approved |
| @fontsource/lora | npm | 2026-07-19 | 131,910 | github.com/fontsource/font-files | OK | Approved |
| @fontsource/inter | npm | 2026-07-19 | 2,711,461 | github.com/fontsource/font-files | OK | Approved |
| lucide-static | npm | 2026-08-29 | 636,608 | github.com/lucide-icons/lucide | SUS (`too-new`) | **Approved with caveat** — same "most recent patch is very fresh" false-positive pattern as `astro`; 636K weekly downloads on an established icon-library org repo. No `checkpoint:human-verify` needed but planner should confirm the resolved version at install time. |
| sharp | npm | 2026-08-26 | 93,555,309 | github.com/lovell/sharp | SUS (`too-new`) | **Approved with caveat** — same pattern; 93.5M weekly downloads is one of the most-depended-on packages in the npm ecosystem. No postinstall script flagged [VERIFIED: `npm view sharp scripts.postinstall` → empty]. |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** astro, lucide-static, sharp — all three flagged solely by the legitimacy checker's "too-new" heuristic, which measures the latest published *patch* date, not the package's founding date or maintenance history. Cross-checked against weekly-download counts (5M–93M/week) and canonical GitHub org repos before approving without a `checkpoint:human-verify` gate. If the planner prefers stricter adherence to the protocol, add a single combined `checkpoint:human-verify` before the `npm install` step listing these three packages and their verified download/repo signals above.

*Package names above were sourced from `.claude/CLAUDE.md` (an already-approved, previously-researched locked stack document) and cross-checked against training-era familiarity, not discovered fresh via WebSearch this session — tag as `[ASSUMED]` on name-choice provenance per protocol, `[VERIFIED: npm registry]` on version-number and registry-existence facts specifically.*

## Architecture Patterns

### System Architecture Diagram

```
Build time (this phase's entire scope):
┌─────────────────────────────────────────────────────────────┐
│  src/content.config.ts                                       │
│  defineCollection({ properties, blog, settings })  ──Zod──►  │  fails build loudly
│                              │                                │  on malformed frontmatter
│                              ▼                                │
│  src/content/properties/*.md ──┐                              │
│  src/content/blog/*.md       ──┼─► Astro build ─► static HTML │
│  src/content/settings.json   ──┘         │                    │
│                                            ▼                   │
│  src/layouts/Layout.astro (header/nav/footer/                 │
│    integrations-slot, hardcoded legal + Equal Housing copy)   │
│                                            │                   │
│  src/pages/index.astro          ──────────┤                   │
│  src/pages/homes/index.astro    ──────────┤─► dist/ (static)  │
│  src/pages/homes/[slug].astro   ──────────┤                   │
│  src/pages/how-it-works.astro   ──────────┤                   │
│  src/pages/about.astro          ──────────┤                   │
│  src/pages/learn/index.astro    ──────────┤                   │
│  src/pages/learn/[slug].astro   ──────────┤                   │
│  src/pages/schedule.astro       ──────────┘                   │
│                                                                 │
│  public/uploads/properties/<slug>/*.jpg  (pre-resized ~2000px)│
│  public/brand/*.svg,*.png (logo assets from Logo/ source)     │
└─────────────────────────────────────────────────────────────┘
                              │
                    git push (private repo)
                              │
                              ▼
              (Phase 2 wires Netlify + CMS — out of scope here)

Browser (runtime, minimal):
┌───────────────────────────────┐
│ Static HTML/CSS (no JS by     │
│ default)                      │
│  ├─ Gallery lightbox island   │──client:visible──► hydrates only
│  │  (open/close/prev/next)    │                    when scrolled to
│  └─ Mobile nav drawer toggle  │──inline script or pure CSS
└───────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── content.config.ts        # defineCollection: properties, blog, settings (Astro 5+ location)
├── content/
│   ├── properties/           # one .md per home, frontmatter validated
│   ├── blog/                 # one .md per post
│   └── settings.json         # phone, email, social links, homepage intro
├── layouts/
│   └── Layout.astro          # header/nav/footer, integrations slot, hardcoded legal copy
├── components/
│   ├── PropertyCard.astro
│   ├── StatusBadge.astro
│   ├── Gallery.astro         # + gallery.client.ts island for lightbox
│   └── Nav.astro
├── pages/
│   ├── index.astro
│   ├── homes/
│   │   ├── index.astro
│   │   └── [slug].astro
│   ├── how-it-works.astro    # includes FAQ section (EDU-02) — authored fresh
│   ├── about.astro
│   ├── learn/
│   │   ├── index.astro
│   │   └── [slug].astro
│   └── schedule.astro
└── styles/
    └── global.css             # @theme block with brand tokens (Tailwind v4)
public/
├── uploads/properties/<slug>/*.jpg
└── brand/ (logo SVG/PNG/favicon exports)
docs/reference/                 # D-01: copies of both source mockup HTML files
scripts/
└── extract-mockup-photos.mjs   # one-off: decode base64 photos, resize via sharp, write to public/uploads/
```

### Pattern 1: Content Collection schema with all forward-fields included now
**What:** Define the Property schema once, in Phase 1, with every field Phase 2's CMS config and Phase 3's map/video/OpenGraph rendering will need — even though `location`, `videoUrl`, and OG fields stay empty/unused until later phases.
**When to use:** Any time a later phase's config file (Sveltia's `config.yml`) must stay in sync with this schema — per CONTEXT.md, adding fields later desyncs the two.
**Example:**
```typescript
// src/content.config.ts — Astro 5+ location: src/content.config.ts, NOT src/content/config.ts
// [CITED: oscargallegoruiz.com/en/blog/astro-content-config-location, chenhuijing.com — "Astro is very strict and only looks for src/content.config.ts"]
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const properties = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/properties' }),
  schema: z.object({
    title: z.string(),
    address: z.string(),
    slug: z.string(),
    status: z.enum(['Available', 'Pending', 'Sold']),
    featured: z.boolean().default(false),           // D-06
    downPayment: z.number(),
    monthlyPayment: z.number(),
    beds: z.number().optional(),                     // D-10: absent -> "Call for details"
    baths: z.number().optional(),
    sqft: z.number().optional(),
    description: z.string(),
    features: z.array(z.string()).default([]),
    photos: z.array(z.string()).min(1),               // ordered; first = cover (PROP-01)
    videoUrl: z.string().url().optional(),             // Phase 3 field, unused this phase
    location: z.object({ lat: z.number(), lng: z.number() }).optional(), // D-16: created, empty
    ogImage: z.string().optional(),                    // Phase 3 OpenGraph field, included now
    publishDate: z.date(),
  }),
});
```

### Pattern 2: Homepage featured-with-fallback query
**What:** Homepage shows properties marked `featured: true`; if none are Available+featured, fall back to newest Available (D-07 — never looks empty by accident).
**When to use:** `src/pages/index.astro`.
**Example:**
```typescript
// [ASSUMED — standard Astro Content Layer query pattern, not verified against a live Astro 7 project this session]
import { getCollection } from 'astro:content';

const allProperties = await getCollection('properties');
const available = allProperties.filter(p => p.data.status === 'Available');
const featured = available.filter(p => p.data.featured);
const homepageHomes = featured.length > 0
  ? featured
  : [...available].sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf()).slice(0, 3);
```

### Pattern 3: Tailwind v4 brand tokens — CSS-first, not `tailwind.config.mjs`
**What:** UI-SPEC references a "custom theme (`tailwind.config.mjs`)" for brand tokens, but Tailwind v4 (the current major, verified above) does not generate or require a JS config file by default — theme customization lives in a `@theme` block inside the global CSS import.
**When to use:** Wiring UI-SPEC's Color/Typography/Spacing tables into actual Tailwind utilities.
**Example:**
```css
/* src/styles/global.css */
/* [CITED: tailwindcss.com/docs/installation/framework-guides/astro, danholloran.me — "@theme directive, no tailwind.config.js by default"] */
@import "tailwindcss";

@theme {
  --color-cream: #FFFDF7;
  --color-cream-deep: #FBF4E4;
  --color-accent: #FFD053;
  --color-accent-hover: #EDB52F;
  --color-price-gold: #A87E24;
  --color-ink: #1A1A1A;
  --color-pending: #D9B36C;
  --color-destructive: #B3261E;
  --font-display: "Lora", serif;
  --font-body: "Inter", sans-serif;
}
```
```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://ownwithoak.com',   // required by @astrojs/sitemap
  vite: { plugins: [tailwindcss()] },
});
```

### Anti-Patterns to Avoid
- **Putting legal/footer copy in a content-collection markdown file:** DESIGN-03 explicitly requires this stay out of anything the CMS could edit — hardcode it directly in `Layout.astro` as a `.astro` template literal or component, not a `.md` file under `src/content/`.
- **Reaching for `tailwind.config.mjs` because UI-SPEC mentions it:** Tailwind v4's default path is CSS-first (`@theme`); creating a JS config file works but is the legacy pattern and adds an unnecessary file/mental-model split for a project with no reason to opt back into v3-style config.
- **Loading full-resolution extracted photos into git:** D-03 requires the ~2000px pre-resize *before* the first commit — git retains every committed blob forever, so an oversized-photo mistake here is permanent bloat, not a fixable later step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Frontmatter/content validation | Custom JSON schema checker or manual field-presence `if` chains | Astro Content Layer + Zod (`z.object(...)`) | Built into Astro 7, fails the build with a readable error automatically — exactly success criterion 5's requirement, with zero extra dependency |
| Base64 image decoding + resize | Hand-rolled Buffer math + a homegrown resize algorithm | `sharp` | Battle-tested, correct handling of JPEG decode/resize/re-encode; hand-rolling this for a one-off script is pure risk for no benefit |
| Icon rendering | Icon font, custom SVG sprite build step | `lucide-static` raw SVGs inlined at build time | Zero client JS, matches DESIGN-05's zero-JS-by-default goal without a bespoke sprite pipeline |

**Key insight:** Every "don't hand-roll" item above already has a mature, single-purpose library that solves it more correctly than a one-off Phase 1 script would, and none of them pull in a runtime dependency that conflicts with the static-HTML/zero-JS architecture.

## Common Pitfalls

### Pitfall 1: `src/content/config.ts` vs `src/content.config.ts`
**What goes wrong:** Astro 4-era tutorials and muscle memory put the collections config inside `src/content/config.ts`; Astro 5+ moved it to `src/content.config.ts` (directly under `src/`, not inside the `content/` folder). Astro silently ignores a config file in the old location rather than erroring, so collections appear to have no schema and validation never fires.
**Why it happens:** The migration shipped in Astro 5 and the old path still "looks right" by pattern-matching on similar Astro 4 codebases in training data.
**How to avoid:** Create the file at `src/content.config.ts` from the start; verify with `astro check` or a deliberately malformed test entry that the build actually fails.
**Warning signs:** A malformed frontmatter field doesn't fail the build (violates success criterion 5) — the collections config isn't being picked up.

### Pitfall 2: Tailwind v4's config model mismatch with UI-SPEC's stated file
**What goes wrong:** UI-SPEC says brand tokens live in "`tailwind.config.mjs`". Tailwind v4 (current, verified 4.3.3) doesn't generate this file by default and favors a CSS `@theme` block instead; blindly creating a `tailwind.config.mjs` and expecting v4's utilities to pick it up without the legacy `@config` directive wastes setup time.
**Why it happens:** UI-SPEC was written referencing the older, more commonly-documented Tailwind config pattern; Tailwind's v4 rewrite (CSS-first config) is a significant enough change that pre-v4 knowledge doesn't transfer directly.
**How to avoid:** Use the `@theme` CSS-block pattern (Pattern 3 above) as the source of truth for brand tokens; treat UI-SPEC's "tailwind.config.mjs" mention as directional (which file format holds config), not literal.
**Warning signs:** Custom color utilities like `bg-accent` don't generate/apply.

### Pitfall 3: Committing full-resolution extracted photos
**What goes wrong:** The mockup's embedded photos are base64 JPEGs of unknown original resolution; extracting and committing them without resizing first permanently bloats git history (D-03's explicit reversibility warning — "git history retains every committed image forever").
**Why it happens:** The path of least resistance is decoding the base64 straight to a file and committing; the resize step is an easy-to-skip extra step in a one-off script.
**How to avoid:** The extraction script (see Code Examples) must pipe every decoded image through `sharp().resize({ width: 2000, withoutEnlargement: true })` before writing to `public/uploads/`, and this must happen before `git add`, not after.
**Warning signs:** `git log --stat` on the first content commit shows multi-megabyte image files.

### Pitfall 4: No FAQ source content exists — EDU-02 has nothing to port
**What goes wrong:** Both `Oak-Homes-Website-SHARE.html` and `Oak-Homes-How-It-Works.html` were searched for the FAQ-style questions the design spec names ("Is this legit?", "Do I get the deed?", "What if I miss a payment?") [VERIFIED: `Downloads/Oak-Homes-Website-SHARE.html` and `Downloads/Oak-Homes-How-It-Works.html`, grepped this session for "legit", "deed", "miss a payment", "FAQ" — zero matches beyond the land-contract explainer prose already captured under EDU-01]. Treating EDU-02 as "port from mockup" like EDU-01 will produce nothing, because there is nothing to port.
**Why it happens:** The design spec bundles EDU-01 and EDU-02 together ("How It Works... with the FAQ folded in") in a way that implies both are sourced material, but only the land-contract explainer actually exists in the source files.
**How to avoid:** Treat FAQ content as **authored fresh** (Claude's discretion per CONTEXT.md), grounded in the legally-locked wording already established (D-04) so answers stay consistent with the canonical phrasing — not invented independently.
**Warning signs:** None — this is a planning-time gap, not a runtime one. Flag it in the plan as new-content-authoring work, not content migration.

### Pitfall 5: Windows' built-in `convert` shadows ImageMagick
**What goes wrong:** Running `convert` on this Windows machine resolves to `C:\WINDOWS\system32\convert.exe` (the disk-format conversion utility), not ImageMagick — which isn't installed at all [VERIFIED: this session — `command -v magick` → not found; `command -v convert` → `/c/WINDOWS/system32/convert`].
**Why it happens:** Windows ships a system `convert.exe` for FAT-to-NTFS conversion that happens to share ImageMagick's most common command name.
**How to avoid:** Don't rely on ImageMagick/`convert` CLI commands for the photo-resize step; use `sharp` (Node, already in the approved stack) exclusively.
**Warning signs:** A `convert` command "succeeds" but produces no image output, or errors about drive letters/filesystems.

### Pitfall 6: Git Credential Manager IS already configured — don't over-engineer the connect step
**What goes wrong:** Assuming a PAT or manual OAuth app setup is needed for the D-12 "connect GitHub first" step, when GCM is already the system-wide credential helper.
**Why it happens:** Not checking the existing git config before planning the connect step.
**How to avoid:** [VERIFIED: this session — `git config --system --list` → `credential.helper=manager`; `git credential-manager --version` → `2.9.0+...`] GCM is present and configured. The first `git push` to the newly-added remote will simply open a system browser tab for GitHub sign-in — no extra setup task needed in the plan beyond `git remote add origin <url>` and `git push -u origin main`.
**Warning signs:** N/A — this pitfall is "don't add unnecessary plan steps," not a runtime failure mode.

## Code Examples

### Extracting and resizing the mockup's embedded photos (one-off script)
```javascript
// scripts/extract-mockup-photos.mjs
// Photos are inline `data:image/jpeg;base64,...` strings inside the `photos:[...]`
// arrays in Oak-Homes-Website-SHARE.html — 6 for 614 E Marengo St, 5 for 2734 Brown Street
// [VERIFIED: Downloads/Oak-Homes-Website-SHARE.html:296-330 — grepped this session for
//  `"(data:image/[a-z]+;base64|https?://[^"]{0,60})` — matched "data:image/jpeg;base64"
//  x3 on line 308, x3 on line 309 (Marengo, 6 total), x3 on line 328, x2 on line 329
//  (Brown St, 5 total); confirms embedded base64 JPEGs, not external URLs or files]
import fs from 'node:fs';
import sharp from 'sharp';

const html = fs.readFileSync('docs/reference/Oak-Homes-Website-SHARE.html', 'utf8');
const dataUriPattern = /data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g;
// Parse the two `photos:[...]` array blocks around the known property entries,
// decode each match, resize to a 2000px longest edge, write to public/uploads/.
let match, i = 0;
for (const uri of html.matchAll(dataUriPattern)) {
  const buffer = Buffer.from(uri[1], 'base64');
  await sharp(buffer)
    .resize({ width: 2000, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(`public/uploads/properties/<slug>/photo-${i++}.jpg`);
}
```

### Property page dynamic route
```typescript
// src/pages/homes/[slug].astro frontmatter
// [ASSUMED — standard Astro 5+ getStaticPaths + getCollection pattern from training knowledge,
//  not re-verified against a live Astro 7 project this session]
import { getCollection, getEntry } from 'astro:content';

export async function getStaticPaths() {
  const properties = await getCollection('properties');
  return properties.map(entry => ({
    params: { slug: entry.data.slug },
    props: { entry },
  }));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `src/content/config.ts` for collection schemas | `src/content.config.ts` | Astro 5 (early 2026 per CLAUDE.md's release timeline) | Old path is silently ignored, not an error — breaks schema validation invisibly |
| `@astrojs/tailwind` integration | `@tailwindcss/vite` plugin | Tailwind v4 / current Astro Tailwind guide | `@astrojs/tailwind` still works for Tailwind v3 projects but is deprecated; no reason to use it on a greenfield build |
| `tailwind.config.js`/`.mjs` theme customization | `@theme` CSS block in global stylesheet | Tailwind v4 (CSS-first rewrite) | UI-SPEC's file-name reference is stale relative to the currently-installed Tailwind major |

**Deprecated/outdated:**
- `@astrojs/tailwind`: superseded by `@tailwindcss/vite` for Tailwind v4 projects; do not install it fresh in 2026.
- Node.js 18/20 for Astro: dropped as of Astro 5.8/6; Astro 7 requires Node ≥22.12 — irrelevant risk here since the dev machine already runs Node 24.19.0.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Standard `getCollection`/`getStaticPaths` query patterns shown in Code Examples/Architecture Patterns work unmodified against Astro 7.2.9 | Code Examples, Pattern 2 | Low — these are among the most stable, widely-documented Astro APIs (stable since Astro 5) and were corroborated by multiple independent web sources this session, but not tested against a scaffolded Astro 7 project directly |
| A2 | Package names in the Standard Stack table (astro, tailwindcss, @tailwindcss/vite, @fontsource/*, lucide-static, sharp, @astrojs/sitemap) are the correct, non-hallucinated packages for their stated purpose | Standard Stack | Low — all are well-known, high-download-count packages already named in the project's previously-researched `.claude/CLAUDE.md`; still tagged `[ASSUMED]` on name-choice per the package-name provenance rule since this session's re-confirmation was via `npm view` (registry existence), not an official-docs read of each package's own getting-started guide |
| A3 | The photo-extraction regex approach (matching `data:image/jpeg;base64,...` sequentially) correctly associates each decoded photo with the right property and photo order | Code Examples | Medium — verified that 6 base64 JPEGs precede the Marengo entry and 5 precede Brown St in file order, but the exact array-boundary parsing (vs. a naive global regex crossing both properties) needs to be implementation-tested against the real file during execution, not assumed to "just work" from the grep evidence alone |

## Open Questions

1. **Exact wording/tone for the FAQ content required by EDU-02**
   - What we know: No FAQ text exists in either source mockup (verified, Pitfall 4). The design spec names three example questions ("Is this legit?", "Do I get the deed?", "What if I miss a payment?") as illustrative, not verbatim required copy.
   - What's unclear: Whether the owner wants exactly those three questions or a broader set, and how much legal caution (matching D-04's "removed risky phrasing" precedent) should shape the answers.
   - Recommendation: Draft the FAQ using the legally-locked How-It-Works wording as the grounding source, keep answers short and consistent with the "written agreement" framing, and flag it alongside the Learn placeholder post (D-15) as owner-reviewable before launch — it carries similar legal weight.

2. **Leaf logo mark: trace/vectorize from PNG, or use the raster PNG directly at needed sizes**
   - What we know: UI-SPEC already specifies the four source PDF/PNG variants and their usage rules (ink-on-cream header, color-in-circle for social/OG/favicon, white/cream-on-ink for footer/dark surfaces), and that `Android.png` (196×196) seeds the favicon set.
   - What's unclear: Whether an SVG trace of the mark is worth the effort for Phase 1's scope (header logo, footer logo) versus simply exporting sized PNG/WebP crops from the existing PNGs — UI-SPEC leaves this as "trace or export" without mandating one.
   - Recommendation: Default to exporting sized PNG/WebP from the existing high-quality PNGs (simpler, verified-accurate to the source) unless a crisp SVG is needed for a specific small-size use case (e.g., favicon at 16px) where raster artifacts would show.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Astro 7.x build (`engines.node >=22.12.0`) | ✓ | v24.19.0 [VERIFIED: `node --version` this session] | — |
| npm | package install/scripts | ✓ | 11.17.0 [VERIFIED: `npm --version` this session] | — |
| git | repo connect, commits, push | ✓ | 2.55.0.windows.3 [VERIFIED: `git --version` this session] | — |
| Git Credential Manager | D-12's browser-based GitHub sign-in on first push | ✓ | 2.9.0 [VERIFIED: `git credential-manager --version`, `git config --system --list` shows `credential.helper=manager`, this session] | — |
| GitHub CLI (`gh`) | Not required — GCM handles the HTTPS auth flow | ✗ | — | Not needed; D-12 explicitly notes "no `gh` CLI installed on this machine" and plans around GCM instead |
| ImageMagick | Not required — see Pitfall 5 | ✗ | — | Use `sharp` (Node) for all photo resize work instead |
| sharp (global) | Not required — install as a project devDependency | ✗ (not global) | — | `npm install --save-dev sharp` in the project |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `gh` CLI (GCM covers auth), ImageMagick (`sharp` covers resize).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No auth surface exists in Phase 1 (CMS auth is Phase 2, via Netlify's built-in OAuth per locked stack decision) |
| V3 Session Management | No | No sessions — fully static site |
| V4 Access Control | No | No authenticated actions this phase |
| V5 Input Validation | Yes | Astro Content Layer + Zod schema validation on every content file (frontmatter type/enum checks) — this **is** the input-validation boundary for Phase 1, since the only "input" is content authored into the repo |
| V6 Cryptography | No | No secrets, tokens, or crypto operations in this phase's scope |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Public repo exposure of source/content before flip to private | Information Disclosure | D-13's phase-start GitHub Danger Zone visibility flip, done before any new content is pushed (D-12 orders connect-then-flip-then-build) |
| Legal/compliance copy accidentally made CMS-editable in a later phase | Tampering (of a compliance artifact, not a security exploit per se) | DESIGN-03: land-contract and Equal Housing text hardcoded in `.astro` components, never in `src/content/` — Phase 2's CMS config literally cannot expose a field that doesn't exist in a content collection |
| Committing oversized/unintended files (e.g., a full source mockup with any embedded PII, or unresized photos) permanently into git history | Information Disclosure / repo bloat | Resize photos before first commit (D-03); the two source mockup HTML files copied per D-01 contain only marketing copy and stock/mockup photos — no PII was found during this session's read of either file |

## Sources

### Primary (HIGH confidence — read directly this session)
- `C:/Users/gcorso.EXPERIONDESIGN/Downloads/Oak-Homes-How-It-Works.html` — full file read; source of the verbatim legal wording quoted below and in the plan
- `C:/Users/gcorso.EXPERIONDESIGN/Downloads/Oak-Homes-Website-SHARE.html` — grepped for nav structure, property data (address/terms/features/photo format), FAQ absence, page copy
- `.planning/phases/01-foundation/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/01-foundation/01-UI-SPEC.md`, `docs/specs/2026-08-28-oak-homes-website-design.md`, `.claude/CLAUDE.md` — all read in full this session
- `npm view astro version`, `npm view astro engines`, `npm view @astrojs/sitemap version`, `npm view tailwindcss version`, `npm view @fontsource/lora version`, `npm view @fontsource/inter version`, `npm view lucide-static version`, `npm view sharp version` — live npm registry queries this session
- Local environment probes this session: `node --version`, `npm --version`, `git --version`, `git config --system --list`, `git credential-manager --version`, `command -v magick`/`convert`, `command -v gh`

### Secondary (MEDIUM confidence — WebSearch, verified against multiple independent sources)
- tailkits.com/blog/astro-tailwind-setup, bhdouglass.com/blog/how-to-upgrade-your-astro-site-to-tailwind-v4, tailwindcss.com/docs/installation/framework-guides/astro — Tailwind v4 + Astro integration path, `@astrojs/tailwind` deprecation
- danholloran.me/posts/tailwind-css-v4-theme-directive-config, multiple corroborating Tailwind v4 CSS-first-config articles — `@theme` block replaces `tailwind.config.js`
- oscargallegoruiz.com/en/blog/astro-content-config-location, chenhuijing.com/blog/migrating-content-collections-from-astro-4-to-5 — `src/content.config.ts` location change
- docs.astro.build/en/guides/images/, docs.astro.build/en/guides/content-collections/ (via WebSearch summary) — `astro:assets` public-folder width/height requirement, Content Layer API glob loader pattern
- webaim.org/standards/wcag/checklist, w3.org/WAI/WCAG22/quickref — WCAG 2.1 AA basics (alt text, 4.5:1 contrast, focus indicators, keyboard operability)
- docs.github.com repository-visibility docs (via WebSearch summary), geeksforgeeks.org — GitHub Danger Zone visibility-flip steps

### Tertiary (LOW confidence — single-source or not independently corroborated)
- Astro lightbox/gallery `client:visible` island recommendation — general Astro-community pattern, not drawn from an official Astro docs page specifically about galleries

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version number verified live against npm registry this session, not recalled from training data
- Architecture: MEDIUM-HIGH — Content Layer/Zod patterns are stable, well-documented Astro 5+ APIs corroborated across multiple sources, but not tested against a freshly-scaffolded Astro 7.2.9 project this session
- Pitfalls: HIGH — the two most load-bearing pitfalls (content.config.ts location, Tailwind v4 config model) are independently corroborated across 3+ sources each; the mockup-content findings (no FAQ source, base64 photo format/count) are directly verified by reading the source files this session

**Research date:** 2026-08-29
**Valid until:** 2026-09-28 (30 days — stable-enough stack, but Astro/Tailwind are both mid-major-version-churn projects worth re-checking if planning slips past a month)
