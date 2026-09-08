// polozky-shared.jsx — Shared data + helpers for the tooth chart (variant-detail.jsx).
//   - FDI ↔ Universal ↔ Palmer notation conversion
//   - Procedure catalog (crown / bridge / inlay / implant / etc.) with mini SVG glyphs
//   - Tooth metadata (type per FDI code)

// ── FDI rows, in display order (patient-facing — patient's right is on the LEFT) ────
const FDI_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const FDI_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Tooth "type" by position within a quadrant (last digit of FDI)
//   1,2 = incisor   3 = canine   4,5 = premolar   6,7,8 = molar
function toothType(fdi) {
  const n = fdi % 10;
  if (n <= 2) return 'incisor';
  if (n === 3) return 'canine';
  if (n <= 5) return 'premolar';
  return 'molar';
}
function isUpper(fdi) { return Math.floor(fdi / 10) <= 2; }
function quadrant(fdi) { return Math.floor(fdi / 10); }   // 1=UR 2=UL 3=LL 4=LR

// ── Notation conversion ────────────────────────────────────────────────────────────
// FDI is canonical. Universal is 1..32 starting at upper-right 3rd molar, snake order.
const FDI_TO_UNIVERSAL = (() => {
  const m = {};
  [...FDI_UPPER].forEach((fdi, i) => m[fdi] = i + 1);     // 18→1 … 28→16
  [38, 37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47, 48]
    .forEach((fdi, i) => m[fdi] = i + 17);                // 38→17 … 48→32
  return m;
})();

// Palmer uses 1..8 + a quadrant bracket. We approximate with quadrant glyphs.
//   UR ┘   UL └   LL ┌   LR ┐
const PALMER_BRACKET = { 1: '\u2518', 2: '\u2514', 3: '\u250C', 4: '\u2510' };
function fdiToPalmer(fdi) {
  const q = quadrant(fdi);
  const n = fdi % 10;
  // Upper quadrants: bracket goes after number; Lower: before
  if (q === 1) return `${n}${PALMER_BRACKET[1]}`;
  if (q === 2) return `${PALMER_BRACKET[2]}${n}`;
  if (q === 3) return `${PALMER_BRACKET[3]}${n}`;
  if (q === 4) return `${n}${PALMER_BRACKET[4]}`;
  return String(n);
}
function fdiLabel(fdi, notation) {
  if (notation === 'universal') return String(FDI_TO_UNIVERSAL[fdi]);
  if (notation === 'palmer') return fdiToPalmer(fdi);
  return String(fdi); // fdi default
}

// ── Procedure catalog ──────────────────────────────────────────────────────────────
// `glyph` is a small inline-SVG path drawn inside a 16×16 viewBox using currentColor.
// `cat` controls the color the chip uses.
const PROC_CATS = {
  crown:    { label: 'Korunky',      bg: '#d4f0eb', fg: '#085c4e', accent: '#0d7c6b' },
  bridge:   { label: 'Mostíky',      bg: '#e0e7ff', fg: '#3730a3', accent: '#4f46e5' },
  filling:  { label: 'Výplne',       bg: '#fef3c7', fg: '#92400e', accent: '#d97706' },
  veneer:   { label: 'Fazety',       bg: '#fde7f3', fg: '#9d174d', accent: '#db2777' },
  implant:  { label: 'Implantológia',bg: '#f3e8ff', fg: '#6b21a8', accent: '#9333ea' },
  denture:  { label: 'Protézy',      bg: '#dbeafe', fg: '#1e40af', accent: '#2563eb' },
  tech:     { label: 'Technické',    bg: '#f0ede5', fg: '#5a6b66', accent: '#8a9490' },
  extract:  { label: 'Extrakcia',    bg: '#fde8e6', fg: '#991b1b', accent: '#c0392b' },
};

const PROC_CATALOG = [
  // Crowns
  { code: 'KOR-ZIR', name: 'Korunka zirkónová',          cat: 'crown',   price: 280, glyph: 'crown' },
  { code: 'KOR-KER', name: 'Korunka celokeramická',      cat: 'crown',   price: 240, glyph: 'crown' },
  { code: 'KOR-KOV', name: 'Korunka kovokeramická',      cat: 'crown',   price: 180, glyph: 'crown' },
  // Bridges
  { code: 'MOS-3Z',  name: 'Mostík 3-členný zirkón',     cat: 'bridge',  price: 540, glyph: 'bridge', span: 3 },
  { code: 'MOS-4Z',  name: 'Mostík 4-členný zirkón',     cat: 'bridge',  price: 720, glyph: 'bridge', span: 4 },
  // Fillings
  { code: 'INL-KER', name: 'Inlay keramický',            cat: 'filling', price: 210, glyph: 'inlay' },
  { code: 'ONL-KER', name: 'Onlay keramický',            cat: 'filling', price: 230, glyph: 'onlay' },
  // Veneer
  { code: 'VEN-KER', name: 'Fazeta keramická',           cat: 'veneer',  price: 220, glyph: 'veneer' },
  // Implant
  { code: 'IMP-ABU', name: 'Implantátový abutment',      cat: 'implant', price: 120, glyph: 'screw' },
  { code: 'IMP-KOR', name: 'Korunka na implantát',       cat: 'implant', price: 320, glyph: 'implantCrown' },
  // Denture
  { code: 'PRO-CEL', name: 'Celková snímateľná prot.',   cat: 'denture', price: 480, glyph: 'denture' },
  { code: 'PRO-CIA', name: 'Čiastočná snímateľná prot.', cat: 'denture', price: 380, glyph: 'denture' },
  // Tech / lab
  { code: 'STL-001', name: 'STL skenovanie / model',     cat: 'tech',    price: 50,  glyph: 'scan' },
  { code: 'FRZ-001', name: 'Frézovanie',                 cat: 'tech',    price: 35,  glyph: 'mill' },
  { code: 'LEP-001', name: 'Lepenie / cementovanie',     cat: 'tech',    price: 10,  glyph: 'drop' },
  // Extraction (visualized only — marks tooth as missing)
  { code: 'EXT-001', name: 'Extrakcia (chýba)',          cat: 'extract', price: 0,   glyph: 'x' },
];
const PROC_BY_CODE = Object.fromEntries(PROC_CATALOG.map(p => [p.code, p]));

// ── Procedure glyph paths (16×16 viewBox, stroke = currentColor) ───────────────────
const PROC_GLYPHS = {
  crown:        '<path d="M3 11 L4 5 L7 8 L8 4 L9 8 L12 5 L13 11 Z M3 11 H13 V13 H3 Z"/>',
  bridge:       '<path d="M2 7 Q8 1 14 7"/><path d="M2 7 V12 H5 V8"/><path d="M14 7 V12 H11 V8"/><path d="M6 9 H10 V12 H6 Z"/>',
  inlay:        '<rect x="3" y="3" width="10" height="10" rx="1.5"/><rect x="6" y="6" width="4" height="4" rx=".5" fill="currentColor" stroke="none"/>',
  onlay:        '<rect x="3" y="3" width="10" height="10" rx="1.5"/><path d="M3 3 L13 13 M13 3 L3 13" stroke-width="1"/>',
  veneer:       '<path d="M4 3 H12 V5 L13 13 H3 L4 5 Z"/>',
  screw:        '<path d="M8 2 V14"/><path d="M5 4 H11 M5 7 H11 M5 10 H11 M5 13 H11"/>',
  implantCrown: '<path d="M3 7 L5 3 H11 L13 7 H3 Z"/><rect x="6" y="7" width="4" height="5"/><path d="M5 12 H11"/>',
  denture:      '<path d="M2 5 Q8 2 14 5 Q14 11 11 12 H5 Q2 11 2 5 Z"/><path d="M4 7 H12 M5 9 H11"/>',
  scan:         '<rect x="2" y="2" width="12" height="12" rx="1"/><path d="M2 6 H14 M2 10 H14 M6 2 V14 M10 2 V14"/>',
  mill:         '<circle cx="8" cy="8" r="2.5"/><path d="M8 1 V4 M8 12 V15 M1 8 H4 M12 8 H15 M3 3 L5 5 M11 11 L13 13 M3 13 L5 11 M11 5 L13 3"/>',
  drop:         '<path d="M8 2 Q4 7 4 10 A4 4 0 0 0 12 10 Q12 7 8 2 Z"/>',
  x:            '<path d="M3 3 L13 13 M13 3 L3 13" stroke-width="2.2"/>',
};

function ProcGlyph({ code, size = 14 }) {
  const p = PROC_BY_CODE[code];
  if (!p) return null;
  const path = PROC_GLYPHS[p.glyph] || '';
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 16 16',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' },
    dangerouslySetInnerHTML: { __html: path },
  });
}

// ── Anatomical tooth SVG shapes ────────────────────────────────────────────────────
// Each returns paths inside a 40×56 viewBox. `flip` flips vertically for lower jaw.
function ToothShape({ fdi, selected, missing, implant, temporary, size = 44 }) {
  const type = toothType(fdi);
  const upper = isUpper(fdi);
  // Crown path (top) + root path (bottom) — for upper teeth crown is at bottom (occlusal facing down)
  const W = 40, H = 56;
  // shapes — crown shape varies by type; root is a tapered triangle
  let crown, occlusal = null;
  if (type === 'incisor') {
    crown = 'M8 22 Q8 14 12 12 L28 12 Q32 14 32 22 L32 36 Q32 40 28 40 L12 40 Q8 40 8 36 Z';
  } else if (type === 'canine') {
    crown = 'M8 22 Q8 14 14 12 L20 8 L26 12 Q32 14 32 22 L32 36 Q32 40 28 40 L12 40 Q8 40 8 36 Z';
  } else if (type === 'premolar') {
    crown = 'M6 22 Q6 14 11 12 L16 14 L20 11 L24 14 L29 12 Q34 14 34 22 L34 36 Q34 40 29 40 L11 40 Q6 40 6 36 Z';
    occlusal = 'M14 24 Q20 21 26 24';
  } else { // molar
    crown = 'M5 24 Q5 14 11 12 L15 15 L20 12 L25 15 L29 12 Q35 14 35 24 L35 36 Q35 41 29 41 L11 41 Q5 41 5 36 Z';
    occlusal = 'M10 26 Q14 23 18 26 M22 26 Q26 23 30 26 M14 32 Q20 29 26 32';
  }
  const root = type === 'molar'
    ? 'M11 41 L8 53 M20 41 L20 54 M29 41 L32 53'
    : 'M14 40 L13 54 M20 40 L20 55 M26 40 L27 54';

  const fill = missing ? '#f7f6f2' : selected ? '#fff' : '#fefdf9';
  const stroke = missing ? '#c8c0b4' : selected ? '#0d7c6b' : '#9aa5a0';
  const strokeWidth = selected ? 2 : 1.3;

  const inner = React.createElement('g', { transform: upper ? '' : `translate(0,${H}) scale(1,-1)`, stroke, fill: 'none', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: crown, fill, strokeDasharray: temporary ? '3 2' : null }),
    occlusal && React.createElement('path', { d: occlusal, strokeWidth: 1 }),
    React.createElement('path', { d: root, fill: 'none' }),
    missing && React.createElement('path', { d: 'M6 14 L34 50 M34 14 L6 50', stroke: '#c0392b', strokeWidth: 1.5 }),
  );

  // Implant: blue/purple screw inside root area
  const implantOverlay = implant && React.createElement('g', { transform: upper ? '' : `translate(0,${H}) scale(1,-1)`, stroke: '#9333ea', fill: 'none', strokeWidth: 1.4, strokeLinecap: 'round' },
    React.createElement('path', { d: 'M20 41 V53' }),
    React.createElement('path', { d: 'M16 44 H24 M16 47 H24 M16 50 H24' })
  );

  return React.createElement('svg', { width: size, height: size * (H/W), viewBox: `0 0 ${W} ${H}`, style: { display: 'block' } },
    inner, implantOverlay
  );
}

// ── Notation toggle component ──────────────────────────────────────────────────────
function NotationToggle({ value, onChange }) {
  const opts = [
    { v: 'fdi', label: 'FDI' },
    { v: 'palmer', label: 'Palmer' },
    { v: 'universal', label: 'Universal' },
  ];
  return React.createElement('div', { style: { display: 'inline-flex', background: '#f0ede5', borderRadius: 7, padding: 2 } },
    ...opts.map(o => React.createElement('button', {
      key: o.v, onClick: () => onChange(o.v),
      style: {
        padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
        background: value === o.v ? '#fff' : 'transparent',
        color: value === o.v ? '#0d7c6b' : '#5a6b66',
        fontWeight: value === o.v ? 700 : 500, fontSize: 11.5, fontFamily: 'Manrope,sans-serif',
        boxShadow: value === o.v ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
      }
    }, o.label))
  );
}

Object.assign(window, {
  FDI_UPPER, FDI_LOWER, toothType, isUpper, quadrant,
  FDI_TO_UNIVERSAL, fdiToPalmer, fdiLabel,
  PROC_CATS, PROC_CATALOG, PROC_BY_CODE, PROC_GLYPHS, ProcGlyph,
  ToothShape, NotationToggle,
});
