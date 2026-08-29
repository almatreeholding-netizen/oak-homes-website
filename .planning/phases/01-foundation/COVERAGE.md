# Phase 1 — API Coverage Declaration

**Phase:** 01-foundation
**Decided:** 2026-08-29 (during `--reviews` replanning)
**Verdict:** no external API integration in scope

---

## Declaration

No external API integration: phase builds static Astro pages and content collections only; external
services (Zoho, Netlify OAuth, Leaflet/OSM) arrive in Phases 2-3.

## Reasoning

Re-read of the phase scope across `01-CONTEXT.md`, `ROADMAP.md` Phase 1, and all five plan files
confirms no capability in this phase calls, embeds, or authenticates against a third-party API or
SDK. What the phase touches externally, and why none of it is an API integration:

| Surface | In this phase? | Why it is not an API integration |
|---|---|---|
| GitHub | Yes — one `git push` over HTTPS (plan 01-01) | Git transport authenticated by the already-installed Git Credential Manager. No REST/GraphQL client, no token in the repo, no SDK. The one action with no CLI path — flipping repository visibility — is a human browser checkpoint precisely *because* no API is being wired. |
| npm registry | Yes — dependency installation (plan 01-02) | Package installation, covered by the blocking package-legitimacy checkpoint and threat `T-01-SC`, not an application integration. |
| Zoho CRM Web-to-Lead | No | LEAD-01/LEAD-02, Phase 3. Plan 01-04 ships only a `/contact` page shell with a marked comment where the embed lands, and its acceptance criteria assert the built page contains no form element and no external script tag. |
| Netlify (hosting, OAuth provider) | No | INFRA-03 and ADMIN-\*, Phase 2. Plan 01-05 Task 2 explicitly forbids configuring Netlify, adding an adapter, or adding CI. |
| Leaflet + OpenStreetMap tiles | No | PROP-03, Phase 3. The `location` lat/lng schema field is defined in plan 01-02 and left empty on both homes per D-16. |
| Google Fonts CDN | No — deliberately avoided | Fonts are self-hosted via `@fontsource`; plan 01-02 asserts zero built pages reference `fonts.googleapis.com`. |
| `@astrojs/sitemap` | Yes, as a build-time integration | Generates static XML at build time. No network call, no runtime. |

The phase's entire data layer is the repository itself: markdown and JSON files validated by Zod at
build time, rendered to static HTML with no server and no runtime fetch. `SKELETON.md` records this
as an architectural decision (`output: 'static'`, no adapter) that later phases build on rather than
revisit.

## Consequence

No coverage matrix is produced for Phase 1. The first genuine external-API coverage decision belongs
to Phase 2 (Netlify OAuth for the CMS) and Phase 3 (Zoho Web-to-Lead, whose field naming is
account-specific and, per `ROADMAP.md`, needs hands-on testing rather than a paper design).
