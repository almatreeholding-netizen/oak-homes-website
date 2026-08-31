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

      // -- 6. Zero-photo entry builds (Marengo's photos are already []) ---

      if (!originalPropertyFile.includes('photos: []')) {
        fail(id, `src/content/properties/614-e-marengo-st.md does not have an empty photos array — the baseline build above no longer exercises the zero-photo state`);
      }
      // The baseline build in step 1 already proved this exact state builds
      // clean, so no separate mutation/build round-trip is needed here.

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

      const movedPath = join(toplevel, '.tmp-moved-property.md.bak');
      renameSync(propertyFile, movedPath);
      clearAstroCache(toplevel);
      build = runBuild(toplevel);
      renameSync(movedPath, propertyFile);
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

    // Property page's gallery region carries the placeholder mark while
    // photos is empty.
    const propertyPagePath = join(distDir, 'homes', '614-e-marengo-st', 'index.html');
    if (!existsSync(propertyPagePath)) {
      fail(id, `missing ${propertyPagePath}`);
    }
    const propertyPage = readUtf8File(propertyPagePath);
    const galleryRegionMatch = propertyPage.match(/<div class="gallery-region"[^]*?<\/div>\s*<\/div>/);
    if (!galleryRegionMatch || !galleryRegionMatch[0].includes('/brand/')) {
      fail(id, `${propertyPagePath}'s gallery-region does not reference a brand asset — the zero-photo placeholder must render the mark`);
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
