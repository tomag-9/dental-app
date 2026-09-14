#!/usr/bin/env node
// job-label-smoke.mjs — verifies the prosthetic label UI (#100) is wired to the
// real backend, not hardcoded, and that the IPZP payment-split recompute (#96)
// matches the server invariant `insurance_amount + patient_amount == total`.
//
// Static check via Node `vm` with a stub React — no bundler, no browser (see
// scripts/tooth-chart-smoke.mjs for the pattern this follows).
//
// Exit codes: 0 = all assertions pass, 1 = a check failed.

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const SRC = resolve(import.meta.dirname, '..', 'src');
const LABEL_MODULES = ['components/JobDetailSections.jsx', 'components/JobLabelSection.jsx'];
const ITEMS_MODULES = ['components/nj-items.jsx'];

const failures = [];
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

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

function loadModules(relPaths) {
  const sandbox = { console, Object, Array, Math, Number, String, JSON, Set, Map, Date, Boolean, Intl, URL };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.React = makeReactStub();
  sandbox.MolarisAPI = { request: () => Promise.resolve({}) };
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.dispatchEvent = () => {};
  const context = createContext(sandbox);
  const sources = {};
  for (const rel of relPaths) {
    const full = resolve(SRC, rel);
    let source;
    try {
      source = readFileSync(full, 'utf8');
    } catch (err) {
      console.error(`job-label smoke: cannot read ${rel}: ${err.code || err.message}`);
      process.exit(1);
    }
    sources[rel] = source;
    try {
      runInContext(source, context, { filename: relative(process.cwd(), full) });
    } catch (err) {
      console.error(`job-label smoke: ${rel} failed to evaluate: ${err.message}`);
      process.exit(1);
    }
  }
  return { sandbox, sources };
}

// ── 1. The label section exists, is wired to appModules, and calls the API ──
console.log('job-label smoke: label section is wired to the real backend');

const mainJs = readFileSync(resolve(SRC, 'main.js'), 'utf8');
check('JobLabelSection.jsx is registered in appModules (src/main.js)', /JobLabelSection\.jsx/.test(mainJs));

const { sandbox: labelSandbox, sources: labelSources } = loadModules(LABEL_MODULES);
const labelSource = labelSources['components/JobLabelSection.jsx'] || '';

check('window.JobLabelSection is exposed', typeof labelSandbox.JobLabelSection === 'function');
check(
  'label section calls MolarisAPI / request(), not hardcoded data',
  /MolarisAPI\.[a-zA-Z]+\(|\brequest\(/.test(labelSource),
);
check('no hardcoded label number in the section source', !/"?ŠT-\d+"?/.test(labelSource));
check(
  'label section reads label_missing_fields / label_number from the job payload',
  /label_missing_fields/.test(labelSource) && /label_number/.test(labelSource),
);

// ── 2. Job detail edit form carries diagnosis_code / health_note (#94) ──────
console.log('job-label smoke: diagnosis code and health note are distinct from the technician note (#94)');
const jobDetailSectionsSource = labelSources['components/JobDetailSections.jsx'] || '';
check('JobHeader edit form has a diagnosis_code field', /diagnosis_code/.test(jobDetailSectionsSource));
check('JobHeader edit form has a health_note field', /health_note/.test(jobDetailSectionsSource));

const newJobSource = readFileSync(resolve(SRC, 'components/NewJob.jsx'), 'utf8');
check('NewJobDrawer collects diagnosisCode', /diagnosisCode/.test(newJobSource));
check('NewJobDrawer collects healthNote', /healthNote/.test(newJobSource));
check('NewJobDrawer submits diagnosis_code to the API', /diagnosis_code:/.test(newJobSource));
check('NewJobDrawer submits health_note to the API', /health_note:/.test(newJobSource));

// ── 3. IPZP columns + live recompute in the job item editor (#96) ──────────
console.log('job-label smoke: IPZP code + payment split columns recompute like the backend invariant');
const { sandbox: itemsSandbox } = loadModules(ITEMS_MODULES);

check('window.NJItems is exposed', typeof itemsSandbox.NJItems === 'function');
check('window.resolvePaymentSplit is exposed', typeof itemsSandbox.resolvePaymentSplit === 'function');

const resolve_ = itemsSandbox.resolvePaymentSplit;
if (typeof resolve_ === 'function') {
  // total = 100.00, only insurance given -> patient is the remainder.
  let split = resolve_(100, { insurance: 60 });
  check(
    'insurance given -> patient computed as the remainder',
    Math.abs(split.insurance - 60) < 0.005 && Math.abs(split.patient - 40) < 0.005,
    JSON.stringify(split),
  );

  // total = 100.00, only patient given -> insurance is the remainder.
  split = resolve_(100, { patient: 25 });
  check(
    'patient given -> insurance computed as the remainder',
    Math.abs(split.patient - 25) < 0.005 && Math.abs(split.insurance - 75) < 0.005,
    JSON.stringify(split),
  );

  // Invariant holds for a handful of totals/splits, mirroring
  // job_service.resolve_payment_split's one-cent tolerance.
  for (const [total, given] of [[45.5, { insurance: 10 }], [10, { patient: 10 }], [0, {}], [33.33, { insurance: 33.33 }]]) {
    const result = resolve_(total, given);
    const sum = (result.insurance || 0) + (result.patient || 0);
    check(
      `invariant insurance+patient==total holds for total=${total}, given=${JSON.stringify(given)}`,
      Math.abs(sum - total) < 0.01,
      `insurance=${result.insurance} patient=${result.patient} sum=${sum}`,
    );
  }

  // Neither given -> both left for the backend to default (price-list based).
  split = resolve_(100, {});
  check('neither given -> split left undefined for the server default', split.insurance == null && split.patient == null, JSON.stringify(split));
}

const njItemsSource = readFileSync(resolve(SRC, 'components/nj-items.jsx'), 'utf8');
check('item editor has an ipzp_code column', /ipzp/i.test(njItemsSource));
check('item editor has an insurance amount column', /insuranceAmount|insurance_amount/.test(njItemsSource));
check('item editor has a patient amount column', /patientAmount|patient_amount/.test(njItemsSource));

report();

function report() {
  console.log('');
  if (failures.length) {
    console.error(`job-label smoke FAILED — ${failures.length} check(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error('');
    console.error('Fix: wire the prosthetic label section (#100) to /jobs/jobs/<id>/prosthetic-label/');
    console.error('via window.MolarisAPI, add diagnosis_code/health_note fields (#94), and add the');
    console.error('IPZP code + insurance/patient split columns with live recompute to the item editor (#96).');
    process.exit(1);
  }
  console.log('job-label smoke OK — the prosthetic label UI is wired to the real backend.');
  process.exit(0);
}
