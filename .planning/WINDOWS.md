---
schema_version: 1
open_count: 9
waived_count: 0
fixed_count: 0
total_count: 9
last_updated: 2026-09-03T01:54:02.096Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | quick | deviation | scripts/verify/checks.mjs |  | a11y-sweep asserts exactly 10 built .html files but the build now emits 11 (public/admin/index.html, added in phase 02-01's CMS admin shell); a11y-sweep and its 10-file assertion predate the admin shell and were never updated -- confirmed pre-existing via baseline build at commit b98ab61, unrelated to 260901-t59's hero-banner changes | open |  | 2026-09-02T01:17:38.968Z |  |
| 2 | quick | deviation | scripts/verify/checks.mjs |  | skeleton-e2e baseline step fails: dist/admin/index.html has 0 occurrences of the Equal Housing sentence (expected 1 on every built .html page) -- 02-01 added public/admin/index.html as Sveltia's static shell, which was never templated with the legal footer; confirmed pre-existing at baseline commit b796b7d, unrelated to quick-260902-sws's schema fix | open |  | 2026-09-03T01:22:20.333Z |  |
| 3 | quick | deviation | scripts/verify/checks.mjs |  | brand-assets fails: dist/admin/index.html has 0 occurrences of the 'Oak Homes -- From Rent to Roots' alt text -- same root cause as deviation 1/skeleton-e2e (02-01's admin shell was never given the tagline alt), confirmed pre-existing at baseline commit b796b7d | open |  | 2026-09-03T01:22:21.252Z |  |
| 4 | quick | deviation | scripts/verify/checks.mjs |  | phase-complete fails: expected exactly 10 built .html files, found 11 -- same root cause as deviation 1 (public/admin/index.html from 02-01), confirmed pre-existing at baseline commit b796b7d with an origin remote temporarily added to the sandbox | open |  | 2026-09-03T01:22:22.169Z |  |
| 5 | quick | deviation | src/content/properties/2734-brown-st.md |  | photos-resized fails: '2734-brown-st.md sets sqft -- square footage is unknown and must be left unset' -- the check predates the CMS's write behavior and asserts the sqft KEY is absent, but Sveltia (CMS commit 45da85e) writes 'sqft: null' explicitly rather than omitting the key; confirmed the check PASSED at baseline commit b796b7d (pre-CMS-write) and fails only after 45da85e, unrelated to quick-260902-sws's schema fix | open |  | 2026-09-03T01:22:23.084Z |  |
| 6 | quick | deviation | scripts/verify/checks.mjs |  | homes-grid fails: 'badge-variant build does not render a Pending badge' -- the check mutates via literal .replace("status: \\"Available\\"", ...) but CMS commits e3d7077/45da85e unquoted every string value in the real content files, so the literal no longer matches and the mutation silently no-ops; confirmed PASSED at baseline commit b796b7d (pre-CMS-write, still quoted), unrelated to quick-260902-sws's schema fix | open |  | 2026-09-03T01:22:23.979Z |  |
| 7 | quick | deviation | src/pages/homes/[slug].astro |  | property-page fails: dist/homes/614-e-marengo-st/index.html does not contain 'Inquire About This Home' -- both real homes are genuinely status: Sold (D-09: canInquire is Available/Pending only), so the Inquire button correctly does not render; the check assumed at least one home would render Available/Pending, confirmed PASSED at baseline commit b796b7d (pre-CMS-write, both Available), unrelated to quick-260902-sws's schema fix | open |  | 2026-09-03T01:22:24.878Z |  |
| 8 | quick | deviation | src/pages/homes/index.astro |  | content-pages fails: no /contact?property= Inquire links found under dist/homes -- same D-09 cause as property-page's deviation: both real homes are genuinely Sold, so no Inquire link renders anywhere; confirmed PASSED at baseline commit b796b7d, unrelated to quick-260902-sws's schema fix | open |  | 2026-09-03T01:22:25.795Z |  |
| 9 | quick | todo | src/data/legal.ts |  | legal-placeholders check is RED by design: LEGAL_ENTITY_NAME and BUSINESS_ADDRESS are bracketed placeholder tokens pending owner-supplied values before 10DLC submission and site launch | open |  | 2026-09-03T01:54:02.096Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "quick",
    "file": "scripts/verify/checks.mjs",
    "line": null,
    "description": "a11y-sweep asserts exactly 10 built .html files but the build now emits 11 (public/admin/index.html, added in phase 02-01's CMS admin shell); a11y-sweep and its 10-file assertion predate the admin shell and were never updated -- confirmed pre-existing via baseline build at commit b98ab61, unrelated to 260901-t59's hero-banner changes",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T01:17:38.968Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "quick",
    "file": "scripts/verify/checks.mjs",
    "line": null,
    "description": "skeleton-e2e baseline step fails: dist/admin/index.html has 0 occurrences of the Equal Housing sentence (expected 1 on every built .html page) -- 02-01 added public/admin/index.html as Sveltia's static shell, which was never templated with the legal footer; confirmed pre-existing at baseline commit b796b7d, unrelated to quick-260902-sws's schema fix",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T01:22:20.333Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "quick",
    "file": "scripts/verify/checks.mjs",
    "line": null,
    "description": "brand-assets fails: dist/admin/index.html has 0 occurrences of the 'Oak Homes -- From Rent to Roots' alt text -- same root cause as deviation 1/skeleton-e2e (02-01's admin shell was never given the tagline alt), confirmed pre-existing at baseline commit b796b7d",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T01:22:21.252Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "quick",
    "file": "scripts/verify/checks.mjs",
    "line": null,
    "description": "phase-complete fails: expected exactly 10 built .html files, found 11 -- same root cause as deviation 1 (public/admin/index.html from 02-01), confirmed pre-existing at baseline commit b796b7d with an origin remote temporarily added to the sandbox",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T01:22:22.169Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "quick",
    "file": "src/content/properties/2734-brown-st.md",
    "line": null,
    "description": "photos-resized fails: '2734-brown-st.md sets sqft -- square footage is unknown and must be left unset' -- the check predates the CMS's write behavior and asserts the sqft KEY is absent, but Sveltia (CMS commit 45da85e) writes 'sqft: null' explicitly rather than omitting the key; confirmed the check PASSED at baseline commit b796b7d (pre-CMS-write) and fails only after 45da85e, unrelated to quick-260902-sws's schema fix",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T01:22:23.084Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "quick",
    "file": "scripts/verify/checks.mjs",
    "line": null,
    "description": "homes-grid fails: 'badge-variant build does not render a Pending badge' -- the check mutates via literal .replace(\"status: \\\"Available\\\"\", ...) but CMS commits e3d7077/45da85e unquoted every string value in the real content files, so the literal no longer matches and the mutation silently no-ops; confirmed PASSED at baseline commit b796b7d (pre-CMS-write, still quoted), unrelated to quick-260902-sws's schema fix",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T01:22:23.979Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "quick",
    "file": "src/pages/homes/[slug].astro",
    "line": null,
    "description": "property-page fails: dist/homes/614-e-marengo-st/index.html does not contain 'Inquire About This Home' -- both real homes are genuinely status: Sold (D-09: canInquire is Available/Pending only), so the Inquire button correctly does not render; the check assumed at least one home would render Available/Pending, confirmed PASSED at baseline commit b796b7d (pre-CMS-write, both Available), unrelated to quick-260902-sws's schema fix",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T01:22:24.878Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "quick",
    "file": "src/pages/homes/index.astro",
    "line": null,
    "description": "content-pages fails: no /contact?property= Inquire links found under dist/homes -- same D-09 cause as property-page's deviation: both real homes are genuinely Sold, so no Inquire link renders anywhere; confirmed PASSED at baseline commit b796b7d, unrelated to quick-260902-sws's schema fix",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T01:22:25.795Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "todo",
    "phase": "quick",
    "file": "src/data/legal.ts",
    "line": null,
    "description": "legal-placeholders check is RED by design: LEGAL_ENTITY_NAME and BUSINESS_ADDRESS are bracketed placeholder tokens pending owner-supplied values before 10DLC submission and site launch",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T01:54:02.096Z",
    "resolved_at": null
  }
]
````
