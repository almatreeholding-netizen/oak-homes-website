---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-02T01:17:38.968Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | quick | deviation | scripts/verify/checks.mjs |  | a11y-sweep asserts exactly 10 built .html files but the build now emits 11 (public/admin/index.html, added in phase 02-01's CMS admin shell); a11y-sweep and its 10-file assertion predate the admin shell and were never updated -- confirmed pre-existing via baseline build at commit b98ab61, unrelated to 260901-t59's hero-banner changes | open |  | 2026-09-02T01:17:38.968Z |  |

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
  }
]
````
