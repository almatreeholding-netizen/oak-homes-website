# Oak Homes Website — Design Spec

_Date: 2026-08-28 · Status: approved design, pre-implementation_

## 1. Purpose

Replace the single-file HTML mockup of **ownwithoak.com** with a real, maintainable website that:

- Presents homes sold on **owner financing / land contracts** in plain, legally careful language.
- Lets a **non-technical assistant** add properties and blog posts through a friendly admin panel — no coding, no Google Drive folders, no asking Claude to rebuild.
- Feeds leads directly into **Zoho CRM**.
- Stays **light, fast, fully owned by Oak Homes** (no REI or vendor dependency), at ~$0/month hosting cost.
- Is ready to host an **AI chat agent and promotional popups** as a later phase (see §9).

The mockup (`Oak-Homes-Website-SHARE.html`) defines the visual/UX direction only; its architecture (single file, embedded photos, JS section-switching) is replaced.

## 2. Background / current state

- Existing "site" is a 2.5MB single-file HTML mockup deployed by dragging a zip onto Netlify Drop (project `cool-semifreddo-760942`).
- Domain `ownwithoak.com` is now **unlocked** at the registrar; transfer to Oak's own Cloudflare account can proceed (nameservers ready: `harvey.ns.cloudflare.com` / `raegan.ns.cloudflare.com`; all DNS records including Google Workspace email already imported).
- Zoho web-to-lead form exists and was tested end-to-end (creates Leads tagged "Website Lead").
- Two homes currently listed: 614 E Marengo St, Flint MI ($3,000 down / $950/mo, 6 photos) and Brown Street, Flint MI ($3,000 down / $1,250/mo, 5 photos). **Open item:** confirm 2734 vs 2437 Brown St.
- No GitHub account exists yet for Oak Homes.

## 3. Architecture

```
Assistant → admin panel (ownwithoak.com/admin, Sveltia CMS)
         → commits content to GitHub repo
         → Netlify auto-builds (Astro)
         → live static site (~1 minute after Publish)
```

| Component | Choice | Why |
|-----------|--------|-----|
| Site generator | **Astro** | Pre-rendered static HTML per page: fastest loads, best SEO, real social-share previews, no server to maintain. |
| Content storage | Markdown/JSON files + images **in the GitHub repo** | The repo is the single source of truth and the backup. No external database. |
| Admin panel | **Sveltia CMS** (Decap-compatible, free, open source) served at `/admin` | Form-based editing for non-technical users; saves via GitHub. Login with the Oak Homes GitHub account (OAuth handled by a small Netlify function). |
| Hosting | **Netlify** (existing account) | Free tier, auto-build on every commit, already familiar. |
| DNS / domain | Oak-owned **Cloudflare** account | Independence from REI; email records already preserved. |
| Leads | **Zoho web-to-lead form** (existing) | Already tested; leads arrive in Zoho tagged "Website Lead". |

Rejected alternatives (recorded for posterity): vanilla-JS SPA (breaks Facebook/Instagram link previews, weaker SEO, no real per-home URLs, still needs a build step); hosted CMS like Sanity (third-party content lock-in); WordPress (hosting cost, security upkeep, heavy).

## 4. Content model

Everything editable lives as content files the CMS writes; the Astro build turns them into pages.

**Property** (one file per home):
- `title` (display name), `address`, `slug` (URL, auto-generated from address)
- `status`: Available | Pending | Sold (badge on card and page; Sold homes remain visible as social proof unless unpublished)
- `downPayment` (number), `monthlyPayment` (number)
- `beds`, `baths`, `sqft` (numbers, optional)
- `description` (rich text with feature bullets)
- `photos` (ordered list; first = cover)
- `videoUrl` (optional YouTube/Facebook link)
- `location` (map pin: the assistant picks the spot on a small map widget in the admin form; stored as lat/long)
- `publishDate`

**Blog post**: `title`, `slug`, `date`, `coverImage` (optional), `body` (rich text).

**Editable site settings** (single settings file editable in CMS): phone number, email, social links, homepage intro text.

Static page copy (How It Works, About, legal footer) lives in the repo and is edited with Claude's help — it changed rarely and carries legal weight, so it deliberately does not go through the assistant's panel.

## 5. Pages

All pages share one base layout (header, nav, footer with legal line, and the **integrations slot** — see §9).

1. **Home** — brand intro ("A Path to Homeownership"), 3-step overview, featured available homes, CTA.
2. **Browse Homes** (`/homes`) — grid of property cards: cover photo, address, status badge, down/monthly terms, beds/baths/sqft.
3. **Property page** (`/homes/<slug>`) — photo gallery, full terms, specs, description, small map, optional embedded video, **Inquire** button → Contact form with property pre-filled. Proper meta/OpenGraph tags so shared links show photo + address + price.
4. **How It Works** (`/how-it-works`) — content ported from the refined one-pager (steps, land-contract explainer, "what you'll need" panel, CTA).
5. **About** (`/about`) — company intro.
6. **Learn** (`/learn`) — blog index + post pages, written from the admin panel.
7. **Schedule a Showing** (`/schedule`) — phone CTA: (217) 269-0003.
8. **Contact** (`/contact`) — Zoho web-to-lead form.

## 6. Design / branding

Ported from the mockup:

- Colors: yellow `#F6C84C` / deep yellow `#E4AE2B`, ink `#1A1A1A`, warm cream backgrounds (`#FFFDF7`, `#FBF4E4`).
- Fonts: **Lora** (headings) + **Inter** (body), via Google Fonts.
- Leaf logo mark + "Oak Homes / From Rent to Roots" wordmark; tagline **From Rent to Roots**.
- Mobile-first responsive; the phone CTA is prominent on small screens.

**Legal wording (must be preserved exactly as refined):**
- Owner financing described as a **land contract (agreement for deed)**; note that full terms, *including what happens if payments aren't made*, are in the written agreement.
- Footer on every page: *Equal Housing Opportunity. Owner financing is subject to a written agreement; this is not a commitment to lend or an offer of credit.*
- Avoid removed phrasing ("equitable interest", "honest terms", "purchase not a rental").
- Attorney review of copy remains a pre-promotion checklist item (outside this build).

## 7. Lead flow

- Contact page embeds the existing **Zoho web-to-lead form** (module: Leads, tag "Website Lead").
- Property **Inquire** buttons link to the Contact form with the property address pre-filled (Zoho form field populated via URL parameter), so every lead identifies its home.
- End-to-end test at launch: submit test lead, verify in Zoho, delete.

## 8. Assistant workflow (acceptance test for the whole project)

- **Add a home:** log in at `/admin` → Properties → New → fill form, drag photos → Publish → live in ~1 min.
- **Mark sold:** open property → Status dropdown → Publish.
- **Write a post:** Blog → New → title + body → Publish.
- No Git, no code, no file naming rules. A one-page illustrated cheat-sheet for the assistant is a deliverable.
- Migration: the two current homes (Marengo, Brown St) are entered by Claude during the build; team confirms the Brown St street number.

## 9. Future upgrades (Phase 2 — designed-for, not built now)

The base layout includes a single clearly-marked **integrations slot** — the one place where site-wide scripts/widgets get added.

- **AI chat agent popup, Zoho-integrated.** Recommended path: **Zoho SalesIQ** (Zoho's chat widget + "Zobot" AI) — drops in via script tag, conversations and captured contact info flow into Zoho CRM automatically. Alternative if a smarter custom agent is wanted later: a Claude-powered bot via Netlify Functions calling the Zoho API — still no architecture change.
- **Promotional popups / offer banners** (e.g., "New home just listed", email capture) posting into Zoho.
- Analytics, if wanted later, goes in the same slot.

## 10. Delivery phases

1. **Foundation:** create Oak Homes GitHub account (browser walkthrough with owner); connect this computer (git credentials); create private repo; scaffold Astro project.
2. **Build:** all pages per §5–6, content model per §4, migrate the two homes and How-It-Works/About copy.
3. **Admin panel:** Sveltia CMS at `/admin`, GitHub OAuth via Netlify function, CMS config matching §4; full assistant publish-flow test.
4. **Integrations:** Zoho form embed + property pre-fill; maps; Netlify build hooks; meta/OpenGraph tags.
5. **Launch:** connect repo to Netlify (replacing zip-drag deploys); complete domain transfer to Oak Cloudflare; point `@` A record → Netlify (`75.2.60.5`) and `www` → Netlify address; add SPF record `v=spf1 include:_spf.google.com ~all`; verify email still flows; end-to-end lead test; assistant cheat-sheet handoff.

## 11. Non-goals

- No user accounts, saved favorites, or payment processing on the site.
- No online application/credit collection (leads go to Zoho; the rest happens off-site).
- No Google Drive content pipeline (explicitly replaced by the admin panel).
- Chat agent and popups are Phase 2 (§9), not part of this build.

## 12. Testing & acceptance

- **Build checks:** site builds from a clean clone; all pages render; links valid.
- **Assistant test (primary):** assistant adds a test property and blog post through `/admin` unaided by anyone technical; both appear on the live site.
- **Lead test:** contact form submission arrives in Zoho tagged correctly; property pre-fill works from an Inquire button.
- **Share test:** pasting a property URL into Facebook shows photo, address, and terms in the preview card.
- **Performance:** pages load fast on mobile (static HTML, optimized images — Astro handles image resizing at build).
- **Email safety:** after DNS cutover, Google Workspace mail send/receive verified.

## 13. Open items carried from before

1. Confirm Brown St address (2734 vs 2437).
2. Attorney review of owner-financing copy before heavy promotion.
3. Domain transfer execution (now unblocked).
