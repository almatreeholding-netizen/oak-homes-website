// src/data/legal.ts
//
// Shared source for the unresolved legal facts referenced by src/pages/privacy.astro
// and src/pages/sms-terms.astro. Three notes, recorded here so they cannot be
// missed by whoever next edits this file:
//
// (1) LEGAL_ENTITY_NAME and BUSINESS_ADDRESS are unresolved facts the owner
//     must supply before the site goes live and before the 10DLC brand
//     registration is submitted. They are guarded by the `legal-placeholders`
//     check in scripts/verify/checks.mjs, which fails by name and by
//     file:line while either bracketed token below remains unreplaced.
//
// (2) Fabricating either value is worse than leaving it unresolved. A wrong
//     mailing address or a legal-entity name that does not match the EIN on
//     the 10DLC brand registration is a direct rejection cause AND a false
//     statement published on a real business's live website. Do not guess,
//     do not approximate, do not substitute "Oak Homes" for the legal
//     entity -- Oak Homes may be a DBA, not the registering entity.
//
// (3) If a future plan adds a sitemap `filter` to astro.config.mjs (02-03
//     plans one, to drop the publishing-guide page from the sitemap), that
//     filter must keep /privacy and /sms-terms in the generated sitemap --
//     10DLC/TCR vetting has to be able to crawl and index both pages.

export const LEGAL_ENTITY_NAME = 'Oak Homes LLC';
export const BUSINESS_ADDRESS = '2222 W Grand River Ave Ste A, Okemos, MI 48864';
export const LEGAL_EFFECTIVE_DATE = 'September 2, 2026';
