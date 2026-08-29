# Pitfalls Research

**Domain:** Owner-financing real estate marketing site — Astro static site + Sveltia CMS (git-based) + Netlify + GitHub, maintained by a non-technical assistant, with Zoho CRM lead capture and a domain/DNS migration onto Cloudflare + Google Workspace email
**Researched:** 2026-08-28
**Confidence:** MEDIUM (most findings are single-source web results, not cross-verified against official docs directly in this pass — treat provider/config specifics as needing a live spot-check during the relevant phase, per the confidence tags below)

## Critical Pitfalls

### Pitfall 1: Zoho web-to-lead has no built-in URL-parameter pre-fill

**What goes wrong:**
The project requires "Inquire" buttons on each property page to pre-fill the Zoho contact form with that property's address (PROJECT.md, FEATURES). The team's assumption — visible in the design spec ("Zoho form field populated via URL parameter") — is that this is a standard Zoho capability. It is not, for the classic **Zoho CRM web-to-lead form** (the embeddable HTML snippet this project uses). URL-parameter pre-fill is a feature of the separate **Zoho Forms** product, not the CRM web-to-lead embed.

**Why it happens:**
Zoho's ecosystem has multiple form products (CRM web-to-lead, Zoho Forms, Zoho SalesIQ chat) with overlapping-sounding but different feature sets. Documentation and blog posts often conflate them.

**How to avoid:**
Plan for **custom JavaScript** on the Contact page: on page load, read a `?property=...` query parameter and use `document.getElementById(...)` / `.value =` to set the hidden or visible field in the embedded Zoho form before submit. This requires knowing the exact field `name`/`id` Zoho generates for the embed (see Pitfall 2) and testing that the value survives Zoho's own form validation/submit handler. Budget explicit implementation and testing time for this in Phase 4 (Integrations) — do not assume it "just works" the way a hosted form builder's prefill option would.

**Warning signs:**
Inquire button link works and the contact page loads, but the property field is empty on arrival; or the field shows the raw query string instead of a clean value.

**Phase to address:**
Phase 4 (Integrations) — build and test the custom prefill script against the live embedded form; verify with an actual test lead in Zoho before moving to Phase 5 (Launch).

---

### Pitfall 2: Zoho web-to-lead form silently stops capturing leads due to source-URL mismatch

**What goes wrong:**
Zoho CRM web-to-lead forms are tied at creation time to a registered source URL. If the form is embedded on a page whose live URL differs from what was registered (common after a domain change, or when embedding inside a layout/component rather than a flat page), submissions can be silently dropped — the visitor sees a "thank you," but nothing appears in Zoho.

**Why it happens:**
Zoho validates the `Referer`/registered source URL as a lightweight anti-spam/anti-scraping measure. Since this project is also doing a domain migration (Netlify preview URL → ownwithoak.com) and moving the form from the old single-file mockup into a new Astro component, there are two separate opportunities for the registered URL to drift from the actual URL.

**How to avoid:**
In Zoho's webform settings, set the source URL to a wildcard (`*`) or explicitly re-register the exact final `ownwithoak.com/contact` URL after the domain cutover, not just the Netlify preview URL used during Phase 4 build/test. Re-test end-to-end (submit → verify in Zoho → delete) **after** the Phase 5 domain cutover, not only during Phase 4 integration testing on the `*.netlify.app` URL — a pass on the preview domain does not guarantee a pass on the production domain.

**Warning signs:**
Test lead submitted successfully (no client-side error) but does not appear in Zoho within a few minutes; discrepancy only appears after the domain changes.

**Phase to address:**
Phase 4 (initial integration + testing on preview URL) **and** Phase 5 (re-verification on the live domain) — this is a two-phase pitfall, not a single checkbox.

---

### Pitfall 3: DNS cutover breaks Google Workspace email (MX/SPF/DKIM not carried over)

**What goes wrong:**
When moving nameservers to Cloudflare and pointing records at Netlify, it's common for MX records, the SPF TXT record, and the DKIM TXT record to not be automatically recreated in the new DNS zone — the registrar's old zone doesn't get "copied," records must be re-entered manually. If Google Workspace's MX records are missing or wrong even briefly, inbound mail to `hello@ownwithoak.com` bounces or is lost; if SPF is wrong, outbound mail risks landing in spam or being rejected by recipients enforcing DMARC.

**Why it happens:**
Teams focus on getting the *website* pointed correctly (A/CNAME records) and treat email as "it'll just keep working" since the domain itself doesn't change — but nameserver changes move the entire authoritative DNS zone, including MX/SPF/DKIM, not just the web records.

**How to avoid:**
- Before cutover: export/screenshot the full existing DNS zone (already partly done — PROJECT.md notes "Cloudflare account ready with all DNS imported").
- Explicitly verify, side by side, that Cloudflare has: the Google Workspace MX records (all of them, with correct priorities), the SPF TXT record (`v=spf1 include:_spf.google.com ~all` — include only Google, not stale entries from the old host), and the Google Workspace DKIM TXT record (regenerate from Google Admin console if unsure it carried over — DKIM keys are per-provider and don't get inferred).
- Lower TTLs to ~300s a day ahead of cutover so any fix propagates fast.
- Send/receive a real test email through Workspace immediately after cutover, before declaring launch done (this is already listed in the design spec's testing section — keep it as a hard gate, not a nice-to-have).

**Warning signs:**
Any bounce-back on a test email sent to/from `hello@ownwithoak.com` in the hours after DNS cutover; mail arriving but landing in spam (SPF/DKIM misalignment).

**Phase to address:**
Phase 5 (Launch/domain) — this must be a scripted, checked step in the cutover runbook, not an assumption. Verify MX/SPF/DKIM are staged and correct in Cloudflare *before* changing nameservers at the registrar, then re-verify live immediately after.

---

### Pitfall 4: CMS config.yml drifts from the actual content schema, breaking the admin form

**What goes wrong:**
Sveltia/Decap-style CMSes generate their admin form purely from `config.yml` field definitions. If a field is renamed, removed, or its type changed in the Astro content schema (e.g., a Zod content collection schema) without updating `config.yml` to match — or vice versa — the admin form either shows the wrong fields, fails validation, or produces frontmatter that Astro's content schema then rejects at build time.

**Why it happens:**
`config.yml` and the Astro content collection schema are two independent, manually-synchronized sources of truth describing the same content shape. Nothing enforces they stay aligned; a developer (or Claude, mid-session) can update one without the other, especially under later iteration once the site is "done."

**How to avoid:**
Treat the property/blog-post field list as a single documented contract established once in Phase 2/3 and touched together whenever either side changes. When adding/changing a field, always update both the Astro content schema (`src/content/config.ts`) and `public/admin/config.yml` in the same commit. Add a build-time check: if the Astro build fails validation on CMS-authored content, that failure should be loud and specific (not swallowed), so drift is caught at the next Netlify build rather than silently corrupting the live site.

**Warning signs:**
Admin form shows a field that no longer renders on the live site (or vice versa); Netlify build fails after a routine CMS publish with a content-schema validation error; a field the assistant filled in doesn't show up on the published page.

**Phase to address:**
Phase 3 (Admin panel) to establish the aligned contract initially; flag as a standing rule for any future phase that touches the content model (including the Phase 2 integrations slot follow-on work).

---

### Pitfall 5: Uncompressed photos bloat the git repo permanently

**What goes wrong:**
Content and photos live directly in the GitHub repo (explicit architecture decision — "no database"). If the assistant (or Claude during migration) uploads full-resolution phone/camera photos (often 3–8MB each) through the CMS, every one gets committed to git history. Git never shrinks — even replacing or deleting a photo later leaves the old blob in history — so repo size only grows, slowing clones, Netlify builds, and eventually risking GitHub's soft repository-size guidance.

**Why it happens:**
The CMS media widget accepts whatever file the assistant drags in; there's no default resizing/compression step between "drag photo into admin" and "commit to git," and a non-technical user has no way to know a photo is 6MB versus 200KB.

**How to avoid:**
Two complementary layers: (1) Astro's `astro:assets` (`<Image>`/`<Picture>`) already optimizes images at *build/serve* time (WebP/AVIF, resizing) — this fixes page-weight but does **not** fix repo bloat, since the original oversized file is still what's committed. (2) Add an explicit pre-commit or CMS-side size guard: either configure the CMS media library step to warn/limit file size, or document in the assistant's cheat-sheet that photos should be exported at a "web size" (e.g., resize to ~2000px wide) before uploading — most phones' camera apps or the OS photo picker can do this in one step. For the two homes migrated at launch, Claude should pre-resize photos before committing them, setting the precedent.

**Warning signs:**
Repo size growing noticeably faster than content count would suggest; Netlify build times creeping up; `git clone` taking longer than expected for a small marketing site.

**Phase to address:**
Phase 2 (Build) — establish the image pipeline and pre-resize the two migrated homes' photos as the reference example; Phase 3 (Admin panel) — document/enforce the size guidance in the assistant cheat-sheet so it's a habit from day one, not a retrofit.

---

### Pitfall 6: Fair housing wording regression during later edits

**What goes wrong:**
The Fair Housing Act covers **all** advertising of residential property for sale, rent, or financing, with no carve-outs — and this project's copy has already been deliberately refined (land contract / agreement for deed language, removal of phrases like "equitable interest," "honest terms," "purchase not a rental," and a specific Equal Housing Opportunity footer disclaimer). The risk isn't the initial build — it's that a future edit (a new blog post, a tweaked property description, a new page) reintroduces risky language, or that the Equal Housing footer gets dropped from a newly-added page/template because it's a hardcoded partial that a new page type forgets to include.

**Why it happens:**
Static legal-weight copy (How It Works, About, footer) is intentionally kept out of the assistant's CMS panel (per design spec §4) precisely because it's fragile — but the footer must still appear on *every* page, including any new page templates added later (e.g., if a landing page or promo page is added in Phase 2 upgrades). If the footer isn't part of the shared base layout that literally every route uses, a new page type can ship without it.

**How to avoid:**
Bake the Equal Housing Opportunity footer into the single shared base layout component (already planned — "one base layout" per §5) so it is structurally impossible to add a page without it, rather than something copy-pasted per page. For blog posts (the one CMS-editable content type with free-text rich body), keep the pre-launch attorney review as a hard gate before "heavy promotion" (already an open item in PROJECT.md/spec) and consider a lightweight editorial reminder in the assistant cheat-sheet ("avoid promising loan approval, avoid excluding groups, avoid guarantee language") since the assistant will be writing free-text blog copy without legal review on every post.

**Warning signs:**
A new page added later doesn't show the footer; a blog post uses financing-guarantee language ("guaranteed approval," "no credit check needed") or exclusionary language.

**Phase to address:**
Phase 2 (Build) — footer lives in the base layout, not per-page. Phase 5 (Launch) — final compliance check against PROJECT.md's approved wording is part of the launch checklist, and attorney review remains an explicit pre-promotion gate outside this build (already tracked as an open item).

---

## Moderate Pitfalls

### Pitfall 7: Netlify Git Gateway deprecation trap (avoided by design, but worth confirming)

**What goes wrong:**
Older Decap CMS tutorials assume "Netlify Identity + Git Gateway" for authenticating the CMS. Git Gateway is deprecated for new setups; teams following outdated tutorials can end up half-configuring a path that isn't recommended going forward.

**Why it happens:**
Most CMS setup guides online predate Sveltia CMS and still describe the Identity/Git Gateway pattern, since Decap (formerly Netlify CMS) popularized it.

**How to avoid:**
This project's stack choice already avoids the trap: Sveltia CMS authenticates via **GitHub OAuth** directly (Netlify acting as the OAuth proxy, or a small Netlify Function), not Identity+Git Gateway. During Phase 3 setup, explicitly confirm the auth flow being configured is the GitHub OAuth App path, not a copy-pasted Identity/Git Gateway tutorial — get the GitHub OAuth App's callback URL exactly right (`https://ownwithoak.com/admin/auth/callback` pattern) since a mismatched callback URL is the most common single OAuth setup error.

**Prevention:** Confirm during Phase 3 planning which auth backend Sveltia is configured for before following any tutorial; verify the callback URL matches exactly (including trailing slashes/protocol).

---

### Pitfall 8: Non-technical editor confusion from git-based CMS mental model

**What goes wrong:**
Sveltia CMS (and Decap) have no real-time collaborative editing, and Sveltia in particular works against a single branch with effectively one draft "in flight" at a time — very different from Google Docs-style editing the assistant may be used to. If the assistant opens the admin panel in two tabs, or another person edits at the same time, one edit can silently overwrite the other, or a half-finished draft could get published unexpectedly.

**Why it happens:**
The CMS presents a friendly form UI but the underlying model is still "one git branch, one linear history" — a fundamentally single-editor-at-a-time system.

**How to avoid:**
Since this is a solo non-technical assistant (not a team of editors), the practical risk is mainly "assistant leaves a tab open and forgets," not true concurrent-user conflict. Mitigate with the assistant cheat-sheet: one browser tab for `/admin` at a time; always click Publish (not just save/close) before navigating away; and if something looks wrong after publishing, the git history in the repo is the recovery path (Claude can always restore a prior commit).

**Phase to address:**
Phase 3 (Admin panel) — document this in the one-page cheat-sheet deliverable already planned.

---

### Pitfall 9: Netlify free-tier build/bandwidth caps are a hard cutoff, not a throttle

**What goes wrong:**
Netlify's free tier (300 build minutes, 100GB bandwidth/month, restructured to a credit system) has **no grace period** — exceeding it can take the site offline until the next billing month, with no warning ramp.

**Why it happens:**
A small local-market site is very unlikely to hit these limits under normal traffic, but a social-media spike (e.g., a viral local Facebook post, or an aggressive photo-heavy blog cadence triggering frequent rebuilds) could plausibly approach the bandwidth cap given multi-MB photo galleries per home.

**How to avoid:**
Keep photos optimized (ties back to Pitfall 5/astro:assets) to reduce bandwidth per pageview; if the site gains real traction, monitor Netlify's usage dashboard occasionally. Not worth over-engineering for at this scale, but worth a one-line mention in the launch checklist so it's not a total surprise later.

**Phase to address:**
Phase 5 (Launch) — note as a monitoring item, not a build task.

---

## Minor Pitfalls

### Pitfall 10: Missing/incomplete OpenGraph tags produce generic-looking social shares

**What goes wrong:**
The "share test" acceptance criterion (pasting a property URL into Facebook should show photo + address + terms) will fail if `og:image`, `og:title`, `og:description`, or `og:site_name` are missing or use a site-wide default rather than per-property values — every shared home link would look identical instead of showing that home's own cover photo and price.

**How to avoid:**
Set OG tags per-page in the shared base layout, sourced from each property's own `photos[0]`, `title`, `downPayment`/`monthlyPayment`, and `address` frontmatter — not a single static site-wide image. Keep the `og:image` under ~300KB (WhatsApp's practical limit) even after Astro's optimization. Test with a real preview-debugger tool (Facebook Sharing Debugger, or a generic OG preview tool) before launch, not just visual inspection of the meta tags.

**Phase to address:**
Phase 4 (Integrations, meta/OpenGraph tags per §10) — test with an actual social-preview debugger as part of the "share test" acceptance criterion already defined in the spec.

---

### Pitfall 11: Forgetting redirects from the old mockup's structure

**What goes wrong:**
The old single-file mockup used in-page JS section-switching (anchors like `#homes`, `#contact`) rather than real URLs, so there isn't a large body of indexed old URLs to worry about — but if the old Netlify Drop project (`cool-semifreddo-760942`) has been shared anywhere (social posts, business cards, Google Business listing) with its `.netlify.app` URL or any deep link, those references will 404 once traffic is cut over to the new site/domain.

**How to avoid:**
Add a simple `_redirects` file in the new Netlify site mapping the old project's known shared URLs (if any) to the new domain's home page at minimum. Check Google Business Profile and any social bios for the old link and update them at launch. Low effort, low risk given the mockup's single-file architecture, but worth a 15-minute check rather than assuming there's nothing to redirect.

**Phase to address:**
Phase 5 (Launch) — quick check-and-redirect pass alongside the domain cutover.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Committing full-resolution photos to git instead of a pre-resize step | Faster initial migration, less setup | Permanent repo bloat, slower builds/clones over time | Never as a standing habit; acceptable one-time for the 2 launch homes if resized immediately after, before more content is added |
| Skipping the custom Zoho URL-prefill script and just linking Inquire → generic Contact form | Ships faster in Phase 4 | Leads don't identify which home they're asking about, undermining a stated acceptance criterion | Only as a temporary Phase 4 fallback if the prefill script proves harder than expected — must be fixed before Phase 5 launch, not left as final state |
| Leaving CMS `config.yml` and Astro content schema loosely in sync ("close enough") | Less coordination overhead early on | Admin form breaks or corrupts content unpredictably as fields evolve | Never — this is a correctness issue, not a scope tradeoff |
| Deferring the attorney review of copy past initial launch | Launches sooner | Legal/compliance exposure on live, publicly promoted marketing copy | Acceptable only if promotion stays low-key (as PROJECT.md already frames it: "pending before heavy promotion") — must happen before any paid ads or wide social push |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Zoho web-to-lead form | Assuming built-in URL-parameter prefill exists (it's a Zoho Forms feature, not CRM web-to-lead) | Write custom JS to read query params and set field values by ID before submit; test on both preview and production URLs |
| Zoho web-to-lead form | Registering the form's source URL as the Netlify preview URL and never updating it after domain cutover | Use a wildcard source URL, or re-register the exact production URL after Phase 5 cutover, and re-run the lead test on the live domain |
| Sveltia CMS + GitHub OAuth | Following an outdated Netlify Identity + Git Gateway tutorial | Configure GitHub OAuth App directly with the exact `/admin/auth/callback` URL; confirm auth backend in `config.yml` matches the chosen flow |
| Google Workspace + Cloudflare DNS | Assuming MX/SPF/DKIM "just come along" when nameservers change | Manually verify and stage MX, SPF, and DKIM records in the new zone before cutover; regenerate DKIM from Google Admin if in doubt |
| Netlify custom domain | Using a CNAME on the apex/root domain | Use an A record (75.2.60.5) or ALIAS/ANAME on the apex; CNAME only on `www` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Uploading unresized photos via the CMS | Repo size grows fast, Netlify build times creep up | Pre-resize to ~2000px wide before upload; rely on `astro:assets` only for serve-time optimization, not as a repo-size fix | Noticeable by ~20-30 unresized full-res photos; a real problem well before it threatens Netlify's free-tier build minutes |
| Relying only on site-wide OG defaults | All social shares look identical regardless of which property was shared | Per-page OG tags sourced from each property's own data | Immediately — this isn't a scale issue, it's wrong from day one if not built per-page |
| No monitoring of Netlify bandwidth/build minutes | Site could go offline without warning if free tier is exceeded | Spot-check Netlify usage dashboard occasionally post-launch, especially after a marketing push | Unlikely at this site's expected traffic level, but a hard cutoff with no warning if it happens |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Weak or default Zoho web-to-lead spam settings | Fake/bot leads pollute the Zoho pipeline the assistant relies on for real inquiries | Enable Zoho's Honeypot field and/or CAPTCHA (reCAPTCHA v2/v3 or Cloudflare Turnstile) and CRM-level Spam Detection at setup, not as an afterthought once spam appears |
| GitHub OAuth App misconfigured with an overly broad or wrong callback URL | Could allow auth flow to be hijacked or simply fail unpredictably | Set the exact production callback URL (`https://ownwithoak.com/admin/auth/callback`); avoid wildcard callback patterns |
| Private repo visibility assumptions | Content/photos are the CMS's only backing store — if the repo were accidentally made public, all content (though not secrets) would be exposed | Confirm the GitHub repo is created as **private** in Phase 1 and stays that way; no CMS credentials or API keys should ever be committed to it regardless |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Git-based CMS draft/publish model with no "are you sure" clarity for a non-technical user | Assistant may not realize a change wasn't actually published, or may double-publish confusing content | One-page cheat-sheet (already planned) should explicitly show what "Publish" looks like and how to confirm it worked (live site refresh) |
| No visible confirmation that a Zoho lead was captured after Inquire | Assistant/owner can't easily tell if leads are flowing without checking Zoho directly | Not a build requirement, but worth setting an expectation in the cheat-sheet: check Zoho periodically, don't rely on the website itself to confirm lead capture |
| Photos uploaded in inconsistent order or orientation | Property galleries look unprofessional (sideways photos, cover photo not the best shot) | CMS's "ordered list, first = cover" field (already in the content model) should be explained in the cheat-sheet with a visual example |

## "Looks Done But Isn't" Checklist

- [ ] **OpenGraph tags:** Often only set site-wide — verify each property page's shared link shows *that* property's own photo/price in an actual Facebook/WhatsApp preview tool, not just by reading the HTML `<head>`.
- [ ] **Zoho lead capture:** Often tested only on the Netlify preview URL — verify a real end-to-end test lead on the *production* domain after Phase 5 cutover, including the Inquire prefill.
- [ ] **Google Workspace email:** Often "looks fine" because inbound mail from the last hour still works (cached) — verify by sending a fresh test message from an external account after DNS cutover, not just checking existing mail still loads.
- [ ] **Equal Housing footer:** Often present on the main pages built early but forgotten on later additions — verify it renders on every route by checking the shared base layout is the only place it's defined.
- [ ] **Image optimization:** Often "done" because Astro's `<Image>` component is used, but the *source* files committed to git are still full-resolution — check actual repo size / individual file sizes in the content folder, not just the rendered output.
- [ ] **Redirects:** Often skipped entirely on a "new site, no real old URLs" assumption — verify nothing (Google Business Profile, social bios) still points at the old `cool-semifreddo-760942.netlify.app` project.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Google Workspace email breaks after DNS cutover | LOW–MEDIUM | Re-check MX/SPF/DKIM records against Google's official values in Cloudflare; propagation is usually fast if TTL was pre-lowered; email typically restores within minutes to a couple hours once records are correct |
| CMS config.yml drifts from content schema, corrupting a publish | LOW | Git history has every prior commit — revert the offending content commit or config.yml change; Astro build failure prevents a broken deploy from going live in the first place if the schema validation is strict |
| Repo bloated by unresized photos | MEDIUM | Can be cleaned with git history rewriting (e.g., `git filter-repo`) but this rewrites all commit hashes and requires a fresh clone for the CMS/Netlify connection — better to just prevent going forward than to attempt cleanup unless size becomes a real operational problem |
| Zoho leads not arriving due to source-URL mismatch | LOW | Update the source URL setting in Zoho (or switch to wildcard); no data is recoverable for leads missed during the mismatch window, so speed of detection matters more than recovery |
| Fair housing wording regression in a blog post | LOW–MEDIUM | Edit and republish immediately (git-based CMS makes this fast); more important to have a pre-publish mental checklist for the assistant than to rely on catching it after the fact |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Zoho web-to-lead has no built-in prefill | Phase 4 | Custom prefill script written and tested; Inquire button populates property field correctly on the live form |
| Zoho source-URL mismatch drops leads | Phase 4 (initial) + Phase 5 (re-verify) | Test lead submitted and confirmed in Zoho on both the preview URL and, again, the production domain |
| DNS cutover breaks Google Workspace email | Phase 5 | MX/SPF/DKIM staged and diffed against Google's documented values before cutover; live send/receive test immediately after |
| CMS config.yml drifts from content schema | Phase 3 (established) | Astro build fails loudly on schema mismatch rather than silently publishing broken content; config.yml and content schema updated together in every change |
| Uncompressed photos bloat the repo | Phase 2 (pipeline set) + Phase 3 (documented for assistant) | Migrated launch photos are pre-resized; cheat-sheet instructs the assistant to use web-sized images |
| Fair housing wording regression | Phase 2 (footer in base layout) + Phase 5 (launch compliance check) | Footer renders on every route by construction; approved wording checklist reviewed before go-live; attorney review remains a pre-promotion gate |
| Outdated Git Gateway auth pattern | Phase 3 | Confirm GitHub OAuth App + correct callback URL is the configured auth backend, not Identity/Git Gateway |
| Non-technical editor concurrent-edit confusion | Phase 3 | Cheat-sheet documents single-tab, always-Publish workflow |
| Netlify free-tier hard caps | Phase 5 | Noted as a post-launch monitoring item |
| Missing/generic OpenGraph tags | Phase 4 | Share test passes in an actual social-preview debugger for at least one property page |
| No redirects from old mockup links | Phase 5 | Old Netlify project URL and any public references checked/updated |

## Sources

- [decaporg/decap-cms Discussion #7419 — Netlify Identity deprecation](https://github.com/decaporg/decap-cms/discussions/7419) — LOW confidence (community discussion, single source)
- [Netlify Docs — Git Gateway](https://docs.netlify.com/manage/security/secure-access-to-sites/git-gateway/) — MEDIUM (official docs, not independently re-verified in this pass)
- [Sveltia CMS — GitHub Backend docs](https://sveltiacms.app/en/docs/backends/github) — LOW (single source)
- [sveltia/sveltia-cms Issue #312 — Netlify config instructions](https://github.com/sveltia/sveltia-cms/issues/312) — LOW
- [Sveltia CMS — Editorial Workflow docs](https://sveltiacms.app/en/docs/workflows/editorial) — LOW
- [GitProtect.io — hidden cost of git repository bloat](https://gitprotect.io/blog/hidden-cost-of-git-repository-bloat/) — MEDIUM (general git behavior, well-established)
- [Codemzy's Blog — hosting images without bloating git](https://www.codemzy.com/blog/hosting-image-files-without-bloating-git) — LOW
- [Netlify Support Forums — free plan bandwidth/build minutes limits](https://answers.netlify.com/t/what-happens-if-a-free-plan-exceeds-bandwidth-and-or-build-minutes-limit/16244) — MEDIUM
- [Gautam Khorana — Netlify Free Tier Limits 2026 breakdown](https://gautamkhorana.com/blog/netlify-free-tier-limits-2026/) — LOW (third-party summary, not official)
- [Google Workspace Admin Community — MX records via Cloudflare after domain transfer](https://support.google.com/a/thread/340577831) — MEDIUM
- [Cloudflare Community — G Suite MX records disappearing](https://community.cloudflare.com/t/g-suite-mx-records-disappearing/73941) — LOW
- [DMARCLY — SPF/DKIM/DMARC setup guide for Google Workspace](https://dmarcly.com/blog/spf-dkim-dmarc-set-up-guide-for-g-suite-gmail-for-business) — MEDIUM
- [Google Workspace Help — Set up SPF](https://knowledge.workspace.google.com/admin/security/set-up-spf) — HIGH (official Google docs)
- [Google Workspace Help — Set up DMARC](https://knowledge.workspace.google.com/admin/security/set-up-dmarc) — HIGH (official Google docs)
- [Netlify Docs — Configure external DNS for a custom domain](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/) — HIGH (official docs; matches the A-record value 75.2.60.5 already recorded in this project's PROJECT.md)
- [Netlify Support Forums — using an ALIAS record for apex domains](https://answers.netlify.com/t/using-an-alias-record-to-point-an-apex-domain-to-a-netlify-subdomain-external-dns-provider/83728) — MEDIUM
- [National Fair Housing Alliance — Responsible Advertising](https://nationalfairhousing.org/responsibleadvertising/) — MEDIUM (advocacy org summary of HUD rules, not primary regulatory text)
- [Fair Housing Institute — Advertising Guidelines](https://fairhousinginstitute.com/fair-housing-advertising-guidelines/) — LOW
- [Liran Tal — Getting social media previews right with OpenGraph on Astro](https://lirantal.com/blog/getting-social-media-previews-right-with-opengraph-meta-tags) — LOW
- [Astro Docs — Images guide](https://docs.astro.build/en/guides/images/) — HIGH (official docs)
- [Astro.build blog — Better Images in Astro](https://astro.build/blog/images/) — HIGH (official)
- [Bruce Clay — URL redirects best practices during a site migration](https://www.bruceclay.com/blog/url-redirects-best-practices-during-a-site-migration/) — MEDIUM
- [HAMY — migrating sites on Netlify without losing SEO](https://hamy.xyz/blog/netlify-migrating-sites-to-a-new-domain) — LOW
- [Zoho Help — FAQs on Webform](https://help.zoho.com/portal/en/kb/crm/faqs/channels/articles/faqs-webforms) — MEDIUM (official Zoho help portal)
- [Zoho Community — Web-to-lead forms doesn't work when embedded](https://help.zoho.com/portal/en/community/topic/web-to-lead-forms-doesn-t-work-when-embedded) — LOW (community thread)
- [Zoho Forms — Spam Control CAPTCHA](https://help.zoho.com/portal/en/kb/forms/form-settings/privacy-features/captcha/articles/spam-control) — MEDIUM (official)
- [Zoho Community — spam detection for webforms announcement](https://help.zoho.com/portal/en-gb/community/topic/introducing-spam-detection-for-webforms-an-additional-layer-of-protection-to-keep-your-zoho-crm-clean-and-secure) — MEDIUM (official Zoho announcement)
- [Zoho Forms — Prefill Forms feature page](https://www.zoho.com/forms/prefill-forms.html) — MEDIUM (official — confirms prefill is a Zoho Forms feature, distinct from CRM web-to-lead)
- [Square Labs — How to Enhance Zoho CRM Webforms](https://www.squarelabs.com.au/blogs/post/how-to-enhance-zoho-crm-webforms) — LOW (describes the custom-JS prefill workaround for CRM web-to-lead)

**Note on confidence:** Findings above tagged HIGH draw on official Google/Netlify/Astro documentation. Findings tagged MEDIUM are corroborated by official vendor help content but not independently cross-checked against a second source in this pass. Findings tagged LOW come from single community/blog sources and should be spot-checked live during the phase that implements them (especially the Sveltia CMS-specific and Zoho CRM-web-to-lead-specific claims, since Sveltia is a newer/smaller project with less documentation depth than Decap, and Zoho's web-to-lead behavior can vary by account/region settings).

---
*Pitfalls research for: owner-financing real estate marketing site (Astro + Sveltia CMS + Netlify + GitHub + Zoho CRM + Cloudflare DNS)*
*Researched: 2026-08-28*
