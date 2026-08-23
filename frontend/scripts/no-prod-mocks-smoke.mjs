#!/usr/bin/env node
// no-prod-mocks-smoke.mjs — guards against demo/mock data creeping back into
// the production frontend bundle.
//
// History: this script used to read `frontend/public/design/`, a directory that
// disappeared when the sources moved to `frontend/src/`. It failed with an
// unhandled ENOENT for an unknown amount of time (issue #114). It now walks
// `frontend/src/` recursively and matches generic patterns instead of a
// hand-maintained per-file list of forbidden strings.
//
// Exit codes: 0 = clean (known exceptions may be reported), 1 = new mock data
// found or the scan could not run. Never throws an unhandled stack trace.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const SRC = resolve(import.meta.dirname, '..', 'src');
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.vite']);

// ── Patterns that mark hardcoded demo data ────────────────────────────────
// `fallback[A-Z]` (not bare "fallback") so that prose/comments about e.g. a
// "ctrl+wheel fallback" do not trip the check — only identifiers such as
// `fallbackPatient` / `fallbackJobs` do.
const PATTERNS = [
  { name: 'fallback*', re: /\bfallback[A-Z]\w*/g },
  { name: 'DEMO_*', re: /\bDEMO_[A-Z0-9_]+/g },
  { name: 'SAMPLE_*', re: /\bSAMPLE_[A-Z0-9_]+/g },
  // Literal atrapy that shipped in the original design prototype. Cheap to
  // keep as an explicit list — these strings have no legitimate use in app code.
  {
    name: 'demo literal',
    re: /(Mária Kováčová|Klinika Bratislava|ZubMed Košice|jan\.novak@dl\.sk|anna\.m@dl\.sk|INV-2025-012|Lucia Šimková|Implantát — T\. Varga|Nová práca pridelená)/g,
  },
];

// ── Known, tolerated exceptions ───────────────────────────────────────────
// Files that legitimately still contain demo data today. Each entry MUST carry
// the issue that tracks removing it. Matches inside these files are reported
// as tolerated and do not fail the build — the point of this script is to stop
// NEW mocks, not to block CI on a backlog that is already tracked.
//
// `patterns` scopes the exception: anything matching a pattern NOT listed here
// still fails, even in an excepted file.
const EXCEPTIONS = [
  {
    // Design-prototype tooth-chart components. Still rendered from a static
    // DEMO_STATE object instead of the workspace API. Removing them is tracked
    // separately; failing CI on them here would just block every pipeline.
    file: 'components/polozky-shared.jsx',
    patterns: ['DEMO_*'],
    issue: '#115',
  },
  { file: 'components/variant-anatomical.jsx', patterns: ['DEMO_*', 'demo literal'], issue: '#115' },
  { file: 'components/variant-arch.jsx', patterns: ['DEMO_*', 'demo literal'], issue: '#115' },
  { file: 'components/variant-detail.jsx', patterns: ['DEMO_*'], issue: '#116' },
  { file: 'components/variant-grid.jsx', patterns: ['DEMO_*'], issue: '#116' },
];

// ── Additional structural check: pages that must talk to the API ──────────
// A page whose whole content is hardcoded is a mock even without a `fallback`
// identifier. Superadmin.jsx used to be exactly that case; it now reads live
// data (#109), so the exception is gone and a regression fails the build.
const API_BACKED_PAGES = [
  'pages/Superadmin.jsx',
];
const API_BACKED_EXCEPTIONS = {};
const API_CALL_RE = /\b(MolarisAPI|useWorkspace|loadWorkspace|request\()/;

const patternIndex = new Map(PATTERNS.map((p) => [p.name, p]));
const exceptionIndex = new Map(EXCEPTIONS.map((e) => [e.file, e]));

function fail(message) {
  console.error(`no-prod-mocks smoke: ${message}`);
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
  fail(
    `source directory not found: ${SRC} (${err.code || err.message}). ` +
      'Frontend sources are expected under frontend/src/.',
  );
}

const files = walk(SRC);
if (files.length === 0) fail(`no source files found under ${SRC}`);

const failures = [];
const tolerated = [];
const usedExceptions = new Set();

for (const full of files) {
  const rel = relative(SRC, full).split(sep).join('/');
  let content;
  try {
    content = readFileSync(full, 'utf8');
  } catch (err) {
    fail(`cannot read ${rel}: ${err.code || err.message}`);
  }

  const exception = exceptionIndex.get(rel);
  const lines = content.split('\n');

  for (const { name, re } of PATTERNS) {
    const allowed = exception && exception.patterns.includes(name);
    for (let i = 0; i < lines.length; i += 1) {
      re.lastIndex = 0;
      const hits = lines[i].match(re);
      if (!hits) continue;
      const entry = `${rel}:${i + 1}: ${name} — ${[...new Set(hits)].join(', ')}`;
      if (allowed) {
        usedExceptions.add(rel);
        tolerated.push(`${entry} (tolerated, tracked in ${exception.issue})`);
      } else {
        failures.push(entry);
      }
    }
  }

  if (API_BACKED_PAGES.includes(rel) && !API_CALL_RE.test(content)) {
    const issue = API_BACKED_EXCEPTIONS[rel];
    const entry = `${rel}: page renders only hardcoded content — no MolarisAPI/workspace call found`;
    if (issue) {
      usedExceptions.add(rel);
      tolerated.push(`${entry} (tolerated, tracked in ${issue})`);
    } else {
      failures.push(entry);
    }
  }
}

// Exceptions that no longer match anything are stale — report, do not fail.
const stale = [
  ...EXCEPTIONS.map((e) => e.file),
  ...Object.keys(API_BACKED_EXCEPTIONS),
].filter((f, i, arr) => arr.indexOf(f) === i && !usedExceptions.has(f));

if (tolerated.length) {
  console.log(`no-prod-mocks smoke: ${tolerated.length} tolerated finding(s) in known files:`);
  for (const line of tolerated) console.log(`  - ${line}`);
}

if (stale.length) {
  console.log('no-prod-mocks smoke: exceptions that no longer match — remove them from this script:');
  for (const file of stale) console.log(`  - ${file}`);
}

if (failures.length) {
  console.error('');
  console.error(`no-prod-mocks smoke FAILED — ${failures.length} demo/mock finding(s) outside the known exceptions:`);
  for (const line of failures) console.error(`  - ${line}`);
  console.error('');
  console.error('Fix: load the data from the API instead of hardcoding it.');
  console.error('If the finding is a deliberate, tracked exception, add it to EXCEPTIONS');
  console.error(`in ${relative(process.cwd(), resolve(import.meta.dirname, 'no-prod-mocks-smoke.mjs'))} with the issue number.`);
  process.exit(1);
}

console.log(`no-prod-mocks smoke OK — scanned ${files.length} files under frontend/src/, ${patternIndex.size} pattern groups, no new mock data.`);
