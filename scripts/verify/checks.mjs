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

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

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

    const logResult = runGit(['log', 'origin/main', '--oneline', '-1']);
    if (!logResult.ok) {
      fail(id, `git log origin/main --oneline -1 failed: ${logResult.timedOut ? logResult.reason : logResult.stderr}`);
    }
    if (!logResult.stdout.includes('preserve mockup, one-pager, and logo sources in repo')) {
      fail(id, `git log origin/main --oneline -1 does not show the Task 2 commit — got: '${logResult.stdout}'`);
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

checks[checkId](checkId);
