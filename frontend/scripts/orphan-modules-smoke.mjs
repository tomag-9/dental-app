#!/usr/bin/env node
// orphan-modules-smoke.mjs — guards against .jsx files that are never loaded.
//
// Why this exists (#115): the frontend has no bundler dependency graph. Every
// component registers itself on `window` and `frontend/src/main.js` loads the
// modules one by one, in a hand-maintained order, via dynamic `import()`.
// A .jsx file that is not listed in `appModules` is therefore never evaluated,
// never reaches the build — and yet `npm run lint` still checks it, so it looks
// alive in the repository. Seven files (~3 100 lines) had been dead that way
// since the design prototype was imported.
//
// The check: every .jsx under frontend/src/ must be either
//   a) listed in the `appModules` array in main.js, or
//   b) listed in EXCEPTIONS below together with the issue that tracks it.
// Additionally every `appModules` entry must point at a file that exists.
//
// Exit codes: 0 = clean, 1 = orphaned/missing module or the scan could not run.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const SRC = resolve(import.meta.dirname, '..', 'src');
const MAIN = resolve(SRC, 'main.js');
const EXTENSIONS = ['.jsx'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.vite']);

// ── Deliberately not loaded by main.js ────────────────────────────────────
// Each entry MUST carry a reason and the issue that tracks it. Anything else
// that is missing from `appModules` fails the check.
//
// Empty on purpose: after #115 every .jsx in src/ is wired. Files that are not
// product code were deleted rather than excepted — an exception here is for a
// file that must stay in the tree while being loaded some other way (e.g. a
// lazily imported route), not for dead code.
/** @type {{ file: string, issue: string, reason: string }[]} */
const EXCEPTIONS = [];

function fail(message) {
  console.error(`orphan-modules smoke: ${message}`);
  process.exit(1);
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    fail(`cannot read ${dir}: ${err.code || err.message}`);
  }
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

try {
  if (!statSync(SRC).isDirectory()) fail(`${SRC} is not a directory`);
} catch (err) {
  fail(`source directory not found: ${SRC} (${err.code || err.message})`);
}

let mainSource;
try {
  mainSource = readFileSync(MAIN, 'utf8');
} catch (err) {
  fail(`cannot read ${MAIN}: ${err.code || err.message}`);
}

const block = mainSource.match(/const\s+appModules\s*=\s*\[([\s\S]*?)\]\s*;/);
if (!block) fail('could not find the `appModules = [ ... ]` array in src/main.js');

const loaded = new Set();
for (const match of block[1].matchAll(/import\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)) {
  loaded.add(match[1]);
}
if (loaded.size === 0) fail('`appModules` in src/main.js lists no dynamic imports');

const files = walk(SRC).map((full) => relative(SRC, full).split(sep).join('/'));
if (files.length === 0) fail(`no ${EXTENSIONS.join('/')} files found under ${SRC}`);

const exceptionIndex = new Map(EXCEPTIONS.map((e) => [e.file, e]));
const orphans = [];
const tolerated = [];
const usedExceptions = new Set();

for (const rel of files.sort()) {
  if (loaded.has(rel)) continue;
  const exception = exceptionIndex.get(rel);
  if (exception) {
    usedExceptions.add(rel);
    tolerated.push(`${rel} — ${exception.reason} (tolerated, tracked in ${exception.issue})`);
  } else {
    orphans.push(rel);
  }
}

// `appModules` entries whose file no longer exists would crash boot().
const known = new Set(files);
const missing = [...loaded].filter((rel) => rel.endsWith('.jsx') && !known.has(rel));

const stale = EXCEPTIONS.map((e) => e.file).filter((f) => !usedExceptions.has(f));

if (tolerated.length) {
  console.log(`orphan-modules smoke: ${tolerated.length} tolerated file(s) not in appModules:`);
  for (const line of tolerated) console.log(`  - ${line}`);
}

if (stale.length) {
  console.log('orphan-modules smoke: exceptions that no longer apply — remove them from this script:');
  for (const file of stale) console.log(`  - ${file}`);
}

if (missing.length) {
  console.error('');
  console.error(`orphan-modules smoke FAILED — ${missing.length} appModules entr(ies) point at a missing file:`);
  for (const rel of missing) console.error(`  - ${rel}`);
}

if (orphans.length) {
  console.error('');
  console.error(`orphan-modules smoke FAILED — ${orphans.length} .jsx file(s) under frontend/src/ are never loaded:`);
  for (const rel of orphans) console.error(`  - ${rel}`);
  console.error('');
  console.error('Fix: add the file to `appModules` in frontend/src/main.js (mind the load order —');
  console.error('a module must come after the modules whose window globals it uses), or delete it.');
  console.error('If it is deliberately loaded some other way, add it to EXCEPTIONS in');
  console.error(`${relative(process.cwd(), resolve(import.meta.dirname, 'orphan-modules-smoke.mjs'))} with the issue number.`);
}

if (missing.length || orphans.length) process.exit(1);

console.log(
  `orphan-modules smoke OK — ${files.length} .jsx file(s) under frontend/src/, all reachable from appModules.`,
);
