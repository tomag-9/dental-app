#!/usr/bin/env node
// tooth-chart-smoke.mjs — verifies the dental cross renders JOB data, not demo data.
//
// Why this exists (#116): `components/variant-detail.jsx` is the tooth chart that
// ships (it is in main.js `appModules` and mounted from App.jsx). It used to fall
// back to the hardcoded `DEMO_STATE` / `REGION_PROCEDURES` prototype fixtures and
// never read the fields the backend actually stores:
//   Job.input_tooth_procedures / Job.output_tooth_procedures,
//   Patient.tooth_procedures,
//   JobItem.tooth / tooth_scope / tooth_state / bridge_span.
//
// The frontend has no bundler, no JSX transform outside Vite and no unit-test
// runner: every component is a plain script that reads globals and registers
// itself on `window`. So this check evaluates the two relevant files in a Node
// `vm` context with a stub React, then exercises the pure derivation function
// `buildToothChartState()` directly. No DOM, no stack, no browser.
//
// Exit codes: 0 = all assertions pass, 1 = a check failed.

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const SRC = resolve(import.meta.dirname, '..', 'src');
const MODULES = ['components/polozky-shared.jsx', 'components/variant-detail.jsx'];

const failures = [];
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

// ── Stub React: enough for module evaluation + tree inspection ─────────────
function makeReactStub() {
  return {
    createElement: (type, props, ...children) => ({
      type, props: props || {}, children: children.flat(Infinity).filter((c) => c != null && c !== false),
    }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (initial) => ({ current: initial }),
    Fragment: 'Fragment',
  };
}

const sandbox = { console, Object, Array, Math, Number, String, JSON, Set, Map, Date, Boolean, Intl };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.React = makeReactStub();
sandbox.MolarisAPI = {};
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
sandbox.dispatchEvent = () => {};
const context = createContext(sandbox);

const sources = {};
for (const rel of MODULES) {
  const full = resolve(SRC, rel);
  let source;
  try {
    source = readFileSync(full, 'utf8');
  } catch (err) {
    console.error(`tooth-chart smoke: cannot read ${rel}: ${err.code || err.message}`);
    process.exit(1);
  }
  sources[rel] = source;
  try {
    runInContext(source, context, { filename: relative(process.cwd(), full) });
  } catch (err) {
    console.error(`tooth-chart smoke: ${rel} failed to evaluate: ${err.message}`);
    process.exit(1);
  }
}

// ── 1. No demo fixtures left in the production tooth chart ────────────────
console.log('tooth-chart smoke: demo fixtures removed from the shipped chart');
for (const rel of MODULES) {
  const source = sources[rel];
  check(`${rel}: no DEMO_* fixture`, !/\bDEMO_[A-Z0-9_]+/.test(source));
  check(`${rel}: no hardcoded demo patient name`, !/Bezáková Gabriela/.test(source));
  check(
    `${rel}: no hardcoded demo dates`,
    !/'\d{1,2}\.\d{1,2}\.20\d\d'/.test(source),
  );
}

// ── 2. The derivation function exists and is pure ─────────────────────────
console.log('tooth-chart smoke: buildToothChartState() derives the chart from job data');
const build = sandbox.buildToothChartState;
check('window.buildToothChartState is exposed', typeof build === 'function');
if (typeof build !== 'function') {
  report();
}

// Fixture mirrors the API payload: a job with a tooth map plus items carrying
// tooth / tooth_scope / tooth_state / bridge_span.
const job = {
  id: 4711,
  output_tooth_procedures: { 26: 'KOR-ZIR', 36: ['ONL-KER', 'LEP-001'] },
  input_tooth_procedures: { 11: 'VEN-KER' },
  items: [
    { price_list_code: 'MOS-3Z', tooth: '45', bridge_span: '45-47', procedure_category: 'bridge', tooth_state: 'planned', quantity: 1, unit_price: '120.00' },
    { price_list_code: 'EXT-001', tooth: '17', tooth_state: 'missing', quantity: 1, unit_price: '0.00' },
    { price_list_code: 'IMP-ABU', tooth: '16', tooth_state: 'implant', quantity: 1, unit_price: '300.00' },
    { price_list_code: 'KOR-KER', tooth: '25', tooth_state: 'temporary', quantity: 1, unit_price: '90.00' },
    { price_list_code: 'DSH-001', tooth: '', tooth_scope: 'U', tooth_state: 'planned', quantity: 1, unit_price: '30.00' },
  ],
};

const state = build({ job, items: job.items });

check('procs read Job.output_tooth_procedures', (state.procs['26'] || []).includes('KOR-ZIR'),
  JSON.stringify(state.procs));
check('procs accept a list value in the tooth map', (state.procs['36'] || []).includes('ONL-KER'));
check('procs fall back to input_tooth_procedures for untouched teeth', (state.procs['11'] || []).includes('VEN-KER'));
check('procs include JobItem.tooth entries', (state.procs['25'] || []).includes('KOR-KER'));
check('bridges come from JobItem.bridge_span', state.bridges.some((b) => String(b.from) === '45' && String(b.to) === '47'),
  JSON.stringify(state.bridges));
check('missing comes from tooth_state=missing', state.missing.has(17), [...state.missing].join(','));
check('implants come from tooth_state=implant', state.implants.has(16), [...state.implants].join(','));
check('temporary comes from tooth_state=temporary', state.temporary.has(25), [...state.temporary].join(','));
check('region procedures come from JobItem.tooth_scope',
  state.regionProcedures.some((r) => r.scope === 'upper' && r.code === 'DSH-001'),
  JSON.stringify(state.regionProcedures));
check('scoped items are not drawn on the cross', !state.procs['']);

// ── 3. Empty input yields an empty chart, never demo data ─────────────────
console.log('tooth-chart smoke: empty job renders an empty chart');
const empty = build({ job: null, items: [] });
check('no teeth', Object.keys(empty.procs).length === 0, JSON.stringify(empty.procs));
check('no bridges', empty.bridges.length === 0);
check('no missing/implant/temporary', empty.missing.size === 0 && empty.implants.size === 0 && empty.temporary.size === 0);
check('no region procedures', empty.regionProcedures.length === 0, JSON.stringify(empty.regionProcedures));

// ── 4. Patient cumulative map (Patient.tooth_procedures) ─────────────────
console.log('tooth-chart smoke: patient cumulative map is supported');
const cumulative = build({ toothProcedures: { 11: 'crown', 12: ['veneer'] } });
check('toothProcedures populates the chart',
  (cumulative.procs['11'] || []).includes('crown') && (cumulative.procs['12'] || []).includes('veneer'),
  JSON.stringify(cumulative.procs));

// ── 5. The chart component actually consumes the derivation ──────────────
console.log('tooth-chart smoke: ToothCrossDetail renders the derived state');
check('window.ToothCrossDetail is exposed', typeof sandbox.ToothCrossDetail === 'function');
if (typeof sandbox.ToothCrossDetail === 'function') {
  let tree;
  try {
    tree = sandbox.ToothCrossDetail({ job, items: job.items, patient: { name: 'Testovací Pacient', workId: '4711' } });
  } catch (err) {
    check('ToothCrossDetail renders without throwing', false, err.message);
  }
  if (tree) {
    const rows = [];
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (node.props && node.props.procs) rows.push(node.props);
      for (const child of node.children || []) walk(child);
      for (const value of Object.values(node.props || {})) {
        if (value && typeof value === 'object' && (value.type || Array.isArray(value))) walk(value);
      }
    })(tree);
    check('a tooth row receives the derived procs', rows.some((p) => (p.procs['26'] || []).includes('KOR-ZIR')),
      `${rows.length} row(s) with procs`);
    check('a tooth row receives the derived bridges',
      rows.some((p) => Array.isArray(p.bridges) && p.bridges.some((b) => String(b.to) === '47')));
    const flat = JSON.stringify(tree, (k, v) => (v instanceof Set ? [...v] : v));
    check('rendered tree carries the real patient name', flat.includes('Testovací Pacient'));
  }
}

report();

function report() {
  console.log('');
  if (failures.length) {
    console.error(`tooth-chart smoke FAILED — ${failures.length} check(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error('');
    console.error('Fix: derive the chart state from Job.input_tooth_procedures /');
    console.error('output_tooth_procedures, Patient.tooth_procedures and the JobItem');
    console.error('tooth / tooth_scope / tooth_state / bridge_span fields (#116).');
    process.exit(1);
  }
  console.log('tooth-chart smoke OK — the dental cross is driven by job data.');
  process.exit(0);
}
