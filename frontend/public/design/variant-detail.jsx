// variant-detail.jsx — Variant A reused as a DETAIL VIEW (modal/overlay content).
//   Shows just the dental cross (no catalog, no table) — bigger, read-only by default,
//   with an "Upraviť" toggle. Used by:
//     · the LupaButton in Variant C (Položky step)
//     · the patient detail page (history view of the patient's chart)
//
// Mounted inside <ToothDetailModal>. The modal is opened by dispatching a window
// CustomEvent 'open-tooth-detail' with { detail: { fdi, patient, items } } — Variant C
// uses this to hand off state. If detail isn't passed, the modal falls back to DEMO_STATE.

// ── Region-scope procedures ────────────────────────────────────────────────────────
// These are procedures that were performed on a WHOLE region (full mouth, jaw, side,
// or quadrant) and therefore do NOT get drawn on the dental cross. They appear in a
// dedicated panel below the chart so the clinician/technician can still see them.
//
// scope values: 'all' | 'upper' | 'lower' | 'right' | 'left' | 'q1'..'q4'
const REGION_SCOPES = [
  { id: 'all',   label: 'Celý chrup',   short: 'Celý chrup',  teeth: [...FDI_UPPER, ...FDI_LOWER] },
  { id: 'upper', label: 'Horná čeľusť', short: 'Horná',       teeth: FDI_UPPER },
  { id: 'lower', label: 'Dolná čeľusť', short: 'Dolná',       teeth: FDI_LOWER },
  { id: 'right', label: 'Pravá strana', short: 'Pravá',       teeth: [...FDI_UPPER.slice(0, 8), ...FDI_LOWER.slice(0, 8)] },
  { id: 'left',  label: 'Ľavá strana',  short: 'Ľavá',        teeth: [...FDI_UPPER.slice(8),    ...FDI_LOWER.slice(8)]    },
  { id: 'q1',    label: 'Kvadrant 1 · horný pravý',  short: 'Q1', teeth: FDI_UPPER.slice(0, 8) },
  { id: 'q2',    label: 'Kvadrant 2 · horný ľavý',   short: 'Q2', teeth: FDI_UPPER.slice(8)    },
  { id: 'q3',    label: 'Kvadrant 3 · dolný ľavý',   short: 'Q3', teeth: FDI_LOWER.slice(8)    },
  { id: 'q4',    label: 'Kvadrant 4 · dolný pravý',  short: 'Q4', teeth: FDI_LOWER.slice(0, 8) },
];
const REGION_BY_ID = Object.fromEntries(REGION_SCOPES.map(r => [r.id, r]));

// Region procedures catalog — light-weight entries (these aren't in PROC_CATALOG
// because they're not tooth-specific).
const REGION_PROC_DEFS = {
  'DSH-001': { name: 'Dentálna hygiena',              cat: 'tech',    glyph: 'drop' },
  'RTG-PAN': { name: 'RTG panoramický snímok',        cat: 'tech',    glyph: 'scan' },
  'RTG-INT': { name: 'RTG intraorálny set',           cat: 'tech',    glyph: 'scan' },
  'BIE-001': { name: 'Bielenie zubov',                cat: 'veneer',  glyph: 'drop' },
  'ANE-LOC': { name: 'Lokálna anestézia',             cat: 'tech',    glyph: 'drop' },
  'PSR-001': { name: 'PSR — parodontologický skríning', cat: 'tech',  glyph: 'scan' },
  'SCA-001': { name: 'Subgingiválne čistenie (SRP)',  cat: 'tech',    glyph: 'mill' },
  'FLU-001': { name: 'Fluoridácia',                   cat: 'tech',    glyph: 'drop' },
};

// Demo: which region-scoped procedures were performed and on which scope.
const REGION_PROCEDURES = [
  { id: 1, scope: 'all',   code: 'RTG-PAN', date: '12.3.2025', note: 'Vstupné vyšetrenie' },
  { id: 2, scope: 'all',   code: 'DSH-001', date: '12.3.2025' },
  { id: 3, scope: 'upper', code: 'BIE-001', date: '20.3.2025', note: '3 sedenia' },
  { id: 4, scope: 'q2',    code: 'ANE-LOC', date: '20.3.2025' },
  { id: 5, scope: 'q1',    code: 'ANE-LOC', date: '12.3.2025' },
  { id: 6, scope: 'lower', code: 'PSR-001', date: '12.3.2025' },
  { id: 7, scope: 'q3',    code: 'SCA-001', date: '02.4.2025' },
  { id: 8, scope: 'all',   code: 'FLU-001', date: '02.4.2025' },
];

function ToothCrossDetail({ initialSelected, notation: initialNotation, readonly = true, patient, onClose, items = [] }) {
  const [notation, setNotation] = React.useState(initialNotation || 'fdi');
  const [selected, setSelected] = React.useState(initialSelected || DEMO_STATE.selected);
  const [isEditing, setIsEditing] = React.useState(!readonly);
  const [regionScope, setRegionScope] = React.useState('all');
  const [highlightRegion, setHighlightRegion] = React.useState(false);
  const hasLiveItems = Array.isArray(items) && items.length > 0;
  const liveProcs = {};
  for (const item of items || []) {
    const tooth = String(item.tooth || '');
    const code = item.code || item.price_list_code;
    if (!tooth || !code) continue;
    (liveProcs[tooth] = liveProcs[tooth] || []).push(code);
  }
  const procs = hasLiveItems ? liveProcs : DEMO_STATE.procedures;
  const missing = new Set(hasLiveItems ? Object.entries(liveProcs).filter(([, codes]) => codes.includes('EXT-001')).map(([tooth]) => Number(tooth)) : DEMO_STATE.missing);
  const implants = new Set(hasLiveItems ? Object.entries(liveProcs).filter(([, codes]) => codes.some((code) => String(code).startsWith('IMP'))).map(([tooth]) => Number(tooth)) : DEMO_STATE.implants);
  const temporary = new Set(hasLiveItems ? [] : DEMO_STATE.temporary);
  const bridges = hasLiveItems ? [] : DEMO_STATE.bridges;

  // Procedures grouped per tooth for the detail panel
  const allProcs = [];
  for (const [t, codes] of Object.entries(procs)) {
    for (const c of codes) {
      const p = PROC_BY_CODE[c] || (hasLiveItems ? { code: c, name: c, price: 0, cat: 'tech' } : null);
      if (!p) continue;
      if (p.cat === 'bridge') {
        const b = bridges.find(b => String(b.from) === t);
        if (!b) continue;
        allProcs.push({ tooth: `${b.from}–${b.to}`, code: c, p });
      } else {
        allProcs.push({ tooth: t, code: c, p });
      }
    }
  }
  if (hasLiveItems) {
    allProcs.length = 0;
    for (const item of items || []) {
      const code = item.code || item.price_list_code;
      const p = PROC_BY_CODE[code] || { code, name: item.name || code, price: Number(item.price || 0), cat: 'tech' };
      allProcs.push({ tooth: String(item.tooth || '—'), code, p, qty: Number(item.qty || item.quantity || 1) || 1 });
    }
  }
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const total = allProcs.reduce((s, x) => s + (Number(x.p.price) || 0) * (Number(x.qty) || 1), 0);

  // Highlight the teeth that fall in the currently-selected region scope (when the
  // user has turned the highlight on). This is purely visual context — region
  // procedures are NOT drawn on the cross.
  const regionHighlightSet = (highlightRegion && regionScope !== 'all')
    ? new Set(REGION_BY_ID[regionScope].teeth)
    : null;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#fbfaf6', fontFamily: 'Manrope,sans-serif', color: '#1a2320' } },
    // Header
    React.createElement('div', { style: { padding: '10px 18px', background: '#fff', borderBottom: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement('div', { style: { width: 32, height: 32, borderRadius: 8, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
            React.createElement('path', { d: 'M12 5.5c-2 0-3-1.5-5-1.5S3 5.5 3 9c0 2 .5 4 1.5 6S6 19 7 19s1.5-1 2-3 1-3 3-3 2.5 1 3 3 1 3 2 3 1.5-1 2.5-4S21 11 21 9c0-3.5-2-5-4-5s-3 1.5-5 1.5z' }),
          )
        ),
        React.createElement('div', null,
          React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 16, fontWeight: 700, color: '#1a2320', letterSpacing: '-.015em' } }, 'Zubný kríž — detail'),
          React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } },
            (patient && patient.name) || 'Bezáková Gabriela',
            React.createElement('span', { style: { color: '#b0bdb9', margin: '0 6px' } }, '·'),
            patient && patient.age && patient.age !== '—' ? `${patient.age} r.` : 'vek nezadaný',
            React.createElement('span', { style: { color: '#b0bdb9', margin: '0 6px' } }, '·'),
            'práca ',
            React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', color: '#0d7c6b', fontWeight: 600 } }, (patient && patient.workId) || '2025/252')
          )
        )
      ),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        React.createElement('span', { style: { fontSize: 11, color: '#8a9490' } }, 'Notácia:'),
        React.createElement(NotationToggle, { value: notation, onChange: setNotation }),
        React.createElement('div', { style: { width: 1, height: 26, background: '#e4ded4', margin: '0 4px' } }),
        React.createElement('button', {
          onClick: () => setIsEditing(e => !e),
          style: {
            padding: '7px 14px', borderRadius: 6, border: '1px solid #e4ded4',
            background: isEditing ? '#d4f0eb' : '#fff', color: isEditing ? '#085c4e' : '#1a2320',
            fontSize: 12, fontWeight: 600, fontFamily: 'Manrope,sans-serif', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }
        },
          React.createElement('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
            React.createElement('path', { d: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' }),
            React.createElement('path', { d: 'm15 5 4 4' }),
          ),
          isEditing ? 'Hotovo' : 'Upraviť'
        ),
        onClose && React.createElement('button', {
          onClick: onClose,
          style: { width: 32, height: 32, padding: 0, borderRadius: 6, border: 'none', background: 'transparent', color: '#5a6b66', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
          title: 'Zavrieť (Esc)',
        },
          React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
            React.createElement('path', { d: 'M18 6 6 18 M6 6 l12 12' }),
          )
        )
      )
    ),

    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 18px 18px', flex: 1, overflow: 'auto' } },
      // Big cross — full width
      React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 12, padding: '12px 18px 14px', flexShrink: 0 } },
        // Legend
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
          React.createElement('div', { style: { display: 'flex', gap: 14, fontSize: 11, color: '#5a6b66' } },
            React.createElement(LegendItem, { color: '#0d7c6b', label: 'Vybraný' }),
            React.createElement(LegendItem, { color: '#9333ea', label: 'Implantát' }),
            React.createElement(LegendItem, { color: '#4f46e5', label: 'Mostík' }),
            React.createElement(LegendItem, { color: '#c0392b', label: 'Chýba' }),
            React.createElement(LegendItem, { color: '#d97706', label: 'Dočasná' }),
          ),
          React.createElement('div', { style: { fontSize: 11, color: '#8a9490' } }, isEditing ? 'Klik = vybrať · pravý-klik = chýba' : 'Iba zobrazenie (read-only)')
        ),
        // Labels — patient orientation
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '4px 38px 2px', fontSize: 10, fontWeight: 700, color: '#8a9490', letterSpacing: '.08em' } },
          React.createElement('span', null, 'PRAVÁ'), React.createElement('span', null, 'ĽAVÁ')
        ),
        // Upper row
        React.createElement(DetailToothRow, { teeth: FDI_UPPER, notation, selected, onSelect: setSelected, procs, missing, implants, temporary, bridges, upper: true, big: true, highlightSet: regionHighlightSet }),
        // Midline
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', padding: '6px 0', gap: 8 } },
          React.createElement('div', { style: { flex: 1, height: 1, background: 'repeating-linear-gradient(to right, #c8c0b4 0 6px, transparent 6px 12px)' } }),
          React.createElement('span', { style: { fontSize: 10, color: '#b0bdb9', fontFamily: 'ui-monospace,monospace' } }, 'okluzálna rovina'),
          React.createElement('div', { style: { flex: 1, height: 1, background: 'repeating-linear-gradient(to right, #c8c0b4 0 6px, transparent 6px 12px)' } }),
        ),
        // Lower row
        React.createElement(DetailToothRow, { teeth: FDI_LOWER, notation, selected, onSelect: setSelected, procs, missing, implants, temporary, bridges, upper: false, big: true, highlightSet: regionHighlightSet }),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '2px 38px 0', fontSize: 10, fontWeight: 700, color: '#8a9490', letterSpacing: '.08em' } },
          React.createElement('span', null, 'PRAVÁ'), React.createElement('span', null, 'ĽAVÁ')
        ),
      ),

      // BELOW the cross: selected-tooth info as a wide horizontal card
      React.createElement(FocusedToothBar, { fdi: selected, notation, codes: procs[selected] || [], missing: missing.has(selected), implant: implants.has(selected), temporary: temporary.has(selected), fmt }),

      // Region-scoped procedures (not drawn on the cross): full mouth / jaw / side / quadrant
      React.createElement(RegionProceduresPanel, {
        notation,
        scope: regionScope, onScopeChange: setRegionScope,
        highlight: highlightRegion, onHighlightChange: setHighlightRegion,
        items: REGION_PROCEDURES,
      })
    )
  );
}

// Larger version of a tooth row — same structure as Variant A but bigger.
function DetailToothRow({ teeth, notation, selected, onSelect, procs, missing, implants, temporary, bridges, upper, big, highlightSet }) {
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 3 } },
    ...teeth.map((fdi, i) => {
      const codes = procs[fdi] || [];
      const bridge = bridges.find(b => fdi >= b.from && fdi <= b.to);
      const isMidlineEnd = i === 7;
      return React.createElement(DetailToothCell, {
        key: fdi, fdi, notation,
        selected: selected === fdi, onSelect,
        codes, missing: missing.has(fdi), implant: implants.has(fdi), temporary: temporary.has(fdi),
        bridge, bridgeStart: bridge && fdi === bridge.from, bridgeEnd: bridge && fdi === bridge.to,
        upper, big,
        marginRight: isMidlineEnd ? 18 : 0,
        regionHighlighted: highlightSet && highlightSet.has(fdi),
      });
    })
  );
}

function DetailToothCell({ fdi, notation, selected, onSelect, codes, missing, implant, temporary, bridge, bridgeStart, bridgeEnd, upper, big, marginRight, regionHighlighted }) {
  const counted = {};
  for (const c of codes) counted[c] = (counted[c] || 0) + 1;
  const items = Object.entries(counted);
  const toothSize = big ? 40 : 32;
  const glyphSize = big ? 22 : 18;

  const stripContent = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minHeight: big ? 36 : 28 } },
    ...items.slice(0, 4).map(([code, n]) => {
      const p = PROC_BY_CODE[code] || { code, name: code, cat: 'tech' };
      const cat = PROC_CATS[p.cat] || PROC_CATS.tech;
      return React.createElement('div', {
        key: code, title: p.name + (n > 1 ? ` ×${n}` : ''),
        style: {
          width: glyphSize, height: glyphSize, borderRadius: 6,
          background: cat.bg, color: cat.fg,
          border: `1px solid ${cat.accent}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }
      },
        React.createElement(ProcGlyph, { code, size: glyphSize - 8 }),
        n > 1 && React.createElement('span', {
          style: { position: 'absolute', top: -5, right: -5, fontSize: 9, fontWeight: 700, background: '#1a2320', color: 'white', borderRadius: 8, padding: '1px 4px', lineHeight: 1 }
        }, n),
      );
    }),
    items.length > 4 && React.createElement('div', { style: { fontSize: 10, color: '#8a9490', fontWeight: 700 } }, `+${items.length - 4}`)
  );

  const bridgeBar = bridge && React.createElement('div', {
    style: {
      position: 'absolute',
      left: bridgeStart ? '50%' : -2,
      right: bridgeEnd ? '50%' : -2,
      [upper ? 'bottom' : 'top']: 10, height: 4, background: PROC_CATS.bridge.accent, borderRadius: 2, zIndex: 0,
    }
  });

  return React.createElement('div', {
    onClick: () => onSelect(fdi),
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      cursor: 'pointer', userSelect: 'none', position: 'relative',
      marginRight, padding: '4px 2px', borderRadius: 7,
      background: selected ? 'rgba(13,124,107,.07)' : regionHighlighted ? 'rgba(13,124,107,.045)' : 'transparent',
      boxShadow: !selected && regionHighlighted ? 'inset 0 0 0 1px rgba(13,124,107,.18)' : 'none',
      transition: 'background .15s, box-shadow .15s', minWidth: toothSize + 8,
    }
  },
    upper && stripContent,
    upper && React.createElement('div', { style: { position: 'relative' } },
      bridgeBar,
      React.createElement(ToothShape, { fdi, selected, missing, implant, temporary, size: toothSize })
    ),
    React.createElement('div', {
      style: {
        fontFamily: 'ui-monospace, monospace', fontSize: big ? 12 : 10.5, fontWeight: 700,
        color: selected ? '#0d7c6b' : '#5a6b66', letterSpacing: '.02em',
        padding: '3px 6px', borderRadius: 4, marginTop: 4,
        background: selected ? '#fff' : 'transparent',
        border: selected ? '1px solid #0d7c6b' : '1px solid transparent',
      }
    }, fdiLabel(fdi, notation)),
    !upper && React.createElement('div', { style: { position: 'relative' } },
      bridgeBar,
      React.createElement(ToothShape, { fdi, selected, missing, implant, temporary, size: toothSize })
    ),
    !upper && stripContent,
  );
}

function LegendItem({ color, label }) {
  return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 5 } },
    React.createElement('div', { style: { width: 10, height: 10, borderRadius: 3, background: color } }),
    label
  );
}

// Wide horizontal info bar placed BELOW the cross: tooth glyph + name + flags on the
// left, the per-tooth procedures laid out horizontally as chips on the right.
// NOTE: no prices here — pricing belongs to the work-items table, not to the chart.
function FocusedToothBar({ fdi, notation, codes, missing, implant, temporary, fmt }) {
  const type = toothType(fdi);
  const typeLabel = { incisor: 'Rezák', canine: 'Očný zub', premolar: 'Predstoličkov', molar: 'Stolička' }[type];
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 } },
    // Tooth glyph + identity
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 } },
      React.createElement(ToothShape, { fdi, selected: true, missing, implant, temporary, size: 44 }),
      React.createElement('div', null,
        React.createElement('div', { style: { fontSize: 9.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em' } }, 'Vybraný zub'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
          React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 22, fontWeight: 800, color: '#1a2320', letterSpacing: '-.02em', lineHeight: 1 } }, fdiLabel(fdi, notation)),
          notation !== 'fdi' && React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 10.5, color: '#8a9490' } }, `FDI ${fdi}`),
        ),
        React.createElement('div', { style: { fontSize: 10.5, color: '#5a6b66', marginTop: 2 } }, typeLabel),
      )
    ),
    // Flags
    React.createElement('div', { style: { display: 'flex', gap: 5, flexShrink: 0 } },
      implant && React.createElement('span', { style: detailFlagStyle(PROC_CATS.implant) }, 'Implantát'),
      missing && React.createElement('span', { style: detailFlagStyle(PROC_CATS.extract) }, 'Chýba'),
      temporary && React.createElement('span', { style: detailFlagStyle({ bg: '#fef3c7', fg: '#92400e' }) }, 'Dočasná'),
    ),
    // Separator
    React.createElement('div', { style: { width: 1, height: 44, background: '#ece7dc', flexShrink: 0 } }),
    // Procedures — horizontal chips
    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
      React.createElement('div', { style: { fontSize: 9.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 } }, `Výkony na tomto zube (${codes.length})`),
      codes.length === 0
        ? React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', fontStyle: 'italic' } }, 'Žiadne výkony. Klikom v edit móde môžete pridať z katalógu.')
        : React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 5 } },
            ...codes.map((c, i) => {
              const p = PROC_BY_CODE[c] || { code: c, name: c, cat: 'tech' };
              const cat = PROC_CATS[p.cat] || PROC_CATS.tech;
              return React.createElement('div', {
                key: i,
                style: {
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '5px 10px 5px 6px',
                  background: cat.bg, color: cat.fg,
                  border: `1px solid ${cat.accent}44`, borderRadius: 9999,
                  fontSize: 11.5, fontWeight: 600,
                }
              },
                React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', background: '#fff', color: cat.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
                  React.createElement(ProcGlyph, { code: c, size: 11 })
                ),
                React.createElement('span', null, p.name),
                React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 10, opacity: 0.7 } }, p.code),
              );
            })
          )
    ),
  );
}

function detailFlagStyle(cat) {
  return { background: cat.bg, color: cat.fg, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 9999, textTransform: 'uppercase', letterSpacing: '.04em' };
}

// Summary of ALL procedures across the chart (read-only list).
function ProcSummaryPanel({ items, total, fmt, selected }) {
  // Group by tooth for a readable summary
  const byTooth = {};
  for (const it of items) {
    if (!byTooth[it.tooth]) byTooth[it.tooth] = [];
    byTooth[it.tooth].push(it);
  }
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' } },
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderBottom: '1px solid #ece7dc' } },
      React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, `Všetky výkony (${items.length})`),
      React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, 'Zoskupené podľa zuba')
    ),
    React.createElement('div', { style: { flex: 1, overflowY: 'auto', maxHeight: 280 } },
      ...Object.entries(byTooth).map(([tooth, group]) => {
        const isOnSelected = tooth === String(selected) || (tooth.includes('–') && (() => {
          const [a, b] = tooth.split('–').map(n => parseInt(n));
          return selected >= a && selected <= b;
        })());
        return React.createElement('div', {
          key: tooth,
          style: { padding: '8px 14px', borderTop: '1px solid #f0ede5', background: isOnSelected ? '#fbf9f1' : '#fff' }
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } },
            React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11.5, fontWeight: 700, color: isOnSelected ? '#0d7c6b' : '#1a2320', padding: '1px 7px', background: '#fbfaf6', borderRadius: 4, border: '1px solid #ece7dc' } }, tooth),
            React.createElement('span', { style: { fontSize: 10.5, color: '#8a9490' } }, `${group.length} výkon(ov)`)
          ),
          ...group.map((it, i) => {
            const cat = PROC_CATS[it.p.cat];
            return React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0 2px 8px' } },
              React.createElement('div', { style: { width: 14, height: 14, borderRadius: 3, background: cat.bg, color: cat.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
                React.createElement(ProcGlyph, { code: it.code, size: 9 })
              ),
              React.createElement('span', { style: { fontSize: 11, color: '#1a2320', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it.p.name),
              React.createElement('span', { style: { fontSize: 10.5, fontWeight: 700, color: '#5a6b66', fontFamily: 'Plus Jakarta Sans,sans-serif' } }, fmt(it.p.price))
            );
          })
        );
      })
    ),
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderTop: '1px solid #ece7dc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement('span', { style: { fontSize: 11.5, color: '#8a9490' } }, 'Spolu'),
      React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 15, fontWeight: 700, color: '#1a2320' } }, fmt(total))
    )
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────────
// Listens to window 'open-tooth-detail' events and shows the detail in an overlay.
function ToothDetailModal() {
  const [open, setOpen] = React.useState(false);
  const [props, setProps] = React.useState({ initialSelected: 26 });

  React.useEffect(() => {
    const onOpen = (e) => { setProps(e.detail || {}); setOpen(true); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('open-tooth-detail', onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('open-tooth-detail', onOpen); window.removeEventListener('keydown', onKey); };
  }, []);

  if (!open) return null;
  return React.createElement('div', {
    onClick: () => setOpen(false),
    style: {
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(26,35,32,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn .15s ease-out',
      padding: 20,
    }
  },
    React.createElement('style', null,
      '@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } } @keyframes popIn2 { from { transform: scale(.97); opacity: 0 } to { transform: scale(1); opacity: 1 } }'
    ),
    React.createElement('div', {
      onClick: e => e.stopPropagation(),
      style: {
        width: 'min(1200px, 96vw)', height: 'min(820px, 92vh)',
        background: '#fbfaf6', borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 24px 70px rgba(0,0,0,.25)',
        animation: 'popIn2 .18s ease-out',
        display: 'flex', flexDirection: 'column',
      }
    },
      React.createElement(ToothCrossDetail, {
        initialSelected: props.fdi || props.initialSelected,
        notation: props.notation,
        readonly: props.readonly !== false,
        patient: props.patient,
        items: props.items || [],
        onClose: () => setOpen(false),
      })
    )
  );
}

// ─── Region procedures panel ──────────────────────────────────────────────────────
// Shows procedures performed on a WHOLE region (full mouth / jaw / side / quadrant).
// These aren't drawn on the dental cross — they live in their own table here.
function RegionProceduresPanel({ scope, onScopeChange, highlight, onHighlightChange, items, notation }) {
  const visible = scope === 'all' ? items : items.filter(it => it.scope === scope);
  const region = REGION_BY_ID[scope];
  const counts = {};
  for (const it of items) counts[it.scope] = (counts[it.scope] || 0) + 1;

  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 12, overflow: 'hidden', flexShrink: 0 } },
    // Header
    React.createElement('div', { style: { padding: '10px 16px 8px', borderBottom: '1px solid #f0ede5', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' } },
      React.createElement('div', null,
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: '#0d7c6b', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
            React.createElement('path', { d: 'M3 12h4l3-9 4 18 3-9h4' }),
          ),
          React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 14, fontWeight: 700, color: '#1a2320' } }, 'Výkony na oblastiach'),
          React.createElement('span', { style: { fontSize: 10.5, fontWeight: 700, color: '#085c4e', background: '#d4f0eb', padding: '2px 8px', borderRadius: 9999, letterSpacing: '.04em' } }, `${items.length} celkovo`),
        ),
        React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 4, maxWidth: 520 } },
          'Výkony vykonané na celom chrupe, čeľusti, strane alebo kvadrante — nekreslia sa do zubného kríža, ale evidujú sa tu.'
        ),
      ),
      React.createElement('label', {
        style: {
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#5a6b66',
          cursor: scope === 'all' ? 'not-allowed' : 'pointer', opacity: scope === 'all' ? 0.45 : 1,
          padding: '5px 10px', border: '1px solid #e4ded4', borderRadius: 6, background: '#fbfaf6',
        }
      },
        React.createElement('input', {
          type: 'checkbox', checked: highlight, disabled: scope === 'all',
          onChange: e => onHighlightChange(e.target.checked),
          style: { accentColor: '#0d7c6b' },
        }),
        'Zvýrazniť oblasť v kríži'
      )
    ),

    // Region tabs
    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 5, padding: '8px 16px', background: '#fbfaf6', borderBottom: '1px solid #f0ede5' } },
      ...REGION_SCOPES.map(r => {
        const active = scope === r.id;
        const count = counts[r.id] || 0;
        return React.createElement('button', {
          key: r.id, onClick: () => onScopeChange(r.id),
          style: {
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 11px', borderRadius: 7,
            border: active ? '1px solid #0d7c6b' : '1px solid #e4ded4',
            background: active ? '#0d7c6b' : '#fff',
            color: active ? '#fff' : '#1a2320',
            fontSize: 11.5, fontWeight: active ? 700 : 600,
            fontFamily: 'Manrope,sans-serif', cursor: 'pointer',
            boxShadow: active ? '0 1px 2px rgba(13,124,107,.25)' : 'none',
            transition: 'background .12s, border-color .12s, color .12s',
          }
        },
          React.createElement(RegionScopeIcon, { scopeId: r.id, color: active ? '#fff' : '#5a6b66', size: 14 }),
          React.createElement('span', null, r.short),
          count > 0 && React.createElement('span', {
            style: {
              fontFamily: 'ui-monospace,monospace', fontSize: 10,
              padding: '1px 6px', borderRadius: 9999,
              background: active ? 'rgba(255,255,255,.22)' : '#f0ede5',
              color: active ? '#fff' : '#5a6b66', fontWeight: 700,
            }
          }, count),
        );
      })
    ),

    // Region context + procedure list
    React.createElement('div', { style: { padding: '10px 16px 12px' } },
      // Scope summary line
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 11, color: '#5a6b66' } },
        React.createElement('span', { style: { fontWeight: 700, color: '#1a2320', fontFamily: 'Plus Jakarta Sans,sans-serif' } }, region.label),
        React.createElement('span', { style: { color: '#b0bdb9' } }, '·'),
        React.createElement('span', null, `${region.teeth.length} ${region.teeth.length === 1 ? 'zub' : (region.teeth.length < 5 ? 'zuby' : 'zubov')} v rozsahu`),
        React.createElement('span', { style: { color: '#b0bdb9' } }, '·'),
        React.createElement('span', null, visible.length === 0 ? 'žiadne výkony' : `${visible.length} výkon${visible.length === 1 ? '' : (visible.length < 5 ? 'y' : 'ov')}`),
      ),

      // List
      visible.length === 0
        ? React.createElement('div', {
            style: { padding: '24px 18px', border: '1px dashed #e4ded4', borderRadius: 8, background: '#fbfaf6', textAlign: 'center', fontSize: 12, color: '#8a9490' }
          }, `Pre oblasť „${region.label}" nie sú evidované žiadne výkony.`)
        : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            ...visible.map(it => {
              const def = REGION_PROC_DEFS[it.code] || { name: it.code, cat: 'tech', glyph: 'drop' };
              const cat = PROC_CATS[def.cat];
              const itemRegion = REGION_BY_ID[it.scope];
              return React.createElement('div', {
                key: it.id,
                style: {
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 12px', background: '#fbfaf6',
                  border: '1px solid #f0ede5', borderRadius: 9,
                }
              },
                React.createElement('div', {
                  style: {
                    width: 30, height: 30, borderRadius: 7,
                    background: cat.bg, color: cat.fg,
                    border: `1px solid ${cat.accent}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }
                }, React.createElement(RegionGlyph, { glyph: def.glyph, size: 16 })),
                React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                  React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, color: '#1a2320', display: 'flex', alignItems: 'center', gap: 8 } },
                    def.name,
                    React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 10, color: '#8a9490', fontWeight: 500 } }, it.code),
                  ),
                  it.note && React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, it.note),
                ),
                React.createElement('span', {
                  style: {
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 9999,
                    background: '#fff', border: '1px solid #e4ded4',
                    fontSize: 10.5, fontWeight: 700, color: '#5a6b66', letterSpacing: '.03em',
                  }
                },
                  React.createElement(RegionScopeIcon, { scopeId: it.scope, color: '#5a6b66', size: 12 }),
                  itemRegion.short.toUpperCase(),
                ),
                React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#8a9490', minWidth: 70, textAlign: 'right' } }, it.date),
              );
            })
          ),
    ),
  );
}

// Tiny inline icon that hints at the scope shape: full square / upper half / lower half /
// left half / right half / one quadrant. Drawn over a rounded jaw outline.
function RegionScopeIcon({ scopeId, color = '#5a6b66', size = 14 }) {
  // 16x16 viewBox — round-rect = mouth, inner highlight = the scope
  const fills = {
    all:   ['M2 2h12v12H2z'],
    upper: ['M2 2h12v6H2z'],
    lower: ['M2 8h12v6H2z'],
    right: ['M2 2h6v12H2z'],
    left:  ['M8 2h6v12H8z'],
    q1:    ['M2 2h6v6H2z'],
    q2:    ['M8 2h6v6H8z'],
    q3:    ['M8 8h6v6H8z'],
    q4:    ['M2 8h6v6H2z'],
  };
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
    style: { flexShrink: 0 },
  },
    React.createElement('rect', { x: 2, y: 2, width: 12, height: 12, rx: 2.5, stroke: color, strokeWidth: 1.2, opacity: 0.4 }),
    ...(fills[scopeId] || fills.all).map((d, i) => React.createElement('path', { key: i, d, fill: color, opacity: 0.85, rx: 1 })),
    // midlines
    scopeId !== 'all' && React.createElement('path', { d: 'M8 2v12 M2 8h12', stroke: color, strokeWidth: 0.6, opacity: 0.25 }),
  );
}

// Pull a glyph path from the shared PROC_GLYPHS lookup by name (not code).
function RegionGlyph({ glyph, size = 14 }) {
  const path = PROC_GLYPHS[glyph] || PROC_GLYPHS.drop;
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 16 16',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' },
    dangerouslySetInnerHTML: { __html: path },
  });
}

Object.assign(window, { ToothCrossDetail, ToothDetailModal });
