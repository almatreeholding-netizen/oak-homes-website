#!/usr/bin/env node
// scripts/extract-mockup-photos.mjs
//
// One-off (but re-runnable) extraction of both real Oak Homes properties'
// embedded photos from the rescued mockup HTML at
// docs/reference/Oak-Homes-Website-SHARE.html. Registered as
// `npm run extract:photos` (01-03-PLAN.md Task 1).
//
// Parses per-property, not globally: window.PROPERTIES holds two objects,
// keyed by address, each with its own `photos` array. A single regex across
// the whole file would flatten both homes' photos into one list with no
// property boundary (RESEARCH.md assumption A3) -- mis-assigned real-estate
// photos are worse than none, so this locates each property object by its
// `address:"..."` literal and extracts only the base64 strings inside that
// object's own photos array, asserting the exact expected count (6, 5)
// before writing anything.
//
// Resize uses a two-axis box constraint, not a width-only constraint:
//   .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
// A width-only resize (the RESEARCH.md sketch, superseded here) lets a
// portrait source's height sail past 2000px. All four options are
// load-bearing -- see 01-03-PLAN.md Task 1 action text for the full
// rationale. Every encoded buffer's dimensions are re-read and asserted
// against the longest-edge ceiling BEFORE any file is written -- this write
// is irreversible (git retains every committed blob forever), so the guard
// must fire before the write, not be discovered by a later check.
//
// Two strict phases, so a failed run writes nothing at all:
//   Phase 1 -- decode, resize, re-encode, and threshold-check ALL eleven
//              photos across both homes, entirely in memory. Zero
//              filesystem writes (no mkdir, no writeFile, no toFile). Any
//              throw here exits non-zero having touched nothing on disk.
//   Phase 2 -- only once the full set has validated: write every buffer to
//              a temp name (`photo-01.jpg.tmp`), then rename every temp
//              name into place as the last action. A write failure partway
//              deletes the temp files already written, leaving the
//              destination directories exactly as they were found -- not
//              holding a prefix of the correct output.
//
// Test hooks (env vars only, both no-ops by default). Used exclusively by
// scripts/verify/checks.mjs's `photos-resized` check to prove the two
// guards above actually fire, without hand-editing this file back and
// forth between check runs:
//   OAK_MAX_EDGE_PX      overrides the longest-edge ceiling (default 2000).
//   OAK_FORCE_FAIL_INDEX forces the photo at this 0-based *global* index
//                        (0..10, Marengo's 6 photos first, then Brown
//                        Street's 5) to fail its threshold check --
//                        simulating a failure on a single middle photo
//                        without touching every photo the way a lowered
//                        ceiling does. Because Phase 1 fully validates
//                        every photo before Phase 2 writes anything, a
//                        forced failure at ANY index -- early, middle, or
//                        late -- always results in zero files written,
//                        which is exactly the atomicity invariant this
//                        script exists to guarantee.

import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const MOCKUP_PATH = 'docs/reference/Oak-Homes-Website-SHARE.html';
const MAX_EDGE_PX = Number(process.env.OAK_MAX_EDGE_PX) || 2000;
const FORCE_FAIL_INDEX =
  process.env.OAK_FORCE_FAIL_INDEX !== undefined ? Number(process.env.OAK_FORCE_FAIL_INDEX) : null;

const PROPERTIES = [
  { address: '614 E Marengo St', slug: '614-e-marengo-st', expectedCount: 6 },
  { address: '2734 Brown Street', slug: '2734-brown-st', expectedCount: 5 },
];

/**
 * Locate one property's `photos:[...]` array by its own `address:"..."`
 * literal and extract only the base64 payloads inside that array -- never a
 * global regex over the whole file, which would cross property boundaries.
 */
function extractPhotosForAddress(html, address) {
  const addressMarker = `address:"${address}"`;
  const addressIdx = html.indexOf(addressMarker);
  if (addressIdx === -1) {
    throw new Error(`could not find address marker '${addressMarker}' in ${MOCKUP_PATH}`);
  }
  const photosKeyIdx = html.indexOf('photos:[', addressIdx);
  if (photosKeyIdx === -1) {
    throw new Error(`could not find 'photos:[' after address '${address}'`);
  }
  const arrayStart = photosKeyIdx + 'photos:['.length;
  const arrayEnd = html.indexOf(']', arrayStart);
  if (arrayEnd === -1) {
    throw new Error(`could not find closing ']' for photos array of '${address}'`);
  }
  const arraySlice = html.slice(arrayStart, arrayEnd);
  const matches = [...arraySlice.matchAll(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g)];
  return matches.map((m) => m[1]);
}

/**
 * Decode, resize through the two-axis box constraint, re-encode, and
 * threshold-check one photo. Pure in-memory work -- no filesystem writes.
 * Returns the validated output buffer plus its dimensions, or throws.
 */
async function processPhoto(base64, globalIndex, label) {
  const sourceBuffer = Buffer.from(base64, 'base64');
  const sourceMeta = await sharp(sourceBuffer).metadata();

  const outputBuffer = await sharp(sourceBuffer)
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const { width, height } = await sharp(outputBuffer).metadata();

  const forcedFail = FORCE_FAIL_INDEX !== null && globalIndex === FORCE_FAIL_INDEX;
  if (forcedFail || Math.max(width, height) > MAX_EDGE_PX) {
    const longestEdge = Math.max(width, height);
    throw new Error(
      `${label}: longest edge ${longestEdge}px exceeds the ${MAX_EDGE_PX}px ceiling` +
        (forcedFail ? ' (forced failure for atomicity test)' : ''),
    );
  }

  if (width > sourceMeta.width || height > sourceMeta.height) {
    throw new Error(
      `${label}: output ${width}x${height} exceeds source ${sourceMeta.width}x${sourceMeta.height} -- upscaled`,
    );
  }

  return { buffer: outputBuffer, width, height, sourceWidth: sourceMeta.width, sourceHeight: sourceMeta.height };
}

async function main() {
  const html = readFileSync(MOCKUP_PATH, 'utf8');

  // -- Phase 1: everything in memory, zero filesystem writes --------------
  const validated = [];
  let globalIndex = 0;

  for (const prop of PROPERTIES) {
    const photos = extractPhotosForAddress(html, prop.address);
    if (photos.length !== prop.expectedCount) {
      throw new Error(
        `${prop.address}: found ${photos.length} photos, expected exactly ${prop.expectedCount} -- refusing to ` +
          `write anything (a miscount risks mis-assigning photos between homes)`,
      );
    }

    for (let i = 0; i < photos.length; i += 1) {
      const filename = `photo-${String(i + 1).padStart(2, '0')}.jpg`;
      const destDir = join('public', 'uploads', 'properties', prop.slug);
      const destPath = join(destDir, filename);
      const tmpPath = `${destPath}.tmp`;
      const label = `${prop.slug}/${filename}`;

      const result = await processPhoto(photos[i], globalIndex, label);
      validated.push({ destDir, destPath, tmpPath, buffer: result.buffer, label });
      globalIndex += 1;
    }
  }

  // -- Phase 2: write only after the entire set has validated -------------
  const writtenTmp = [];
  try {
    for (const item of validated) {
      mkdirSync(item.destDir, { recursive: true });
      writeFileSync(item.tmpPath, item.buffer);
      writtenTmp.push(item.tmpPath);
    }
    for (const item of validated) {
      renameSync(item.tmpPath, item.destPath);
    }
  } catch (err) {
    for (const tmpPath of writtenTmp) {
      try {
        rmSync(tmpPath, { force: true });
      } catch {
        // best effort cleanup
      }
    }
    throw err;
  }

  console.log(`Extracted and resized ${validated.length} photos across ${PROPERTIES.length} homes.`);
  for (const item of validated) {
    console.log(`  ${item.destPath}`);
  }
}

main().catch((err) => {
  console.error(`extract-mockup-photos: ${err.message}`);
  process.exit(1);
});
