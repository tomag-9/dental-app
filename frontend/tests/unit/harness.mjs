// harness.mjs — loads the app's "classic script" sources (files under
// frontend/src/ that attach their exports to `window` instead of using ESM
// exports) into a sandbox so pure logic in them can be unit-tested in Node.
//
// Why a sandbox and not a plain `import`: App.jsx, Sidebar.jsx and
// Permissions.jsx are still global-script modules — they read `React` from the
// global scope and publish with `Object.assign(window, …)`. Once #124 migrates
// them to real ES modules, `loadGlobalScript` should be replaced by a plain
// `import` and the sandbox deleted; `resolveExport` below already prefers a
// real ESM export when one exists, so that migration will not need to touch
// the test cases themselves.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

export const SRC = path.resolve(import.meta.dirname, '..', '..', 'src');

/** Minimal React stand-in: builds a plain tree instead of rendering. */
export function createReactHarness() {
  return {
    createElement(type, props, ...children) {
      return { type, props: props || {}, children: children.flat() };
    },
    Fragment: 'Fragment',
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useEffect() {},
    useMemo(factory) { return factory(); },
    useRef(initial) { return { current: initial }; },
    useCallback(fn) { return fn; },
  };
}

/**
 * Run `src/<relPath>` in a fresh sandbox and return its `window` object.
 * `extraContext` provides the globals the file expects to find (component
 * stubs, `document`, `ReactDOM`, …).
 */
export async function loadGlobalScript(relPath, extraContext = {}) {
  const filename = path.join(SRC, relPath);
  let source;
  try {
    source = await readFile(filename, 'utf8');
  } catch (err) {
    throw new Error(
      `cannot load ${relPath} for unit testing: ${err.code || err.message}. ` +
        'Frontend sources are expected under frontend/src/ — if the file moved, ' +
        'update this test instead of leaving it to fail at read time.',
    );
  }
  const context = {
    window: {},
    console,
    React: createReactHarness(),
    setTimeout,
    clearTimeout,
    URL,
    ...extraContext,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename });
  return context.window;
}

/**
 * Prefer a real ES module export, fall back to the `window` global published by
 * a classic script. Keeps the test cases stable across the #124 migration.
 */
export async function resolveExport(relPath, name, extraContext = {}) {
  try {
    const mod = await import(pathToFileURL(path.join(SRC, relPath)).href);
    if (mod && typeof mod[name] !== 'undefined') return mod[name];
  } catch {
    // Not an ES module (or not importable in Node) — use the sandbox.
  }
  const win = await loadGlobalScript(relPath, extraContext);
  const value = win[name];
  if (typeof value === 'undefined') {
    throw new Error(`${relPath} exposes neither an ESM export nor window.${name}`);
  }
  return value;
}

/** Flatten every string in a harness-rendered tree, for label assertions. */
export function collectText(node, out = []) {
  if (typeof node === 'string') out.push(node);
  if (!node || typeof node !== 'object') return out;
  for (const child of node.children || []) collectText(child, out);
  return out;
}
