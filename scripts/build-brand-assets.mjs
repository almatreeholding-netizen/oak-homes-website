#!/usr/bin/env node
// scripts/build-brand-assets.mjs
//
// One-off asset export (01-02-PLAN.md Task 4): reads the owner's source logo
// PNGs from docs/reference/logo-source/ and writes web-ready sized rasters
// into public/brand/ in all three UI-SPEC variants (ink, light, circle) plus
// the favicon set. Not part of `npm run build` -- rerun manually if the
// source logo files are ever replaced. See 01-UI-SPEC.md "### Brand Mark /
// Logo" for the variant-usage rules this implements.
//
// Node built-ins only, plus `sharp` (already a devDependency).

import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = 'docs/reference/logo-source';
const OUT_DIR = 'public/brand';
const MAX_BYTES = 102400; // 100 KB per-file budget (Task 4 acceptance criteria)

mkdirSync(OUT_DIR, { recursive: true });

// The three full-lockup source files (Black/White/Color-with-background)
// share identical canvas dimensions (3171x2772px, verified via sharp
// metadata) and an identical composition: a filled circle mark with leaf
// line art on top, the "Oak Homes" / "FROM RENT TO ROOTS" wordmark stacked
// below. This box isolates just the circle mark, cropping out the stacked
// wordmark raster entirely.
//
// Box derived by scanning the color variant's yellow-fill pixels
// (docs/reference/logo-source/Color logo with background.png) for their
// bounding rectangle -- yellow rows [86, 1884], yellow cols [686, 2484], a
// perfect 1798x1798 square -- then padding 40px on every side. The same box
// applies to the black and white variants because all four source files are
// different color renders of one identical vector composition.
//
// Cropping to the mark alone (rather than shipping the full lockup raster)
// is deliberate, not just a size optimization: the header BrandMark instance
// carries "Oak Homes -- From Rent to Roots" as alt text specifically because
// the UI-SPEC forbids re-typesetting the wordmark in a site UI font, and the
// visual mark itself does not also carry it as baked-in raster text. Baking
// the wordmark into the icon image would make the alt-text strategy
// redundant instead of necessary.
const MARK_BOX = { left: 646, top: 46, width: 1878, height: 1878 };

const VARIANTS = [
  { name: 'ink', source: 'Black logo - no background.png' },
  { name: 'light', source: 'White logo - no background.png' },
  { name: 'circle', source: 'Color logo with background.png' },
];

// sm = header/footer display size (40px 1x, 80px 2x retina).
// lg = zero-photo placeholder frame display size (128px 1x, 256px 2x retina).
const SIZES = [40, 80, 128, 256];

function assertUnderBudget(path) {
  const { size: bytes } = statSync(path);
  if (bytes > MAX_BYTES) {
    throw new Error(`${path} is ${bytes} bytes, exceeds the ${MAX_BYTES}-byte budget`);
  }
  return bytes;
}

async function exportVariant({ name, source }) {
  const srcPath = join(SRC_DIR, source);
  for (const size of SIZES) {
    const base = sharp(srcPath).extract(MARK_BOX).resize(size, size);
    const pngPath = join(OUT_DIR, `mark-${name}-${size}.png`);
    const webpPath = join(OUT_DIR, `mark-${name}-${size}.webp`);
    await base.clone().png({ compressionLevel: 9 }).toFile(pngPath);
    await base.clone().webp({ quality: 90 }).toFile(webpPath);
    const pngBytes = assertUnderBudget(pngPath);
    const webpBytes = assertUnderBudget(webpPath);
    console.log(`  ${pngPath} (${pngBytes}B), ${webpPath} (${webpBytes}B)`);
  }
}

async function exportFavicons() {
  // Deliberately sourced from the mark-only Android.png (196x196, transparent
  // background, no circle fill) rather than the "circle" variant crop above
  // -- per Task 4's action text, the favicon set is "seeded from the 196x196
  // Android.png" specifically.
  const androidSrc = join(SRC_DIR, 'Android.png');
  const favicons = [
    { size: 32, name: 'favicon-32.png' },
    { size: 180, name: 'apple-touch-icon-180.png' },
    { size: 192, name: 'android-chrome-192.png' },
  ];
  for (const { size, name } of favicons) {
    const outPath = join(OUT_DIR, name);
    await sharp(androidSrc).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
    const bytes = assertUnderBudget(outPath);
    console.log(`  ${outPath} (${bytes}B)`);
  }
}

console.log('Exporting brand mark variants...');
for (const variant of VARIANTS) {
  await exportVariant(variant);
}
console.log('Exporting favicon set...');
await exportFavicons();
console.log('Done. Brand assets written to public/brand/.');
