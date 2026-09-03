// src/content.config.ts
//
// Astro 5+ location: directly under src/, NOT src/content/config.ts. The old
// location is silently ignored rather than erroring (RESEARCH.md Pitfall 1),
// which would leave every collection unvalidated while appearing to work —
// defeating phase success criterion 5 invisibly. Keep this file at exactly
// this path (SKELETON.md invariant 1).
//
// The Property schema finalized here is the shape Phase 2's admin/config.yml
// is written against (D-06's costly reversibility) — every field, including
// the ones that render nothing until Phase 2/3 (featured, location, videoUrl,
// ogImage), is included now so the two files never need to change in
// different commits.
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

// Slugs are permanent URLs. Lowercase ASCII words joined by single hyphens,
// no leading/trailing hyphen — an uppercase letter, space, or underscore
// must fail the build rather than ship (BROWSE-02/encoding).
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const slugSchema = z
  .string()
  .regex(slugPattern, 'slug must be lowercase ASCII words separated by single hyphens, with no leading or trailing hyphen');

/**
 * A form-based CMS cannot express "this key is absent" the way hand-written
 * frontmatter can. Sveltia (and form-based CMSes generally) writes a blank
 * optional number field as `null` and a blank optional text field as `""` --
 * it never simply omits the key. `z.number().optional()` only tolerates a
 * missing key; handed `null` it fails with "expected number, received null"
 * (Astro's content-layer wrapper reports this as "received object", since
 * `typeof null === 'object'`). That gap took the production build down on
 * commits e3d7077 / 45da85e, when the assistant left `sqft` blank on both
 * homes and Netlify kept serving stale HTML because every subsequent deploy
 * failed.
 *
 * `z.preprocess` runs BEFORE the inner validator, so `null` and `''` are
 * normalized to `undefined` first and the inner schema never sees them --
 * this is NOT interchangeable with `.nullish()`, which still hands `''` to
 * `.url()` and fails it, and still hands `null` straight through to a nested
 * object schema. `undefined` is the deliberate normalization target, not
 * `null` or `''`, because every consuming template already guards on
 * `undefined` (`n === undefined ? 'Call for details' : ...`) or on plain
 * truthiness -- normalizing to anything else would require touching those
 * templates too.
 *
 * This must NEVER be wrapped around a required field: that would silently
 * let a home publish with no price, no status, or no address. The
 * `cms-null-tolerance` check in scripts/verify/checks.mjs enforces both
 * directions -- every optional field stays wrapped, every required field
 * stays bare -- so this boundary cannot drift unnoticed.
 */
function cmsOptional<T extends z.ZodType>(inner: T) {
  return z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    inner.optional(),
  );
}

/**
 * Derive the entry id from the filename stem only, ignoring any `slug` in
 * frontmatter. This is deliberate: Astro's glob-loader default (see
 * astro/dist/content/loaders/glob.js `generateIdDefault`) uses `data.slug`
 * as the id WHEN a slug field is present in frontmatter — which would make
 * `entry.id === entry.data.slug` trivially true and unable to catch drift
 * between a home's filename and its claimed slug. Overriding `generateId`
 * to strip only the extension (never the frontmatter slug) is what makes
 * the drift assertion in the [slug] route meaningful (RESEARCH.md A1,
 * SKELETON.md invariant 6).
 *
 * The flat `*.md` loader glob (not `**\/*.md`) means `entry` here is
 * ordinarily just a bare filename with no path separator. If a future
 * widening of the glob ever produces a nested entry, this still strips only
 * the extension and preserves the separator, so the route's drift-assertion
 * message can name nesting as the cause instead of misreporting it as slug
 * drift.
 */
function idFromFilename({ entry }: { entry: string }) {
  return entry.replace(/\.md$/, '');
}

const properties = defineCollection({
  // Flat glob, not recursive `**\/*.md` — superseding RESEARCH.md Pattern 1.
  // A nested file would yield an id containing a path separator, which can
  // never satisfy slugPattern above, so a nested file would fail the build
  // with a message about slug drift that is not what actually went wrong.
  // The flat pattern also makes "two files cannot share one filename" hold
  // literally, since it is checked within one directory, not across a tree.
  loader: glob({ pattern: '*.md', base: './src/content/properties', generateId: idFromFilename }),
  schema: z.object({
    title: z.string(),
    address: z.string(),
    slug: slugSchema,
    status: z.enum(['Available', 'Pending', 'Sold']),
    featured: z.boolean().default(false), // D-06: homepage featured-with-fallback
    downPayment: z.number(),
    monthlyPayment: z.number(),
    beds: cmsOptional(z.number()), // D-10: absent -> "Call for details"
    baths: cmsOptional(z.number()),
    sqft: cmsOptional(z.number()),
    description: z.string(),
    features: z.array(z.string()).default([]),
    // Default-empty, NOT z.array(z.string()).min(1) — this supersedes
    // RESEARCH.md Pattern 1's `.min(1)`. The UI-SPEC's E3 empty-state row
    // specifies a designed branded placeholder for a zero-photo property;
    // `.min(1)` would turn that designed state into a build failure, and
    // plan 01-03 Task 3 proves the placeholder by temporarily emptying this
    // array and requiring a passing build.
    photos: z.array(z.string()).default([]),
    videoUrl: cmsOptional(z.string().url()), // Phase 3 field, unused this phase
    location: cmsOptional(z.object({ lat: z.number(), lng: z.number() })), // D-16: created, empty
    ogImage: cmsOptional(z.string()), // Phase 3 OpenGraph field, included now
    publishDate: z.date(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog', generateId: idFromFilename }),
  schema: z.object({
    title: z.string(),
    slug: slugSchema,
    date: z.date(),
    coverImage: cmsOptional(z.string()),
    ownerReviewed: z.boolean().default(false),
  }),
});

const settings = defineCollection({
  // A single JSON entry, keyed "main" inside the file (see
  // src/content/settings.json) — the file() loader treats a top-level JSON
  // object's own keys as entry ids, so wrapping the settings under one
  // "main" key is what gives this collection exactly one entry rather than
  // one entry per settings field.
  loader: file('src/content/settings.json'),
  schema: z.object({
    phone: z.string().min(1), // required non-empty: no page can render with no way to call (LEAD-03/empty)
    phoneHref: z.string().min(1),
    email: z.string().min(1),
    social: z.object({
      facebook: cmsOptional(z.string().url()), // D-17: Facebook only, no Instagram
    }),
    homepageIntro: z.string().min(1),
  }),
});

export const collections = { properties, blog, settings };
