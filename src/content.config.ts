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
    beds: z.number().optional(), // D-10: absent -> "Call for details"
    baths: z.number().optional(),
    sqft: z.number().optional(),
    description: z.string(),
    features: z.array(z.string()).default([]),
    // Default-empty, NOT z.array(z.string()).min(1) — this supersedes
    // RESEARCH.md Pattern 1's `.min(1)`. The UI-SPEC's E3 empty-state row
    // specifies a designed branded placeholder for a zero-photo property;
    // `.min(1)` would turn that designed state into a build failure, and
    // plan 01-03 Task 3 proves the placeholder by temporarily emptying this
    // array and requiring a passing build.
    photos: z.array(z.string()).default([]),
    videoUrl: z.string().url().optional(), // Phase 3 field, unused this phase
    location: z.object({ lat: z.number(), lng: z.number() }).optional(), // D-16: created, empty
    ogImage: z.string().optional(), // Phase 3 OpenGraph field, included now
    publishDate: z.date(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog', generateId: idFromFilename }),
  schema: z.object({
    title: z.string(),
    slug: slugSchema,
    date: z.date(),
    coverImage: z.string().optional(),
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
      facebook: z.string().url().optional(), // D-17: Facebook only, no Instagram
    }),
    homepageIntro: z.string().min(1),
  }),
});

export const collections = { properties, blog, settings };
