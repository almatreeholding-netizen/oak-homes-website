---
phase: quick-260902-txo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/data/legal.ts
  - src/pages/privacy.astro
  - src/pages/sms-terms.astro
  - src/layouts/Layout.astro
  - scripts/verify/checks.mjs
autonomous: true
requirements: [COMPLIANCE-10DLC-01, COMPLIANCE-10DLC-02, COMPLIANCE-10DLC-03]

estimate:
  tokens: 85000
  raw_tokens: 85000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A carrier/TCR vetting reviewer crawling ownwithoak.com can reach a Privacy Policy and an SMS Terms page from a footer link on every page of the site, with no login and no redirect."
    - "The Privacy Policy states verbatim that mobile information is not sold or shared with third parties or affiliates for marketing or promotional purposes, and that text-messaging originator opt-in data and consent are excluded from every sharing category — the single statement 10DLC vetting most often rejects a brand for lacking."
    - "The SMS Terms page carries all six carrier-expected disclosures: sender identity and message type, message frequency, message-and-data-rates, STOP to opt out, HELP for help, and that consent is not a condition of purchase."
    - "Both pages are crawlable — no robots directive blocks indexing — and both appear in the generated sitemap so Search Console and vetting crawlers find them."
    - "The two facts nobody has yet supplied — the registering legal entity name and the physical business mailing address — appear as loud, greppable bracketed tokens rather than invented values, so no false statement is published and no 10DLC registration is filed against a mismatched entity."
    - "`node scripts/verify/checks.mjs legal-placeholders` fails by name and by file:line while either token remains unresolved, and passes only once both are replaced with real values — so a placeholder cannot reach the live domain unnoticed."
    - "Legal prose lives only in code (src/pages + src/data); no file under src/content/ contains any of it, so the assistant cannot edit it from the CMS — the DESIGN-03 precedent already applied to the land-contract and Equal Housing wording."
    - "Contact facts rendered on both legal pages come from the settings collection, so they cannot drift from the header and footer."
  artifacts:
    - path: "src/pages/privacy.astro"
      provides: "the /privacy route: a complete privacy policy covering collection, use, service providers (Zoho CRM, Netlify), the SMS-consent non-sharing statement, deletion requests, and an effective date"
      contains: "text messaging originator opt-in data and consent"
    - path: "src/pages/sms-terms.astro"
      provides: "the /sms-terms route: CTIA/carrier-expected messaging disclosures including STOP, HELP, frequency, rates, and the not-a-condition-of-purchase statement"
      contains: "Message and data rates may apply."
    - path: "src/data/legal.ts"
      provides: "the single shared source for the unresolved legal facts and the effective date, so the two pages cannot state different values and one edit resolves both"
      contains: "LEGAL_ENTITY_NAME"
    - path: "src/layouts/Layout.astro"
      provides: "footer-nav links to /privacy and /sms-terms, present on every page of the site because footer-nav lives only here"
      contains: "/sms-terms"
    - path: "scripts/verify/checks.mjs"
      provides: "the `legal-placeholders` check id — a self-testing scan that fails by file:line on any unresolved bracketed placeholder in the legal source files or the built HTML"
      contains: "legal-placeholders"
  key_links:
    - from: "src/data/legal.ts constants"
      to: "src/pages/privacy.astro and src/pages/sms-terms.astro"
      via: "both pages import the same constants, so the entity name, address, and effective date are stated identically on both and are resolved in one edit"
      pattern: "from '../data/legal'"
    - from: "src/layouts/Layout.astro footer-nav"
      to: "/privacy and /sms-terms"
      via: "footer-nav is declared only in the shared layout, so every built page carries both links — the pattern vetting crawlers expect"
      pattern: "href=\"/privacy\""
    - from: "src/data/legal.ts placeholder tokens"
      to: "scripts/verify/checks.mjs legal-placeholders"
      via: "the check scans an explicit file list plus dist HTML for bracketed uppercase tokens and exits non-zero naming each one, turning an unresolved fact into a loud pre-launch gate instead of silent published text"
      pattern: "legal-placeholders"
    - from: "src/content/settings.json phone/email"
      to: "both legal pages"
      via: "getEntry('settings','main'), the same call contact.astro already makes — contact facts stay single-sourced"
      pattern: "getEntry('settings', 'main')"
---

<objective>
Publish two static legal pages — `/privacy` and `/sms-terms` — and link them from the site
footer, so US A2P 10DLC brand/campaign vetting can crawl them and the owner can activate SMS
on (217) 269-0003 through Zoho.

Purpose: a missing or inadequate privacy policy is the single most common 10DLC rejection
reason, and the owner is blocked on texting customers until vetting passes. This is the
critical path.

Output: `src/pages/privacy.astro`, `src/pages/sms-terms.astro`, `src/data/legal.ts`, two new
footer links in `src/layouts/Layout.astro`, and a new `legal-placeholders` check in
`scripts/verify/checks.mjs` that keeps an unresolved legal fact from shipping unnoticed.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/WINDOWS.md

@src/pages/about.astro
@src/pages/contact.astro
@src/layouts/Layout.astro
@src/content/settings.json
</context>

<interface_context>
Shapes the executor needs and must not re-derive:

- `Layout.astro` props: `{ title: string; description?: string }`. It renders the html/head/body
  shell, the skip link, the header (brand + Nav + phone), `<main id="main-content">` wrapping the
  slot, and the footer (BrandMark, footer-contact, `<nav class="footer-nav">`, the verbatim
  Equal Housing paragraph). Every page renders through it. Nothing else in the project emits
  those elements.
- Settings access pattern, copied from `contact.astro` lines 19-23:
  `const settings = await getEntry('settings', 'main');` then a null-guard that throws naming
  the file, then `const { phone, phoneHref, email } = settings.data;`.
  `phone` = `(217) 269-0003`, `phoneHref` = `tel:+12172690003`, `email` = `hello@ownwithoak.com`.
- Global type scale (declared once in `Layout.astro`'s `<style is:global>`, locked by
  `02-UI-SPEC.md`): body 16px/400/1.5, h1 36px Lora/600/1.15, h2 24px Lora/600/1.2, and a
  14px/600 Label used for small UI text. 14px is the floor. There is no h3 rule and no smaller
  size — do not introduce one.
- Color tokens available (`src/styles/global.css`): `--color-cream #FFFDF7`,
  `--color-cream-deep #FBF4E4`, `--color-accent #FFD053`, `--color-accent-hover #EDB52F`,
  `--color-price-gold #A87E24`, `--color-ink #1A1A1A`, `--color-pending #D9B36C`,
  `--color-destructive #B3261E`. No new colors.
- `about.astro`'s page-shell style block is the structural analog to copy:
  `max-width: 820px; margin: 0 auto; padding: 32px 24px 64px;`, `h2 { margin-top: 24px; }`,
  `p { margin: 0; max-width: 70ch; }`, and a `.lead` at 16px/1.5.
- `scripts/verify/checks.mjs` shape: one `const checks = { 'id': (id) => {...}, ... };` object
  closed at the end of the file, followed by an argv dispatch block. Helpers already defined near
  the top and reusable: `readUtf8File(path)`, `walkFiles(dir)` (recursive, returns full paths),
  `listDir(path)`, `runGit(args)` (returns `{ok, stdout, stderr, reason}`), `fail(id, reason)`
  (writes `FAIL <id>: <reason>` to stderr, exit 1), `pass(id)`. Imports already at the top include
  `readFileSync, readdirSync, statSync, existsSync` from `node:fs` and `join, resolve, sep` from
  `node:path`. Node built-ins only — never shell out to grep/find/wc.
- Every existing check that touches the repo begins with
  `const toplevelResult = runGit(['rev-parse', '--show-toplevel']);` then a failure guard then
  `const toplevel = resolve(toplevelResult.stdout);`. Follow that.
</interface_context>

<tasks>

<task type="tracer" tdd="false">
  <name>Task 1: Both legal pages live, footer-linked, single-sourced facts</name>

  <files>
    src/data/legal.ts (new),
    src/pages/privacy.astro (new),
    src/pages/sms-terms.astro (new),
    src/layouts/Layout.astro (modified)
  </files>

  <read_first>
    - `src/pages/about.astro` — the structural analog. Copy its page-shell markup shape and its
      scoped style block almost verbatim; do not invent a new page layout.
    - `src/pages/contact.astro` lines 15-24 — the exact settings-access pattern with its
      null-guard, to be reproduced in both new pages.
    - `src/layouts/Layout.astro` lines 70-86 — the footer, and specifically the
      `<nav class="footer-nav" aria-label="Footer">` block the two new links go into. Note the
      comment at lines 27-33 explaining why the Equal Housing wording lives in code and must never
      become a content-collection field: that is the DESIGN-03 precedent this task follows.
    - `.planning/phases/02-publishing/02-UI-SPEC.md` "Typography" and "Color" tables — the four
      permitted type sizes with a 14px floor, and the inherited palette.
  </read_first>

  <behavior>
    Rendered output, asserted in Task 3 against real built HTML:
    - `/privacy` and `/sms-terms` both emit, each with exactly one `<h1>`.
    - Every page in the site (including `/about`) carries a footer link to each of the two new routes.
    - `/privacy` contains the mobile-information non-sharing statement verbatim.
    - `/sms-terms` contains the frequency, rates, STOP, HELP, and not-a-condition-of-purchase
      disclosures verbatim.
    - Neither page emits a robots meta directive that blocks indexing.
    - Both routes appear in the generated sitemap.
  </behavior>

  <action>
    Create `src/data/legal.ts`. It exports exactly three string constants and nothing else:

    - `LEGAL_ENTITY_NAME` — set to the literal five-character-bracketed token
      `[[LEGAL_ENTITY_NAME]]`. The registering legal entity is NOT known. "Oak Homes" may be a
      DBA and the 10DLC brand must match the legal entity on the EIN. Do not guess it, do not
      write "Alma Tree Holding LLC", do not write "Oak Homes LLC".
    - `BUSINESS_ADDRESS` — set to the literal token `[[BUSINESS_ADDRESS]]`. The physical mailing
      address is NOT known. Do not invent a Flint street address, do not use a city-only
      approximation, do not omit the field.
    - `LEGAL_EFFECTIVE_DATE` — a hardcoded literal date string in `Month D, YYYY` form. Use the
      date this task is committed (`September 2, 2026` unless the executor's clock says
      otherwise). It must be a literal, never a computed `new Date()` — an effective date that
      changes on every deploy is meaningless to a vetting reviewer and is itself a compliance
      defect.

    Put a file-header comment in `legal.ts` recording three things: (1) these two tokens are
    unresolved facts the owner must supply before 10DLC submission, guarded by the
    `legal-placeholders` check added in Task 2; (2) fabricating either is worse than omitting it,
    because a wrong address or an entity name that does not match the EIN is a direct 10DLC
    rejection cause and a false statement on a real business site; (3) if a future plan adds a
    sitemap `filter` to `astro.config.mjs` (02-03 plans one to drop the publishing-guide page from
    the sitemap), that filter must keep `/privacy` and `/sms-terms` in — vetting has to crawl them.

    Do NOT touch `astro.config.mjs` in this task. The sitemap currently has no `filter`, so both
    new routes are included automatically, and leaving that file alone keeps this quick task from
    colliding with plan 02-03.

    Create `src/pages/privacy.astro`. Structure it exactly like `about.astro`: frontmatter with a
    file-header comment, the `getEntry('settings', 'main')` call plus null-guard plus
    `const { phone, phoneHref, email } = settings.data;`, an import of the three constants from
    `../data/legal`, then `<Layout title="Privacy Policy" description="...">` wrapping a single
    `<section class="legal">`. One `<h1>` reading `Privacy Policy`. Every subsequent section
    heading is an `<h2>` — do not use `<h3>`, because the global stylesheet declares rules for h1
    and h2 only and adding a third level would introduce an undeclared type size.

    Immediately under the h1, a `<p class="lead">` stating the effective date, rendered from
    `LEGAL_EFFECTIVE_DATE`, in the form `Effective date: {LEGAL_EFFECTIVE_DATE}`.

    Sections, in this order, each an h2 followed by prose:

    1. `Who we are` — Oak Homes is the business name; the operating legal entity is
       `{LEGAL_ENTITY_NAME}`. Mailing address `{BUSINESS_ADDRESS}`. Phone and email rendered from
       the settings constants (`{phone}` as an anchor to `{phoneHref}`, `{email}` as a mailto
       anchor). Website ownwithoak.com. State that Oak Homes sells homes in Flint, Michigan on
       owner financing / land contract.
    2. `Information we collect` — a `<ul>` listing: name; phone number; email address; the content
       of any message or inquiry submitted through a form on this site or sent by email; and the
       property a visitor inquired about. State plainly that the site does not use analytics,
       advertising, or tracking cookies, and does not collect information from visitors who simply
       browse without contacting us. That is true today and truth is the requirement.
    3. `How we use your information` — to respond to inquiries about homes, to schedule showings,
       to discuss owner-financing terms, and to send text messages about those things when a
       visitor has given a phone number for that purpose.
    4. `Text messages and mobile information` — this is the section 10DLC vetting reads first.
       Make it prominent and plainly worded. It must contain, as its own paragraph, verbatim and
       unaltered:
       "No mobile information will be sold or shared with third parties or affiliates for
       marketing or promotional purposes. All the above categories exclude text messaging
       originator opt-in data and consent; this information will not be shared with any third
       parties."
       Follow that with a sentence linking to the SMS Terms page:
       an `<a href="/sms-terms">` reading `SMS Terms`.
    5. `Service providers` — name them truthfully and say what each one holds:
       Zoho CRM (Zoho Corporation) stores contact details and inquiry content so Oak Homes can
       follow up; Netlify hosts the website and keeps standard server access logs. State that
       these providers process information on Oak Homes' behalf and that Oak Homes does not sell
       personal information to anyone.
    6. `How long we keep information` — kept as long as needed to respond to an inquiry and to
       keep records of a transaction, then deleted on request.
    7. `Requesting deletion of your information` — say that anyone may request a copy or deletion
       of their information by calling `{phone}` or emailing `{email}`, that Oak Homes will
       respond within 30 days, and that a text-message opt-out can be sent at any time by replying
       STOP. Render phone and email as live `tel:` and `mailto:` anchors.
    8. `Children's privacy` — the site is not directed to children under 13 and Oak Homes does not
       knowingly collect information from them.
    9. `Changes to this policy` — changes are posted on this page with a new effective date.
    10. `Contact us` — repeat `{phone}`, `{email}`, and `{BUSINESS_ADDRESS}` as the contact route.

    Create `src/pages/sms-terms.astro` with the identical shell (same imports, same settings guard,
    same section/style structure), `<Layout title="SMS Terms" description="...">`, one `<h1>`
    reading `SMS Terms`, and the same `Effective date: {LEGAL_EFFECTIVE_DATE}` lead paragraph.
    Sections, each an h2:

    1. `About our messages` — Oak Homes (operating as `{LEGAL_ENTITY_NAME}`) sends text messages
       about property inquiries, showing scheduling, and questions about owner-financing terms.
       Messages come from `{phone}`.
    2. `How you opt in` — you consent to receive text messages from Oak Homes by giving your phone
       number on a form on this site, by texting us, or by telling us verbally that we may text you.
    3. `Message frequency` — this section must contain the sentence verbatim:
       "Message frequency varies."
    4. `Cost` — this section must contain the sentence verbatim:
       "Message and data rates may apply."
    5. `How to stop messages` — must state, in a sentence containing the word STOP in capitals:
       "You can opt out at any time by replying STOP to any message from us." Then: after replying
       STOP you will receive one confirmation message and no further messages, and you can opt back
       in by texting START or by contacting us.
    6. `How to get help` — must state, in a sentence containing the word HELP in capitals:
       "Reply HELP to any message from us for help." Then give `{phone}` and `{email}` as live
       anchors as the alternative help route.
    7. `Consent is not required to buy` — this section must contain the sentence verbatim:
       "Consent to receive text messages from Oak Homes is not a condition of any purchase."
    8. `Carrier notice` — must contain verbatim:
       "Carriers are not liable for delayed or undelivered messages."
    9. `Privacy` — a sentence stating that mobile information is never sold or shared with third
       parties or affiliates for marketing or promotional purposes, followed by an
       `<a href="/privacy">` reading `Privacy Policy`.

    Both pages: write all prose in plain ASCII punctuation only — straight apostrophes, straight
    quotes, and hyphens. Do not use curly quotes, em dashes, or any non-ASCII character. The
    `a11y-sweep` check fails a built page containing U+FFFD, and ASCII-only copy removes every
    encoding failure mode from legal text that must match verbatim.

    Both pages: do NOT add any robots meta tag. These pages must stay crawlable — a vetting
    reviewer has to be able to fetch and index them.

    Both pages get an identical scoped `<style>` block copied from `about.astro`'s: a `.legal`
    class with `max-width: 820px; margin: 0 auto; padding: 32px 24px 64px;`,
    `.legal .lead { font-size: 16px; line-height: 1.5; max-width: 70ch; margin: 0 0 16px; }`,
    `.legal h2 { margin-top: 24px; }`, `.legal p { margin: 0 0 12px; max-width: 70ch; }`, and
    `.legal ul { margin: 0 0 12px; padding-left: 24px; max-width: 70ch; }`. No new font sizes, no
    new colors, no new spacing values outside the 4px scale.

    Legal prose stays in these two `.astro` files and `legal.ts` only. Do not add any of this copy
    to `src/content/`, do not add a collection for it, and do not add a CMS field for it — this is
    the same rule the Equal Housing and land-contract wording already follow (DESIGN-03), and the
    assistant must not be able to edit it from the admin panel.

    Finally, edit `src/layouts/Layout.astro`. In the existing `<nav class="footer-nav">` block,
    after the `/contact` link, add two anchors: `<a href="/privacy">Privacy Policy</a>` and
    `<a href="/sms-terms">SMS Terms</a>`. Change nothing else in that file — not the Equal Housing
    constant, not the header, not the style blocks.
  </action>

  <verify>
    <automated>L=src/data/legal.ts; P=src/pages/privacy.astro; S=src/pages/sms-terms.astro; Y=src/layouts/Layout.astro; grep -qF 'LEGAL_ENTITY_NAME' $L && grep -qF 'BUSINESS_ADDRESS' $L && grep -qF 'LEGAL_EFFECTIVE_DATE' $L && grep -qF 'No mobile information will be sold or shared with third parties or affiliates for marketing or promotional purposes.' $P && grep -qF 'text messaging originator opt-in data and consent; this information will not be shared with any third parties.' $P && grep -qF 'href="/sms-terms"' $P && grep -qF "getEntry('settings', 'main')" $P && grep -qF "getEntry('settings', 'main')" $S && grep -qF 'Message frequency varies.' $S && grep -qF 'Message and data rates may apply.' $S && grep -qF 'replying STOP to any message from us.' $S && grep -qF 'Reply HELP to any message from us for help.' $S && grep -qF 'Consent to receive text messages from Oak Homes is not a condition of any purchase.' $S && grep -qF 'Carriers are not liable for delayed or undelivered messages.' $S && grep -qF 'href="/privacy"' $S && grep -qF 'href="/privacy"' $Y && grep -qF 'href="/sms-terms"' $Y && test $(grep -c '<h1' $P) -eq 1 && test $(grep -c '<h1' $S) -eq 1 && ! LC_ALL=C grep -q $'[\x80-\xFF]' $P && ! LC_ALL=C grep -q $'[\x80-\xFF]' $S && ! LC_ALL=C grep -q $'[\x80-\xFF]' $L && ! grep -qF 'name="robots"' $P && ! grep -qF 'name="robots"' $S && git diff --quiet -- astro.config.mjs && git diff --quiet -- src/content && test -z "$(git ls-files --others --exclude-standard src/content)" && echo "PASS task1: literals verbatim, single h1 each, ASCII-only, crawlable, config untouched, src/content untouched"</automated>
  </verify>

  <acceptance_criteria>
    - `src/data/legal.ts` exists and exports `LEGAL_ENTITY_NAME`, `BUSINESS_ADDRESS`, and
      `LEGAL_EFFECTIVE_DATE`, with the first two set to bracketed placeholder tokens and no
      invented entity name or street address anywhere in the repo.
    - `LEGAL_EFFECTIVE_DATE` is a hardcoded string literal, not a `Date` computation.
    - `src/pages/privacy.astro` contains the two-sentence mobile-information non-sharing statement
      verbatim, character for character.
    - `src/pages/sms-terms.astro` contains, verbatim: `Message frequency varies.`,
      `Message and data rates may apply.`, `Consent to receive text messages from Oak Homes is not
      a condition of any purchase.`, and `Carriers are not liable for delayed or undelivered
      messages.`; and states STOP and HELP in capitals as opt-out and help keywords.
    - Each new page has exactly one `<h1>` and uses only `<h1>`/`<h2>` heading levels.
    - Both new files and `legal.ts` are pure ASCII.
    - Neither page declares a robots meta tag.
    - `src/layouts/Layout.astro` `footer-nav` contains anchors to `/privacy` and `/sms-terms`, and
      nothing else in that file changed.
    - `astro.config.mjs` is unmodified (no sitemap `filter` added — that belongs to plan 02-03,
      and when it lands it must keep both new routes in the sitemap).
    - `src/content/` has no modified and no new files: the legal prose went into code only, so the
      assistant cannot reach it from the CMS.
  </acceptance_criteria>

  <done>
    Both routes exist as source, both are reachable from the footer of every page, every required
    disclosure string is present verbatim, and the two unknown legal facts are bracketed
    placeholders rather than inventions.
  </done>

  <reversibility rating="reversible">
    Two new pages, one new data module, and two footer links — deleting them restores the prior
    site exactly. The published legal text itself is the only thing with real-world weight, and it
    is standard-practice compliance copy that an attorney can revise in place.
  </reversibility>
</task>

<task type="auto" tdd="false">
  <name>Task 2: legal-placeholders check — an unresolved legal fact cannot ship silently</name>

  <files>scripts/verify/checks.mjs</files>

  <read_first>
    - `scripts/verify/checks.mjs` lines 1-120 (header contract, `readUtf8File`, `walkFiles`,
      `runGit`, `fail`) and lines 2231-2260 (`content-pages`' opening, for the exact toplevel-
      resolution preamble every check uses).
    - `scripts/verify/checks.mjs` lines 4110-4142 — the end of the `checks` object and the argv
      dispatch, so the new entry lands inside the object and the unknown-id error message picks it
      up automatically.
    - `src/data/legal.ts` from Task 1 — the tokens the check must find.
  </read_first>

  <behavior>
    - Run with both legal facts unresolved (the state at the end of Task 1): exits non-zero, and
      the failure names each unresolved token together with the file and line it sits on.
    - Run after both tokens are replaced with real values: exits 0.
    - Run with a deliberately broken detector: exits non-zero with a distinct self-test failure
      rather than a false pass — so a green result is never vacuous.
    - Run when one of the legal source files has been deleted: exits non-zero, so removing a page
      cannot make the check pass by having nothing to scan.
  </behavior>

  <action>
    Append one new entry, `'legal-placeholders'`, as the last property of the `checks` object in
    `scripts/verify/checks.mjs`, immediately before the closing `};` that ends the object. Do not
    modify any existing check, and do not touch the dispatch block below it — the unknown-id error
    message enumerates `Object.keys(checks)` and will list the new id automatically.

    Give it the standard preamble: `runGit(['rev-parse', '--show-toplevel'])`, a failure guard
    calling `fail(id, ...)`, then `const toplevel = resolve(toplevelResult.stdout);`.

    Define a module-shaped detector inside the check: a regex matching a doubled-square-bracket
    wrapper around one or more uppercase ASCII letters, digits, and underscores, applied globally,
    and a small `findPlaceholders(text)` helper that splits the text on newlines and returns an
    array of `{ token, line }` for every match, with 1-based line numbers.

    Before scanning anything real, run a two-fixture self-test in memory, no file writes:
    a positive fixture — an ordinary sentence containing one bracketed uppercase token named
    `SELF_TEST_TOKEN` — must yield exactly one finding whose token equals that name; and a negative
    fixture — an ordinary sentence containing single-bracketed lowercase and uppercase references
    such as `[a]` and `[B]` — must yield zero findings. If either fixture gives the wrong answer,
    call `fail(id, ...)` with a message that says the detector self-test did not behave as
    specified, so a broken regex reports itself instead of silently passing everything. On success,
    write the line `legal-placeholders: detector self-test OK (2 fixtures)` to stdout before
    continuing.

    Then build the scan list. Three source files, resolved under `toplevel`:
    `src/data/legal.ts`, `src/pages/privacy.astro`, `src/pages/sms-terms.astro`. Each one is
    mandatory — if `existsSync` is false for any of them, `fail(id, ...)` naming the missing path,
    so deleting a legal page can never turn this check green by leaving nothing to inspect. Then,
    only if a `dist` directory exists under `toplevel`, add every `.html` file returned by
    `walkFiles(join(toplevel,'dist'))` to the scan list, so the check is meaningful in CI after a
    build and still runnable in this worktree where the build cannot complete.

    Deliberately do NOT include `scripts/verify/checks.mjs` itself in the scan list. The check's own
    self-test fixture contains a bracketed token by construction, and scanning itself would make it
    permanently self-failing.

    Read each scanned file with `readUtf8File`, run `findPlaceholders`, and collect findings as
    `<path relative to toplevel>:<line>: <token>` strings. Sort them for stable output.

    If there are findings, call `fail(id, ...)` with a message that opens with the word
    `unresolved`, states how many placeholders were found, states that each must be replaced with a
    real value before the site goes live and before the 10DLC brand registration is submitted, and
    then lists every finding on its own line. If there are none, call `pass(id)`.

    Expected state right now: this check is RED by design. Both legal facts are genuinely unknown,
    so a non-zero exit naming `LEGAL_ENTITY_NAME` and `BUSINESS_ADDRESS` is the correct and
    intended result of this task, not a defect. It turns green the moment the owner supplies the
    two facts and someone edits `src/data/legal.ts`. Record this explicitly in the SUMMARY as the
    single blocking pre-launch follow-up.
  </action>

  <verify>
    <automated>mkdir -p /c/tmp/oak-legal-260902 && node scripts/verify/checks.mjs legal-placeholders > /c/tmp/oak-legal-260902/lp.out 2> /c/tmp/oak-legal-260902/lp.err; test $? -ne 0 && grep -q "detector self-test OK" /c/tmp/oak-legal-260902/lp.out && grep -q "unresolved" /c/tmp/oak-legal-260902/lp.err && grep -q "LEGAL_ENTITY_NAME" /c/tmp/oak-legal-260902/lp.err && grep -q "BUSINESS_ADDRESS" /c/tmp/oak-legal-260902/lp.err && grep -q "src/data/legal.ts" /c/tmp/oak-legal-260902/lp.err && node scripts/verify/checks.mjs bogus-id-that-does-not-exist 2>&1 | grep -q "legal-placeholders" && echo "PASS task2: check is registered, self-test green, and reports both unresolved facts by file"</automated>
  </verify>

  <acceptance_criteria>
    - `node scripts/verify/checks.mjs legal-placeholders` exits non-zero today.
    - Its stdout contains the detector self-test confirmation line, proving the PASS path's
      detector is exercised on every run rather than only when findings are empty.
    - Its stderr names both `LEGAL_ENTITY_NAME` and `BUSINESS_ADDRESS`, each with the file and
      line number where it sits.
    - The id appears in the known-checks list printed for an unrecognised check id.
    - Deleting or renaming any of the three legal source files makes the check fail rather than
      pass.
    - No existing check in `checks.mjs` was modified.
  </acceptance_criteria>

  <done>
    `legal-placeholders` exists, is wired into the dispatch, proves its own detector on every
    invocation, and currently fails loudly naming exactly the two facts nobody has supplied — so a
    placeholder cannot reach ownwithoak.com unnoticed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Prove it in a real build — sandbox, disclosures, sitemap, and pre-existing failures</name>

  <files>
    (no repo files modified — verification only; evidence is captured into
    .planning/quick/260902-txo-add-privacy-policy-and-sms-terms-pages-f/build.log)
  </files>

  <precondition>
    Tasks 1 and 2 are committed: `git status --porcelain src scripts` reports nothing, because
    `git archive HEAD` carries committed content only and an uncommitted page would silently not
    be built. Network access is required for `npm install`. If either is unmet, halt and say so
    rather than reporting an unverified build.
  </precondition>

  <read_first>
    - `.planning/phases/02-publishing/02-01-SUMMARY.md` "Issues Encountered" — the full diagnosis
      of why `npm run build` cannot complete inside this worktree.
    - `.planning/WINDOWS.md` — deviations 1 through 8, all open, all pre-existing.
  </read_first>

  <action>
    `npm run build` and `astro dev` crash inside this worktree with the native Rolldown assertion
    `!(handle->flags & UV_HANDLE_CLOSING)`, caused by this worktree's deeply-nested Windows path
    (a dotted username segment plus a hidden `.claude` segment) confusing Rolldown's native
    resolver. This is pre-existing, fully diagnosed in `02-01-SUMMARY.md`, and explicitly NOT
    yours to fix. Use the established archive-to-shallow-path workaround.

    From the worktree root, in Git Bash: remove and recreate `/c/tmp/oak-legal-260902-build` (it
    must be fresh — a stale sandbox from an earlier quick task would invalidate the result), export
    the committed tree into it with `git archive HEAD` piped through `tar -x`, then from inside
    that directory run `git init -q` (needed only so the checks' `runGit(['rev-parse',
    '--show-toplevel'])` resolves; no commit required), then `npm install --no-audit --no-fund`,
    then `npm run build`. Redirect the build output to `build.out` in the sandbox and copy it into
    the planning directory as `build.log` so the evidence survives the throwaway sandbox.

    Confirm from the built output that: both new routes emitted; every required disclosure string
    is present in the built HTML character for character; each new page has exactly one `<h1>`;
    neither new page carries a robots directive; the footer links appear on a page unrelated to
    this change; and both routes are listed in `dist/sitemap-0.xml`. The verify block below
    encodes all of these as assertions — run it, do not eyeball it.

    Also run `node scripts/verify/checks.mjs legal-placeholders` inside the sandbox, where `dist/`
    now exists. It must still fail, and its failure must now additionally name
    `dist/privacy/index.html` and `dist/sms-terms/index.html` — proving the dist half of the scan
    is live and that a placeholder in built output is caught, not just one in source.

    Then run the full existing check suite in the sandbox and classify each result. Adding two
    pages takes the built HTML file count from 11 to 13. Two checks hardcode a literal expectation
    of 10 built `.html` files: `a11y-sweep` (its count assertion sits ahead of its per-page
    structural sweep) and `phase-complete`. Both are ALREADY failing at 11 because of 02-01's
    `public/admin/index.html`, logged as open deviations 1 and 4 in `.planning/WINDOWS.md`. After
    this change their failure text changes from "found 11" to "found 13". That is the SAME
    pre-existing defect with a larger number, not a new break and not something this task caused
    beyond the arithmetic. Do NOT "fix" those counts — updating a hardcoded phase-1 assertion is
    outside this task's scope and belongs with the deviation-1/4 resolution.

    A consequence worth stating plainly: because `a11y-sweep` aborts at its count assertion, its
    valuable per-page sweep (single h1, lang, charset, alt text, landmarks, skip link, no U+FFFD)
    never actually runs against the two new pages. The verify block below therefore reproduces
    those specific assertions directly against the new pages' built HTML, so the accessibility
    properties are genuinely proven rather than assumed to be covered by a check that stops early.

    The other six open deviations are unrelated to this change and must also be reported, not
    fixed: `skeleton-e2e` and `brand-assets` (02-01's admin shell lacks the Equal Housing line and
    the tagline alt), `photos-resized` (Sveltia writes `sqft: null` rather than omitting the key),
    `homes-grid` (CMS unquoted the YAML so the check's literal `.replace` no-ops), and
    `property-page` and `content-pages` (both real homes are genuinely Sold, so no Inquire button
    or Inquire link renders anywhere). Note in the SUMMARY that the two new pages carry the Equal
    Housing line and the tagline correctly via the shared Layout, so they neither cause nor worsen
    the `skeleton-e2e` and `brand-assets` failures.

    Record in the SUMMARY, as a clearly visible note: this is standard-practice compliance copy
    drafted to what carrier and TCR vetting look for. It is not legal advice. It should be added
    to the attorney review already pending on the land-contract wording, which the ROADMAP carries
    forward as a Phase 4 launch-checklist item.

    Do not modify any repo file in this task.
  </action>

  <verify>
    <automated>rm -rf /c/tmp/oak-legal-260902-build && mkdir -p /c/tmp/oak-legal-260902-build && git archive HEAD | tar -x -C /c/tmp/oak-legal-260902-build && cd /c/tmp/oak-legal-260902-build && git init -q && npm install --no-audit --no-fund > build.out 2>&1 && npm run build >> build.out 2>&1 && test -f dist/privacy/index.html && test -f dist/sms-terms/index.html && echo "BUILT: both routes emitted"</automated>
    <automated>cd /c/tmp/oak-legal-260902-build && P=dist/privacy/index.html && S=dist/sms-terms/index.html && grep -q "No mobile information will be sold or shared with third parties or affiliates for marketing or promotional purposes." $P && grep -q "text messaging originator opt-in data and consent; this information will not be shared with any third parties." $P && grep -q "Message frequency varies." $S && grep -q "Message and data rates may apply." $S && grep -q "replying STOP to any message from us." $S && grep -q "Reply HELP to any message from us for help." $S && grep -q "Consent to receive text messages from Oak Homes is not a condition of any purchase." $S && grep -q "Carriers are not liable for delayed or undelivered messages." $S && ! grep -q 'name="robots"' $P && ! grep -q 'name="robots"' $S && test $(grep -o '<h1' $P | wc -l) -eq 1 && test $(grep -o '<h1' $S | wc -l) -eq 1 && grep -q 'lang="en"' $P && grep -q 'id="main-content"' $P && grep -q 'class="skip-link"' $P && grep -q 'lang="en"' $S && grep -q 'id="main-content"' $S && grep -q 'class="skip-link"' $S && ! LC_ALL=C grep -q $'\xEF\xBF\xBD' $P && ! LC_ALL=C grep -q $'\xEF\xBF\xBD' $S && grep -q 'href="/privacy"' dist/about/index.html && grep -q 'href="/sms-terms"' dist/about/index.html && grep -q "ownwithoak.com/privacy" dist/sitemap-0.xml && grep -q "ownwithoak.com/sms-terms" dist/sitemap-0.xml && echo "VERIFIED: disclosures verbatim, crawlable, single h1, footer-linked site-wide, both in sitemap"</automated>
    <automated>cd /c/tmp/oak-legal-260902-build && node scripts/verify/checks.mjs legal-placeholders > lp2.out 2> lp2.err; test $? -ne 0 && grep -q "dist/privacy/index.html" lp2.err && grep -q "dist/sms-terms/index.html" lp2.err && echo "VERIFIED: dist half of the placeholder scan is live"</automated>
  </verify>

  <acceptance_criteria>
    - `npm run build` exits 0 in the shallow-path sandbox and emits `dist/privacy/index.html` and
      `dist/sms-terms/index.html`.
    - All eight required disclosure sentences are present verbatim in the built HTML.
    - Neither built page contains a robots meta tag; each contains exactly one `<h1>`; neither
      contains U+FFFD.
    - `dist/about/index.html` — a page this task did not otherwise touch — carries both footer
      links, proving the links are site-wide via the shared layout.
    - `dist/sitemap-0.xml` lists both new URLs.
    - `legal-placeholders` run in the sandbox fails naming the two built HTML files as well as the
      source, proving the dist scan path executes.
    - `build.log` is copied into the plan directory as verbatim evidence.
    - The SUMMARY reports `a11y-sweep` and `phase-complete` now saying "found 13" instead of
      "found 11", classified as open deviations 1 and 4 with a larger count and explicitly not
      caused by this change; and reports the other six pre-existing failures unfixed.
    - The SUMMARY carries a visible note that this is standard-practice compliance copy, not legal
      advice, and belongs in the pending attorney review of the land-contract wording (ROADMAP
      Phase 4 carried-forward note).
  </acceptance_criteria>

  <done>
    A real build proves both pages render every required disclosure verbatim, are crawlable, are
    footer-linked from every page, and appear in the sitemap; the placeholder gate is proven to
    catch built output; and every pre-existing check failure is reported with its cause rather
    than fixed or mistaken for a regression.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo -> public web | Everything in these two pages is published verbatim to a real business's live domain and read by a carrier/TCR vetting reviewer as a statement of fact. |
| repo -> 10DLC registration | The legal entity name and address published here must match the EIN and the brand registration filing; a mismatch is a direct rejection. |
| settings collection -> legal pages | Contact facts are CMS-editable by a non-technical assistant and render inside legal text. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-txo-01 | Repudiation | src/data/legal.ts published entity name / address | high | mitigate | Never fabricate: both facts ship as bracketed tokens and the `legal-placeholders` check (Task 2) exits non-zero, naming file and line, until the owner supplies real values. A wrong address or non-EIN-matching entity is both a false public statement and a 10DLC rejection cause. |
| T-txo-02 | Information disclosure | Privacy Policy claims about data handling | high | mitigate | Every claim is written to what is literally true today (Zoho CRM, Netlify, no analytics/tracking) rather than to boilerplate; Task 1's action enumerates the true providers explicitly so the executor cannot substitute a generic template that overclaims or underclaims. |
| T-txo-03 | Tampering | legal prose editable from the CMS | medium | mitigate | Legal copy lives only in `src/pages/*.astro` and `src/data/legal.ts`, never under `src/content/` and never as a CMS field — the same DESIGN-03 rule already protecting the Equal Housing and land-contract wording. Task 1 states this as a hard constraint and an acceptance criterion. |
| T-txo-04 | Tampering | npm/pip/cargo installs | high | accept | No package-manager installs are introduced by this task. `npm install` in Task 3 restores the existing, already-audited lockfile inside a throwaway sandbox and adds no dependency. No new package legitimacy surface. |
| T-txo-05 | Denial of service | build regression from two new pages | low | accept | Two zero-JS static pages through the existing shared layout. The only measurable effect is built-HTML file count moving 11 -> 13, which lands on two already-open deviations (1 and 4) and is reported, not fixed. |
</threat_model>

<verification>
- Task 1's literal audit passes against source.
- Task 2's `legal-placeholders` is registered, self-tests green, and fails naming both unresolved facts.
- Task 3's sandbox build exits 0, both routes emit, all eight disclosure sentences match verbatim,
  both pages are crawlable with a single h1, footer links appear on a page unrelated to this change,
  and both URLs appear in `dist/sitemap-0.xml`.
- `.planning/WINDOWS.md` deviations 1 and 4 are re-stated with their new count; the other six are
  reported unfixed with their existing causes.
</verification>

<success_criteria>
1. `https://ownwithoak.com/privacy` and `https://ownwithoak.com/sms-terms` build, are reachable
   from the footer of every page, are indexable, and are in the sitemap.
2. The Privacy Policy carries the mobile-information non-sharing statement verbatim — the specific
   disclosure 10DLC vetting most often rejects a brand for lacking.
3. The SMS Terms page carries frequency, rates, STOP, HELP, not-a-condition-of-purchase, and the
   carrier-liability notice verbatim, and links to the Privacy Policy.
4. No legal fact was invented. The two unknowns are greppable tokens guarded by a check that is
   red until they are resolved.
5. Every pre-existing check failure is reported with its cause; none is fixed and none is mistaken
   for a regression caused by this task.
</success_criteria>

<output>
Create `.planning/quick/260902-txo-add-privacy-policy-and-sms-terms-pages-f/260902-txo-SUMMARY.md` when done.

The SUMMARY must contain, visibly and near the top:

**Blocking pre-launch follow-up:** `src/data/legal.ts` ships two unresolved placeholders,
`[[LEGAL_ENTITY_NAME]]` and `[[BUSINESS_ADDRESS]]`. The owner must supply the exact legal entity
name as it appears on the EIN (Oak Homes may be a DBA) and the physical business mailing address,
before the site goes live on ownwithoak.com and before the 10DLC brand registration is submitted.
`node scripts/verify/checks.mjs legal-placeholders` is red until both are replaced and is the gate.

**Not legal advice:** these pages are standard-practice compliance copy drafted to what carrier and
TCR vetting look for, not legal advice. Add them to the attorney review already pending on the
land-contract wording (ROADMAP Phase 4 carried-forward note).
</output>
