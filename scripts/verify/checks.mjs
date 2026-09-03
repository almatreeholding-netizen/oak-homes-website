#!/usr/bin/env node
// scripts/verify/checks.mjs
//
// The phase's single shell-independent verification CLI. Every <automated>
// block in plans 01-01 through 01-05 is exactly one invocation of this file:
//
//   node scripts/verify/checks.mjs <check-id>
//
// Node built-ins only (node:fs, node:path, node:child_process, node:url) with
// the single exception of `sharp`, used by the photos-resized check added in
// plan 01-03. Never shell out to grep/find/wc/cmp/test — read files with
// node:fs and count occurrences with a regex or String.prototype.split.
//
// Exit code 0 + "PASS <check-id>" on success.
// Non-zero exit + "FAIL <check-id>: <reason>" on stderr on any failure.
// An unrecognised check id is itself a failure, listing known ids, so a typo
// can never be mistaken for a pass.

import { readFileSync, readdirSync, statSync, writeFileSync, renameSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Read a file as UTF-8 text. Throws loudly if the file is missing/unreadable. */
function readUtf8File(path) {
  return readFileSync(path, 'utf8');
}

/** Count non-overlapping occurrences of a literal substring in a string. */
function countOccurrences(haystack, needle) {
  if (needle.length === 0) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count += 1;
    idx += needle.length;
  }
  return count;
}

/** List file entries (non-recursive) in a directory. Throws if missing. */
function listDir(path) {
  return readdirSync(path, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

/**
 * Run a git subprocess with an explicit argv array (no shell string) and a
 * mandatory timeout. Git Credential Manager re-prompts through a GUI dialog
 * rather than a console prompt, and this session's stdin is null — an
 * untimed spawnSync would block forever waiting on a window nobody answers.
 * A timed-out call is reported as a failure naming the command and timeout,
 * never as a silent hang.
 */
function runGit(args, { timeout = 30000 } = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', timeout });
  if (result.error && result.error.code === 'ETIMEDOUT') {
    return {
      ok: false,
      timedOut: true,
      reason: `git ${args.join(' ')} timed out after ${timeout}ms`,
    };
  }
  if (result.signal === 'SIGTERM' && result.status === null) {
    // spawnSync's own timeout kill also surfaces this way on some platforms.
    return {
      ok: false,
      timedOut: true,
      reason: `git ${args.join(' ')} timed out after ${timeout}ms`,
    };
  }
  if (result.error) {
    return { ok: false, timedOut: false, reason: String(result.error) };
  }
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  return { ok: result.status === 0, timedOut: false, status: result.status, stdout, stderr };
}

/** Fail helper: prints FAIL line and exits non-zero. */
function fail(checkId, reason) {
  process.stderr.write(`FAIL ${checkId}: ${reason}\n`);
  process.exit(1);
}

/** Pass helper: prints PASS line and exits 0. */
function pass(checkId) {
  process.stdout.write(`PASS ${checkId}\n`);
  process.exit(0);
}

/**
 * Recursively list every file (not directory) under `dir`, as absolute
 * paths. Manual walk rather than fs.readdirSync's `recursive` option so
 * behaviour does not depend on a specific Node minor version's Dirent
 * shape.
 */
function walkFiles(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      out = out.concat(walkFiles(p));
    } else {
      out.push(p);
    }
  }
  return out;
}

/**
 * Run `npm run build` in `cwd`. Uses shell:true with a single fixed command
 * string (same rationale as scaffold-clean: npm.cmd cannot be spawned
 * directly via spawnSync's argv form on Windows) and an explicit timeout so
 * a genuine hang is reported, not silently blocked forever.
 */
function runBuild(cwd, { timeout = 180000 } = {}) {
  const result = spawnSync('npm run build', { cwd, encoding: 'utf8', timeout, shell: true });
  const timedOut = Boolean(result.error && result.error.code === 'ETIMEDOUT');
  return {
    status: result.status,
    timedOut,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * Astro's content layer persists a cache at node_modules/.astro/data-store.json
 * across builds. When a test in this file mutates or removes a content file
 * between builds, a stale cache entry from a *previous* build can survive the
 * "Synced content" step and be handed to getStaticPaths anyway -- observed as
 * a build that logs "No files found matching ..." and then still throws the
 * previous run's slug-drift error. Deleting the cache before every mutation
 * round-trip build forces a fresh, disk-accurate content sync each time.
 */
function clearAstroCache(cwd) {
  rmSync(join(cwd, 'node_modules', '.astro'), { recursive: true, force: true });
}

/**
 * Replace a property content file's `photos:` block (everything from the
 * `photos:` key up to, but excluding, `publishDate:`) with a literal value.
 * Used to build a temporary zero-photo fixture out of a real, photo-bearing
 * entry -- both migrated homes have photos post-01-03-Task-1 (D-03), so the
 * UI-SPEC E3 empty-state row can no longer be exercised by a naturally
 * zero-photo entry and must be proven via a mutate-build-assert-revert
 * round-trip instead (01-03-PLAN.md Task 3 continuation note).
 */
function withPhotosField(content, literalValue, checkId) {
  const startIdx = content.indexOf('photos:');
  const endIdx = content.indexOf('publishDate:', startIdx);
  if (startIdx === -1 || endIdx === -1) {
    fail(checkId, `could not locate a 'photos:' ... 'publishDate:' span to mutate`);
  }
  return content.slice(0, startIdx) + `photos: ${literalValue}\n` + content.slice(endIdx);
}

/**
 * Decode HTML entities: the five named entities Astro's runtime escaper
 * actually produces (&amp; &lt; &gt; &quot; &#39;), &nbsp;, and any other
 * named/numeric/hex character reference. Used by the 01-04 content-pages
 * verbatim-transcription comparison -- Astro escapes '&' to '&amp;' on any
 * text that passes through a JS expression (e.g. {step.title}), while
 * literal template text and the canonical source file both carry a bare
 * '&', so a byte comparison without this step reports a false mismatch on
 * a correct page (T-01-19).
 */
function decodeHtmlEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, ref) => {
    if (ref[0] === '#') {
      const isHex = ref[1] === 'x' || ref[1] === 'X';
      const codePoint = isHex ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      if (Number.isNaN(codePoint)) return match;
      return String.fromCodePoint(codePoint);
    }
    return Object.prototype.hasOwnProperty.call(named, ref) ? named[ref] : match;
  });
}

/**
 * Strip HTML tags from a fragment. Simple tag-boundary strip -- fragments
 * passed in here are already isolated to a single element's inner content
 * (e.g. one <p>...</p>), so this only needs to remove nested inline tags
 * like <strong>, not parse a whole document.
 */
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * The full normalisation pipeline required by 01-04-PLAN.md Task 2's
 * acceptance criteria, applied identically to both the canonical source
 * file's paragraph and the built page's paragraph before comparison: strip
 * HTML tags, decode HTML entities, normalise Unicode to NFC (the copy
 * contains em dashes and can arrive in composed or decomposed form),
 * collapse every run of whitespace (including decoded &nbsp; -- JS `\s`
 * already matches U+00A0) to a single space, then trim.
 */
function normalizeForComparison(fragment) {
  return decodeHtmlEntities(stripHtmlTags(fragment))
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const checks = {
  /**
   * Task 2: assert the staged source material is present, byte-exact, and
   * resolves inside THIS worktree — not a sibling worktree, not missing —
   * and that .gitignore and the git tree are in the expected state.
   */
  'sources-staged': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const mockupPath = join(toplevel, 'docs', 'reference', 'Oak-Homes-Website-SHARE.html');
    const onePagerPath = join(toplevel, 'docs', 'reference', 'Oak-Homes-How-It-Works.html');
    const logoDir = join(toplevel, 'docs', 'reference', 'logo-source');
    const gitignorePath = join(toplevel, '.gitignore');

    // Resolve-inside-worktree check: reject anything that isn't rooted under toplevel.
    for (const p of [mockupPath, onePagerPath, logoDir]) {
      if (!(p === toplevel || p.startsWith(toplevel + sep))) {
        fail(id, `${p} does not resolve inside this worktree root (${toplevel}) — staged into a sibling worktree?`);
      }
    }

    // Byte-exact size assertions.
    let mockupStat;
    try {
      mockupStat = statSync(mockupPath);
    } catch {
      fail(id, `missing file: ${mockupPath}`);
    }
    if (mockupStat.size !== 2673638) {
      fail(id, `${mockupPath} is ${mockupStat.size} bytes, expected exactly 2673638`);
    }

    let onePagerStat;
    try {
      onePagerStat = statSync(onePagerPath);
    } catch {
      fail(id, `missing file: ${onePagerPath}`);
    }
    if (onePagerStat.size !== 22508) {
      fail(id, `${onePagerPath} is ${onePagerStat.size} bytes, expected exactly 22508`);
    }

    // Content marker assertions.
    const mockup = readUtf8File(mockupPath);
    const onePager = readUtf8File(onePagerPath);

    const photoCount = countOccurrences(mockup, 'data:image/jpeg;base64,');
    if (photoCount < 11) {
      fail(id, `mockup has ${photoCount} occurrences of 'data:image/jpeg;base64,', expected at least 11`);
    }

    // NOTE (deviation, Rule 1): the plan's acceptance criteria states "exactly
    // 1 occurrence of window.PROPERTIES", but the verified-byte-exact source
    // file legitimately contains 2: the declaration ("window.PROPERTIES =
    // [...]") and one defensive read-site ("(window.PROPERTIES||[]).slice()").
    // The file cannot be edited (Task 1/2 forbid re-saving the byte-exact
    // source), so this check asserts "at least 1" — the property data block
    // is present — rather than an unsatisfiable exact-1 count. See SUMMARY.md
    // Deviations section.
    const propCount = countOccurrences(mockup, 'window.PROPERTIES');
    if (propCount < 1) {
      fail(id, `mockup has ${propCount} occurrences of 'window.PROPERTIES', expected at least 1`);
    }

    const legalCount = countOccurrences(onePager, 'agreement for deed');
    if (legalCount < 1) {
      fail(id, `one-pager has ${legalCount} occurrences of 'agreement for deed', expected at least 1`);
    }

    // Logo source directory assertions.
    let logoFiles;
    try {
      logoFiles = listDir(logoDir);
    } catch {
      fail(id, `missing directory: ${logoDir}`);
    }
    if (logoFiles.length !== 9) {
      fail(id, `${logoDir} has ${logoFiles.length} files, expected exactly 9 (found: ${logoFiles.join(', ')})`);
    }
    if (!logoFiles.includes('Android.png')) {
      fail(id, `${logoDir} is missing Android.png (found: ${logoFiles.join(', ')})`);
    }

    // .gitignore assertions — the new build-output/dotenv entries must be
    // present alongside the pre-existing CLAUDE.md negation (appended, not
    // overwritten).
    let gitignore;
    try {
      gitignore = readUtf8File(gitignorePath);
    } catch {
      fail(id, `missing file: ${gitignorePath}`);
    }
    const gitignoreLines = gitignore.split(/\r\n|\n/);
    if (!gitignoreLines.includes('node_modules/')) {
      fail(id, `.gitignore missing a line equal to 'node_modules/'`);
    }
    if (!gitignoreLines.includes('!.claude/CLAUDE.md')) {
      fail(id, `.gitignore missing a line equal to '!.claude/CLAUDE.md' (pre-existing negation must be preserved, not overwritten)`);
    }

    // Clean git tree.
    const statusResult = runGit(['status', '--porcelain']);
    if (!statusResult.ok) {
      fail(id, `git status --porcelain failed: ${statusResult.reason || statusResult.stderr}`);
    }
    if (statusResult.stdout.length > 0) {
      fail(id, `git status --porcelain is not empty:\n${statusResult.stdout}`);
    }

    pass(id);
  },

  /**
   * Task 3: assert origin is set to the private Oak Homes repo, this machine
   * can push/pull without a credential re-prompt, and remote main matches
   * this worktree's HEAD.
   */
  'remote-private': (id) => {
    const expectedUrl = 'https://github.com/almatreeholding-netizen/oak-homes-website.git';

    const urlResult = runGit(['remote', 'get-url', 'origin']);
    if (!urlResult.ok) {
      fail(id, `git remote get-url origin failed: ${urlResult.timedOut ? urlResult.reason : urlResult.stderr}`);
    }
    if (urlResult.stdout !== expectedUrl) {
      fail(id, `origin URL is '${urlResult.stdout}', expected exactly '${expectedUrl}'`);
    }

    const remoteListResult = runGit(['remote']);
    if (!remoteListResult.ok) {
      fail(id, `git remote failed: ${remoteListResult.timedOut ? remoteListResult.reason : remoteListResult.stderr}`);
    }
    const remoteLines = remoteListResult.stdout.split(/\r\n|\n/).filter((l) => l.length > 0);
    if (remoteLines.length !== 1 || remoteLines[0] !== 'origin') {
      fail(id, `expected exactly one remote named 'origin', found: ${JSON.stringify(remoteLines)}`);
    }

    const lsRemote1 = runGit(['ls-remote', 'origin']);
    if (lsRemote1.timedOut) {
      fail(id, lsRemote1.reason);
    }
    if (!lsRemote1.ok) {
      fail(id, `git ls-remote origin failed: ${lsRemote1.stderr}`);
    }
    const refLines1 = lsRemote1.stdout.split(/\r\n|\n/).filter((l) => l.length > 0);
    if (refLines1.length < 1) {
      fail(id, `git ls-remote origin returned no refs — expected at least one`);
    }

    const lsRemoteMain = runGit(['ls-remote', 'origin', 'refs/heads/main']);
    if (lsRemoteMain.timedOut) {
      fail(id, lsRemoteMain.reason);
    }
    if (!lsRemoteMain.ok) {
      fail(id, `git ls-remote origin refs/heads/main failed: ${lsRemoteMain.stderr}`);
    }
    const mainLine = lsRemoteMain.stdout.split(/\r\n|\n/).filter((l) => l.length > 0)[0] || '';
    const remoteMainSha = mainLine.split(/\s+/)[0] || '';
    if (!remoteMainSha) {
      fail(id, `git ls-remote origin refs/heads/main returned no ref — has it been pushed?`);
    }

    const headResult = runGit(['rev-parse', 'HEAD']);
    if (!headResult.ok) {
      fail(id, `git rev-parse HEAD failed: ${headResult.timedOut ? headResult.reason : headResult.stderr}`);
    }
    if (remoteMainSha !== headResult.stdout) {
      fail(id, `remote main SHA (${remoteMainSha}) does not equal this worktree's HEAD (${headResult.stdout})`);
    }

    // Repeated ls-remote proves Git Credential Manager persisted the
    // credential rather than re-prompting via a GUI dialog on null stdin.
    // A timeout here is the honest FAIL this assertion exists to detect.
    const lsRemote2 = runGit(['ls-remote', 'origin']);
    if (lsRemote2.timedOut) {
      fail(id, `credential not persisted — repeated ls-remote timed out: ${lsRemote2.reason}`);
    }
    if (!lsRemote2.ok) {
      fail(id, `repeated git ls-remote origin failed: ${lsRemote2.stderr}`);
    }

    // Ancestry, not tip: origin/main keeps receiving commits after this plan,
    // so the rescued-source commit must be reachable from origin/main, not equal to it.
    const logResult = runGit(['log', 'origin/main', '--oneline']);
    if (!logResult.ok) {
      fail(id, `git log origin/main --oneline failed: ${logResult.timedOut ? logResult.reason : logResult.stderr}`);
    }
    if (!logResult.stdout.includes('preserve mockup, one-pager, and logo sources in repo')) {
      fail(id, `origin/main history does not contain the rescued-source commit`);
    }

    pass(id);
  },

  /**
   * Task 2: assert the Astro scaffold stands cleanly — config files present,
   * the approved dependency set installed (and the deprecated Tailwind v3
   * integration absent), the build succeeds, .gitignore survived the
   * scaffold (including the throwaway-tmp-dir entry), and the brand-token
   * `@theme` block in global.css carries the correct values.
   */
  'scaffold-clean': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    // Config files exist at the project root.
    const pkgJsonPath = join(toplevel, 'package.json');
    const astroConfigPath = join(toplevel, 'astro.config.mjs');
    const tsconfigPath = join(toplevel, 'tsconfig.json');
    const pkgLockPath = join(toplevel, 'package-lock.json');
    const gitignorePath = join(toplevel, '.gitignore');
    const globalCssPath = join(toplevel, 'src', 'styles', 'global.css');

    for (const p of [pkgJsonPath, astroConfigPath, tsconfigPath, pkgLockPath]) {
      try {
        statSync(p);
      } catch {
        fail(id, `missing required file: ${p}`);
      }
    }

    // package.json dependency assertions.
    let pkg;
    try {
      pkg = JSON.parse(readUtf8File(pkgJsonPath));
    } catch (e) {
      fail(id, `could not parse package.json: ${e}`);
    }
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    const requiredDeps = [
      'astro',
      'tailwindcss',
      '@tailwindcss/vite',
      '@fontsource/lora',
      '@fontsource/inter',
      'lucide-static',
      '@astrojs/sitemap',
    ];
    for (const dep of requiredDeps) {
      if (!Object.prototype.hasOwnProperty.call(deps, dep)) {
        fail(id, `package.json dependencies missing '${dep}'`);
      }
    }
    if (!Object.prototype.hasOwnProperty.call(devDeps, 'sharp')) {
      fail(id, `package.json devDependencies missing 'sharp'`);
    }
    if (Object.prototype.hasOwnProperty.call(deps, '@astrojs/tailwind') ||
        Object.prototype.hasOwnProperty.call(devDeps, '@astrojs/tailwind')) {
      fail(id, `package.json lists the deprecated '@astrojs/tailwind' integration — it must never enter the tree`);
    }

    // astro.config.mjs assertions.
    const astroConfig = readUtf8File(astroConfigPath);
    if (!astroConfig.includes('https://ownwithoak.com')) {
      fail(id, `astro.config.mjs does not contain 'https://ownwithoak.com'`);
    }
    if (!astroConfig.includes('tailwindcss()')) {
      fail(id, `astro.config.mjs does not contain 'tailwindcss()'`);
    }
    if (astroConfig.includes('adapter')) {
      fail(id, `astro.config.mjs contains an 'adapter' key — Phase 1 ships output: 'static' with no adapter`);
    }
    if (astroConfig.includes(`output: 'server'`) || astroConfig.includes('output: "server"') ||
        astroConfig.includes(`output: 'hybrid'`) || astroConfig.includes('output: "hybrid"')) {
      fail(id, `astro.config.mjs sets output to 'server' or 'hybrid' — Phase 1 requires static output`);
    }

    // .gitignore assertions — post-scaffold re-assertion.
    const gitignore = readUtf8File(gitignorePath);
    const gitignoreLines = gitignore.split(/\r\n|\n/);
    const requiredGitignoreLines = [
      '.claude/*',
      '!.claude/CLAUDE.md',
      'node_modules/',
      'dist/',
      '.astro/',
      '.env',
      '.astro-scaffold-tmp/',
    ];
    for (const line of requiredGitignoreLines) {
      if (!gitignoreLines.includes(line)) {
        fail(id, `.gitignore missing a line equal to '${line}' after the scaffold`);
      }
    }

    // Untracked-file assertions after install + build.
    const statusResult = runGit(['status', '--porcelain']);
    if (!statusResult.ok) {
      fail(id, `git status --porcelain failed: ${statusResult.reason || statusResult.stderr}`);
    }
    const untrackedForbidden = ['node_modules', 'dist', '.astro-scaffold-tmp'];
    for (const line of statusResult.stdout.split(/\r\n|\n/)) {
      if (!line.startsWith('??')) continue;
      const path = line.slice(3).trim();
      for (const forbidden of untrackedForbidden) {
        if (path === forbidden || path.startsWith(forbidden + '/')) {
          fail(id, `git status --porcelain lists '${path}' as untracked — .gitignore is not excluding it`);
        }
      }
    }

    // No throwaway scaffold file was ever committed.
    const lsFilesResult = runGit(['ls-files']);
    if (!lsFilesResult.ok) {
      fail(id, `git ls-files failed: ${lsFilesResult.reason || lsFilesResult.stderr}`);
    }
    const trackedUnderTmp = lsFilesResult.stdout
      .split(/\r\n|\n/)
      .filter((p) => p.startsWith('.astro-scaffold-tmp/'));
    if (trackedUnderTmp.length > 0) {
      fail(id, `git ls-files returned ${trackedUnderTmp.length} path(s) under .astro-scaffold-tmp/: ${trackedUnderTmp.join(', ')}`);
    }

    // global.css brand-token assertions.
    let globalCss;
    try {
      globalCss = readUtf8File(globalCssPath);
    } catch {
      fail(id, `missing file: ${globalCssPath}`);
    }
    if (!globalCss.includes('@theme')) {
      fail(id, `${globalCssPath} does not contain an '@theme' block`);
    }
    const requiredTokens = [
      '--color-cream',
      '--color-cream-deep',
      '--color-accent',
      '--color-accent-hover',
      '--color-price-gold',
      '--color-ink',
      '--color-pending',
      '--color-destructive',
      '--font-display',
      '--font-body',
    ];
    for (const token of requiredTokens) {
      if (!globalCss.includes(token)) {
        fail(id, `${globalCssPath} is missing token '${token}'`);
      }
    }
    if (!globalCss.includes('#FFD053')) {
      fail(id, `${globalCssPath} is missing the accent value #FFD053`);
    }
    if (!globalCss.includes('#A87E24')) {
      fail(id, `${globalCssPath} is missing the price-gold value #A87E24`);
    }
    if (globalCss.toUpperCase().includes('F6C84C')) {
      fail(id, `${globalCssPath} contains the superseded design-spec yellow estimate F6C84C`);
    }
    if (!globalCss.includes('@fontsource/lora/400.css') || !globalCss.includes('@fontsource/lora/600.css')) {
      fail(id, `${globalCssPath} does not import both @fontsource/lora weight 400 and 600`);
    }
    if (!globalCss.includes('@fontsource/inter/400.css') || !globalCss.includes('@fontsource/inter/600.css')) {
      fail(id, `${globalCssPath} does not import both @fontsource/inter weight 400 and 600`);
    }
    if (globalCss.includes('fonts.googleapis.com')) {
      fail(id, `${globalCssPath} references fonts.googleapis.com — fonts must be self-hosted`);
    }

    // The build itself. `npm.cmd` cannot be spawned directly via spawnSync's
    // argv form on Windows (EINVAL — it is a batch shim, not a real
    // executable), so this uses shell:true with a single fixed command
    // string (no args array, so there is nothing for the shell to
    // re-interpret from external input) rather than an argv array. Explicit
    // timeout: not a credential-touching subprocess, but an unbounded build
    // hang is still a real failure mode worth capping.
    const buildResult = spawnSync('npm run build', {
      cwd: toplevel,
      encoding: 'utf8',
      timeout: 180000,
      shell: true,
    });
    if (buildResult.error && buildResult.error.code === 'ETIMEDOUT') {
      fail(id, `npm run build timed out after 180000ms`);
    }
    if (buildResult.status !== 0) {
      fail(id, `npm run build exited ${buildResult.status}:\n${(buildResult.stdout || '').slice(-2000)}\n${(buildResult.stderr || '').slice(-2000)}`);
    }

    pass(id);
  },

  /**
   * Task 3: the tracer proper. One real home, read from one real content
   * file, validated by one real schema, rendered through one shared layout,
   * into static HTML. Covers 01-02-PLAN.md Task 3's full acceptance-criteria
   * list: content-schema location, flat loader glob, id<->slug drift
   * assertion (including the nesting-vs-drift message branch), schema
   * validation actually firing on malformed content, the Equal Housing line
   * on every built page and nowhere under src/content/, brand-token and
   * self-hosted-font presence in built CSS/HTML, DOM ordering of the phone
   * CTA ahead of <main>, and the settings-phone-required guarantee.
   */
  'skeleton-e2e': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const distDir = join(toplevel, 'dist');
    const distHomesDir = join(toplevel, 'dist', 'homes');
    const propertiesDir = join(toplevel, 'src', 'content', 'properties');
    const propertyFile = join(propertiesDir, '614-e-marengo-st.md');
    // Added by 01-03 Task 1 (D-03) after this check was first written --
    // step 10's "empty collection" proof must move both real entries out,
    // not just Marengo, or Brown Street's file alone still yields 1 page.
    const brownPropertyFile = join(propertiesDir, '2734-brown-st.md');
    const settingsPath = join(toplevel, 'src', 'content', 'settings.json');
    const contentConfigPath = join(toplevel, 'src', 'content.config.ts');
    const legacyContentConfigPath = join(toplevel, 'src', 'content', 'config.ts');
    const slugRoutePath = join(toplevel, 'src', 'pages', 'homes', '[slug].astro');

    const equalHousingSentence =
      'Equal Housing Opportunity. Owner financing is subject to a written agreement; this is not a commitment to lend or an offer of credit.';

    // -- Static, no-build source assertions -----------------------------

    if (!existsSync(contentConfigPath)) {
      fail(id, `missing ${contentConfigPath} — schema must live at the Astro 5+ location`);
    }
    if (existsSync(legacyContentConfigPath)) {
      fail(id, `${legacyContentConfigPath} exists — the Astro 4-era location is silently ignored and must be absent`);
    }

    const contentConfig = readUtf8File(contentConfigPath);
    if (contentConfig.includes('**/*.md')) {
      fail(id, `${contentConfigPath} contains the recursive glob '**/*.md' — every collection's loader pattern must be the flat '*.md'`);
    }
    if (!contentConfig.includes(`pattern: '*.md'`) && !contentConfig.includes(`pattern: "*.md"`)) {
      fail(id, `${contentConfigPath} does not contain a flat '*.md' loader pattern`);
    }
    // The literal 'min(1)' is expected to appear once, in prose, in the
    // comment documenting RESEARCH.md Pattern 1's superseded line (plan's
    // own <!-- planner-discipline-allow: min(1) --> marker). What must be
    // absent is `.min(1)` attached to the *code* declaration of the photos
    // field itself — check that field's declaration line in isolation.
    const photosFieldMatch = contentConfig.match(/photos:\s*z\.array\(z\.string\(\)\)[^,\n]*/);
    if (!photosFieldMatch) {
      fail(id, `${contentConfigPath} does not declare a 'photos: z.array(z.string())...' field`);
    }
    if (!photosFieldMatch[0].includes('.default([])')) {
      fail(id, `${contentConfigPath}'s photos field declaration does not contain '.default([])': "${photosFieldMatch[0]}"`);
    }
    if (photosFieldMatch[0].includes('.min(1)')) {
      fail(id, `${contentConfigPath}'s photos field declaration contains '.min(1)' — this supersedes RESEARCH.md Pattern 1, must be default-empty instead: "${photosFieldMatch[0]}"`);
    }

    if (!existsSync(slugRoutePath)) {
      fail(id, `missing ${slugRoutePath}`);
    }
    const slugRoute = readUtf8File(slugRoutePath);
    if (!slugRoute.includes('entry.id')) {
      fail(id, `${slugRoutePath} does not reference entry.id as the route-parameter source`);
    }
    if (!slugRoute.includes('entry.data.slug')) {
      fail(id, `${slugRoutePath} does not contain an equality assertion against entry.data.slug`);
    }
    if (!slugRoute.includes(`entry.id.includes('/')`) && !slugRoute.includes('entry.id.includes("/")')) {
      fail(id, `${slugRoutePath} does not branch on entry.id containing a path separator`);
    }
    if (!/subdirector/i.test(slugRoute)) {
      fail(id, `${slugRoutePath}'s nesting branch does not name the subdirectory cause in its error message`);
    }

    // -- Backups for every file this check temporarily mutates ----------

    const originalPropertyFile = readUtf8File(propertyFile);
    const originalSettings = readUtf8File(settingsPath);

    function restoreAll() {
      writeFileSync(propertyFile, originalPropertyFile, 'utf8');
      writeFileSync(settingsPath, originalSettings, 'utf8');
    }

    // Any failure from here on must restore mutated files before exiting,
    // so a failed run doesn't leave the working tree corrupted.
    try {
      // -- 1. Baseline build ---------------------------------------------

      clearAstroCache(toplevel);
      let build = runBuild(toplevel);
      if (build.timedOut) {
        fail(id, `baseline npm run build timed out`);
      }
      if (build.status !== 0) {
        fail(id, `baseline npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
      }

      const propertyPagePath = join(distHomesDir, '614-e-marengo-st', 'index.html');
      if (!existsSync(propertyPagePath)) {
        fail(id, `missing ${propertyPagePath} after a successful baseline build`);
      }
      const propertyPage = readUtf8File(propertyPagePath);

      if (!propertyPage.includes('614 E Marengo St')) {
        fail(id, `${propertyPagePath} does not contain '614 E Marengo St'`);
      }
      if (!propertyPage.includes('3,000')) {
        fail(id, `${propertyPagePath} does not contain a rendering of the 3,000 down payment`);
      }
      if (!propertyPage.includes('950')) {
        fail(id, `${propertyPagePath} does not contain a rendering of the 950 monthly payment`);
      }
      if (!propertyPage.includes('Bonus room')) {
        fail(id, `${propertyPagePath} does not contain the Marengo feature bullet 'Bonus room' — content did not drive the page`);
      }

      const equalHousingCountOnPropertyPage = countOccurrences(propertyPage, equalHousingSentence);
      if (equalHousingCountOnPropertyPage !== 1) {
        fail(id, `${propertyPagePath} contains ${equalHousingCountOnPropertyPage} occurrences of the Equal Housing sentence, expected exactly 1`);
      }

      if (!propertyPage.includes('lang="en"')) {
        fail(id, `${propertyPagePath} does not contain lang="en"`);
      }
      if (!propertyPage.includes('(217) 269-0003')) {
        fail(id, `${propertyPagePath} does not contain the display phone string '(217) 269-0003'`);
      }
      if (!propertyPage.includes('tel:+12172690003')) {
        fail(id, `${propertyPagePath} does not contain 'tel:+12172690003'`);
      }
      const telIndex = propertyPage.indexOf('tel:+12172690003');
      const mainIndex = propertyPage.indexOf('<main');
      if (mainIndex === -1) {
        fail(id, `${propertyPagePath} does not contain a <main element`);
      }
      if (!(telIndex >= 0 && telIndex < mainIndex)) {
        fail(id, `${propertyPagePath}: first 'tel:+12172690003' occurrence (index ${telIndex}) does not precede first '<main' occurrence (index ${mainIndex})`);
      }

      const integrationsSlotCount = countOccurrences(propertyPage, 'integrations-slot');
      if (integrationsSlotCount !== 1) {
        fail(id, `${propertyPagePath} contains ${integrationsSlotCount} occurrences of the integrations-slot marker, expected exactly 1`);
      }

      // -- 2. Every built .html page carries the legal line, exactly once --

      const htmlFiles = walkFiles(distDir).filter((p) => p.endsWith('.html'));
      if (htmlFiles.length === 0) {
        fail(id, `no .html files found under ${distDir}`);
      }
      let filesWithSentence = 0;
      for (const f of htmlFiles) {
        const content = readUtf8File(f);
        const count = countOccurrences(content, equalHousingSentence);
        if (count !== 1) {
          fail(id, `${f} contains ${count} occurrences of the Equal Housing sentence, expected exactly 1`);
        }
        filesWithSentence += 1;
      }
      if (filesWithSentence !== htmlFiles.length) {
        fail(id, `${filesWithSentence} of ${htmlFiles.length} built .html files carry the Equal Housing sentence — expected all of them`);
      }

      // -- 3. Legal copy is absent from every file under src/content/ -----

      const contentDir = join(toplevel, 'src', 'content');
      const contentFiles = walkFiles(contentDir);
      for (const f of contentFiles) {
        let text;
        try {
          text = readUtf8File(f);
        } catch {
          continue; // non-text asset; not a concern for this grep
        }
        if (text.includes('Equal Housing Opportunity')) {
          fail(id, `${f} under src/content/ contains 'Equal Housing Opportunity' — legal copy must exist only in .astro files (DESIGN-03)`);
        }
      }

      // -- 4. Built CSS / brand-token / font assertions --------------------

      let foundAccent = false;
      let foundPriceGold = false;
      for (const f of htmlFiles.concat(walkFiles(distDir).filter((p) => p.endsWith('.css')))) {
        const content = readUtf8File(f);
        // Lightning CSS (Tailwind v4's minifier) lowercases hex literals in
        // its output, so this must be a case-insensitive match — the source
        // @theme block in global.css is uppercase, but the built asset is not.
        const upper = content.toUpperCase();
        if (upper.includes('#FFD053')) foundAccent = true;
        if (upper.includes('#A87E24')) foundPriceGold = true;
        if (upper.includes('F6C84C')) {
          fail(id, `${f} contains the superseded design-spec yellow estimate F6C84C`);
        }
        if (content.includes('fonts.googleapis.com')) {
          fail(id, `${f} references fonts.googleapis.com — fonts must be self-hosted`);
        }
      }
      if (!foundAccent) {
        fail(id, `no built file under dist/ contains the accent value #FFD053`);
      }
      if (!foundPriceGold) {
        fail(id, `no built file under dist/ contains the price-gold value #A87E24`);
      }

      // -- 5. dist/homes/*/index.html count == properties .md file count --

      function countPropertyPages() {
        if (!existsSync(distHomesDir)) return 0;
        let count = 0;
        for (const name of readdirSync(distHomesDir, { withFileTypes: true })) {
          if (!name.isDirectory()) continue; // excludes dist/homes/index.html itself
          const candidate = join(distHomesDir, name.name, 'index.html');
          if (existsSync(candidate)) count += 1;
        }
        return count;
      }
      const mdFileCount = readdirSync(propertiesDir).filter((f) => f.endsWith('.md')).length;
      const pagesCount = countPropertyPages();
      if (pagesCount !== mdFileCount) {
        fail(id, `dist/homes/*/index.html count is ${pagesCount}, expected ${mdFileCount} (one per src/content/properties/*.md file)`);
      }

      // -- 6. Zero-photo entry builds -------------------------------------
      //
      // Both migrated homes carry real photos as of 01-03 Task 1 (D-03), so
      // this invariant -- a properties collection entry with an empty
      // `photos` array still builds -- can no longer be exercised by a
      // naturally zero-photo entry the way it could when this check was
      // first written. Proven instead via a temporary fixture: mutate
      // Marengo's `photos` to `[]`, build, assert success, then revert and
      // rebuild. The detailed placeholder-frame assertions (brand asset
      // present, no dangling <img> pointing at a removed photo path) live in
      // the property-page check's own zero-photo proof (01-03 Task 3); this
      // check only needs to prove the *build* succeeds with the empty array,
      // which is what this step originally asserted.

      writeFileSync(propertyFile, withPhotosField(originalPropertyFile, '[]', id), 'utf8');
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      writeFileSync(propertyFile, originalPropertyFile, 'utf8');
      if (build.timedOut) {
        fail(id, `zero-photo-fixture build timed out`);
      }
      if (build.status !== 0) {
        fail(id, `zero-photo-fixture build exited ${build.status}, expected 0 -- a properties entry with an empty photos array must still build:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
      }
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      if (build.status !== 0) {
        fail(id, `rebuild after reverting the zero-photo fixture exited ${build.status}, expected 0`);
      }

      // -- 7. Schema validation actually fires (status enum + downPayment) --

      writeFileSync(
        propertyFile,
        originalPropertyFile
          .replace('status: "Available"', 'status: "NotARealStatus"')
          .replace('downPayment: 3000', 'downPayment: "not-a-number"'),
        'utf8',
      );
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      writeFileSync(propertyFile, originalPropertyFile, 'utf8');
      if (build.timedOut) {
        fail(id, `malformed-status/downPayment build timed out`);
      }
      if (build.status === 0) {
        fail(id, `malformed-status/downPayment build exited 0 — schema validation did not fire`);
      }
      const malformedOutput = (build.stdout + build.stderr).toLowerCase();
      if (!malformedOutput.includes('status')) {
        fail(id, `malformed-status/downPayment build's error output does not name 'status'`);
      }
      if (!malformedOutput.includes('downpayment')) {
        fail(id, `malformed-status/downPayment build's error output does not name 'downPayment'`);
      }
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      if (build.status !== 0) {
        fail(id, `build after reverting the malformed-status/downPayment mutation exited ${build.status} — expected 0`);
      }

      // -- 8. Slug encoding enforced ---------------------------------------

      writeFileSync(
        propertyFile,
        originalPropertyFile.replace('slug: "614-e-marengo-st"', 'slug: "614-E Marengo St"'),
        'utf8',
      );
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      writeFileSync(propertyFile, originalPropertyFile, 'utf8');
      if (build.timedOut) {
        fail(id, `invalid-slug-encoding build timed out`);
      }
      if (build.status === 0) {
        fail(id, `invalid-slug-encoding build exited 0 — the slug regex did not fire on an uppercase+space value`);
      }

      // -- 9. Filename <-> frontmatter slug drift is asserted --------------

      writeFileSync(
        propertyFile,
        originalPropertyFile.replace('slug: "614-e-marengo-st"', 'slug: "614-e-marengo-street"'),
        'utf8',
      );
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      writeFileSync(propertyFile, originalPropertyFile, 'utf8');
      if (build.timedOut) {
        fail(id, `slug-drift build timed out`);
      }
      if (build.status === 0) {
        fail(id, `slug-drift build exited 0 — the entry.id === entry.data.slug assertion did not fire`);
      }
      const driftOutput = build.stdout + build.stderr;
      if (!driftOutput.includes('614-e-marengo-st') || !driftOutput.includes('614-e-marengo-street')) {
        fail(id, `slug-drift build's error output does not name both the filename ('614-e-marengo-st') and the frontmatter value ('614-e-marengo-street')`);
      }

      // -- 10. Empty properties collection builds, produces zero pages -----
      //
      // Both real homes must move out -- 01-03 Task 1 (D-03) added Brown
      // Street alongside Marengo, so moving only one file now leaves a
      // non-empty collection (Brown Street's own page still builds) rather
      // than exercising the true zero-entries state this step asserts.

      const movedPath = join(toplevel, '.tmp-moved-property.md.bak');
      const movedBrownPath = join(toplevel, '.tmp-moved-property-brown.md.bak');
      renameSync(propertyFile, movedPath);
      renameSync(brownPropertyFile, movedBrownPath);
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      renameSync(movedPath, propertyFile);
      renameSync(movedBrownPath, brownPropertyFile);
      if (build.timedOut) {
        fail(id, `empty-collection build timed out`);
      }
      if (build.status !== 0) {
        fail(id, `empty-collection build exited ${build.status} — a properties collection with zero entries must still build`);
      }
      if (countPropertyPages() !== 0) {
        fail(id, `empty-collection build produced ${countPropertyPages()} dist/homes/*/index.html files, expected 0`);
      }

      // -- 11. Settings phone is required -----------------------------------

      writeFileSync(settingsPath, originalSettings.replace('"phone": "(217) 269-0003"', '"phone": ""'), 'utf8');
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      writeFileSync(settingsPath, originalSettings, 'utf8');
      if (build.timedOut) {
        fail(id, `blank-phone build timed out`);
      }
      if (build.status === 0) {
        fail(id, `blank-phone build exited 0 — the settings phone field must be required non-empty`);
      }

      // -- 12. Final rebuild — leave the tree in a known-good built state --

      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      if (build.status !== 0) {
        fail(id, `final rebuild after all mutation round-trips exited ${build.status}, expected 0`);
      }
    } finally {
      restoreAll();
    }

    pass(id);
  },

  /**
   * Task 4: the owner's real logo ships as web-ready assets in all three
   * UI-SPEC variants (ink, light, circle) plus a favicon set, consumed only
   * through BrandMark.astro with the single documented exemption of the
   * favicon <link> tags in Layout.astro's head, none exceeding the 100KB
   * budget, and the header mark carrying the tagline as its alt text on
   * every built page.
   */
  'brand-assets': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const brandDir = join(toplevel, 'public', 'brand');
    const brandMarkPath = join(toplevel, 'src', 'components', 'BrandMark.astro');
    const layoutPath = join(toplevel, 'src', 'layouts', 'Layout.astro');
    const srcDir = join(toplevel, 'src');
    const distDir = join(toplevel, 'dist');
    const taglineAlt = 'Oak Homes — From Rent to Roots';
    const MAX_BYTES = 102400;

    // -- 1. public/brand/ has the three variants plus a favicon set --------

    let brandFiles;
    try {
      brandFiles = listDir(brandDir);
    } catch {
      fail(id, `missing directory: ${brandDir}`);
    }
    if (brandFiles.length < 6) {
      fail(id, `${brandDir} has ${brandFiles.length} files, expected at least 6`);
    }
    for (const variant of ['ink', 'light', 'circle']) {
      if (!brandFiles.some((f) => f.startsWith(`mark-${variant}-`))) {
        fail(id, `${brandDir} has no file matching 'mark-${variant}-*' — the ${variant} variant is missing`);
      }
    }
    const requiredFavicons = ['favicon-32.png', 'apple-touch-icon-180.png', 'android-chrome-192.png'];
    for (const name of requiredFavicons) {
      if (!brandFiles.includes(name)) {
        fail(id, `${brandDir} is missing required favicon file '${name}'`);
      }
    }

    // -- 2. Every exported file stays under the 100KB budget ---------------

    for (const name of brandFiles) {
      const bytes = statSync(join(brandDir, name)).size;
      if (bytes > MAX_BYTES) {
        fail(id, `${join(brandDir, name)} is ${bytes} bytes, exceeds the ${MAX_BYTES}-byte budget`);
      }
    }

    // -- 3. BrandMark.astro exists, accepts a variant prop, knows 'circle' --

    let brandMark;
    try {
      brandMark = readUtf8File(brandMarkPath);
    } catch {
      fail(id, `missing file: ${brandMarkPath}`);
    }
    if (!/variant/.test(brandMark)) {
      fail(id, `${brandMarkPath} does not appear to declare a 'variant' prop`);
    }
    if (!brandMark.includes('circle')) {
      fail(id, `${brandMarkPath} does not contain the identifier 'circle'`);
    }

    // The wordmark was not re-typeset anywhere under src/.
    if (brandMark.includes('FROM RENT TO ROOTS')) {
      fail(id, `${brandMarkPath} contains the all-caps wordmark literal 'FROM RENT TO ROOTS' — it must ship as an image asset only`);
    }

    // -- 4. /brand/ is named only in BrandMark.astro, with Layout.astro's --
    // -- favicon <link> exemption confined to <link> elements --------------

    const astroFiles = walkFiles(srcDir).filter((p) => p.endsWith('.astro'));
    for (const f of astroFiles) {
      if (f === brandMarkPath || f === layoutPath) continue;
      const text = readUtf8File(f);
      if (text.includes('/brand/')) {
        fail(id, `${f} contains '/brand/' — every brand-path reference must go through BrandMark.astro (Layout.astro's favicon <link> exemption aside)`);
      }
      if (text.includes('FROM RENT TO ROOTS')) {
        fail(id, `${f} contains the all-caps wordmark literal 'FROM RENT TO ROOTS' — it must ship as an image asset only`);
      }
    }

    const layout = readUtf8File(layoutPath);
    if (layout.includes('FROM RENT TO ROOTS')) {
      fail(id, `${layoutPath} contains the all-caps wordmark literal 'FROM RENT TO ROOTS' — it must ship as an image asset only`);
    }
    // Every /brand/ occurrence in Layout.astro must sit inside a <link ...>
    // element whose rel is icon, apple-touch-icon, or manifest. Walk each
    // <link ...> tag and confirm any /brand/ reference found outside one of
    // those tags does not exist.
    const linkTagRegex = /<link\b[^>]*>/g;
    const brandInAllowedLinks = [];
    let match;
    while ((match = linkTagRegex.exec(layout)) !== null) {
      const tag = match[0];
      if (!tag.includes('/brand/')) continue;
      const relMatch = tag.match(/rel=["']([^"']+)["']/);
      const rel = relMatch ? relMatch[1] : '';
      if (!['icon', 'apple-touch-icon', 'manifest'].includes(rel)) {
        fail(id, `${layoutPath} has a <link> referencing '/brand/' whose rel is '${rel}', expected one of icon/apple-touch-icon/manifest: ${tag}`);
      }
      brandInAllowedLinks.push(tag);
    }
    // Strip every allowed <link> tag out, then confirm no /brand/ occurrence
    // remains anywhere else in the file (an <img>, srcset, or CSS reference).
    let layoutWithoutFaviconLinks = layout;
    for (const tag of brandInAllowedLinks) {
      layoutWithoutFaviconLinks = layoutWithoutFaviconLinks.replace(tag, '');
    }
    if (layoutWithoutFaviconLinks.includes('/brand/')) {
      fail(id, `${layoutPath} references '/brand/' outside an allowed favicon <link> element — every other reference must go through BrandMark.astro`);
    }
    if (brandInAllowedLinks.length === 0) {
      fail(id, `${layoutPath} has no favicon <link> element referencing '/brand/' — expected the exported favicon set to be wired into <head>`);
    }

    // -- 5. Build, then assert the built HTML ------------------------------

    clearAstroCache(toplevel);
    const build = runBuild(toplevel);
    if (build.timedOut) {
      fail(id, `npm run build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
    }

    const htmlFiles = walkFiles(distDir).filter((p) => p.endsWith('.html'));
    if (htmlFiles.length === 0) {
      fail(id, `no .html files found under ${distDir}`);
    }

    // Home page references the favicon.
    const homePagePath = join(distDir, 'index.html');
    if (!existsSync(homePagePath)) {
      fail(id, `missing ${homePagePath}`);
    }
    const homePage = readUtf8File(homePagePath);
    if (!homePage.includes('/brand/favicon-32.png') && !homePage.includes('/brand/apple-touch-icon-180.png')) {
      fail(id, `${homePagePath} head does not reference the exported favicon set`);
    }

    for (const f of htmlFiles) {
      const content = readUtf8File(f);

      const taglineCount = countOccurrences(content, taglineAlt);
      if (taglineCount !== 1) {
        fail(id, `${f} contains ${taglineCount} occurrences of the alt literal '${taglineAlt}', expected exactly 1`);
      }
      if (!content.includes(`alt="${taglineAlt}"`)) {
        fail(id, `${f} does not carry '${taglineAlt}' as an alt attribute value`);
      }

      if (!/mark-ink-/.test(content)) {
        fail(id, `${f} does not reference an ink mark asset (mark-ink-*) — the header mark must render on every page`);
      }
      if (!/mark-light-/.test(content)) {
        fail(id, `${f} does not reference a light mark asset (mark-light-*) — the footer mark must render on every page`);
      }

      // Every <img> emitted has either a non-empty alt or empty-alt +
      // aria-hidden="true" (Astro renders an empty-string alt prop as the
      // bare boolean attribute `alt`, not `alt=""`). Strip HTML comments
      // first -- Astro preserves them in output, and prose mentioning "img"
      // inside a comment must not be mistaken for a rendered element.
      const contentWithoutComments = content.replace(/<!--[^]*?-->/g, '');
      const imgTagRegex = /<img\b[^>]*>/g;
      let imgMatch;
      while ((imgMatch = imgTagRegex.exec(contentWithoutComments)) !== null) {
        const tag = imgMatch[0];
        const altMatch = tag.match(/\balt="([^"]*)"/);
        const hasBareAlt = /\balt(?=[\s>])/.test(tag) && !altMatch;
        const hasNonEmptyAlt = altMatch && altMatch[1].length > 0;
        const hasAriaHiddenTrue = tag.includes('aria-hidden="true"');
        if (!hasNonEmptyAlt && !(hasBareAlt && hasAriaHiddenTrue) && !(altMatch && altMatch[1] === '' && hasAriaHiddenTrue)) {
          fail(id, `${f} has an <img> with neither a non-empty alt nor an empty-alt+aria-hidden="true" pairing: ${tag}`);
        }
      }
    }

    // Property page's zero-photo placeholder carries the brand mark.
    //
    // Both migrated homes carry real photos as of 01-03 Task 1 (D-03), so
    // this can no longer be observed on Marengo's ordinary built page the
    // way it could when this check was first written -- Gallery.astro
    // (01-03 Task 3) also replaced the old inline `.gallery-region` wrapper
    // with `.gallery-placeholder`, rendered only in the zero-photo branch.
    // Proven via the same mutate-build-assert-revert fixture pattern used
    // elsewhere in this file: temporarily empty Marengo's `photos`, build,
    // assert the placeholder renders a brand asset, then revert and rebuild
    // so this check leaves the tree in its real, known-good built state.
    const propertyPagePath = join(distDir, 'homes', '614-e-marengo-st', 'index.html');
    const marengoPropertyFile = join(toplevel, 'src', 'content', 'properties', '614-e-marengo-st.md');
    const originalMarengoContent = readUtf8File(marengoPropertyFile);

    writeFileSync(marengoPropertyFile, withPhotosField(originalMarengoContent, '[]', id), 'utf8');
    clearAstroCache(toplevel);
    const zeroPhotoBuild = runBuild(toplevel);
    writeFileSync(marengoPropertyFile, originalMarengoContent, 'utf8');
    if (zeroPhotoBuild.timedOut) {
      fail(id, `zero-photo-fixture build timed out`);
    }
    if (zeroPhotoBuild.status !== 0) {
      fail(id, `zero-photo-fixture build exited ${zeroPhotoBuild.status}, expected 0`);
    }
    if (!existsSync(propertyPagePath)) {
      fail(id, `missing ${propertyPagePath} after the zero-photo-fixture build`);
    }
    const zeroPhotoPage = readUtf8File(propertyPagePath);
    const placeholderMatch = zeroPhotoPage.match(/<div class="gallery-placeholder"[^]*?<\/div>/);
    if (!placeholderMatch || !placeholderMatch[0].includes('/brand/')) {
      fail(id, `${propertyPagePath}'s gallery-placeholder does not reference a brand asset — the zero-photo placeholder must render the mark`);
    }

    // Rebuild with the real content so this check leaves dist/ reflecting
    // the committed, photo-bearing entries rather than the fixture.
    clearAstroCache(toplevel);
    const finalBuild = runBuild(toplevel);
    if (finalBuild.status !== 0) {
      fail(id, `final rebuild after the zero-photo fixture exited ${finalBuild.status}, expected 0`);
    }

    pass(id);
  },

  /**
   * Task 1: assert the extraction script's structure, dimensions, and
   * atomicity guarantees, and that both content files carry the migrated
   * real data validated against the Property schema.
   *
   * This check re-derives the expected source photos from the mockup
   * independently of scripts/extract-mockup-photos.mjs (its own address+
   * photos-array parse, not a call into the script's internals), so a
   * shared bug in both places can't produce a false pass.
   *
   * The two failure-mode proofs (threshold-lowering, forced middle-photo
   * failure) mutate public/uploads/properties/ on disk. fail(id, ...) calls
   * process.exit() directly, which does NOT run pending `finally` blocks --
   * confirmed empirically, not assumed -- so every assertion during the
   * destructive section throws a plain Error instead of calling fail()
   * directly; restoration always runs in an ordinary catch block BEFORE
   * fail() is ever invoked, so a failed proof can never leave the working
   * tree in a mutated state.
   */
  'photos-resized': async (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const scriptPath = join(toplevel, 'scripts', 'extract-mockup-photos.mjs');
    const mockupPath = join(toplevel, 'docs', 'reference', 'Oak-Homes-Website-SHARE.html');
    const pkgJsonPath = join(toplevel, 'package.json');
    const propertiesDir = join(toplevel, 'src', 'content', 'properties');
    const marengoFile = join(propertiesDir, '614-e-marengo-st.md');
    const brownFile = join(propertiesDir, '2734-brown-st.md');
    const marengoDir = join(toplevel, 'public', 'uploads', 'properties', '614-e-marengo-st');
    const brownDir = join(toplevel, 'public', 'uploads', 'properties', '2734-brown-st');
    const MAX_EDGE = 2000;
    const MAX_BYTES = 1048576;

    // -- 1. Script source assertions: box constraint + pre-write guard ---

    let scriptSrc;
    try {
      scriptSrc = readUtf8File(scriptPath);
    } catch {
      fail(id, `missing ${scriptPath}`);
    }
    if (!scriptSrc.includes(`width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true`)) {
      fail(id, `${scriptPath} does not contain the literal box-constraint option set (width:2000, height:2000, fit:'inside', withoutEnlargement:true)`);
    }
    const throwIdx = scriptSrc.indexOf('Math.max(width, height) >');
    if (throwIdx === -1) {
      fail(id, `${scriptPath} does not contain a 'Math.max(width, height) >' threshold guard`);
    }
    const phase2Idx = scriptSrc.indexOf('// -- Phase 2:');
    if (phase2Idx === -1) {
      fail(id, `${scriptPath} does not mark a distinct '// -- Phase 2:' section`);
    }
    if (throwIdx > phase2Idx) {
      fail(id, `${scriptPath}'s threshold guard (index ${throwIdx}) appears after the Phase 2 marker (index ${phase2Idx}) -- it must validate before any write`);
    }
    const writeCallRegex = /\b(mkdirSync|writeFileSync)\s*\(|\.toFile\s*\(/g;
    let wcMatch;
    while ((wcMatch = writeCallRegex.exec(scriptSrc)) !== null) {
      if (wcMatch.index < phase2Idx) {
        fail(id, `${scriptPath} calls '${wcMatch[0]}' at index ${wcMatch.index}, before the Phase 2 marker (index ${phase2Idx}) -- Phase 1 must perform zero filesystem writes`);
      }
    }

    // -- 2. package.json registers extract:photos -------------------------

    let pkg;
    try {
      pkg = JSON.parse(readUtf8File(pkgJsonPath));
    } catch (e) {
      fail(id, `could not parse package.json: ${e}`);
    }
    if (!pkg.scripts || pkg.scripts['extract:photos'] === undefined) {
      fail(id, `package.json scripts is missing 'extract:photos'`);
    }

    // -- 3. Independently re-derive expected source photos from the mockup

    const mockup = readUtf8File(mockupPath);
    function extractPhotosForAddress(address) {
      const marker = `address:"${address}"`;
      const aIdx = mockup.indexOf(marker);
      if (aIdx === -1) fail(id, `could not find '${marker}' in ${mockupPath}`);
      const pIdx = mockup.indexOf('photos:[', aIdx);
      if (pIdx === -1) fail(id, `could not find 'photos:[' after '${marker}'`);
      const start = pIdx + 'photos:['.length;
      const end = mockup.indexOf(']', start);
      const slice = mockup.slice(start, end);
      return [...slice.matchAll(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g)].map((m) => m[1]);
    }
    const marengoSourcePhotos = extractPhotosForAddress('614 E Marengo St');
    const brownSourcePhotos = extractPhotosForAddress('2734 Brown Street');
    if (marengoSourcePhotos.length !== 6) {
      fail(id, `mockup independently parses to ${marengoSourcePhotos.length} Marengo photos, expected exactly 6`);
    }
    if (brownSourcePhotos.length !== 5) {
      fail(id, `mockup independently parses to ${brownSourcePhotos.length} Brown Street photos, expected exactly 5`);
    }

    // -- helpers used by the destructive proofs below ---------------------

    function hashFile(path) {
      return createHash('sha256').update(readFileSync(path)).digest('hex');
    }
    function snapshotDir(dir) {
      if (!existsSync(dir)) return {};
      const out = {};
      for (const f of listDir(dir)) {
        out[f] = hashFile(join(dir, f));
      }
      return out;
    }
    function snapshotsEqual(a, b) {
      const aKeys = Object.keys(a).sort();
      const bKeys = Object.keys(b).sort();
      if (aKeys.length !== bKeys.length) return false;
      for (let i = 0; i < aKeys.length; i += 1) {
        if (aKeys[i] !== bKeys[i] || a[aKeys[i]] !== b[bKeys[i]]) return false;
      }
      return true;
    }
    function runExtractScript(envOverrides) {
      const result = spawnSync('node', ['scripts/extract-mockup-photos.mjs'], {
        cwd: toplevel,
        encoding: 'utf8',
        timeout: 60000,
        env: { ...process.env, ...envOverrides },
      });
      return result;
    }
    function assertNoTmpFiles() {
      const base = join(toplevel, 'public', 'uploads', 'properties');
      if (!existsSync(base)) return;
      const tmpFiles = walkFiles(base).filter((p) => p.endsWith('.tmp'));
      if (tmpFiles.length > 0) {
        throw new Error(`found leftover .tmp files after a failed extraction run: ${tmpFiles.join(', ')}`);
      }
    }

    // -- 4. Real, committed photos as the known-good baseline -------------

    const goodMarengoSnapshot = snapshotDir(marengoDir);
    const goodBrownSnapshot = snapshotDir(brownDir);
    if (Object.keys(goodMarengoSnapshot).length !== 6) {
      fail(id, `${marengoDir} has ${Object.keys(goodMarengoSnapshot).length} files before the destructive proofs even start, expected exactly 6`);
    }
    if (Object.keys(goodBrownSnapshot).length !== 5) {
      fail(id, `${brownDir} has ${Object.keys(goodBrownSnapshot).length} files before the destructive proofs even start, expected exactly 5`);
    }

    // -- 5 & 6. Destructive proofs. Every assertion in this block throws a
    // plain Error rather than calling fail() -- restoration below always
    // runs in a normal catch block first, so a failed proof can never exit
    // the process while the working tree is left mutated.

    let destructiveFailure = null;
    try {
      // -- 5. Threshold-lowering proves the pre-write guard actually fires.
      // At 200px every real photo exceeds the ceiling, so photo-01 throws
      // first and nothing should be written -- directories stay exactly as
      // the good baseline found them.
      const thresholdResult = runExtractScript({ OAK_MAX_EDGE_PX: '200' });
      if (thresholdResult.status === 0) {
        throw new Error(`extraction script exited 0 with OAK_MAX_EDGE_PX=200 -- the pre-write threshold guard did not fire`);
      }
      if (!snapshotsEqual(snapshotDir(marengoDir), goodMarengoSnapshot)) {
        throw new Error(`${marengoDir} changed after the threshold-200 failed run -- the guard let a write through`);
      }
      if (!snapshotsEqual(snapshotDir(brownDir), goodBrownSnapshot)) {
        throw new Error(`${brownDir} changed after the threshold-200 failed run -- the guard let a write through`);
      }
      assertNoTmpFiles();

      // -- 6. Forced middle-photo failure proves atomicity: emptying both
      // output directories, forcing only Marengo photo-03 (global index 2)
      // to fail, must leave the directories exactly as emptied -- zero .jpg
      // and zero .tmp -- not a prefix of the correct output.
      rmSync(marengoDir, { recursive: true, force: true });
      rmSync(brownDir, { recursive: true, force: true });

      const forcedFailResult = runExtractScript({ OAK_FORCE_FAIL_INDEX: '2' });
      if (forcedFailResult.status === 0) {
        throw new Error(`extraction script exited 0 with OAK_FORCE_FAIL_INDEX=2 -- the forced middle-photo failure did not propagate`);
      }
      const emptyMarengoSnapshot = snapshotDir(marengoDir);
      const emptyBrownSnapshot = snapshotDir(brownDir);
      if (Object.keys(emptyMarengoSnapshot).length !== 0) {
        throw new Error(`${marengoDir} contains ${Object.keys(emptyMarengoSnapshot).length} file(s) after the forced middle-photo failure, expected 0 (photo-01/02 must not survive)`);
      }
      if (Object.keys(emptyBrownSnapshot).length !== 0) {
        throw new Error(`${brownDir} contains ${Object.keys(emptyBrownSnapshot).length} file(s) after the forced middle-photo failure, expected 0`);
      }
      assertNoTmpFiles();
    } catch (err) {
      destructiveFailure = err;
    }

    // -- Restoration: unconditional, plain sequential code -- runs whether
    // or not the destructive proofs above threw, and BEFORE any fail() call.
    const restoreResult = runExtractScript({});
    const restoredMarengoSnapshot = snapshotDir(marengoDir);
    const restoredBrownSnapshot = snapshotDir(brownDir);

    if (destructiveFailure) {
      fail(id, destructiveFailure.message);
    }
    if (restoreResult.status !== 0) {
      fail(id, `restoration run (no env overrides) exited ${restoreResult.status} after the destructive proofs -- output directories may be incomplete:\n${(restoreResult.stdout || '').slice(-1000)}\n${(restoreResult.stderr || '').slice(-1000)}`);
    }
    if (!snapshotsEqual(restoredMarengoSnapshot, goodMarengoSnapshot)) {
      fail(id, `${marengoDir} did not restore to its pre-test byte-identical state after the destructive proofs -- re-running is not idempotent`);
    }
    if (!snapshotsEqual(restoredBrownSnapshot, goodBrownSnapshot)) {
      fail(id, `${brownDir} did not restore to its pre-test byte-identical state after the destructive proofs -- re-running is not idempotent`);
    }

    // -- 7. Independent dimension / upscale / aspect-ratio / size proofs --
    // against the now-restored, known-good output.

    async function validateOutputDir(dir, sourcePhotos) {
      const jpgFiles = listDir(dir).filter((f) => f.endsWith('.jpg')).sort();
      for (let i = 0; i < jpgFiles.length; i += 1) {
        const filePath = join(dir, jpgFiles[i]);
        const bytes = statSync(filePath).size;
        if (bytes > MAX_BYTES) {
          fail(id, `${filePath} is ${bytes} bytes, exceeds the ${MAX_BYTES}-byte budget`);
        }
        const outMeta = await sharp(filePath).metadata();
        const longestEdge = Math.max(outMeta.width, outMeta.height);
        if (longestEdge > MAX_EDGE) {
          fail(id, `${filePath} longest edge ${longestEdge}px exceeds the ${MAX_EDGE}px ceiling`);
        }
        const sourceBuffer = Buffer.from(sourcePhotos[i], 'base64');
        const srcMeta = await sharp(sourceBuffer).metadata();
        if (outMeta.width > srcMeta.width || outMeta.height > srcMeta.height) {
          fail(id, `${filePath} (${outMeta.width}x${outMeta.height}) exceeds its source (${srcMeta.width}x${srcMeta.height}) -- upscaled`);
        }
        const srcRatio = srcMeta.width / srcMeta.height;
        const outRatio = outMeta.width / outMeta.height;
        if (Math.abs(outRatio - srcRatio) * outMeta.height >= 1) {
          fail(id, `${filePath} aspect ratio drifted from its source beyond the 1px tolerance`);
        }
      }
    }
    await validateOutputDir(marengoDir, marengoSourcePhotos);
    await validateOutputDir(brownDir, brownSourcePhotos);

    // -- 8. Content file assertions -----------------------------------------

    if (!existsSync(brownFile)) {
      fail(id, `missing ${brownFile}`);
    }
    const brownContent = readUtf8File(brownFile);
    const marengoContent = readUtf8File(marengoFile);

    if (!brownContent.includes('2734 Brown Street')) {
      fail(id, `${brownFile} does not contain '2734 Brown Street'`);
    }

    function countLineExact(text, line) {
      return text.split(/\r\n|\n/).filter((l) => l.trim() === line).length;
    }
    if (countLineExact(brownContent, 'downPayment: 3000') !== 1) {
      fail(id, `${brownFile} does not contain exactly one 'downPayment: 3000' line`);
    }
    if (countLineExact(brownContent, 'monthlyPayment: 1250') !== 1) {
      fail(id, `${brownFile} does not contain exactly one 'monthlyPayment: 1250' line`);
    }
    if (countLineExact(brownContent, 'beds: 4') !== 1) {
      fail(id, `${brownFile} does not set 'beds: 4'`);
    }
    if (countLineExact(brownContent, 'baths: 1') !== 1) {
      fail(id, `${brownFile} does not set 'baths: 1'`);
    }
    if (/^sqft:/m.test(brownContent)) {
      fail(id, `${brownFile} sets 'sqft' -- square footage is unknown for Brown Street and must be left unset`);
    }
    if (/^location:/m.test(brownContent)) {
      fail(id, `${brownFile} sets 'location' -- D-16 requires it stay unset in this phase`);
    }

    for (const field of ['beds', 'baths', 'sqft']) {
      if (new RegExp(`^${field}:`, 'm').test(marengoContent)) {
        fail(id, `${marengoFile} sets '${field}' -- Marengo supplies no beds/baths/sqft and all three must stay unset`);
      }
    }
    if (/^location:/m.test(marengoContent)) {
      fail(id, `${marengoFile} sets 'location' -- D-16 requires it stay unset in this phase`);
    }

    // Filename stem <-> frontmatter slug binding.
    const brownSlugMatch = brownContent.match(/^slug:\s*"([^"]+)"/m);
    if (!brownSlugMatch || brownSlugMatch[1] !== '2734-brown-st') {
      fail(id, `${brownFile}'s frontmatter slug does not equal its filename stem '2734-brown-st'`);
    }
    const marengoSlugMatch = marengoContent.match(/^slug:\s*"([^"]+)"/m);
    if (!marengoSlugMatch || marengoSlugMatch[1] !== '614-e-marengo-st') {
      fail(id, `${marengoFile}'s frontmatter slug does not equal its filename stem '614-e-marengo-st'`);
    }

    // -- 9. Build succeeds with both real entries --------------------------

    clearAstroCache(toplevel);
    const build = runBuild(toplevel);
    if (build.timedOut) {
      fail(id, `npm run build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
    }

    pass(id);
  },

  /**
   * Task 2: the Browse Homes grid. Every mutation below restores its content
   * file(s) immediately after the build that consumes it and BEFORE any
   * fail() call, following the pattern established by skeleton-e2e and
   * photos-resized -- fail() calls process.exit() directly, which does not
   * run pending `finally` blocks, so restoration can never depend on one.
   */
  'homes-grid': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const distIndexPath = join(toplevel, 'dist', 'homes', 'index.html');
    const propertiesDir = join(toplevel, 'src', 'content', 'properties');
    const marengoFile = join(propertiesDir, '614-e-marengo-st.md');
    const brownFile = join(propertiesDir, '2734-brown-st.md');

    const equalHousingSentence =
      'Equal Housing Opportunity. Owner financing is subject to a written agreement; this is not a commitment to lend or an offer of credit.';

    const originalMarengo = readUtf8File(marengoFile);
    const originalBrown = readUtf8File(brownFile);

    /** Ordered sequence of card identifiers, in DOM order, from built HTML. */
    function extractSlugSequence(html) {
      const re = /data-property-slug="([^"]+)"/g;
      const seq = [];
      let m;
      while ((m = re.exec(html)) !== null) seq.push(m[1]);
      return seq;
    }

    function assertNonEmptyAlts(html, label) {
      const contentWithoutComments = html.replace(/<!--[^]*?-->/g, '');
      const imgTagRegex = /<img\b[^>]*>/g;
      let imgMatch;
      while ((imgMatch = imgTagRegex.exec(contentWithoutComments)) !== null) {
        const tag = imgMatch[0];
        const altMatch = tag.match(/\balt="([^"]*)"/);
        const hasBareAlt = /\balt(?=[\s>])/.test(tag) && !altMatch;
        const hasNonEmptyAlt = altMatch && altMatch[1].length > 0;
        const hasAriaHiddenTrue = tag.includes('aria-hidden="true"');
        if (!hasNonEmptyAlt && !(hasBareAlt && hasAriaHiddenTrue) && !(altMatch && altMatch[1] === '' && hasAriaHiddenTrue)) {
          fail(id, `${label} has an <img> with neither a non-empty alt nor an empty-alt+aria-hidden="true" pairing: ${tag}`);
        }
      }
    }

    // -- 1. Baseline build --------------------------------------------------

    clearAstroCache(toplevel);
    let build = runBuild(toplevel);
    if (build.timedOut) {
      fail(id, `baseline npm run build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `baseline npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
    }
    if (!existsSync(distIndexPath)) {
      fail(id, `missing ${distIndexPath} after a successful baseline build`);
    }

    let html = readUtf8File(distIndexPath);

    if (!html.includes('614 E Marengo St')) {
      fail(id, `${distIndexPath} does not contain '614 E Marengo St'`);
    }
    if (!html.includes('2734 Brown Street')) {
      fail(id, `${distIndexPath} does not contain '2734 Brown Street'`);
    }
    for (const currency of ['$3,000', '$950', '$1,250']) {
      if (!html.includes(currency)) {
        fail(id, `${distIndexPath} does not contain the currency figure '${currency}'`);
      }
    }
    const callForDetailsCount = countOccurrences(html, 'Call for details');
    if (callForDetailsCount < 3) {
      fail(id, `${distIndexPath} contains ${callForDetailsCount} occurrences of 'Call for details', expected at least 3 (Marengo's three absent specs)`);
    }
    if (!html.includes('4 bed')) {
      fail(id, `${distIndexPath} does not show Brown Street's 4 beds as a value`);
    }
    if (!html.includes('1 bath')) {
      fail(id, `${distIndexPath} does not show Brown Street's 1 bath as a value`);
    }

    const baselineSeq = extractSlugSequence(html);
    if (baselineSeq.length !== 2) {
      fail(id, `${distIndexPath} contains ${baselineSeq.length} card identifiers in the baseline build, expected exactly 2`);
    }

    assertNonEmptyAlts(html, distIndexPath);

    if (countOccurrences(html, equalHousingSentence) !== 1) {
      fail(id, `${distIndexPath} does not contain exactly 1 occurrence of the Equal Housing sentence`);
    }
    if (!html.includes('(217) 269-0003')) {
      fail(id, `${distIndexPath} does not contain the header phone number`);
    }

    // -- 2. Sort-order flip: Marengo -> Sold ---------------------------------

    writeFileSync(marengoFile, originalMarengo.replace('status: "Available"', 'status: "Sold"'), 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    writeFileSync(marengoFile, originalMarengo, 'utf8');
    if (build.timedOut) {
      fail(id, `sold-status build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `sold-status build exited ${build.status}, expected 0`);
    }
    const soldHtml = readUtf8File(distIndexPath);
    const soldSeq = extractSlugSequence(soldHtml);
    const brownIdxInSold = soldSeq.indexOf('2734-brown-st');
    const marengoIdxInSold = soldSeq.indexOf('614-e-marengo-st');
    if (brownIdxInSold === -1 || marengoIdxInSold === -1) {
      fail(id, `sold-status build's card sequence is missing an expected slug: ${JSON.stringify(soldSeq)}`);
    }
    if (!(brownIdxInSold < marengoIdxInSold)) {
      fail(id, `after setting Marengo to Sold, its card (position ${marengoIdxInSold}) does not sort after Brown Street's (position ${brownIdxInSold})`);
    }

    // Revert build, confirm the original card sequence returns.
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `post-revert rebuild exited ${build.status}, expected 0`);
    }
    const revertedSeq = extractSlugSequence(readUtf8File(distIndexPath));
    if (JSON.stringify(revertedSeq) !== JSON.stringify(baselineSeq)) {
      fail(id, `card sequence after reverting Marengo's status is ${JSON.stringify(revertedSeq)}, expected the original baseline order ${JSON.stringify(baselineSeq)}`);
    }

    // -- 3. Tiebreak determinism: two consecutive unmodified builds ---------

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `first determinism-check build exited ${build.status}, expected 0`);
    }
    const seqA = extractSlugSequence(readUtf8File(distIndexPath));

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `second determinism-check build exited ${build.status}, expected 0`);
    }
    const seqB = extractSlugSequence(readUtf8File(distIndexPath));

    if (JSON.stringify(seqA) !== JSON.stringify(seqB)) {
      fail(id, `two consecutive builds produced different card-identifier sequences: ${JSON.stringify(seqA)} vs ${JSON.stringify(seqB)} -- the publishDate-then-slug tiebreak is not deterministic`);
    }

    // -- 4. All three badge variants -----------------------------------------

    writeFileSync(marengoFile, originalMarengo.replace('status: "Available"', 'status: "Pending"'), 'utf8');
    writeFileSync(brownFile, originalBrown.replace('status: "Available"', 'status: "Sold"'), 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    writeFileSync(marengoFile, originalMarengo, 'utf8');
    writeFileSync(brownFile, originalBrown, 'utf8');
    if (build.timedOut) {
      fail(id, `badge-variant build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `badge-variant build exited ${build.status}, expected 0`);
    }
    const badgeHtml = readUtf8File(distIndexPath);
    // "Available" is asserted via the always-present "Available Homes"
    // section heading, since both entries were deliberately moved away from
    // Available for this proof -- Pending and Sold are asserted via their
    // badge class + label pairing.
    if (!badgeHtml.includes('Available Homes')) {
      fail(id, `badge-variant build's page does not contain 'Available Homes'`);
    }
    if (!/class="status-badge status-pending[^"]*"[^<]*>Pending</.test(badgeHtml)) {
      fail(id, `badge-variant build's page does not render a Pending badge with label 'Pending'`);
    }
    if (!/class="status-badge status-sold[^"]*"[^<]*>Sold</.test(badgeHtml)) {
      fail(id, `badge-variant build's page does not render a Sold badge with label 'Sold'`);
    }
    // Sold reads as a stamp: ink fill, cream text -- asserted against the
    // built CSS rule rather than a resolved hex literal, since Tailwind v4's
    // Lightning CSS minifier leaves var(--color-*) references intact here
    // rather than inlining them (unlike the raw hex values in global.css).
    const soldRuleMatch = badgeHtml.match(/\.status-sold\[data-astro-cid-[a-z0-9]+\]\{[^}]*\}/);
    if (!soldRuleMatch || !soldRuleMatch[0].includes('background-color:var(--color-ink)') || !soldRuleMatch[0].includes('color:var(--color-cream)')) {
      fail(id, `badge-variant build's .status-sold rule is not 'background-color:var(--color-ink);color:var(--color-cream)': ${soldRuleMatch ? soldRuleMatch[0] : '(no match)'}`);
    }

    // Rebuild clean so subsequent steps observe the real, un-mutated data.
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `rebuild after badge-variant revert exited ${build.status}, expected 0`);
    }

    // -- 5. Empty state -------------------------------------------------------

    const marengoMoved = `${marengoFile}.bak`;
    const brownMoved = `${brownFile}.bak`;
    renameSync(marengoFile, marengoMoved);
    renameSync(brownFile, brownMoved);
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    renameSync(marengoMoved, marengoFile);
    renameSync(brownMoved, brownFile);
    if (build.timedOut) {
      fail(id, `empty-collection build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `empty-collection build exited ${build.status}, expected 0 -- a properties collection with zero entries must still build`);
    }
    const emptyHtml = readUtf8File(distIndexPath);
    if (!emptyHtml.includes('No Homes Available Right Now')) {
      fail(id, `empty-collection build's page does not contain 'No Homes Available Right Now'`);
    }
    if (!emptyHtml.includes('(217) 269-0003')) {
      fail(id, `empty-collection build's page does not contain the phone number`);
    }

    // -- 6. Final rebuild -- leave the tree in a known-good built state -----

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `final rebuild after all mutation round-trips exited ${build.status}, expected 0`);
    }

    pass(id);
  },

  /**
   * Task 3: the property page -- gallery, lightbox wiring, specs, and the
   * status-aware CTA. Same restore-before-fail discipline as homes-grid:
   * fail() calls process.exit() directly, so every mutation is reverted
   * immediately after the build that consumes it, before any assertion that
   * could call fail() runs.
   */
  'property-page': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const propertiesDir = join(toplevel, 'src', 'content', 'properties');
    const marengoFile = join(propertiesDir, '614-e-marengo-st.md');
    const brownFile = join(propertiesDir, '2734-brown-st.md');
    const marengoPagePath = join(toplevel, 'dist', 'homes', '614-e-marengo-st', 'index.html');
    const brownPagePath = join(toplevel, 'dist', 'homes', '2734-brown-st', 'index.html');

    const originalMarengo = readUtf8File(marengoFile);
    const originalBrown = readUtf8File(brownFile);

    function assertNonEmptyAltsWithDims(html, label) {
      const contentWithoutComments = html.replace(/<!--[^]*?-->/g, '');
      const imgTagRegex = /<img\b[^>]*>/g;
      let imgMatch;
      while ((imgMatch = imgTagRegex.exec(contentWithoutComments)) !== null) {
        const tag = imgMatch[0];
        const altMatch = tag.match(/\balt="([^"]*)"/);
        const hasBareAlt = /\balt(?=[\s>])/.test(tag) && !altMatch;
        const hasNonEmptyAlt = altMatch && altMatch[1].length > 0;
        const hasAriaHiddenTrue = tag.includes('aria-hidden="true"');
        if (!hasNonEmptyAlt && !(hasBareAlt && hasAriaHiddenTrue) && !(altMatch && altMatch[1] === '' && hasAriaHiddenTrue)) {
          fail(id, `${label} has an <img> with neither a non-empty alt nor an empty-alt+aria-hidden="true" pairing: ${tag}`);
        }
        if (!/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)) {
          fail(id, `${label} has an <img> missing an explicit numeric width/height: ${tag}`);
        }
      }
    }

    // -- 1. Baseline build ---------------------------------------------------

    clearAstroCache(toplevel);
    let build = runBuild(toplevel);
    if (build.timedOut) {
      fail(id, `baseline npm run build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `baseline npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
    }
    if (!existsSync(marengoPagePath)) {
      fail(id, `missing ${marengoPagePath}`);
    }
    if (!existsSync(brownPagePath)) {
      fail(id, `missing ${brownPagePath}`);
    }

    let marengoHtml = readUtf8File(marengoPagePath);
    let brownHtml = readUtf8File(brownPagePath);

    // -- 2. Gallery image counts and cover-first ordering --------------------

    function photoRefs(html, slug) {
      const re = new RegExp(`/uploads/properties/${slug}/photo-(\\d+)\\.jpg`, 'g');
      const seen = new Set();
      let m;
      while ((m = re.exec(html)) !== null) seen.add(m[1]);
      return [...seen].sort();
    }

    const marengoRefs = photoRefs(marengoHtml, '614-e-marengo-st');
    if (marengoRefs.length !== 6) {
      fail(id, `${marengoPagePath} references ${marengoRefs.length} distinct Marengo photos, expected exactly 6`);
    }
    const brownRefs = photoRefs(brownHtml, '2734-brown-st');
    if (brownRefs.length !== 5) {
      fail(id, `${brownPagePath} references ${brownRefs.length} distinct Brown Street photos, expected exactly 5`);
    }

    const marengoFirstAny = marengoHtml.indexOf('/uploads/properties/614-e-marengo-st/photo-');
    const marengoFirstCover = marengoHtml.indexOf('/uploads/properties/614-e-marengo-st/photo-01.jpg');
    if (marengoFirstCover === -1 || marengoFirstCover !== marengoFirstAny) {
      fail(id, `${marengoPagePath}'s first referenced photo is not photo-01.jpg (cover must be the first array entry, PROP-01)`);
    }
    const brownFirstAny = brownHtml.indexOf('/uploads/properties/2734-brown-st/photo-');
    const brownFirstCover = brownHtml.indexOf('/uploads/properties/2734-brown-st/photo-01.jpg');
    if (brownFirstCover === -1 || brownFirstCover !== brownFirstAny) {
      fail(id, `${brownPagePath}'s first referenced photo is not photo-01.jpg`);
    }

    assertNonEmptyAltsWithDims(marengoHtml, marengoPagePath);
    assertNonEmptyAltsWithDims(brownHtml, brownPagePath);

    // -- 3. Terms, description, and feature bullets ---------------------------

    for (const currency of ['$3,000', '$950']) {
      if (!marengoHtml.includes(currency)) {
        fail(id, `${marengoPagePath} does not contain '${currency}'`);
      }
    }
    for (const currency of ['$3,000', '$1,250']) {
      if (!brownHtml.includes(currency)) {
        fail(id, `${brownPagePath} does not contain '${currency}'`);
      }
    }
    if (!marengoHtml.includes('This home could be a great fit')) {
      fail(id, `${marengoPagePath} does not contain its description text`);
    }
    if (!brownHtml.includes('This home offers plenty of space')) {
      fail(id, `${brownPagePath} does not contain its description text`);
    }
    for (const bullet of ['Bonus room', 'Central air', 'Full basement', 'Detached garage', 'Spacious living', 'Covered front porch']) {
      if (!marengoHtml.includes(bullet)) {
        fail(id, `${marengoPagePath} is missing feature bullet '${bullet}'`);
      }
    }
    for (const bullet of ['Updated kitchen', 'Wood laminate flooring', 'Vinyl windows and siding', 'Updated roof', 'laundry in unit', 'Detached two-car garage']) {
      if (!brownHtml.includes(bullet)) {
        fail(id, `${brownPagePath} is missing feature bullet '${bullet}'`);
      }
    }

    const marengoCallForDetails = countOccurrences(marengoHtml, 'Call for details');
    if (marengoCallForDetails !== 3) {
      fail(id, `${marengoPagePath} contains ${marengoCallForDetails} occurrences of 'Call for details', expected exactly 3`);
    }
    const brownCallForDetails = countOccurrences(brownHtml, 'Call for details');
    if (brownCallForDetails !== 1) {
      fail(id, `${brownPagePath} contains ${brownCallForDetails} occurrences of 'Call for details', expected exactly 1 (square footage only)`);
    }

    // -- 4. Inquire CTA on both baseline (Available) pages --------------------

    for (const [html, path, slug] of [
      [marengoHtml, marengoPagePath, '614-e-marengo-st'],
      [brownHtml, brownPagePath, '2734-brown-st'],
    ]) {
      if (!html.includes('Inquire About This Home')) {
        fail(id, `${path} does not contain 'Inquire About This Home'`);
      }
      if (!html.includes(`/contact?property=${slug}`)) {
        fail(id, `${path} does not contain an href referencing '/contact?property=${slug}'`);
      }
    }

    // -- 5. Lazy-hydration marker + exactly the two client-side islands -------
    //
    // SKELETON.md names two islands: the gallery lightbox and the mobile nav
    // drawer toggle. As of 01-05 Task 1 the drawer toggle is a real <button>
    // driven by a script (trap Tab, close on Escape, return focus) rather
    // than the checkbox+label CSS-only hack it started as -- that hack had
    // no script tag at all, which this assertion used to encode as "exactly
    // 1". Two script tags is now the correct count for every page: Nav.astro
    // (rendered by every page via Layout.astro) plus Gallery.astro (rendered
    // only on property pages).

    for (const [html, path] of [
      [marengoHtml, marengoPagePath],
      [brownHtml, brownPagePath],
    ]) {
      if (!html.includes('data-hydrate="client:visible"')) {
        fail(id, `${path} does not carry the data-hydrate="client:visible" marker on the gallery`);
      }
      const scriptCount = countOccurrences(html, '<script');
      if (scriptCount !== 2) {
        fail(id, `${path} contains ${scriptCount} <script tags, expected exactly 2 (the nav drawer toggle and the gallery lightbox -- SKELETON.md's two client-side islands)`);
      }
    }

    // -- 6. Sold path: Marengo -> Sold ----------------------------------------

    writeFileSync(marengoFile, originalMarengo.replace('status: "Available"', 'status: "Sold"'), 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    writeFileSync(marengoFile, originalMarengo, 'utf8');
    if (build.timedOut) {
      fail(id, `sold-status build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `sold-status build exited ${build.status}, expected 0`);
    }
    const soldHtml = readUtf8File(marengoPagePath);
    if (!soldHtml.includes('See Available Homes')) {
      fail(id, `sold-status page does not contain 'See Available Homes'`);
    }
    if (!/href="\/homes"[^>]*>\s*See Available Homes/.test(soldHtml) && !soldHtml.includes('href="/homes"')) {
      fail(id, `sold-status page's 'See Available Homes' control does not link to '/homes'`);
    }
    if (soldHtml.includes('Inquire About This Home')) {
      fail(id, `sold-status page still contains 'Inquire About This Home' -- D-09 requires it be replaced entirely, not merely disabled`);
    }

    // Revert build, confirm Inquire returns.
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `post-sold-revert rebuild exited ${build.status}, expected 0`);
    }
    if (!readUtf8File(marengoPagePath).includes('Inquire About This Home')) {
      fail(id, `Marengo page does not contain 'Inquire About This Home' after reverting the Sold mutation`);
    }

    // -- 7. Pending path: Inquire stays active --------------------------------

    writeFileSync(marengoFile, originalMarengo.replace('status: "Available"', 'status: "Pending"'), 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    writeFileSync(marengoFile, originalMarengo, 'utf8');
    if (build.timedOut) {
      fail(id, `pending-status build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `pending-status build exited ${build.status}, expected 0`);
    }
    if (!readUtf8File(marengoPagePath).includes('Inquire About This Home')) {
      fail(id, `pending-status page does not contain 'Inquire About This Home' -- D-09 keeps it active on Pending`);
    }

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `post-pending-revert rebuild exited ${build.status}, expected 0`);
    }

    // -- 8. Zero-photo placeholder ---------------------------------------------

    writeFileSync(marengoFile, withPhotosField(originalMarengo, '[]', id), 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    writeFileSync(marengoFile, originalMarengo, 'utf8');
    if (build.timedOut) {
      fail(id, `zero-photo build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `zero-photo build exited ${build.status}, expected 0`);
    }
    const zeroPhotoHtml = readUtf8File(marengoPagePath);
    if (!zeroPhotoHtml.includes('gallery-placeholder')) {
      fail(id, `zero-photo page does not render the gallery-placeholder frame`);
    }
    const placeholderMatch = zeroPhotoHtml.match(/<div class="gallery-placeholder"[^]*?<\/div>/);
    if (!placeholderMatch || !placeholderMatch[0].includes('/brand/')) {
      fail(id, `zero-photo page's gallery-placeholder does not reference a brand asset`);
    }
    if (zeroPhotoHtml.includes('/uploads/properties/614-e-marengo-st/photo-')) {
      fail(id, `zero-photo page still references a Marengo photo path -- the empty-photos state must not leave a broken <img> pointing at a nonexistent file`);
    }

    // -- 9. Final rebuild -- leave the tree in a known-good built state -------

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `final rebuild after all mutation round-trips exited ${build.status}, expected 0`);
    }

    pass(id);
  },

  /**
   * 01-04 Task 1: the homepage -- settings-driven intro, exactly three
   * overview steps, and featured available homes with the D-07 never-empty
   * fallback. Same restore-before-fail discipline as the other content
   * checks in this file: every mutation is reverted immediately after the
   * build that consumes it, before any assertion that could call fail().
   */
  homepage: (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const distIndexPath = join(toplevel, 'dist', 'index.html');
    const propertiesDir = join(toplevel, 'src', 'content', 'properties');
    const marengoFile = join(propertiesDir, '614-e-marengo-st.md');
    const brownFile = join(propertiesDir, '2734-brown-st.md');
    const settingsPath = join(toplevel, 'src', 'content', 'settings.json');

    const equalHousingSentence =
      'Equal Housing Opportunity. Owner financing is subject to a written agreement; this is not a commitment to lend or an offer of credit.';

    const originalMarengo = readUtf8File(marengoFile);
    const originalBrown = readUtf8File(brownFile);
    const originalSettings = readUtf8File(settingsPath);

    function assertNonEmptyAlts(html, label) {
      const contentWithoutComments = html.replace(/<!--[^]*?-->/g, '');
      const imgTagRegex = /<img\b[^>]*>/g;
      let imgMatch;
      while ((imgMatch = imgTagRegex.exec(contentWithoutComments)) !== null) {
        const tag = imgMatch[0];
        const altMatch = tag.match(/\balt="([^"]*)"/);
        const hasBareAlt = /\balt(?=[\s>])/.test(tag) && !altMatch;
        const hasNonEmptyAlt = altMatch && altMatch[1].length > 0;
        const hasAriaHiddenTrue = tag.includes('aria-hidden="true"');
        if (!hasNonEmptyAlt && !(hasBareAlt && hasAriaHiddenTrue) && !(altMatch && altMatch[1] === '' && hasAriaHiddenTrue)) {
          fail(id, `${label} has an <img> with neither a non-empty alt nor an empty-alt+aria-hidden="true" pairing: ${tag}`);
        }
      }
    }

    // -- 1. Baseline build ---------------------------------------------------

    clearAstroCache(toplevel);
    let build = runBuild(toplevel);
    if (build.timedOut) {
      fail(id, `baseline npm run build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `baseline npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
    }
    if (!existsSync(distIndexPath)) {
      fail(id, `missing ${distIndexPath} after a successful baseline build`);
    }

    let html = readUtf8File(distIndexPath);

    // -- 2. homepageIntro is settings-driven, not hardcoded ------------------

    const settingsData = JSON.parse(originalSettings);
    const currentIntro = settingsData.main.homepageIntro;
    // {homepageIntro} is a JS expression, so Astro's escaper HTML-entity-encodes
    // it on output (e.g. the intro's apostrophe becomes &#39;) -- decode before
    // comparing, or a correct page reports a false mismatch.
    if (!decodeHtmlEntities(html).includes(currentIntro)) {
      fail(id, `${distIndexPath} does not contain the current homepageIntro value from settings.json`);
    }

    const marker = 'OAK-HOMEPAGE-INTRO-CHECK-MARKER';
    writeFileSync(settingsPath, originalSettings.replace(currentIntro, marker), 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    const markerHtml = existsSync(distIndexPath) ? readUtf8File(distIndexPath) : '';
    writeFileSync(settingsPath, originalSettings, 'utf8');
    if (build.timedOut) {
      fail(id, `homepageIntro-marker build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `homepageIntro-marker build exited ${build.status}, expected 0`);
    }
    if (!markerHtml.includes(marker)) {
      fail(id, `${distIndexPath} did not pick up a changed homepageIntro value -- the hero text is not settings-driven`);
    }
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `rebuild after reverting the homepageIntro marker exited ${build.status}, expected 0`);
    }
    html = readUtf8File(distIndexPath);

    // -- 3. Browse Homes CTA --------------------------------------------------

    if (!/<a[^>]*href="\/homes"[^>]*>\s*Browse Homes\s*</.test(html)) {
      fail(id, `${distIndexPath} does not contain a 'Browse Homes' call to action with href="/homes"`);
    }

    // -- 4. Exactly three overview steps --------------------------------------

    const stepCount = countOccurrences(html, 'class="step"');
    if (stepCount !== 3) {
      fail(id, `${distIndexPath} contains ${stepCount} occurrences of class="step", expected exactly 3`);
    }

    // -- 5. Featured section: current flags show Marengo, not Brown Street ---

    if (!html.includes('614 E Marengo St')) {
      fail(id, `${distIndexPath} does not contain '614 E Marengo St' in the featured section`);
    }
    if (html.includes('2734 Brown Street')) {
      fail(id, `${distIndexPath} contains '2734 Brown Street' -- it is not featured and no fallback should be active with Marengo featured`);
    }

    // -- 6. Layout invariants + alt text --------------------------------------

    if (countOccurrences(html, equalHousingSentence) !== 1) {
      fail(id, `${distIndexPath} does not contain exactly 1 occurrence of the Equal Housing sentence`);
    }
    if (!html.includes('(217) 269-0003')) {
      fail(id, `${distIndexPath} does not contain the header phone number`);
    }
    assertNonEmptyAlts(html, distIndexPath);

    // -- 7. D-07 fallback: clear Marengo's featured flag ----------------------

    writeFileSync(marengoFile, originalMarengo.replace('featured: true', 'featured: false'), 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    const fallbackHtml = existsSync(distIndexPath) ? readUtf8File(distIndexPath) : '';
    writeFileSync(marengoFile, originalMarengo, 'utf8');
    if (build.timedOut) {
      fail(id, `no-featured-flag build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `no-featured-flag build exited ${build.status}, expected 0`);
    }
    const fallbackCardCount = countOccurrences(fallbackHtml, 'data-property-slug');
    if (fallbackCardCount < 1) {
      fail(id, `no-featured-flag build's homepage renders 0 property cards -- the D-07 fallback did not activate`);
    }

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `rebuild after reverting the featured-flag mutation exited ${build.status}, expected 0`);
    }
    const revertedHtml = readUtf8File(distIndexPath);
    if (!revertedHtml.includes('614 E Marengo St') || revertedHtml.includes('2734 Brown Street')) {
      fail(id, `after reverting the featured-flag mutation, the homepage does not show the original single-featured-card state`);
    }

    // -- 8. Fallback excludes unavailable homes -------------------------------

    writeFileSync(marengoFile, originalMarengo.replace('featured: true', 'featured: false'), 'utf8');
    writeFileSync(brownFile, originalBrown.replace('status: "Available"', 'status: "Sold"'), 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    const excludeHtml = existsSync(distIndexPath) ? readUtf8File(distIndexPath) : '';
    writeFileSync(marengoFile, originalMarengo, 'utf8');
    writeFileSync(brownFile, originalBrown, 'utf8');
    if (build.timedOut) {
      fail(id, `unavailable-fallback build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `unavailable-fallback build exited ${build.status}, expected 0`);
    }
    if (!excludeHtml.includes('614 E Marengo St')) {
      fail(id, `unavailable-fallback build's homepage does not show the remaining Available home`);
    }
    if (excludeHtml.includes('2734 Brown Street')) {
      fail(id, `unavailable-fallback build's homepage shows the Sold home -- the fallback must exclude unavailable homes`);
    }

    // -- 9. Final rebuild -- leave the tree in a known-good built state -------

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `final rebuild after all mutation round-trips exited ${build.status}, expected 0`);
    }

    pass(id);
  },

  /**
   * 01-04 Task 2: How It Works (verbatim land-contract copy + FAQ), About,
   * Schedule, and the Contact shell. Carries the plan's single
   * highest-consequence assertion -- the bidirectional, normalisation-pipeline
   * transcription comparison (T-01-19) -- alongside the retired-phrasing
   * sweep (T-01-20) and the CMS-unreachability assertion (T-01-21).
   */
  'content-pages': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const onePagerPath = join(toplevel, 'docs', 'reference', 'Oak-Homes-How-It-Works.html');
    const howItWorksSrcPath = join(toplevel, 'src', 'pages', 'how-it-works.astro');
    const contactSrcPath = join(toplevel, 'src', 'pages', 'contact.astro');
    const distDir = join(toplevel, 'dist');
    const distHowItWorks = join(distDir, 'how-it-works', 'index.html');
    const distAbout = join(distDir, 'about', 'index.html');
    const distSchedule = join(distDir, 'schedule', 'index.html');
    const distContact = join(distDir, 'contact', 'index.html');
    const contentDir = join(toplevel, 'src', 'content');

    const equalHousingSentence =
      'Equal Housing Opportunity. Owner financing is subject to a written agreement; this is not a commitment to lend or an offer of credit.';
    const closingSentence =
      "The full terms — including what happens if payments aren't made — are set out in the written agreement.";

    const originalHowItWorksSrc = readUtf8File(howItWorksSrcPath);
    const onePagerHtml = readUtf8File(onePagerPath);

    function extractSourceLandContractParagraph(html) {
      const marker = 'What a land contract means';
      const headingIdx = html.indexOf(marker);
      if (headingIdx === -1) return null;
      const pStart = html.indexOf('<p>', headingIdx);
      const pEnd = html.indexOf('</p>', pStart);
      if (pStart === -1 || pEnd === -1) return null;
      return html.slice(pStart + '<p>'.length, pEnd);
    }

    function extractBuiltLandContractParagraph(html) {
      const re = /<p[^>]*data-copy="land-contract-meaning"[^>]*>([^]*?)<\/p>/;
      const m = html.match(re);
      return m ? m[1] : null;
    }

    // -- 1. Baseline build -----------------------------------------------------

    clearAstroCache(toplevel);
    let build = runBuild(toplevel);
    if (build.timedOut) {
      fail(id, `baseline npm run build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `baseline npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
    }
    for (const p of [distHowItWorks, distAbout, distSchedule, distContact]) {
      if (!existsSync(p)) {
        fail(id, `missing ${p} after a successful baseline build`);
      }
    }

    const howItWorksHtml = readUtf8File(distHowItWorks);
    const decodedHowItWorksHtml = decodeHtmlEntities(howItWorksHtml);

    // -- 2. Closing sentence + 'agreement for deed' -----------------------------

    if (!howItWorksHtml.includes(closingSentence)) {
      fail(id, `${distHowItWorks} does not contain the exact closing sentence about full terms / missed payments`);
    }
    if (!howItWorksHtml.includes('agreement for deed')) {
      fail(id, `${distHowItWorks} does not contain the phrase 'agreement for deed'`);
    }

    // -- 3. All four step headings + all three what-you'll-need items ----------

    for (const heading of ["Find a home & reach out", "Let's talk", 'Agree on terms', 'Move in and settle in']) {
      if (!decodedHowItWorksHtml.includes(heading)) {
        fail(id, `${distHowItWorks} (entity-decoded) does not contain the step heading '${heading}'`);
      }
    }
    for (const item of ['A down payment', 'Steady income', 'A commitment to long-term ownership']) {
      if (!decodedHowItWorksHtml.includes(item)) {
        fail(id, `${distHowItWorks} does not contain the what-you'll-need item '${item}'`);
      }
    }

    // -- 4. Mechanical, bidirectional transcription-fidelity comparison --------

    const sourceParagraph = extractSourceLandContractParagraph(onePagerHtml);
    if (!sourceParagraph) {
      fail(id, `could not extract the 'What a land contract means' paragraph from ${onePagerPath}`);
    }
    const builtParagraph = extractBuiltLandContractParagraph(howItWorksHtml);
    if (!builtParagraph) {
      fail(id, `could not extract the land-contract-meaning paragraph from ${distHowItWorks} (missing data-copy="land-contract-meaning" marker?)`);
    }
    const normalizedSource = normalizeForComparison(sourceParagraph);
    const normalizedBuilt = normalizeForComparison(builtParagraph);
    if (normalizedSource !== normalizedBuilt) {
      fail(
        id,
        `land-contract paragraph mismatch after normalisation.\nSOURCE: ${JSON.stringify(normalizedSource)}\nBUILT:  ${JSON.stringify(normalizedBuilt)}`,
      );
    }

    // Bidirectional proof: a deliberate one-word edit must make the
    // comparison fail, so a passing comparison has actually been shown to
    // compare something, not merely to always pass.
    const mutatedHowItWorksSrc = originalHowItWorksSrc.replace(
      'you take possession of the home and make',
      'you take possession of the residence and make',
    );
    if (mutatedHowItWorksSrc === originalHowItWorksSrc) {
      fail(id, `bidirectional-proof mutation did not change ${howItWorksSrcPath} -- the target phrase was not found`);
    }
    writeFileSync(howItWorksSrcPath, mutatedHowItWorksSrc, 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    const mutatedHtml = existsSync(distHowItWorks) ? readUtf8File(distHowItWorks) : '';
    writeFileSync(howItWorksSrcPath, originalHowItWorksSrc, 'utf8');
    if (build.timedOut) {
      fail(id, `bidirectional-proof build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `bidirectional-proof build exited ${build.status}, expected 0 (the page must still build with a wrong word, just fail the comparison)`);
    }
    const mutatedBuiltParagraph = extractBuiltLandContractParagraph(mutatedHtml);
    const normalizedMutated = mutatedBuiltParagraph ? normalizeForComparison(mutatedBuiltParagraph) : null;
    if (normalizedMutated === normalizedSource) {
      fail(id, `bidirectional proof failed: a one-word edit to the transcribed paragraph did NOT change the normalised comparison result -- the comparison is not actually comparing the paragraph text`);
    }

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `rebuild after reverting the bidirectional-proof mutation exited ${build.status}, expected 0`);
    }
    if (readUtf8File(howItWorksSrcPath) !== originalHowItWorksSrc) {
      fail(id, `${howItWorksSrcPath} did not revert to its original content after the bidirectional proof`);
    }

    // -- 5. Retired-phrasing sweep over the whole built site --------------------

    const htmlFiles = walkFiles(distDir).filter((p) => p.endsWith('.html'));
    for (const literal of ['equitable interest', 'honest terms', 'not a rental']) {
      for (const f of htmlFiles) {
        const lower = readUtf8File(f).toLowerCase();
        if (lower.includes(literal)) {
          fail(id, `${f} contains the retired phrasing '${literal}' (case-insensitive)`);
        }
      }
    }

    // -- 6. Legal copy is not CMS-reachable --------------------------------------

    const contentFiles = walkFiles(contentDir);
    for (const f of contentFiles) {
      let text;
      try {
        text = readUtf8File(f);
      } catch {
        continue;
      }
      if (text.includes('agreement for deed')) {
        fail(id, `${f} under src/content/ contains 'agreement for deed' -- legal copy must exist only in .astro files (DESIGN-03)`);
      }
    }

    // -- 7. FAQ: at least 3 questions, deed + missed-payment answers ------------

    if (!howItWorksHtml.includes('Frequently asked questions')) {
      fail(id, `${distHowItWorks} does not contain a 'Frequently asked questions' heading`);
    }
    const faqQuestionCount = countOccurrences(howItWorksHtml, '<dt');
    if (faqQuestionCount < 3) {
      fail(id, `${distHowItWorks} contains ${faqQuestionCount} FAQ questions (<dt> elements), expected at least 3`);
    }
    if (!decodedHowItWorksHtml.includes('Do I get the deed?')) {
      fail(id, `${distHowItWorks} does not contain the deed FAQ question`);
    }
    if (!decodedHowItWorksHtml.includes('What happens if I miss a payment?')) {
      fail(id, `${distHowItWorks} does not contain the missed-payment FAQ question`);
    }
    const writtenAgreementCount = countOccurrences(howItWorksHtml, 'written agreement');
    if (writtenAgreementCount < 3) {
      fail(id, `${distHowItWorks} contains ${writtenAgreementCount} occurrences of 'written agreement', expected at least 3 (the transcribed copy plus both FAQ answers)`);
    }

    // -- 8. Schedule page phone CTA ----------------------------------------------

    const scheduleHtml = readUtf8File(distSchedule);
    if (!scheduleHtml.includes('Call (217) 269-0003')) {
      fail(id, `${distSchedule} does not contain 'Call (217) 269-0003'`);
    }
    if (!scheduleHtml.includes('tel:+12172690003')) {
      fail(id, `${distSchedule} does not contain an href of 'tel:+12172690003'`);
    }

    // -- 9. Contact page: marked Zoho slot, no form, no external script ---------

    const contactSrc = readUtf8File(contactSrcPath);
    if (!contactSrc.includes('Zoho')) {
      fail(id, `${contactSrcPath} does not contain 'Zoho' -- the Phase 3 embed slot must be marked`);
    }
    const contactHtml = readUtf8File(distContact);
    if (/<form\b/i.test(contactHtml)) {
      fail(id, `${distContact} contains a <form> element -- the Zoho embed is Phase 3, not this plan`);
    }
    if (/<script\s+[^>]*\bsrc=/i.test(contactHtml)) {
      fail(id, `${distContact} contains an external <script src=...> tag -- the Zoho embed is Phase 3, not this plan`);
    }

    // -- 10. Every Inquire link's target resolves --------------------------------

    const distHomesDir = join(distDir, 'homes');
    const homesHtmlFiles = existsSync(distHomesDir) ? walkFiles(distHomesDir).filter((p) => p.endsWith('.html')) : [];
    let inquireLinksFound = 0;
    for (const f of homesHtmlFiles) {
      const content = readUtf8File(f);
      const re = /\/contact\?property=([a-z0-9-]+)/g;
      let m;
      while ((m = re.exec(content)) !== null) {
        inquireLinksFound += 1;
      }
    }
    if (inquireLinksFound === 0) {
      fail(id, `no '/contact?property=' Inquire links were found under ${distHomesDir} -- expected at least one`);
    }
    if (!existsSync(distContact)) {
      fail(id, `${distContact} does not exist -- every Inquire link target must resolve`);
    }

    // -- 11. All four pages render through the shared layout --------------------

    for (const p of [distHowItWorks, distAbout, distSchedule, distContact]) {
      const content = readUtf8File(p);
      const count = countOccurrences(content, equalHousingSentence);
      if (count !== 1) {
        fail(id, `${p} contains ${count} occurrences of the Equal Housing sentence, expected exactly 1`);
      }
    }

    pass(id);
  },

  /**
   * 01-04 Task 3: the Learn index and the seeded land-contract-basics post.
   * Same restore-before-fail discipline as the other content checks in this
   * file.
   */
  'learn-section': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const blogDir = join(toplevel, 'src', 'content', 'blog');
    const blogFile = join(blogDir, 'what-is-a-land-contract.md');
    const distLearnDir = join(toplevel, 'dist', 'learn');
    const distLearnIndex = join(distLearnDir, 'index.html');
    const distPost = join(distLearnDir, 'what-is-a-land-contract', 'index.html');

    const equalHousingSentence =
      'Equal Housing Opportunity. Owner financing is subject to a written agreement; this is not a commitment to lend or an offer of credit.';

    const originalBlogFile = readUtf8File(blogFile);

    function countGeneratedPostPages() {
      if (!existsSync(distLearnDir)) return 0;
      let count = 0;
      for (const name of readdirSync(distLearnDir, { withFileTypes: true })) {
        if (!name.isDirectory()) continue; // excludes dist/learn/index.html itself
        const candidate = join(distLearnDir, name.name, 'index.html');
        if (existsSync(candidate)) count += 1;
      }
      return count;
    }

    // -- 1. Baseline build ------------------------------------------------------

    clearAstroCache(toplevel);
    let build = runBuild(toplevel);
    if (build.timedOut) {
      fail(id, `baseline npm run build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `baseline npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
    }
    if (!existsSync(distLearnIndex)) {
      fail(id, `missing ${distLearnIndex} after a successful baseline build`);
    }
    if (!existsSync(distPost)) {
      fail(id, `missing ${distPost} after a successful baseline build`);
    }

    const indexHtml = readUtf8File(distLearnIndex);
    if (!indexHtml.includes('What Is a Land Contract?')) {
      fail(id, `${distLearnIndex} does not list the seeded post's title`);
    }
    if (!/post-date/.test(indexHtml) || !/\d{4}/.test(indexHtml)) {
      fail(id, `${distLearnIndex} does not show a date for the seeded post`);
    }

    // -- 2. Generated post-page count equals blog .md file count ---------------

    const mdFileCount = readdirSync(blogDir).filter((f) => f.endsWith('.md')).length;
    const generatedCount = countGeneratedPostPages();
    if (generatedCount !== mdFileCount) {
      fail(id, `dist/learn/*/index.html count is ${generatedCount}, expected ${mdFileCount} (one per src/content/blog/*.md file)`);
    }

    // -- 3. Post page: full prose, ownerReviewed banner, no truncation ----------

    const postHtml = readUtf8File(distPost);
    if (!postHtml.includes('Where to go from here')) {
      fail(id, `${distPost} does not render the full body prose (missing the closing section heading)`);
    }
    if (/-webkit-line-clamp|text-overflow:\s*ellipsis/i.test(postHtml)) {
      fail(id, `${distPost} applies line-clamp or ellipsis truncation CSS to the prose body -- no truncation is allowed`);
    }
    if (!/ownerReviewed:\s*false/.test(originalBlogFile)) {
      fail(id, `${blogFile} frontmatter does not set ownerReviewed: false`);
    }
    const lowerPost = postHtml.toLowerCase();
    if (!lowerPost.includes('general information') || !lowerPost.includes('not legal advice')) {
      fail(id, `${distPost} does not carry a visible note that the article is general information and not legal advice`);
    }

    // -- 4. No-cover-image path renders cleanly ----------------------------------
    //
    // Match the <img class="post-cover" ...> element specifically, not the
    // bare substring 'post-cover' -- the scoped <style> block always emits
    // the '.post-cover' CSS selector regardless of whether any element uses
    // it, so a substring search false-positives on every build.

    const postCoverImgRe = /<img[^>]*\bclass="post-cover"[^>]*>/;
    if (postCoverImgRe.test(postHtml)) {
      fail(id, `${distPost} renders a post-cover image element for a post with no coverImage -- expected no image slot at all`);
    }
    if (postCoverImgRe.test(indexHtml)) {
      fail(id, `${distLearnIndex} renders a post-cover image element for a post with no coverImage -- expected no image slot at all`);
    }

    // -- 5. With-cover-image path -------------------------------------------------

    const withCover = originalBlogFile.replace(
      'ownerReviewed: false',
      'ownerReviewed: false\ncoverImage: "/brand/mark-circle-256.png"',
    );
    if (withCover === originalBlogFile) {
      fail(id, `could not insert a coverImage field into ${blogFile} -- 'ownerReviewed: false' line not found`);
    }
    writeFileSync(blogFile, withCover, 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    const coverIndexHtml = existsSync(distLearnIndex) ? readUtf8File(distLearnIndex) : '';
    const coverPostHtml = existsSync(distPost) ? readUtf8File(distPost) : '';
    writeFileSync(blogFile, originalBlogFile, 'utf8');
    if (build.timedOut) {
      fail(id, `with-coverImage build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `with-coverImage build exited ${build.status}, expected 0`);
    }
    if (!/<img[^>]*class="post-cover"[^>]*src="\/brand\/mark-circle-256\.png"[^>]*alt="[^"]+"/.test(coverIndexHtml)) {
      fail(id, `with-coverImage build's Learn index does not render the cover image with a non-empty alt`);
    }
    if (!/<img[^>]*class="post-cover"[^>]*src="\/brand\/mark-circle-256\.png"[^>]*alt="[^"]+"/.test(coverPostHtml)) {
      fail(id, `with-coverImage build's post page does not render the cover image with a non-empty alt`);
    }
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `rebuild after reverting the coverImage fixture exited ${build.status}, expected 0`);
    }

    // -- 6. Slug validation holds -------------------------------------------------

    const invalidSlugContent = originalBlogFile.replace(
      'slug: "what-is-a-land-contract"',
      'slug: "What-Is-A-Land-Contract"',
    );
    if (invalidSlugContent === originalBlogFile) {
      fail(id, `could not locate the slug field in ${blogFile} to mutate`);
    }
    writeFileSync(blogFile, invalidSlugContent, 'utf8');
    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    writeFileSync(blogFile, originalBlogFile, 'utf8');
    if (build.timedOut) {
      fail(id, `invalid-slug build timed out`);
    }
    if (build.status === 0) {
      fail(id, `invalid-slug build exited 0 -- the slug regex did not fire on an uppercase value`);
    }

    // -- 7. Both pages render through the shared layout --------------------------

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `post-revert rebuild exited ${build.status}, expected 0`);
    }
    for (const p of [distLearnIndex, distPost]) {
      const content = readUtf8File(p);
      const count = countOccurrences(content, equalHousingSentence);
      if (count !== 1) {
        fail(id, `${p} contains ${count} occurrences of the Equal Housing sentence, expected exactly 1`);
      }
    }

    // -- 8. Retired-phrasing sweep scoped to dist/learn/ --------------------------

    const learnHtmlFiles = walkFiles(distLearnDir).filter((p) => p.endsWith('.html'));
    for (const literal of ['equitable interest', 'honest terms', 'not a rental']) {
      for (const f of learnHtmlFiles) {
        const lower = readUtf8File(f).toLowerCase();
        if (lower.includes(literal)) {
          fail(id, `${f} contains the retired phrasing '${literal}' (case-insensitive)`);
        }
      }
    }

    // -- 9. Filename stem equals frontmatter slug ---------------------------------

    const slugMatch = originalBlogFile.match(/^slug:\s*"([^"]+)"/m);
    if (!slugMatch || slugMatch[1] !== 'what-is-a-land-contract') {
      fail(id, `${blogFile}'s frontmatter slug does not equal its filename stem 'what-is-a-land-contract'`);
    }

    // -- 10. Final rebuild -- leave the tree in a known-good built state --------

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `final rebuild after all mutation round-trips exited ${build.status}, expected 0`);
    }

    pass(id);
  },

  /**
   * 01-05 Task 1: the whole-site WCAG 2.1 AA-basics sweep -- alt text,
   * landmarks, heading structure, encoding survival, the accent-never-text
   * rule, and status-as-text on the badges. This is the cross-cutting check
   * that only becomes meaningful once all ten pages exist together; the
   * per-plan checks above already prove their own page's content is
   * correct, this proves the site-wide *shape* every page shares.
   *
   * Genuinely visual assertions this check cannot make headlessly --
   * horizontal-scroll behaviour at 320/375/768/1280px, the 44px hit areas
   * as measured in devtools, and an actual keyboard walk-through -- are
   * NOT asserted here. They are the plan's <human-check> and are recorded
   * as deferred verification in 01-05-SUMMARY.md instead of being silently
   * skipped or falsely claimed as passing.
   */
  'a11y-sweep': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const distDir = join(toplevel, 'dist');
    const srcDir = join(toplevel, 'src');
    const propertiesDir = join(toplevel, 'src', 'content', 'properties');
    const marengoFile = join(propertiesDir, '614-e-marengo-st.md');
    const brownFile = join(propertiesDir, '2734-brown-st.md');
    const distHomesIndex = join(distDir, 'homes', 'index.html');
    const distHowItWorks = join(distDir, 'how-it-works', 'index.html');
    const onePagerPath = join(toplevel, 'docs', 'reference', 'Oak-Homes-How-It-Works.html');

    const originalMarengo = readUtf8File(marengoFile);
    const originalBrown = readUtf8File(brownFile);

    function restoreAll() {
      writeFileSync(marengoFile, originalMarengo, 'utf8');
      writeFileSync(brownFile, originalBrown, 'utf8');
    }

    try {
      // -- 1. Baseline build ---------------------------------------------

      clearAstroCache(toplevel);
      let build = runBuild(toplevel);
      if (build.timedOut) {
        fail(id, `baseline npm run build timed out`);
      }
      if (build.status !== 0) {
        fail(id, `baseline npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
      }

      const htmlFiles = walkFiles(distDir).filter((p) => p.endsWith('.html'));
      if (htmlFiles.length !== 10) {
        fail(id, `expected exactly 10 built .html files, found ${htmlFiles.length}: ${htmlFiles.join(', ')}`);
      }

      // -- 2. Per-page structural sweep: alt text, encoding, headings, -----
      // --    landmarks, and the skip link -----------------------------------
      //
      // Astro renders an empty-string `alt` prop as a bare `alt` attribute
      // (no `=`), not `alt=""` -- both are the same empty alt in HTML, and
      // both are only correct when paired with aria-hidden="true"
      // (BrandMark.astro's contract). A truly missing alt has neither form.
      const IMG_TAG_RE = /<img\b[^>]*>/g;
      const QUOTED_ALT_RE = /\balt="[^"]*"/;
      const BARE_ALT_RE = /\balt(\s|\/?>)/;

      for (const f of htmlFiles) {
        const html = readUtf8File(f);

        const imgTags = html.match(IMG_TAG_RE) || [];
        for (const tag of imgTags) {
          const hasQuotedAlt = QUOTED_ALT_RE.test(tag);
          const hasBareAlt = BARE_ALT_RE.test(tag);
          if (!hasQuotedAlt && !hasBareAlt) {
            fail(id, `${f}: an <img> is missing an alt attribute entirely: ${tag}`);
          }
          const isEmptyAlt = /\balt=""/.test(tag) || (hasBareAlt && !hasQuotedAlt);
          if (isEmptyAlt && !/aria-hidden="true"/.test(tag)) {
            fail(id, `${f}: an <img> has an empty alt without aria-hidden="true": ${tag}`);
          }
        }

        if (!/<html\s+lang="en"/.test(html)) {
          fail(id, `${f} does not declare lang="en"`);
        }
        if (!/<meta\s+charset="utf-8"/.test(html)) {
          fail(id, `${f} does not declare a utf-8 charset`);
        }

        const h1Count = (html.match(/<h1\b/g) || []).length;
        if (h1Count !== 1) {
          fail(id, `${f} has ${h1Count} <h1> elements, expected exactly 1`);
        }

        if (!/<main\b/.test(html)) fail(id, `${f} has no <main> landmark`);
        if (!/<nav\b/.test(html)) fail(id, `${f} has no <nav> landmark`);
        if (!/<footer\b/.test(html)) fail(id, `${f} has no <footer> landmark`);

        if (!html.includes('id="main-content"')) {
          fail(id, `${f}'s <main> is missing id="main-content", the skip link's target`);
        }
        if (!html.includes('class="skip-link"') || !html.includes('href="#main-content"')) {
          fail(id, `${f} is missing a skip link (class="skip-link" href="#main-content") as the first focusable element`);
        }

        if (html.includes('�')) {
          fail(id, `${f} contains the Unicode replacement character (U+FFFD) -- an encoding loss somewhere in the build`);
        }
      }

      // -- 3. Encoding survived: em dash and straight apostrophe in the ----
      // --    ported land-contract paragraph, transcribed exactly ----------

      const onePagerHtml = readUtf8File(onePagerPath);
      const headingIdx = onePagerHtml.indexOf('What a land contract means');
      const pStart = onePagerHtml.indexOf('<p>', headingIdx);
      const pEnd = onePagerHtml.indexOf('</p>', pStart);
      if (headingIdx === -1 || pStart === -1 || pEnd === -1) {
        fail(id, `could not extract the 'What a land contract means' paragraph from ${onePagerPath}`);
      }
      const sourceParagraph = onePagerHtml.slice(pStart + '<p>'.length, pEnd);

      const howItWorksHtml = readUtf8File(distHowItWorks);
      const builtMatch = howItWorksHtml.match(/<p[^>]*data-copy="land-contract-meaning"[^>]*>([^]*?)<\/p>/);
      if (!builtMatch) {
        fail(id, `could not extract the land-contract-meaning paragraph from ${distHowItWorks}`);
      }
      const builtParagraph = builtMatch[1];

      const normalizedSource = normalizeForComparison(sourceParagraph);
      const normalizedBuilt = normalizeForComparison(builtParagraph);
      if (normalizedSource !== normalizedBuilt) {
        fail(
          id,
          `land-contract paragraph mismatch after normalisation.\nSOURCE: ${JSON.stringify(normalizedSource)}\nBUILT:  ${JSON.stringify(normalizedBuilt)}`,
        );
      }
      if (!normalizedBuilt.includes('—')) {
        fail(id, `${distHowItWorks}'s land-contract paragraph does not contain the em dash (U+2014) present in the source`);
      }
      if (!normalizedBuilt.includes("aren't")) {
        fail(id, `${distHowItWorks}'s land-contract paragraph does not contain "aren't" with its straight apostrophe, as it appears in the source`);
      }

      // -- 4. The accent is never text -------------------------------------
      //
      // Matches a `color:` declaration (not background-/border-/outline-
      // color, all of which end in "-color" -- the negative lookbehind on a
      // word char or hyphen excludes them) set to the accent hex value.
      // Checked both in built CSS (case-insensitive -- Lightning CSS
      // lowercases hex literals) and in every source .astro file, so a
      // future minifier change can't silently stop this from being caught.

      const accentTextRe = /(?<![\w-])color:\s*#ffd053/i;

      const cssFiles = walkFiles(distDir).filter((p) => p.endsWith('.css'));
      if (cssFiles.length === 0) {
        fail(id, `no .css files found under ${distDir}`);
      }
      for (const f of cssFiles) {
        if (accentTextRe.test(readUtf8File(f))) {
          fail(id, `${f} sets a text color to the accent value #FFD053 -- the accent is a fill-only colour, never text on cream`);
        }
      }

      const astroFiles = walkFiles(srcDir).filter((p) => p.endsWith('.astro'));
      for (const f of astroFiles) {
        if (accentTextRe.test(readUtf8File(f))) {
          fail(id, `${f} sets a text color to the accent value -- the accent is a fill-only colour, never text`);
        }
      }

      // -- 5. Status is text, not colour alone: Available (baseline), ------
      // --    Pending and Sold (flip-build-assert-revert) -------------------

      if (!existsSync(distHomesIndex)) {
        fail(id, `missing ${distHomesIndex} after the baseline build`);
      }
      const baselineHomesHtml = readUtf8File(distHomesIndex);
      if (!baselineHomesHtml.includes('>Available<')) {
        fail(id, `${distHomesIndex} does not render 'Available' as visible badge text in the baseline build`);
      }

      writeFileSync(marengoFile, originalMarengo.replace('status: "Available"', 'status: "Pending"'), 'utf8');
      writeFileSync(brownFile, originalBrown.replace('status: "Available"', 'status: "Sold"'), 'utf8');
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      const flippedHomesHtml = existsSync(distHomesIndex) ? readUtf8File(distHomesIndex) : '';
      writeFileSync(marengoFile, originalMarengo, 'utf8');
      writeFileSync(brownFile, originalBrown, 'utf8');
      if (build.timedOut) {
        fail(id, `status-flip build timed out`);
      }
      if (build.status !== 0) {
        fail(id, `status-flip build exited ${build.status}, expected 0`);
      }
      if (!flippedHomesHtml.includes('>Pending<')) {
        fail(id, `${distHomesIndex} does not render 'Pending' as visible badge text after flipping a home's status`);
      }
      if (!flippedHomesHtml.includes('>Sold<')) {
        fail(id, `${distHomesIndex} does not render 'Sold' as visible badge text after flipping a home's status`);
      }

      // -- 6. Final rebuild -- leave the tree in a known-good built state --

      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      if (build.status !== 0) {
        fail(id, `final rebuild after the status-flip round trip exited ${build.status}, expected 0`);
      }
    } finally {
      restoreAll();
    }

    pass(id);
  },

  /**
   * 01-05 Task 2: the phase-level gate. Re-runs the cross-cutting
   * assertions -- ROADMAP criterion 3 as a complete set of four literals,
   * retired-phrasing and superseded-colour sweeps, internal-link
   * resolution, and the README's presence and content -- over the whole
   * assembled dist/ tree, once all ten pages exist together.
   *
   * Two assertions in this task's <acceptance_criteria> require a completed
   * push (remote main SHA == local HEAD) and are therefore expected to fail
   * in this executor's run: pushing is explicitly out of this executor's
   * scope (a human performs it manually) and is recorded as a deferred item
   * in 01-05-SUMMARY.md, not silently skipped or weakened here. Every other
   * assertion below must pass.
   */
  'phase-complete': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const distDir = join(toplevel, 'dist');
    const srcDir = join(toplevel, 'src');
    const contentDir = join(toplevel, 'src', 'content');
    const readmePath = join(toplevel, 'README.md');

    const equalHousingSentence =
      'Equal Housing Opportunity. Owner financing is subject to a written agreement; this is not a commitment to lend or an offer of credit.';
    const displayPhone = '(217) 269-0003';
    const taglineAlt = 'Oak Homes — From Rent to Roots';

    // -- 1. Baseline build; all ten expected routes emit ------------------

    clearAstroCache(toplevel);
    let build = runBuild(toplevel);
    if (build.timedOut) {
      fail(id, `baseline npm run build timed out`);
    }
    if (build.status !== 0) {
      fail(id, `baseline npm run build exited ${build.status}:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
    }

    const expectedRoutes = [
      '',
      'homes',
      join('homes', '614-e-marengo-st'),
      join('homes', '2734-brown-st'),
      'how-it-works',
      'about',
      'learn',
      join('learn', 'what-is-a-land-contract'),
      'schedule',
      'contact',
    ];
    for (const route of expectedRoutes) {
      const p = route === '' ? join(distDir, 'index.html') : join(distDir, route, 'index.html');
      if (!existsSync(p)) {
        fail(id, `missing ${p} -- expected route did not emit`);
      }
    }

    const sitemapPath = join(distDir, 'sitemap-index.xml');
    if (!existsSync(sitemapPath)) {
      fail(id, `missing ${sitemapPath} -- the sitemap did not generate`);
    }

    const htmlFiles = walkFiles(distDir).filter((p) => p.endsWith('.html'));
    if (htmlFiles.length !== 10) {
      fail(id, `expected exactly 10 built .html files, found ${htmlFiles.length}`);
    }

    // -- 2. ROADMAP criterion 3 as a complete set: four independent counts --
    // --    across the ten pages, all equal to 10 -------------------------

    const integrationsSlotMarker = 'integrations-slot';
    let equalHousingCount = 0;
    let phoneCount = 0;
    let taglineCount = 0;
    let integrationsSlotCount = 0;
    for (const f of htmlFiles) {
      const html = readUtf8File(f);
      if (countOccurrences(html, equalHousingSentence) === 1) equalHousingCount += 1;
      if (html.includes(displayPhone)) phoneCount += 1;
      if (html.includes(taglineAlt)) taglineCount += 1;
      if (countOccurrences(html, integrationsSlotMarker) === 1) integrationsSlotCount += 1;
    }
    if (equalHousingCount !== htmlFiles.length) {
      fail(id, `${equalHousingCount} of ${htmlFiles.length} pages carry the Equal Housing sentence exactly once, expected all`);
    }
    if (phoneCount !== htmlFiles.length) {
      fail(id, `${phoneCount} of ${htmlFiles.length} pages carry the display phone '${displayPhone}', expected all`);
    }
    if (taglineCount !== htmlFiles.length) {
      fail(id, `${taglineCount} of ${htmlFiles.length} pages carry the tagline '${taglineAlt}' as the header brand mark's accessible name, expected all`);
    }
    if (integrationsSlotCount !== htmlFiles.length) {
      fail(id, `${integrationsSlotCount} of ${htmlFiles.length} pages carry the integrations-slot marker exactly once, expected all`);
    }

    // -- 3. Tagline present but never re-typeset ---------------------------

    const astroFiles = walkFiles(srcDir).filter((p) => p.endsWith('.astro'));
    for (const f of astroFiles) {
      if (readUtf8File(f).includes('FROM RENT TO ROOTS')) {
        fail(id, `${f} contains the all-caps wordmark literal 'FROM RENT TO ROOTS' -- it must ship as an image asset only`);
      }
    }

    // -- 4. Retired phrasing and superseded colour, whole-tree ------------

    for (const literal of ['equitable interest', 'honest terms', 'not a rental']) {
      for (const f of htmlFiles) {
        if (readUtf8File(f).toLowerCase().includes(literal)) {
          fail(id, `${f} contains the retired phrasing '${literal}' (case-insensitive)`);
        }
      }
    }

    let foundAccent = false;
    let foundPriceGold = false;
    const cssFiles = walkFiles(distDir).filter((p) => p.endsWith('.css'));
    for (const f of htmlFiles.concat(cssFiles)) {
      const upper = readUtf8File(f).toUpperCase();
      if (upper.includes('F6C84C')) {
        fail(id, `${f} contains the superseded design-spec yellow estimate F6C84C`);
      }
      if (upper.includes('#FFD053')) foundAccent = true;
      if (upper.includes('#A87E24')) foundPriceGold = true;
    }
    if (!foundAccent) fail(id, `no built file under dist/ contains the accent value #FFD053`);
    if (!foundPriceGold) fail(id, `no built file under dist/ contains the price-gold value #A87E24`);

    // -- 5. Legally-sensitive copy absent from src/content/ ----------------

    const contentFiles = walkFiles(contentDir);
    for (const f of contentFiles) {
      let text;
      try {
        text = readUtf8File(f);
      } catch {
        continue;
      }
      if (text.includes('Equal Housing Opportunity') || text.includes('agreement for deed')) {
        fail(id, `${f} under src/content/ contains legally-sensitive copy -- it must exist only in .astro files (DESIGN-03)`);
      }
    }

    // -- 6. Every internal link resolves to a file that exists under dist/ --

    const ANCHOR_HREF_RE = /<a\b[^>]*\bhref="([^"]*)"/g;
    const internalHrefs = new Set();
    for (const f of htmlFiles) {
      const html = readUtf8File(f);
      let m;
      ANCHOR_HREF_RE.lastIndex = 0;
      while ((m = ANCHOR_HREF_RE.exec(html)) !== null) {
        const href = m[1];
        if (!href.startsWith('/') || href.startsWith('//')) continue; // external, protocol-relative
        if (href.startsWith('/mailto:') || href.startsWith('/tel:')) continue; // never emitted, defensive
        internalHrefs.add(href);
      }
    }
    function resolveDistPath(href) {
      let p = href.split('#')[0].split('?')[0];
      if (p === '') p = '/';
      if (p.endsWith('/')) {
        p = p + 'index.html';
      } else {
        const lastSegment = p.split('/').pop() || '';
        if (!lastSegment.includes('.')) p = p + '/index.html';
      }
      return join(distDir, p);
    }
    const unresolved = [];
    for (const href of internalHrefs) {
      const resolved = resolveDistPath(href);
      if (!existsSync(resolved)) unresolved.push(`${href} -> ${resolved}`);
    }
    if (unresolved.length > 0) {
      fail(id, `${unresolved.length} internal link(s) do not resolve to a file under dist/:\n${unresolved.join('\n')}`);
    }
    if (internalHrefs.size === 0) {
      fail(id, `no internal (site-relative) <a href> links were found across ${htmlFiles.length} built pages -- expected many`);
    }

    // -- 7. Reproducibility, observed rather than gated --------------------
    //
    // Two consecutive builds are run and any differing dist/ .html files
    // are recorded as information, never as a failure -- see this plan's
    // <review_response> for why whole-tree equality is demoted from a gate.
    // The assertion that carries real weight (card order stability) is
    // gated in 01-03 Task 2 at the granularity it governs.

    const firstBuildContents = new Map();
    for (const f of htmlFiles) firstBuildContents.set(f, readUtf8File(f));

    clearAstroCache(toplevel);
    build = runBuild(toplevel);
    if (build.status !== 0) {
      fail(id, `second consecutive build exited ${build.status}, expected 0`);
    }
    const secondHtmlFiles = walkFiles(distDir).filter((p) => p.endsWith('.html'));
    const reproDiffs = [];
    for (const f of secondHtmlFiles) {
      const before = firstBuildContents.get(f);
      const after = readUtf8File(f);
      if (before !== undefined && before !== after) reproDiffs.push(f);
    }
    process.stdout.write(
      reproDiffs.length === 0
        ? `INFO ${id}: two consecutive builds produced byte-identical dist/ HTML for all ${secondHtmlFiles.length} files\n`
        : `INFO ${id}: two consecutive builds differed in ${reproDiffs.length} file(s): ${reproDiffs.join(', ')}\n`,
    );

    // -- 8. README hands off to Phase 2 -------------------------------------

    if (!existsSync(readmePath)) {
      fail(id, `missing ${readmePath}`);
    }
    const readme = readUtf8File(readmePath);
    if (!readme.includes('npm run build')) {
      fail(id, `${readmePath} does not contain 'npm run build'`);
    }
    for (const collection of ['properties', 'blog', 'settings']) {
      if (!readme.includes(collection)) {
        fail(id, `${readmePath} does not name the '${collection}' content collection`);
      }
    }
    if (!/2000\s?px/.test(readme)) {
      fail(id, `${readmePath} does not state the ~2000px photo pre-resize convention`);
    }
    if (!/integrations slot/i.test(readme)) {
      fail(id, `${readmePath} does not name the integrations slot`);
    }

    // -- 9. Working tree is clean -------------------------------------------

    const statusResult = runGit(['status', '--porcelain']);
    if (!statusResult.ok) {
      fail(id, `git status --porcelain failed: ${statusResult.reason || statusResult.stderr}`);
    }
    if (statusResult.stdout.length > 0) {
      fail(id, `git status --porcelain is not empty -- commit everything before running this check:\n${statusResult.stdout}`);
    }

    // -- 10. Remote main matches local HEAD ---------------------------------
    //
    // Expected to fail in this executor's run: the push is a deferred owner
    // action (01-05-SUMMARY.md "Deferred to the owner"), not something this
    // executor is permitted to perform. Asserted honestly rather than
    // skipped, so a human re-running this check after pushing gets a real
    // pass/fail signal.

    const lsRemoteMain = runGit(['ls-remote', 'origin', 'refs/heads/main']);
    if (lsRemoteMain.timedOut) {
      fail(id, lsRemoteMain.reason);
    }
    if (!lsRemoteMain.ok) {
      fail(id, `git ls-remote origin refs/heads/main failed: ${lsRemoteMain.stderr}`);
    }
    const mainLine = lsRemoteMain.stdout.split(/\r\n|\n/).filter((l) => l.length > 0)[0] || '';
    const remoteMainSha = mainLine.split(/\s+/)[0] || '';
    const headResult = runGit(['rev-parse', 'HEAD']);
    if (!headResult.ok) {
      fail(id, `git rev-parse HEAD failed: ${headResult.timedOut ? headResult.reason : headResult.stderr}`);
    }
    if (remoteMainSha !== headResult.stdout) {
      fail(
        id,
        `remote main SHA (${remoteMainSha}) does not equal local HEAD (${headResult.stdout}) -- push is a deferred owner action, see 01-05-SUMMARY.md`,
      );
    }

    pass(id);
  },

  /**
   * 02-01 Task 1: prove the deploy config, admin shell, and Homes (properties)
   * collection are wired correctly and stay in parity with the Phase-1 Zod
   * schema. Node built-ins only -- public/admin/config.yml is parsed by hand
   * with targeted line/regex extraction (not a generic YAML parser and not
   * an npm dependency), scoped to the exact indentation conventions this
   * repo's config.yml is written in.
   */
  'cms-tracer-config': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const netlifyTomlPath = join(toplevel, 'netlify.toml');
    const adminIndexPath = join(toplevel, 'public', 'admin', 'index.html');
    const adminConfigPath = join(toplevel, 'public', 'admin', 'config.yml');
    const pkgJsonPath = join(toplevel, 'package.json');
    const contentConfigPath = join(toplevel, 'src', 'content.config.ts');
    const adminDir = join(toplevel, 'public', 'admin');

    // Locked verbatim from 02-UI-SPEC.md's Field Validation Messages row for
    // `slug` -- hardcoded here the same way other checks in this file
    // hardcode locked copy (e.g. skeleton-e2e's equalHousingSentence), not
    // read from the planning doc at check-runtime.
    const slugRejectionMessage =
      'Lowercase letters, numbers, and single hyphens only (e.g. 614-e-marengo-st)';

    // The 14-name field set this plan deliberately wires; videoUrl, location,
    // ogImage exist in the Zod schema but are Phase-3-only and must be absent
    // from the CMS this phase (RESEARCH.md Pitfall 4 / Pattern 2 notes).
    const expectedFourteen = [
      'title', 'address', 'slug', 'status', 'featured', 'downPayment',
      'monthlyPayment', 'beds', 'baths', 'sqft', 'description', 'features',
      'photos', 'publishDate',
    ];
    const phase3OnlyFields = new Set(['videoUrl', 'location', 'ogImage']);

    // -- 1. netlify.toml ---------------------------------------------------

    let netlifyToml;
    try {
      netlifyToml = readUtf8File(netlifyTomlPath);
    } catch {
      fail(id, `missing file: ${netlifyTomlPath}`);
    }
    let pkg;
    try {
      pkg = JSON.parse(readUtf8File(pkgJsonPath));
    } catch (e) {
      fail(id, `could not parse package.json: ${e}`);
    }
    if (!pkg.scripts || !Object.prototype.hasOwnProperty.call(pkg.scripts, 'build')) {
      fail(id, `package.json has no 'build' script for netlify.toml to invoke`);
    }
    const commandMatch = netlifyToml.match(/command\s*=\s*"([^"]*)"/);
    if (!commandMatch) {
      fail(id, `${netlifyTomlPath} has no [build] command = "..." line`);
    }
    if (commandMatch[1] !== 'npm run build') {
      fail(id, `${netlifyTomlPath} build command is '${commandMatch[1]}', expected 'npm run build' (package.json's 'build' script invoked through npm)`);
    }
    const publishMatch = netlifyToml.match(/publish\s*=\s*"([^"]*)"/);
    if (!publishMatch) {
      fail(id, `${netlifyTomlPath} has no [build] publish = "..." line`);
    }
    // Astro's static output directory defaults to 'dist' unless astro.config.mjs
    // sets an explicit outDir -- this repo's astro.config.mjs (read at plan
    // time) has no outDir override, so 'dist' is the expected publish dir.
    const astroConfigPath = join(toplevel, 'astro.config.mjs');
    let astroConfig = '';
    try {
      astroConfig = readUtf8File(astroConfigPath);
    } catch {
      fail(id, `missing file: ${astroConfigPath}`);
    }
    const expectedPublishDir = astroConfig.includes('outDir') ? null : 'dist';
    if (expectedPublishDir && publishMatch[1] !== expectedPublishDir) {
      fail(id, `${netlifyTomlPath} publish dir is '${publishMatch[1]}', expected '${expectedPublishDir}' (Astro's static output dir; astro.config.mjs has no outDir override)`);
    }

    // -- 2. public/admin/index.html ----------------------------------------

    let adminIndex;
    try {
      adminIndex = readUtf8File(adminIndexPath);
    } catch {
      fail(id, `missing file: ${adminIndexPath}`);
    }
    if (!/<meta\s+name=["']robots["']\s+content=["']noindex["']\s*\/?>/i.test(adminIndex)) {
      fail(id, `${adminIndexPath} does not contain a robots noindex meta tag`);
    }
    const scriptTagMatch = adminIndex.match(/<script\b[^>]*src=["']([^"']*sveltia-cms\.js)["'][^>]*>/i);
    if (!scriptTagMatch) {
      fail(id, `${adminIndexPath} has no <script> tag loading sveltia-cms.js`);
    }
    const scriptTag = scriptTagMatch[0];
    const scriptSrc = scriptTagMatch[1];
    if (/type=["']module["']/i.test(scriptTag)) {
      fail(id, `${adminIndexPath}'s Sveltia script tag carries a type="module" attribute -- Sveltia's own docs warn this causes unexpected behavior`);
    }
    if (!/@sveltia\/cms@[^/]+\//.test(scriptSrc)) {
      fail(id, `${adminIndexPath}'s Sveltia script src '${scriptSrc}' has no @-prefixed version specifier after the package name -- an unpinned CDN URL is a supply-chain risk (T-02-SC)`);
    }

    // -- 3. public/admin/config.yml ------------------------------------------

    let configYml;
    try {
      configYml = readUtf8File(adminConfigPath);
    } catch {
      fail(id, `missing file: ${adminConfigPath}`);
    }

    // "Parses as YAML" -- hand-rolled line reader targeted at this file's own
    // conventions (2-space indent steps, `key: value` pairs, `- ` list items),
    // not a generic YAML grammar. A basic sanity pass: every non-blank,
    // non-comment line either matches `key: value`/`key:` or a list-item
    // form (`- ...`), and indentation is always a multiple of 2 spaces.
    const ymlLines = configYml.split(/\r\n|\n/);
    for (let i = 0; i < ymlLines.length; i++) {
      const line = ymlLines[i];
      if (line.trim() === '' || line.trim().startsWith('#')) continue;
      const leadingSpaces = line.match(/^ */)[0].length;
      if (leadingSpaces % 2 !== 0) {
        fail(id, `${adminConfigPath} line ${i + 1} has an odd number of leading spaces (${leadingSpaces}) -- not valid YAML indentation: "${line}"`);
      }
      const trimmed = line.trim();
      if (!/^-?\s*[a-zA-Z0-9_.{]/.test(trimmed)) {
        fail(id, `${adminConfigPath} line ${i + 1} does not look like a YAML key or list item: "${line}"`);
      }
    }

    const backendNameMatch = configYml.match(/^backend:\s*\n(?:.*\n)*?\s*name:\s*(\S+)/m);
    const backendRepoMatch = configYml.match(/^backend:\s*\n(?:.*\n)*?\s*repo:\s*(\S+)/m);
    const backendBranchMatch = configYml.match(/^backend:\s*\n(?:.*\n)*?\s*branch:\s*(\S+)/m);
    if (!backendNameMatch || backendNameMatch[1] !== 'github') {
      fail(id, `${adminConfigPath}'s backend.name is not 'github'`);
    }
    const originUrlResult = runGit(['remote', 'get-url', 'origin']);
    if (!originUrlResult.ok) {
      fail(id, `git remote get-url origin failed: ${originUrlResult.timedOut ? originUrlResult.reason : originUrlResult.stderr}`);
    }
    const originRepoMatch = originUrlResult.stdout.match(/github\.com[:/](.+?)(?:\.git)?$/);
    const originRepo = originRepoMatch ? originRepoMatch[1] : null;
    if (!backendRepoMatch || !originRepo || backendRepoMatch[1] !== originRepo) {
      fail(id, `${adminConfigPath}'s backend.repo is '${backendRepoMatch ? backendRepoMatch[1] : '(missing)'}', expected to match origin '${originRepo}'`);
    }
    if (!backendBranchMatch || backendBranchMatch[1] !== 'main') {
      fail(id, `${adminConfigPath}'s backend.branch is '${backendBranchMatch ? backendBranchMatch[1] : '(missing)'}', expected 'main'`);
    }

    // No OAuth broker override key -- Netlify's built-in provider needs none.
    if (/\bbase_url\s*:/.test(configYml) || /\bauth_endpoint\s*:/.test(configYml)) {
      fail(id, `${adminConfigPath} declares an OAuth broker override (base_url/auth_endpoint) -- Netlify's built-in provider requires their absence`);
    }
    // No editorial-workflow publish key -- a draft-and-merge step would
    // defeat the ~2-minute publish criterion outright.
    if (/\bpublish_mode\s*:/.test(configYml)) {
      fail(id, `${adminConfigPath} declares a publish_mode key -- editorial workflow must not be enabled`);
    }

    // Extract the properties collection's top-level field names. Top-level
    // field list items in this file are 6-space-indented `- ` entries (either
    // inline `- { name: X, ... }` or block `- name: X`); nested sub-fields
    // (e.g. a list widget's `field: { name: feature, ... }`) are not list
    // items themselves and are excluded by this indentation+dash requirement.
    const fieldLineRe = /^ {6}-\s*(?:\{\s*name:\s*([a-zA-Z0-9_]+)|name:\s*([a-zA-Z0-9_]+))/;
    const cmsFieldNames = [];
    for (const line of ymlLines) {
      const m = line.match(fieldLineRe);
      if (m) cmsFieldNames.push(m[1] || m[2]);
    }
    const cmsFieldSet = new Set(cmsFieldNames);
    if (cmsFieldNames.length !== cmsFieldSet.size) {
      fail(id, `${adminConfigPath}'s properties fields contain a duplicate name: ${cmsFieldNames.join(', ')}`);
    }

    // Direct assertion: the CMS field set is exactly the locked 14-name set.
    const expectedFourteenSet = new Set(expectedFourteen);
    const missingFromCms = expectedFourteen.filter((f) => !cmsFieldSet.has(f));
    const extraInCms14 = cmsFieldNames.filter((f) => !expectedFourteenSet.has(f));
    if (missingFromCms.length > 0 || extraInCms14.length > 0) {
      fail(
        id,
        `${adminConfigPath}'s properties field set does not equal the locked 14-name set -- missing: [${missingFromCms.join(', ')}], unexpected: [${extraInCms14.join(', ')}]`,
      );
    }

    // Schema-driven parity assertion (non-vacuous): extract every field name
    // declared in content.config.ts's properties schema (all fields,
    // including the Phase-3-only ones), subtract the known Phase-3-only set,
    // and assert the remainder equals the CMS field set exactly. This is
    // what makes an added/dropped/renamed field on either side fail the
    // check by name, whether the drift originates in the schema or in
    // config.yml.
    let contentConfig;
    try {
      contentConfig = readUtf8File(contentConfigPath);
    } catch {
      fail(id, `missing file: ${contentConfigPath}`);
    }
    const propertiesStart = contentConfig.indexOf('const properties = defineCollection({');
    if (propertiesStart === -1) {
      fail(id, `${contentConfigPath} does not contain 'const properties = defineCollection({'`);
    }
    const schemaStart = contentConfig.indexOf('schema: z.object({', propertiesStart);
    if (schemaStart === -1) {
      fail(id, `${contentConfigPath} does not contain a 'schema: z.object({' block after the properties collection declaration`);
    }
    const schemaEnd = contentConfig.indexOf('\n  }),', schemaStart);
    if (schemaEnd === -1) {
      fail(id, `${contentConfigPath}: could not find the closing '  }),' for the properties schema block`);
    }
    const schemaBlock = contentConfig.slice(schemaStart, schemaEnd);
    const schemaFieldRe = /^ {4}([a-zA-Z0-9_]+):\s*\S/gm;
    const schemaFieldNames = [];
    let sm;
    while ((sm = schemaFieldRe.exec(schemaBlock)) !== null) {
      schemaFieldNames.push(sm[1]);
    }
    if (schemaFieldNames.length === 0) {
      fail(id, `${contentConfigPath}: extracted zero field names from the properties schema block -- extraction regex did not match this file's formatting`);
    }
    const expectedFromSchema = schemaFieldNames.filter((f) => !phase3OnlyFields.has(f));
    const expectedFromSchemaSet = new Set(expectedFromSchema);
    const missingFromCmsVsSchema = expectedFromSchema.filter((f) => !cmsFieldSet.has(f));
    const extraInCmsVsSchema = cmsFieldNames.filter((f) => !expectedFromSchemaSet.has(f));
    if (missingFromCmsVsSchema.length > 0 || extraInCmsVsSchema.length > 0) {
      fail(
        id,
        `${adminConfigPath}'s properties field set does not equal the non-Phase-3 field set extracted from ${contentConfigPath}'s schema -- missing from CMS: [${missingFromCmsVsSchema.join(', ')}], unexpected in CMS: [${extraInCmsVsSchema.join(', ')}]`,
      );
    }
    for (const f of phase3OnlyFields) {
      if (!schemaFieldNames.includes(f)) {
        fail(id, `${contentConfigPath}'s properties schema no longer declares Phase-3-only field '${f}' -- this check's Phase-3-omission list is stale`);
      }
      if (cmsFieldSet.has(f)) {
        fail(id, `${adminConfigPath} declares Phase-3-only field '${f}' -- it must stay omitted from the CMS this phase`);
      }
    }

    // slug field: pattern regex byte-identical to content.config.ts's
    // slugPattern source, and rejection message byte-identical to UI-SPEC.
    const slugPatternSourceMatch = contentConfig.match(/const slugPattern = \/(.+)\/;/);
    if (!slugPatternSourceMatch) {
      fail(id, `${contentConfigPath} does not contain a 'const slugPattern = /.../;' declaration`);
    }
    const slugPatternSource = slugPatternSourceMatch[1];
    const cmsSlugFieldMatch = configYml.match(/name:\s*slug\s*\n(?:.*\n)*?\s*pattern:\s*\[\s*'([^']*)'\s*,\s*'([^']*)'\s*\]/);
    if (!cmsSlugFieldMatch) {
      fail(id, `${adminConfigPath}'s slug field has no 'pattern: [...]' validator`);
    }
    if (cmsSlugFieldMatch[1] !== slugPatternSource) {
      fail(id, `${adminConfigPath}'s slug pattern regex '${cmsSlugFieldMatch[1]}' is not byte-identical to ${contentConfigPath}'s slugPattern source '${slugPatternSource}'`);
    }
    if (cmsSlugFieldMatch[2] !== slugRejectionMessage) {
      fail(id, `${adminConfigPath}'s slug pattern rejection message '${cmsSlugFieldMatch[2]}' is not byte-identical to the locked UI-SPEC message '${slugRejectionMessage}'`);
    }

    // status: exactly Available/Pending/Sold, default Available.
    const statusBlockMatch = configYml.match(/name:\s*status\s*\n(?:.*\n)*?\s*options:\s*\[([^\]]*)\]\s*\n\s*default:\s*'([^']*)'/);
    if (!statusBlockMatch) {
      fail(id, `${adminConfigPath}'s status field does not declare both 'options: [...]' and a 'default:'`);
    }
    const statusOptions = statusBlockMatch[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
    const expectedStatusOptions = ['Available', 'Pending', 'Sold'];
    if (statusOptions.length !== expectedStatusOptions.length || !expectedStatusOptions.every((o, idx) => statusOptions[idx] === o)) {
      fail(id, `${adminConfigPath}'s status options are [${statusOptions.join(', ')}], expected exactly [${expectedStatusOptions.join(', ')}]`);
    }
    if (statusBlockMatch[2] !== 'Available') {
      fail(id, `${adminConfigPath}'s status default is '${statusBlockMatch[2]}', expected 'Available'`);
    }

    // featured: boolean, default false.
    const featuredLineMatch = configYml.match(/\{\s*name:\s*featured,[^}]*\}/);
    if (!featuredLineMatch || !/widget:\s*boolean/.test(featuredLineMatch[0]) || !/default:\s*false/.test(featuredLineMatch[0])) {
      fail(id, `${adminConfigPath}'s featured field is not a boolean widget defaulting to false`);
    }

    // features / photos: default to an empty list.
    for (const listField of ['features', 'photos']) {
      const re = new RegExp(`name:\\s*${listField}\\s*\\n(?:.*\\n)*?\\s*default:\\s*\\[\\]`);
      if (!re.test(configYml)) {
        fail(id, `${adminConfigPath}'s ${listField} field does not default to '[]'`);
      }
    }

    // -- 4. No secret- or token-shaped value under public/admin/ ------------

    const secretPatterns = [
      /client_secret/i,
      /clientSecret/,
      /\bghp_[A-Za-z0-9]{20,}/,
      /\bgho_[A-Za-z0-9]{20,}/,
      /\bghu_[A-Za-z0-9]{20,}/,
      /\bghs_[A-Za-z0-9]{20,}/,
      /\bghr_[A-Za-z0-9]{20,}/,
    ];
    for (const f of walkFiles(adminDir)) {
      let text;
      try {
        text = readUtf8File(f);
      } catch {
        continue; // non-text asset
      }
      for (const pattern of secretPatterns) {
        if (pattern.test(text)) {
          fail(id, `${f} contains a secret- or token-shaped value matching ${pattern} -- no credential may live under public/admin/`);
        }
      }
    }

    pass(id);
  },

  /**
   * quick-260902-sws: regression gate for the production incident where
   * commits e3d7077 / 45da85e wrote `sqft: null` (a Sveltia blank-field
   * serialization) into real property frontmatter and the schema's bare
   * `.optional()` rejected it, taking every subsequent Netlify build -- and
   * the live deploy -- down. Asserts BOTH directions: every field this repo
   * has classified as optional actually tolerates null/''/absent (Layer A +
   * Layer B R1-R3), and no field has quietly been loosened out of being
   * required in the process (Layer A + Layer B R4/R5) -- a "fix" that
   * loosens a required field into optionality is a worse bug than the one
   * being fixed.
   *
   * Layer A is a static, no-build audit of src/content.config.ts: it
   * hardcodes the required/defaulted/container/optional partition and
   * fails by name if the file's actual field set drifts from it in either
   * direction -- an unclassified new field, or a classified field that
   * silently changed camp.
   *
   * Layer B proves the partition holds at build time, against the real
   * content files, via six mutate-build-assert-revert round trips
   * (skeleton-e2e's established pattern). Every mutated file is restored
   * immediately after its build and before any assertion, inside a
   * try/finally, because fail() calls process.exit() directly and an
   * assertion placed before the restore would leave the tree corrupt.
   */
  'cms-null-tolerance': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const contentConfigPath = join(toplevel, 'src', 'content.config.ts');
    const marengoPath = join(toplevel, 'src', 'content', 'properties', '614-e-marengo-st.md');
    const brownPath = join(toplevel, 'src', 'content', 'properties', '2734-brown-st.md');
    const blogPath = join(toplevel, 'src', 'content', 'blog', 'what-is-a-land-contract.md');
    const settingsPath = join(toplevel, 'src', 'content', 'settings.json');
    const distHomesIndexPath = join(toplevel, 'dist', 'homes', 'index.html');

    // -- Frontmatter mutation helpers, sharing withPhotosField's style ------

    /**
     * Operate only inside the leading `---` ... `---` frontmatter block.
     * Replace an existing `key: ...` line (plus any more-indented
     * continuation lines immediately following it) with `key: literal`, or
     * insert `key: literal` immediately before the closing `---` if the key
     * is absent. The insert path is required: videoUrl, location, ogImage,
     * and coverImage are absent from the real files today, so the null and
     * empty-string rounds must add them to prove those fields too.
     */
    function upsertFrontmatterKey(content, key, literal) {
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) {
        fail(id, `could not locate a frontmatter block ('---' ... '---') to mutate for key '${key}'`);
      }
      const fmBody = fmMatch[1];
      const fmLines = fmBody.split(/\r?\n/);
      const keyLineRe = new RegExp(`^${key}:`);
      let keyLineIdx = -1;
      for (let i = 0; i < fmLines.length; i++) {
        if (keyLineRe.test(fmLines[i])) {
          keyLineIdx = i;
          break;
        }
      }
      let newLines;
      if (keyLineIdx === -1) {
        newLines = fmLines.concat([`${key}: ${literal}`]);
      } else {
        let endIdx = keyLineIdx + 1;
        while (endIdx < fmLines.length && /^\s+\S/.test(fmLines[endIdx])) endIdx += 1;
        newLines = fmLines.slice(0, keyLineIdx).concat([`${key}: ${literal}`], fmLines.slice(endIdx));
      }
      const newFmBody = newLines.join('\n');
      return content.slice(0, fmMatch.index) + `---\n${newFmBody}\n---` + content.slice(fmMatch.index + fmMatch[0].length);
    }

    /** Delete a frontmatter key's line and any more-indented continuation lines. No-op if absent. */
    function removeFrontmatterKey(content, key) {
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) {
        fail(id, `could not locate a frontmatter block ('---' ... '---') to mutate for key '${key}'`);
      }
      const fmBody = fmMatch[1];
      const fmLines = fmBody.split(/\r?\n/);
      const keyLineRe = new RegExp(`^${key}:`);
      let keyLineIdx = -1;
      for (let i = 0; i < fmLines.length; i++) {
        if (keyLineRe.test(fmLines[i])) {
          keyLineIdx = i;
          break;
        }
      }
      if (keyLineIdx === -1) return content; // no-op: key already absent
      let endIdx = keyLineIdx + 1;
      while (endIdx < fmLines.length && /^\s+\S/.test(fmLines[endIdx])) endIdx += 1;
      const newLines = fmLines.slice(0, keyLineIdx).concat(fmLines.slice(endIdx));
      const newFmBody = newLines.join('\n');
      return content.slice(0, fmMatch.index) + `---\n${newFmBody}\n---` + content.slice(fmMatch.index + fmMatch[0].length);
    }

    // -- Layer A: static schema-partition audit ------------------------------

    let contentConfig;
    try {
      contentConfig = readUtf8File(contentConfigPath);
    } catch {
      fail(id, `missing file: ${contentConfigPath}`);
    }

    const helperMatch = contentConfig.match(/function cmsOptional[\s\S]*?\n\}/);
    if (!helperMatch) {
      fail(id, `${contentConfigPath} does not declare a 'function cmsOptional' helper`);
    }
    const helperBody = helperMatch[0];
    if (!helperBody.includes('z.preprocess')) {
      fail(id, `cmsOptional's body does not call z.preprocess`);
    }
    if (!helperBody.includes('=== null')) {
      fail(id, `cmsOptional's body does not test '=== null'`);
    }
    if (!helperBody.includes(`=== ''`) && !helperBody.includes('=== ""')) {
      fail(id, `cmsOptional's body does not test an empty-string comparison`);
    }
    const cmsOptionalDeclCount = (contentConfig.match(/function cmsOptional/g) || []).length;
    if (cmsOptionalDeclCount !== 1) {
      fail(id, `expected exactly 1 'function cmsOptional' declaration, found ${cmsOptionalDeclCount}`);
    }

    /**
     * Extract `name -> declaration text` pairs from a schema block, using
     * cms-tracer-config's own anchors and extraction regex so this stays in
     * lockstep with that check's formatting assumptions. `socialIndent`
     * additionally extracts 6-space-indented lines (settings.social) as
     * `social.<name>`.
     */
    function extractSchemaFields(collectionMarker, { includeSocial = false } = {}) {
      const collectionStart = contentConfig.indexOf(collectionMarker);
      if (collectionStart === -1) {
        fail(id, `${contentConfigPath} does not contain '${collectionMarker}'`);
      }
      const schemaStart = contentConfig.indexOf('schema: z.object({', collectionStart);
      if (schemaStart === -1) {
        fail(id, `${contentConfigPath}: no 'schema: z.object({' after '${collectionMarker}'`);
      }
      const schemaEnd = contentConfig.indexOf('\n  }),', schemaStart);
      if (schemaEnd === -1) {
        fail(id, `${contentConfigPath}: could not find the closing '  }),' for the block starting at '${collectionMarker}'`);
      }
      const schemaBlock = contentConfig.slice(schemaStart, schemaEnd);
      const fields = {};
      const topRe = /^ {4}([a-zA-Z0-9_]+):\s*(.+)$/gm;
      let m;
      while ((m = topRe.exec(schemaBlock)) !== null) {
        fields[m[1]] = m[2];
      }
      if (includeSocial) {
        const socialRe = /^ {6}([a-zA-Z0-9_]+):\s*(.+)$/gm;
        while ((m = socialRe.exec(schemaBlock)) !== null) {
          fields[`social.${m[1]}`] = m[2];
        }
      }
      if (Object.keys(fields).length === 0) {
        fail(id, `${contentConfigPath}: extracted zero field names from the block starting at '${collectionMarker}' -- extraction regex did not match this file's formatting`);
      }
      return fields;
    }

    const propertiesFields = extractSchemaFields('const properties = defineCollection({');
    const blogFields = extractSchemaFields('const blog = defineCollection({');
    const settingsFields = extractSchemaFields('const settings = defineCollection({', { includeSocial: true });

    const PARTITION = {
      REQUIRED: {
        properties: ['title', 'address', 'slug', 'status', 'downPayment', 'monthlyPayment', 'description', 'publishDate'],
        blog: ['title', 'slug', 'date'],
        settings: ['phone', 'phoneHref', 'email', 'homepageIntro'],
      },
      DEFAULTED: {
        properties: ['featured', 'features', 'photos'],
        blog: ['ownerReviewed'],
        settings: [],
      },
      CONTAINER: {
        properties: [],
        blog: [],
        settings: ['social'],
      },
      OPTIONAL: {
        properties: ['beds', 'baths', 'sqft', 'videoUrl', 'location', 'ogImage'],
        blog: ['coverImage'],
        settings: ['social.facebook'],
      },
    };

    function auditCollection(collectionName, extractedFields) {
      const classified = new Set([
        ...PARTITION.REQUIRED[collectionName],
        ...PARTITION.DEFAULTED[collectionName],
        ...PARTITION.CONTAINER[collectionName],
        ...PARTITION.OPTIONAL[collectionName],
      ]);
      const extractedNames = new Set(Object.keys(extractedFields));

      for (const name of extractedNames) {
        if (!classified.has(name)) {
          fail(
            id,
            `new field '${name}' in the ${collectionName} schema is not classified -- add it to cms-null-tolerance's required/defaulted/container/optional lists before shipping`,
          );
        }
      }
      for (const name of classified) {
        if (!extractedNames.has(name)) {
          fail(id, `classified field '${name}' (${collectionName}) is stale -- it no longer appears in the schema; update cms-null-tolerance's partition`);
        }
      }

      for (const name of PARTITION.OPTIONAL[collectionName]) {
        const decl = extractedFields[name];
        if (!decl.startsWith('cmsOptional(')) {
          fail(id, `optional field '${name}' (${collectionName}) does not start with 'cmsOptional(': "${decl}"`);
        }
      }
      for (const name of PARTITION.REQUIRED[collectionName]) {
        const decl = extractedFields[name];
        for (const forbidden of ['cmsOptional', '.optional(', '.nullish(', '.nullable(', '.default(']) {
          // <!-- planner-discipline-allow: .optional( --> <!-- planner-discipline-allow: .nullish( -->
          if (decl.includes(forbidden)) {
            fail(id, `required field '${name}' (${collectionName}) contains '${forbidden}' -- required fields must never gain a tolerance modifier: "${decl}"`);
          }
        }
      }
      for (const name of PARTITION.DEFAULTED[collectionName]) {
        const decl = extractedFields[name];
        if (!decl.includes('.default(')) {
          fail(id, `defaulted field '${name}' (${collectionName}) does not contain '.default(': "${decl}"`);
        }
        if (decl.includes('cmsOptional')) {
          fail(id, `defaulted field '${name}' (${collectionName}) is wrapped in cmsOptional -- defaulted and cmsOptional are mutually exclusive strategies: "${decl}"`);
        }
      }
    }

    auditCollection('properties', propertiesFields);
    auditCollection('blog', blogFields);
    auditCollection('settings', settingsFields);

    // -- Layer B: behavioural round trips against the real content ----------

    const originalMarengo = readUtf8File(marengoPath);
    const originalBrown = readUtf8File(brownPath);
    const originalBlog = readUtf8File(blogPath);
    const originalSettings = readUtf8File(settingsPath);

    function restoreAll() {
      writeFileSync(marengoPath, originalMarengo, 'utf8');
      writeFileSync(brownPath, originalBrown, 'utf8');
      writeFileSync(blogPath, originalBlog, 'utf8');
      writeFileSync(settingsPath, originalSettings, 'utf8');
    }

    const OPTIONAL_PROPERTY_FIELDS = ['beds', 'baths', 'sqft', 'videoUrl', 'location', 'ogImage'];
    const REQUIRED_PROPERTY_FIELDS = ['title', 'address', 'slug', 'status', 'downPayment', 'monthlyPayment', 'description', 'publishDate'];

    function mutateSettingsFacebook(value) {
      const parsed = JSON.parse(originalSettings);
      if (value === undefined) {
        delete parsed.main.social.facebook;
      } else {
        parsed.main.social.facebook = value;
      }
      writeFileSync(settingsPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
    }

    try {
      // -- R1: optional = null -------------------------------------------
      {
        let marengo = originalMarengo;
        let brown = originalBrown;
        let blog = originalBlog;
        for (const f of OPTIONAL_PROPERTY_FIELDS) {
          marengo = upsertFrontmatterKey(marengo, f, 'null');
          brown = upsertFrontmatterKey(brown, f, 'null');
        }
        blog = upsertFrontmatterKey(blog, 'coverImage', 'null');
        writeFileSync(marengoPath, marengo, 'utf8');
        writeFileSync(brownPath, brown, 'utf8');
        writeFileSync(blogPath, blog, 'utf8');
        mutateSettingsFacebook(null);

        clearAstroCache(toplevel);
        const build = runBuild(toplevel);
        restoreAll();

        if (build.timedOut) fail(id, `R1 (optional=null) build timed out`);
        if (build.status !== 0) {
          fail(id, `R1 (optional=null) build exited ${build.status}, expected 0:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
        }
        const homesIndex = readUtf8File(distHomesIndexPath);
        const cfdCount = countOccurrences(homesIndex, 'Call for details');
        if (cfdCount < 6) {
          fail(id, `R1 (optional=null): 'Call for details' occurs ${cfdCount} times in ${distHomesIndexPath}, expected >= 6 -- nulls did not normalize to undefined`);
        }
      }

      // -- R2: optional = empty string -------------------------------------
      {
        let marengo = originalMarengo;
        let brown = originalBrown;
        let blog = originalBlog;
        for (const f of OPTIONAL_PROPERTY_FIELDS) {
          marengo = upsertFrontmatterKey(marengo, f, `""`);
          brown = upsertFrontmatterKey(brown, f, `""`);
        }
        blog = upsertFrontmatterKey(blog, 'coverImage', `""`);
        writeFileSync(marengoPath, marengo, 'utf8');
        writeFileSync(brownPath, brown, 'utf8');
        writeFileSync(blogPath, blog, 'utf8');
        mutateSettingsFacebook('');

        clearAstroCache(toplevel);
        const build = runBuild(toplevel);
        restoreAll();

        if (build.timedOut) fail(id, `R2 (optional='') build timed out`);
        if (build.status !== 0) {
          fail(id, `R2 (optional='') build exited ${build.status}, expected 0:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
        }
        const homesIndex = readUtf8File(distHomesIndexPath);
        const cfdCount = countOccurrences(homesIndex, 'Call for details');
        if (cfdCount < 6) {
          fail(id, `R2 (optional=''): 'Call for details' occurs ${cfdCount} times in ${distHomesIndexPath}, expected >= 6 -- empty strings did not normalize to undefined`);
        }
      }

      // -- R3: optional absent ----------------------------------------------
      {
        let marengo = originalMarengo;
        let brown = originalBrown;
        let blog = originalBlog;
        for (const f of OPTIONAL_PROPERTY_FIELDS) {
          marengo = removeFrontmatterKey(marengo, f);
          brown = removeFrontmatterKey(brown, f);
        }
        blog = removeFrontmatterKey(blog, 'coverImage');
        writeFileSync(marengoPath, marengo, 'utf8');
        writeFileSync(brownPath, brown, 'utf8');
        writeFileSync(blogPath, blog, 'utf8');
        mutateSettingsFacebook(undefined);

        clearAstroCache(toplevel);
        const build = runBuild(toplevel);
        restoreAll();

        if (build.timedOut) fail(id, `R3 (optional=absent) build timed out`);
        if (build.status !== 0) {
          fail(id, `R3 (optional=absent) build exited ${build.status}, expected 0:\n${build.stdout.slice(-2000)}\n${build.stderr.slice(-2000)}`);
        }
        const homesIndex = readUtf8File(distHomesIndexPath);
        const cfdCount = countOccurrences(homesIndex, 'Call for details');
        if (cfdCount < 6) {
          fail(id, `R3 (optional=absent): 'Call for details' occurs ${cfdCount} times in ${distHomesIndexPath}, expected >= 6 -- an absent key did not normalize to undefined`);
        }
      }

      // -- R4: properties required = null (Marengo only) --------------------
      {
        let marengo = originalMarengo;
        for (const f of REQUIRED_PROPERTY_FIELDS) {
          marengo = upsertFrontmatterKey(marengo, f, 'null');
        }
        writeFileSync(marengoPath, marengo, 'utf8');

        clearAstroCache(toplevel);
        const build = runBuild(toplevel);
        restoreAll();

        if (build.timedOut) fail(id, `R4 (required=null) build timed out`);
        if (build.status === 0) {
          fail(id, `R4 (required=null) build exited 0 -- expected non-zero, required fields must reject null`);
        }
        const out = (build.stdout + build.stderr).toLowerCase();
        const missing = REQUIRED_PROPERTY_FIELDS.filter((f) => !out.includes(f.toLowerCase()));
        if (missing.length > 0) {
          fail(id, `R4 (required=null): build output does not name required field(s) [${missing.join(', ')}]`);
        }
      }

      // -- R5: properties required absent (Marengo only) ---------------------
      {
        let marengo = originalMarengo;
        for (const f of REQUIRED_PROPERTY_FIELDS) {
          marengo = removeFrontmatterKey(marengo, f);
        }
        writeFileSync(marengoPath, marengo, 'utf8');

        clearAstroCache(toplevel);
        const build = runBuild(toplevel);
        restoreAll();

        if (build.timedOut) fail(id, `R5 (required=absent) build timed out`);
        if (build.status === 0) {
          fail(id, `R5 (required=absent) build exited 0 -- expected non-zero, required fields must reject absence`);
        }
        const out = (build.stdout + build.stderr).toLowerCase();
        const missing = REQUIRED_PROPERTY_FIELDS.filter((f) => !out.includes(f.toLowerCase()));
        if (missing.length > 0) {
          fail(id, `R5 (required=absent): build output does not name required field(s) [${missing.join(', ')}]`);
        }
      }

      // -- R6: final rebuild, everything restored -----------------------------

      clearAstroCache(toplevel);
      const finalBuild = runBuild(toplevel);
      if (finalBuild.timedOut) fail(id, `R6 (final rebuild) timed out`);
      if (finalBuild.status !== 0) {
        fail(id, `R6 (final rebuild) exited ${finalBuild.status}, expected 0 -- the tree must be left in a known-good built state:\n${finalBuild.stdout.slice(-2000)}\n${finalBuild.stderr.slice(-2000)}`);
      }
    } finally {
      restoreAll();
    }

    // Blog and settings required fields (blog title/slug/date, settings
    // phone/phoneHref/email/homepageIntro) are covered by Layer A only, not
    // by their own R4/R5-style build round trips. Deliberate, budgeted scope
    // call for a hotfix: Layer A already fails loudly if any of them gains a
    // tolerance modifier, skeleton-e2e step 11 already proves the settings
    // phone field rejects a blank at build time, and adding four more builds
    // would roughly double this check's runtime for a strictly weaker
    // marginal guarantee than R4/R5 already provide for properties.

    pass(id);
  },

  /**
   * 260901-t59: computed (not asserted) WCAG AA contrast gate for the
   * full-bleed homepage hero banner. Verifies the committed hero JPEG's
   * shape, that the colour tokens used are pulled from src/styles/global.css
   * (never hardcoded here), that index.astro declares the expected hero
   * markup/CSS, and -- the core of the check -- computes real AA contrast
   * ratios by compositing the overlay gradient over the actual JPEG pixels,
   * both an absolute pure-white worst case and an 8x8 block-average worst
   * case. See 260901-t59-PLAN.md design decision D-B for why 0.62/0.72
   * replaces the mockup's 0.55/0.66.
   */
  'hero-contrast': async (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const heroImagePath = join(toplevel, 'public', 'uploads', 'hero', 'home-hero.jpg');
    const globalCssPath = join(toplevel, 'src', 'styles', 'global.css');
    const indexAstroPath = join(toplevel, 'src', 'pages', 'index.astro');

    // -- Step 1: asset -------------------------------------------------------

    if (!existsSync(heroImagePath)) {
      fail(id, `missing ${heroImagePath}`);
    }
    let metadata;
    try {
      metadata = await sharp(heroImagePath).metadata();
    } catch (e) {
      fail(id, `sharp could not read metadata for ${heroImagePath}: ${e}`);
    }
    if (metadata.format !== 'jpeg') {
      fail(id, `${heroImagePath} has format '${metadata.format}', expected 'jpeg'`);
    }
    if (Math.max(metadata.width, metadata.height) > 2000) {
      fail(id, `${heroImagePath} is ${metadata.width}x${metadata.height}, exceeds the 2000px pre-resize rule`);
    }

    // -- Step 2: token resolution ---------------------------------------------

    let globalCss;
    try {
      globalCss = readUtf8File(globalCssPath);
    } catch {
      fail(id, `missing ${globalCssPath}`);
    }
    function resolveToken(name) {
      const m = globalCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
      if (!m) fail(id, `${globalCssPath} does not declare '--${name}' as a hex value`);
      return m[1];
    }
    const creamHex = resolveToken('color-cream');
    const inkHex = resolveToken('color-ink');
    const accentHex = resolveToken('color-accent');

    // -- Step 3: source declarations -------------------------------------------

    let indexAstro;
    try {
      indexAstro = readUtf8File(indexAstroPath);
    } catch {
      fail(id, `missing ${indexAstroPath}`);
    }
    const requiredSubstrings = [
      '/uploads/hero/home-hero.jpg',
      'background-size: cover',
      'background-position: center 42%',
    ];
    for (const s of requiredSubstrings) {
      if (!indexAstro.includes(s)) {
        fail(id, `${indexAstroPath} is missing the required substring '${s}'`);
      }
    }
    if (!/\.hero\s*\{[^}]*color:\s*var\(--color-cream\)/.test(indexAstro)) {
      fail(id, `${indexAstroPath}'s .hero rule does not declare color: var(--color-cream)`);
    }
    if (!/background-color:\s*var\(--color-accent\)/.test(indexAstro)) {
      fail(id, `${indexAstroPath} is missing a rule with background-color: var(--color-accent) (expected on the pill)`);
    }
    if (!/color:\s*var\(--color-ink\)/.test(indexAstro)) {
      fail(id, `${indexAstroPath} is missing a rule with color: var(--color-ink) (expected on the pill)`);
    }
    if (indexAstro.includes('64ch')) {
      fail(id, `${indexAstroPath} still contains '64ch' -- the hero must no longer be width-constrained`);
    }

    // -- Step 4: colour-declaration hygiene ------------------------------------

    const hexColorDeclRe = /(?<![\w-])(?:background-)?color:\s*#/;
    if (hexColorDeclRe.test(indexAstro)) {
      fail(id, `${indexAstroPath} declares a literal hex colour -- every colour must resolve through a var(--color-*) token (the two rgba() overlay stops are the only permitted literal colour values)`);
    }

    // -- Step 5: overlay parse --------------------------------------------------

    const overlayMatches = [...indexAstro.matchAll(/rgba\(\s*26\s*,\s*24\s*,\s*20\s*,\s*([0-9.]+)\s*\)/g)];
    if (overlayMatches.length !== 2) {
      fail(id, `${indexAstroPath} contains ${overlayMatches.length} rgba(26, 24, 20, ...) overlay stop(s), expected exactly 2`);
    }
    const overlayAlphas = overlayMatches.map((m) => parseFloat(m[1])).sort((a, b) => a - b);
    const lighterAlpha = overlayAlphas[0];
    if (lighterAlpha < 0.6) {
      fail(id, `${indexAstroPath}'s overlay alphas are [${overlayAlphas.join(', ')}] -- the lighter stop (${lighterAlpha}) is below the 0.60 AA floor`);
    }

    // -- Step 6: the actual contrast computation ---------------------------------

    function hexToRgb(hex) {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function srgbToLin(s) {
      const c = s / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }
    function relLuminance([r, g, b]) {
      return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
    }
    function contrastRatio(rgbA, rgbB) {
      const La = relLuminance(rgbA);
      const Lb = relLuminance(rgbB);
      const lighter = Math.max(La, Lb);
      const darker = Math.min(La, Lb);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const OVERLAY_RGB = [26, 24, 20];
    function composite(imageRgb, alpha) {
      return [0, 1, 2].map((i) => alpha * OVERLAY_RGB[i] + (1 - alpha) * imageRgb[i]);
    }

    const creamRgb = hexToRgb(creamHex);

    // (a) absolute worst case: a pure-white pixel composited at the lighter stop.
    const absoluteComposited = composite([255, 255, 255], lighterAlpha);
    const absoluteRatio = contrastRatio(creamRgb, absoluteComposited);
    if (absoluteRatio < 4.5) {
      fail(id, `absolute worst-case contrast is ${absoluteRatio.toFixed(3)}:1 (alpha ${lighterAlpha}), below the 4.5:1 AA floor`);
    }

    // (b) block worst case: 8x8 block-average over the real JPEG pixels.
    let raw;
    try {
      raw = await sharp(heroImagePath).raw().toBuffer({ resolveWithObject: true });
    } catch (e) {
      fail(id, `sharp could not decode raw pixels for ${heroImagePath}: ${e}`);
    }
    const { data, info } = raw;
    const { width, height, channels } = info;
    const BLOCK = 8;
    let minBlockRatio = Infinity;
    let worstBlock = null;
    for (let by = 0; by < height; by += BLOCK) {
      for (let bx = 0; bx < width; bx += BLOCK) {
        const bw = Math.min(BLOCK, width - bx);
        const bh = Math.min(BLOCK, height - by);
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;
        for (let y = by; y < by + bh; y++) {
          for (let x = bx; x < bx + bw; x++) {
            const idx = (y * width + x) * channels;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count += 1;
          }
        }
        const avgRgb = [sumR / count, sumG / count, sumB / count];
        const blockComposited = composite(avgRgb, lighterAlpha);
        const blockRatio = contrastRatio(creamRgb, blockComposited);
        if (blockRatio < minBlockRatio) {
          minBlockRatio = blockRatio;
          worstBlock = { x: bx, y: by, rgb: avgRgb };
        }
      }
    }
    if (minBlockRatio < 4.5) {
      fail(
        id,
        `block worst-case contrast is ${minBlockRatio.toFixed(3)}:1 (alpha ${lighterAlpha}) at block x=${worstBlock.x} y=${worstBlock.y} rgb=(${worstBlock.rgb.map((v) => v.toFixed(1)).join(', ')}), below the 4.5:1 AA floor`,
      );
    }

    // -- Step 7: pill contrast ---------------------------------------------------

    const pillRatio = contrastRatio(hexToRgb(inkHex), hexToRgb(accentHex));
    if (pillRatio < 4.5) {
      fail(id, `pill contrast (ink on accent) is ${pillRatio.toFixed(3)}:1, below the 4.5:1 AA floor`);
    }

    process.stdout.write(
      `hero-contrast: absolute worst-case ratio ${absoluteRatio.toFixed(3)}:1, block worst-case ratio ${minBlockRatio.toFixed(3)}:1, pill ratio ${pillRatio.toFixed(3)}:1\n`,
    );

    pass(id);
  },

  /**
   * quick-260902-txo Task 2: an unresolved legal fact cannot ship silently.
   *
   * src/data/legal.ts ships two bracketed placeholder tokens
   * (LEGAL_ENTITY_NAME, BUSINESS_ADDRESS) that must be replaced with real
   * values before the site goes live and before the 10DLC brand
   * registration is submitted. This check scans the legal source files
   * (and, once a build exists, the built HTML) for any doubled-square-
   * bracket uppercase token and fails naming each one by file:line, so a
   * placeholder can never reach ownwithoak.com unnoticed.
   *
   * Runs a two-fixture self-test of its own detector before scanning
   * anything real, so a broken regex reports itself instead of silently
   * passing everything.
   */
  'legal-placeholders': (id) => {
    const toplevelResult = runGit(['rev-parse', '--show-toplevel']);
    if (!toplevelResult.ok) {
      fail(id, `could not determine worktree root: ${toplevelResult.reason || toplevelResult.stderr}`);
    }
    const toplevel = resolve(toplevelResult.stdout);

    const placeholderPattern = /\[\[([A-Z0-9_]+)\]\]/g;

    function findPlaceholders(text) {
      const findings = [];
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const re = new RegExp(placeholderPattern.source, 'g');
        let m;
        while ((m = re.exec(line)) !== null) {
          findings.push({ token: m[1], line: i + 1 });
        }
      }
      return findings;
    }

    // -- Self-test: prove the detector before trusting it -----------------
    const positiveFixture = 'This sentence names a placeholder: [[SELF_TEST_TOKEN]] right here.';
    const negativeFixture = 'This sentence references [a] and [B] but neither is a real placeholder.';

    const positiveFindings = findPlaceholders(positiveFixture);
    const negativeFindings = findPlaceholders(negativeFixture);

    if (positiveFindings.length !== 1 || positiveFindings[0].token !== 'SELF_TEST_TOKEN') {
      fail(id, 'detector self-test did not behave as specified: positive fixture did not yield exactly one SELF_TEST_TOKEN finding');
    }
    if (negativeFindings.length !== 0) {
      fail(id, 'detector self-test did not behave as specified: negative fixture yielded a finding for single-bracketed text');
    }
    process.stdout.write('legal-placeholders: detector self-test OK (2 fixtures)\n');

    // -- Build the scan list -----------------------------------------------
    // Deliberately excludes this file (scripts/verify/checks.mjs) itself --
    // its own self-test fixture contains a bracketed token by construction,
    // and scanning itself would make this check permanently self-failing.
    const requiredSourcePaths = [
      join(toplevel, 'src', 'data', 'legal.ts'),
      join(toplevel, 'src', 'pages', 'privacy.astro'),
      join(toplevel, 'src', 'pages', 'sms-terms.astro'),
    ];

    for (const p of requiredSourcePaths) {
      if (!existsSync(p)) {
        fail(id, `required legal source file is missing: ${p}`);
      }
    }

    const scanPaths = [...requiredSourcePaths];

    const distDir = join(toplevel, 'dist');
    if (existsSync(distDir)) {
      for (const p of walkFiles(distDir)) {
        if (p.endsWith('.html')) {
          scanPaths.push(p);
        }
      }
    }

    const findings = [];
    for (const p of scanPaths) {
      const text = readUtf8File(p);
      const relPath = p.startsWith(toplevel) ? p.slice(toplevel.length + 1).split(sep).join('/') : p;
      for (const f of findPlaceholders(text)) {
        findings.push(`${relPath}:${f.line}: ${f.token}`);
      }
    }
    findings.sort();

    if (findings.length > 0) {
      fail(
        id,
        `unresolved: found ${findings.length} placeholder(s). Each must be replaced with a real value before the site goes live and before the 10DLC brand registration is submitted.\n` +
          findings.join('\n'),
      );
    }

    pass(id);
  },
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const checkId = process.argv[2];

if (!checkId || !Object.prototype.hasOwnProperty.call(checks, checkId)) {
  const known = Object.keys(checks).join(', ');
  process.stderr.write(`FAIL ${checkId || '(none)'}: unknown check id. Known checks: ${known}\n`);
  process.exit(1);
}

// Checks are ordinarily synchronous and call process.exit() themselves via
// pass()/fail(). photos-resized is async (it awaits sharp metadata reads),
// so a returned thenable is caught here -- an uncaught rejection would
// otherwise hang or exit with Node's generic unhandled-rejection code
// instead of a clear FAIL line naming this check.
const result = checks[checkId](checkId);
if (result && typeof result.then === 'function') {
  result.catch((err) => {
    process.stderr.write(`FAIL ${checkId}: unexpected error: ${err && err.stack ? err.stack : err}\n`);
    process.exit(1);
  });
}
