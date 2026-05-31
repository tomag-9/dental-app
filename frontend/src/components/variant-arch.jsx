// variant-arch.jsx — Variant B: anatomical occlusal arch view.
//   Teeth are arranged on upper + lower elliptical arches (looking down into the mouth).
//   Each tooth is a small clickable shape oriented outward from the arch centre. Procedures
//   appear as coloured chips floating to the outside of the arch. Linked procedure list +
//   tooth detail card sit on the right.

function VariantArch() {
  const [notation, setNotation] = React.useState('fdi');
  const [selected, setSelected] = React.useState(DEMO_STATE.selected);
  const procs = DEMO_STATE.procedures;
  const missing = new Set(DEMO_STATE.missing);
  const implants = new Set(DEMO_STATE.implants);
  const temporary = new Set(DEMO_STATE.temporary);
  const bridges = DEMO_STATE.bridges;

  const items = buildItems(procs, bridges);
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const total = items.reduce((s, i) => s + i.p.price * i.qty, 0);

  return React.createElement('div', { style: { background: '#fbfaf6', border: '1px solid #e4ded4', borderRadius: 12, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Manrope,sans-serif', color: '#1a2320' } },
    // Toolbar
    React.createElement('div', { style: { padding: '14px 20px', background: '#fff', borderBottom: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em' } }, 'Krok 2 z 4'),
          React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 17, fontWeight: 700, color: '#1a2320', marginTop: 2 } }, 'Položky práce')
        ),
        React.createElement('div', { style: { width: 1, height: 32, background: '#e4ded4' } }),
        React.createElement('div', { style: { fontSize: 12, color: '#1a2320', fontWeight: 600 } },
          'Mária Kováčová ',
          React.createElement('span', { style: { color: '#8a9490', fontWeight: 400 } }, '· 62 r. · MUDr. Novák')
        )
      ),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement('span', { style: { fontSize: 11, color: '#8a9490' } }, 'Notácia:'),
        React.createElement(NotationToggle, { value: notation, onChange: setNotation })
      )
    ),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, padding: 16, flex: 1 } },
      // Arch view
      React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 } },
          React.createElement('div', null,
            React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, 'Anatomický oblúk'),
            React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, 'Pohľad zhora (okluzálne) · klik na zub')
          ),
          React.createElement(ArchLegend)
        ),
        React.createElement(ArchSVG, { selected, onSelect: setSelected, notation, procs, missing, implants, temporary, bridges })
      ),

      // Right column
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 } },
        React.createElement(ArchToothDetail, { fdi: selected, notation, codes: procs[selected] || [], missing: missing.has(selected), implant: implants.has(selected), temporary: temporary.has(selected) }),
        React.createElement(ArchCatalog, { selected, notation }),
        React.createElement(ArchItems, { items, total, fmt })
      )
    )
  );
}

function buildItems(procs, bridges) {
  const out = [];
  for (const [tooth, codes] of Object.entries(procs)) {
    for (const code of codes) {
      const p = PROC_BY_CODE[code];
      if (!p) continue;
      if (p.cat === 'bridge') {
        const b = bridges.find(b => String(b.from) === tooth);
        if (!b) continue;
        out.push({ tooth: `${b.from}–${b.to}`, code, p, qty: b.to - b.from + 1, span: b });
      } else {
        out.push({ tooth, code, p, qty: 1 });
      }
    }
  }
  return out;
}

// ── Arch SVG ──────────────────────────────────────────────────────────────────────
function ArchSVG({ selected, onSelect, notation, procs, missing, implants, temporary, bridges }) {
  // SVG geometry
  const W = 620, H = 540;
  const cx = W / 2;
  const upperCy = H / 2 + 30;   // upper arch curves upward from this baseline
  const lowerCy = H / 2 - 30;   // lower arch curves downward
  // Arch ellipses: rx, ry
  const RX = 232, RY = 200;

  // Map FDI to angle on the ellipse. For upper arch we use angle 180..360 (top half going right to left).
  // Patient's right = our left in display, so:
  //   18 at angle 180+a_min (far right edge of upper arch), going clockwise through 11 at top, then 21 over to 28.
  // We'll distribute 16 teeth across angles from theta=170° down to theta=10° (so most of the upper semicircle).
  // For lower arch we mirror.

  function toothPos(fdi) {
    const upperRow = FDI_UPPER;
    const lowerRow = FDI_LOWER;
    const row = upperRow.includes(fdi) ? upperRow : lowerRow;
    const i = row.indexOf(fdi);
    // Spread across angles. Upper: angles go from 195° (right) → 345° (left) → but we want a U shape.
    //   For an arch viewed from above, upper teeth form a top semicircle (y above center).
    //   We use angles in standard SVG coords where +y is down. We want teeth above the centre,
    //   so angles 200° to 340° (= 200..340 in degrees, where 270 = top in math, but here y axis is flipped).
    //   In SVG: x = cx + rx*cos(θ), y = cy + ry*sin(θ); sin>0 → below cy, sin<0 → above.
    //   For upper arch (teeth above center cy), we want sin<0 → angles 180..360.
    // Map i=0..15 to angles 200..340.
    const isUpper = upperRow.includes(fdi);
    const aStart = isUpper ? 200 : 160;
    const aEnd   = isUpper ? 340 : 20;
    const t = i / (row.length - 1);
    let angle;
    if (isUpper) {
      angle = aStart + (aEnd - aStart) * t;   // 200 → 340 (going through 270° = top of upper arch)
    } else {
      angle = aStart - 140 * t;               // 160 → 20 (going through 90° = bottom of lower arch)
    }
    const rad = (angle * Math.PI) / 180;
    const cy = isUpper ? upperCy : lowerCy;
    const x = cx + RX * Math.cos(rad);
    const y = cy + RY * Math.sin(rad);
    return { x, y, angle, isUpper };
  }

  // Bridge path between connected teeth
  const bridgePaths = bridges.map((b, i) => {
    const points = [];
    for (let f = b.from; f <= b.to; f++) {
      const { x, y } = toothPos(f);
      points.push([x, y]);
    }
    return React.createElement('path', {
      key: `br-${i}`,
      d: 'M ' + points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L '),
      stroke: PROC_CATS.bridge.accent, strokeWidth: 6, fill: 'none', opacity: 0.35, strokeLinecap: 'round',
    });
  });

  return React.createElement('svg', { width: '100%', viewBox: `0 0 ${W} ${H}`, style: { display: 'block', flex: 1, minHeight: 380, maxHeight: 540 } },
    // Background arch hints (jaw contour)
    React.createElement('path', {
      d: `M ${cx - RX - 20} ${upperCy} A ${RX + 20} ${RY + 20} 0 0 1 ${cx + RX + 20} ${upperCy}`,
      fill: '#fbfaf6', stroke: '#ece7dc', strokeWidth: 1.5, strokeDasharray: '2 4',
    }),
    React.createElement('path', {
      d: `M ${cx - RX - 20} ${lowerCy} A ${RX + 20} ${RY + 20} 0 0 0 ${cx + RX + 20} ${lowerCy}`,
      fill: '#fbfaf6', stroke: '#ece7dc', strokeWidth: 1.5, strokeDasharray: '2 4',
    }),

    // Midline + jaw labels
    React.createElement('text', { x: cx - 30, y: 24, fontSize: 11, fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fill: '#5a6b66', letterSpacing: '.12em' }, 'HORNÁ ČEĽUSŤ'),
    React.createElement('text', { x: cx - 30, y: H - 12, fontSize: 11, fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fill: '#5a6b66', letterSpacing: '.12em' }, 'DOLNÁ ČEĽUSŤ'),
    React.createElement('text', { x: 14, y: H / 2 + 4, fontSize: 11, fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fill: '#8a9490', letterSpacing: '.12em' }, 'PRAVÁ'),
    React.createElement('text', { x: W - 60, y: H / 2 + 4, fontSize: 11, fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fill: '#8a9490', letterSpacing: '.12em' }, 'ĽAVÁ'),

    // Bridges (rendered behind teeth)
    ...bridgePaths,

    // Teeth
    ...[...FDI_UPPER, ...FDI_LOWER].map(fdi => {
      const { x, y, angle, isUpper } = toothPos(fdi);
      return React.createElement(ArchTooth, {
        key: fdi, fdi, x, y, angle, isUpper, notation,
        selected: selected === fdi, onSelect,
        codes: procs[fdi] || [],
        missing: missing.has(fdi), implant: implants.has(fdi), temporary: temporary.has(fdi),
      });
    })
  );
}

// ── Tooth on arch — small clickable tooth + outside procedure chips ───────────────
function ArchTooth({ fdi, x, y, angle, isUpper, notation, selected, onSelect, codes, missing, implant, temporary }) {
  // Outward direction (unit vector from arch centre to tooth) — used to push procedure chips outside
  // We approximate by using the angle: outward = (cos(angle), sin(angle))
  const rad = (angle * Math.PI) / 180;
  const ox = Math.cos(rad), oy = Math.sin(rad);
  // Tooth box size
  const halfW = 14, halfH = 17;
  const rotDeg = angle + 90;   // tooth rotated to face outward (occlusal towards centre, root outward)
  const fill = missing ? '#f7f6f2' : selected ? '#fff' : '#fefdf9';
  const stroke = missing ? '#c8c0b4' : selected ? '#0d7c6b' : '#9aa5a0';
  const strokeWidth = selected ? 2 : 1.2;
  const type = toothType(fdi);
  // Simplified tooth glyph in local coords (small)
  let crown;
  if (type === 'incisor') crown = 'M-9 4 Q-9 -2 -6 -4 L6 -4 Q9 -2 9 4 L9 8 Q9 10 6 10 L-6 10 Q-9 10 -9 8 Z';
  else if (type === 'canine') crown = 'M-9 4 Q-9 -2 -5 -4 L0 -7 L5 -4 Q9 -2 9 4 L9 8 Q9 10 6 10 L-6 10 Q-9 10 -9 8 Z';
  else if (type === 'premolar') crown = 'M-10 4 Q-10 -2 -6 -4 L-3 -2 L0 -4 L3 -2 L6 -4 Q10 -2 10 4 L10 8 Q10 11 6 11 L-6 11 Q-10 11 -10 8 Z';
  else crown = 'M-11 4 Q-11 -2 -6 -4 L-3 -1 L0 -4 L3 -1 L6 -4 Q11 -2 11 4 L11 8 Q11 12 6 12 L-6 12 Q-11 12 -11 8 Z';

  // Procedure dots — small coloured circles placed in a ring outside the tooth
  const dotR = 5;
  const ringRadius = 22;
  const counted = {};
  for (const c of codes) counted[c] = (counted[c] || 0) + 1;
  const items = Object.entries(counted);
  const dotSpread = 36;   // degrees total
  const dotStart = items.length > 1 ? -dotSpread / 2 : 0;

  return React.createElement('g', { onClick: () => onSelect(fdi), style: { cursor: 'pointer' } },
    // Selected halo
    selected && React.createElement('circle', { cx: x, cy: y, r: 22, fill: '#d4f0eb' }),
    // Tooth body
    React.createElement('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotDeg.toFixed(1)})` },
      React.createElement('path', { d: crown, fill, stroke, strokeWidth, strokeLinejoin: 'round', strokeDasharray: temporary ? '3 2' : null }),
      missing && React.createElement('path', { d: 'M-8 -4 L8 10 M8 -4 L-8 10', stroke: '#c0392b', strokeWidth: 1.5, fill: 'none' }),
      implant && React.createElement('rect', { x: -3.5, y: 9, width: 7, height: 8, fill: 'none', stroke: '#9333ea', strokeWidth: 1.2 }),
    ),
    // Tooth label
    React.createElement('text', {
      x, y: y + (isUpper ? -halfH - 4 : halfH + 11),
      textAnchor: 'middle',
      fontSize: 10, fontFamily: 'ui-monospace,monospace', fontWeight: 700,
      fill: selected ? '#0d7c6b' : '#5a6b66',
    }, fdiLabel(fdi, notation)),

    // Procedure dots ring (rendered outside the tooth, away from centre)
    ...items.slice(0, 5).map(([code, n], i) => {
      const p = PROC_BY_CODE[code];
      const cat = PROC_CATS[p.cat];
      // Angle offset relative to outward direction
      const off = (items.length === 1 ? 0 : dotStart + (dotSpread / (items.length - 1)) * i) * (Math.PI / 180);
      // Rotate outward direction by off
      const cosO = Math.cos(off), sinO = Math.sin(off);
      const nx = ox * cosO - oy * sinO;
      const ny = ox * sinO + oy * cosO;
      const dx = x + nx * ringRadius;
      const dy = y + ny * ringRadius;
      return React.createElement('g', { key: code },
        React.createElement('circle', { cx: dx, cy: dy, r: dotR, fill: cat.bg, stroke: cat.accent, strokeWidth: 1.2 }),
        n > 1 && React.createElement('text', { x: dx, y: dy + 2.5, textAnchor: 'middle', fontSize: 7.5, fontWeight: 700, fill: cat.fg }, n)
      );
    })
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────────
function ArchLegend() {
  const cats = ['crown', 'bridge', 'filling', 'implant', 'tech'];
  return React.createElement('div', { style: { display: 'flex', gap: 8 } },
    ...cats.map(c => {
      const cat = PROC_CATS[c];
      return React.createElement('div', { key: c, style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#5a6b66' } },
        React.createElement('div', { style: { width: 8, height: 8, borderRadius: '50%', background: cat.bg, border: `1px solid ${cat.accent}` } }),
        cat.label
      );
    })
  );
}

// ── Tooth detail card (right side, top) ───────────────────────────────────────────
function ArchToothDetail({ fdi, notation, codes, missing, implant, temporary }) {
  const type = toothType(fdi);
  const typeLabel = { incisor: 'Rezák', canine: 'Očný zub', premolar: 'Predstoličkov', molar: 'Stolička' }[type];
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, padding: 14 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12 } },
      React.createElement(ToothShape, { fdi, selected: true, missing, implant, temporary, size: 50 }),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em' } }, 'Vybraný zub'),
        React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 22, fontWeight: 700, color: '#1a2320', letterSpacing: '-.02em', marginTop: 1 } }, fdiLabel(fdi, notation)),
        React.createElement('div', { style: { fontSize: 11.5, color: '#5a6b66', marginTop: 2 } },
          typeLabel,
          notation !== 'fdi' && React.createElement('span', { style: { color: '#8a9490', marginLeft: 6, fontFamily: 'ui-monospace,monospace' } }, `· FDI ${fdi}`)
        ),
      )
    ),
    // Flags
    React.createElement('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 } },
      implant && React.createElement('span', { style: flagStyle(PROC_CATS.implant) }, 'Implantát'),
      missing && React.createElement('span', { style: flagStyle(PROC_CATS.extract) }, 'Chýba'),
      temporary && React.createElement('span', { style: flagStyle({ bg: '#fef3c7', fg: '#92400e' }) }, 'Dočasná'),
      codes.length > 0 && React.createElement('span', { style: flagStyle({ bg: '#f0ede5', fg: '#5a6b66' }) }, `${codes.length} výkon(ov)`),
    ),
    // History blurb
    React.createElement('div', { style: { marginTop: 10, padding: '8px 10px', background: '#fbfaf6', border: '1px solid #f0ede5', borderRadius: 7 } },
      React.createElement('div', { style: { fontSize: 10, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em' } }, 'História zuba'),
      React.createElement('div', { style: { fontSize: 11.5, color: '#5a6b66', marginTop: 3, lineHeight: 1.4 } },
        '2024-03-14 · Inlay keramický', React.createElement('br'),
        '2022-11-02 · Endodoncia (lekár)'
      )
    )
  );
}
function flagStyle(cat) {
  return { background: cat.bg, color: cat.fg, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 9999, textTransform: 'uppercase', letterSpacing: '.04em' };
}

// ── Catalog (compact, focused on selected tooth) ──────────────────────────────────
function ArchCatalog({ selected, notation }) {
  // Show frequently-used procedures as quick add chips, grouped by category
  const quick = [
    'KOR-ZIR', 'KOR-KER', 'INL-KER', 'ONL-KER', 'VEN-KER',
    'IMP-ABU', 'IMP-KOR', 'MOS-3Z', 'STL-001', 'LEP-001',
  ];
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, padding: 12 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
      React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, 'Pridať výkon'),
      React.createElement('a', { href: '#', style: { fontSize: 11, color: '#0d7c6b', textDecoration: 'none', fontWeight: 600 } }, 'Otvoriť celý katalóg ›')
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 } },
      ...quick.map(code => {
        const p = PROC_BY_CODE[code];
        const cat = PROC_CATS[p.cat];
        return React.createElement('button', {
          key: code,
          style: {
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
            background: '#fff', border: '1px solid #ece7dc', borderRadius: 6, cursor: 'pointer',
            textAlign: 'left', fontFamily: 'Manrope,sans-serif',
          },
          onMouseEnter: e => { e.currentTarget.style.background = cat.bg; e.currentTarget.style.borderColor = cat.accent; },
          onMouseLeave: e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#ece7dc'; },
        },
          React.createElement('div', { style: { width: 22, height: 22, borderRadius: 5, background: cat.bg, color: cat.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
            React.createElement(ProcGlyph, { code, size: 12 })
          ),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: '#1a2320', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.name),
            React.createElement('div', { style: { fontSize: 9.5, color: '#8a9490', fontFamily: 'ui-monospace,monospace' } }, p.code, ' · ', p.price.toFixed(0), ' €')
          ),
        );
      })
    )
  );
}

// ── Items table ───────────────────────────────────────────────────────────────────
function ArchItems({ items, total, fmt }) {
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' } },
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderBottom: '1px solid #ece7dc' } },
      React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, `Všetky položky (${items.length})`)
    ),
    React.createElement('div', { style: { maxHeight: 220, overflowY: 'auto' } },
      ...items.map((it, i) => {
        const cat = PROC_CATS[it.p.cat];
        return React.createElement('div', {
          key: i,
          style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: i ? '1px solid #f0ede5' : 'none' }
        },
          React.createElement('div', { style: { width: 4, height: 26, borderRadius: 2, background: cat.accent, flexShrink: 0 } }),
          React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 700, color: '#1a2320', minWidth: 38 } }, it.tooth),
          React.createElement('div', { style: { width: 20, height: 20, borderRadius: 4, background: cat.bg, color: cat.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
            React.createElement(ProcGlyph, { code: it.code, size: 11 })
          ),
          React.createElement('span', { style: { fontSize: 11.5, color: '#1a2320', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it.p.name),
          React.createElement('span', { style: { fontSize: 11.5, fontWeight: 700, fontFamily: 'Plus Jakarta Sans,sans-serif', color: '#1a2320' } }, fmt(it.p.price * it.qty))
        );
      })
    ),
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderTop: '1px solid #ece7dc', display: 'flex', justifyContent: 'space-between' } },
      React.createElement('span', { style: { fontSize: 11.5, color: '#8a9490' } }, 'Spolu'),
      React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 15, fontWeight: 700, color: '#1a2320' } }, fmt(total))
    )
  );
}

Object.assign(window, { VariantArch });
