// variant-grid.jsx — Variant C: compact data-entry grid.
//   Designed for power-users who want to add many items fast. The "kríž" is a tight 4-quadrant
//   tile grid (each tooth = a small chip with FDI code + status dots + count badge). The right
//   side dominates with a real spreadsheet-style table — exactly what users miss from the old
//   system. A quick-entry input at the top accepts "26 KOR-ZIR 1" style shorthand.

function VariantGrid() {
  const [notation, setNotation] = React.useState('fdi');
  const [selected, setSelected] = React.useState(DEMO_STATE.selected);
  const [quickEntry, setQuickEntry] = React.useState('');
  const procs = DEMO_STATE.procedures;
  const missing = new Set(DEMO_STATE.missing);
  const implants = new Set(DEMO_STATE.implants);
  const temporary = new Set(DEMO_STATE.temporary);
  const bridges = DEMO_STATE.bridges;

  const items = flatItems(procs, bridges);
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const total = items.reduce((s, i) => s + i.p.price * i.qty, 0);

  return React.createElement('div', { style: { background: '#fbfaf6', border: '1px solid #e4ded4', borderRadius: 12, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Manrope,sans-serif', color: '#1a2320' } },
    // Toolbar
    React.createElement('div', { style: { padding: '12px 18px', background: '#fff', borderBottom: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 16, fontWeight: 700, color: '#1a2320' } }, 'Položky práce'),
        React.createElement('div', { style: { width: 1, height: 20, background: '#e4ded4' } }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12.5, color: '#1a2320' } },
          React.createElement('span', { style: { fontWeight: 700 } }, 'Bezáková Gabriela'),
          React.createElement('span', { style: { color: '#8a9490', fontFamily: 'ui-monospace,monospace', fontSize: 11 } }, '· 62 r. · ZP 00'),
          React.createElement('span', { style: { color: '#8a9490' } }, '· Práca'),
          React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', color: '#0d7c6b', fontWeight: 700 } }, '2025/252')
        )
      ),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        // Quick entry — accepts "26 KOR-ZIR" type shorthand
        React.createElement('div', { style: { position: 'relative' } },
          React.createElement('input', {
            value: quickEntry, onChange: e => setQuickEntry(e.target.value),
            placeholder: 'Rýchle zadanie: 26 KOR-ZIR 1',
            style: {
              padding: '6px 10px 6px 28px', border: '1px solid #0d7c6b', borderRadius: 6,
              fontSize: 12, fontFamily: 'ui-monospace,monospace', outline: 'none', width: 260,
              background: '#fff',
            }
          }),
          React.createElement('span', { style: { position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: '#0d7c6b', fontFamily: 'Manrope,sans-serif' } }, 'GO'),
        ),
        React.createElement(NotationToggle, { value: notation, onChange: setNotation }),
      )
    ),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '530px 1fr', gap: 14, padding: 14, flex: 1, minHeight: 0 } },
      // Left: tile grid + free-text popis
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 } },
        React.createElement(TileGrid, { selected, onSelect: setSelected, notation, procs, missing, implants, temporary, bridges, onOpenDetail: () => window.dispatchEvent(new CustomEvent('open-tooth-detail', { detail: { fdi: selected } })) }),
        React.createElement(PopisCard, null),
      ),
      // Right: data-entry table
      React.createElement(DataTable, { items, total, fmt, selected, notation, procs, bridges }),
    )
  );
}

function flatItems(procs, bridges) {
  const out = [];
  for (const [tooth, codes] of Object.entries(procs)) {
    for (const code of codes) {
      const p = PROC_BY_CODE[code];
      if (!p) continue;
      if (p.cat === 'bridge') {
        const b = bridges.find(b => String(b.from) === tooth);
        if (!b) continue;
        out.push({ tooth: `${b.from}–${b.to}`, code, p, qty: b.to - b.from + 1 });
      } else {
        out.push({ tooth, code, p, qty: 1 });
      }
    }
  }
  return out;
}

// ── Tile grid ─────────────────────────────────────────────────────────────────────
function TileGrid({ selected, onSelect, notation, procs, missing, implants, temporary, bridges, onOpenDetail }) {
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, padding: 14 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 10 } },
      React.createElement('div', null,
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, 'Zubný kríž'),
          // Magnifying glass button — opens the detail (Variant A) modal
          React.createElement(LupaButton, { onClick: onOpenDetail, title: 'Otvoriť detail zubného kríža' }),
        ),
        React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, 'Kompaktné zobrazenie — všetkých 32 zubov · detail otvoríte tlačidlom lupy'),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 6, fontSize: 9.5, color: '#5a6b66', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 240 } },
        ...['crown', 'bridge', 'implant', 'filling', 'tech'].map(c => {
          const cat = PROC_CATS[c];
          return React.createElement('span', { key: c, style: { display: 'inline-flex', alignItems: 'center', gap: 3 } },
            React.createElement('span', { style: { width: 7, height: 7, borderRadius: '50%', background: cat.accent } }),
            cat.label.slice(0, 4)
          );
        })
      )
    ),
    // Quadrant labels
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 14px 1fr', fontSize: 9.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em', padding: '0 2px 4px' } },
      React.createElement('div', { style: { textAlign: 'right' } }, 'Hore · pravá'),
      React.createElement('div', null),
      React.createElement('div', null, 'Hore · ľavá')
    ),
    // Upper row (8 + gap + 8)
    React.createElement(TileRow, { teeth: FDI_UPPER, notation, selected, onSelect, procs, missing, implants, temporary, bridges, upper: true }),
    // Midline divider
    React.createElement('div', { style: { height: 1, background: 'repeating-linear-gradient(to right, #c8c0b4 0 4px, transparent 4px 8px)', margin: '8px 2px' } }),
    // Lower row
    React.createElement(TileRow, { teeth: FDI_LOWER, notation, selected, onSelect, procs, missing, implants, temporary, bridges, upper: false }),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 14px 1fr', fontSize: 9.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em', padding: '4px 2px 0' } },
      React.createElement('div', { style: { textAlign: 'right' } }, 'Dolu · pravá'),
      React.createElement('div', null),
      React.createElement('div', null, 'Dolu · ľavá')
    ),
  );
}

// Magnifying-glass button — used in tile grid + patient detail; exported.
function LupaButton({ onClick, title, size = 28 }) {
  return React.createElement('button', {
    onClick, title,
    style: {
      width: size, height: size, padding: 0,
      background: '#fbfaf6', border: '1px solid #e4ded4', borderRadius: 6,
      color: '#0d7c6b', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background .12s, color .12s, border-color .12s',
    },
    onMouseEnter: e => { e.currentTarget.style.background = '#d4f0eb'; e.currentTarget.style.borderColor = '#0d7c6b'; },
    onMouseLeave: e => { e.currentTarget.style.background = '#fbfaf6'; e.currentTarget.style.borderColor = '#e4ded4'; },
  },
    // Custom magnifier-with-tooth glyph (zoom + tooth)
    React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
      React.createElement('circle', { cx: 9, cy: 9, r: 6 }),
      React.createElement('path', { d: 'm17 17-3.3-3.3' }),
      // Tiny tooth glyph inside the magnifier
      React.createElement('path', { d: 'M7 6.5 Q7 5.5 8 5.2 L10 5.2 Q11 5.5 11 6.5 L11 9 Q11 11 10 11 L8 11 Q7 11 7 9 Z', strokeWidth: 1.2 }),
    )
  );
}

function TileRow({ teeth, notation, selected, onSelect, procs, missing, implants, temporary, bridges, upper }) {
  // 8 tiles + midline gap + 8 tiles — explicit grid so columns are guaranteed equal width
  // regardless of content (no more flex shrink quirks).
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr) 14px repeat(8, 1fr)', gap: 4, alignItems: 'stretch' } },
    ...teeth.slice(0, 8).map(fdi => React.createElement(Tile, {
      key: fdi, fdi, notation,
      selected: selected === fdi, onSelect,
      codes: procs[fdi] || [],
      missing: missing.has(fdi), implant: implants.has(fdi), temporary: temporary.has(fdi),
      bridge: bridges.find(b => fdi >= b.from && fdi <= b.to), upper
    })),
    React.createElement('div', { key: 'mid', style: { width: '100%' } }),
    ...teeth.slice(8).map(fdi => React.createElement(Tile, {
      key: fdi, fdi, notation,
      selected: selected === fdi, onSelect,
      codes: procs[fdi] || [],
      missing: missing.has(fdi), implant: implants.has(fdi), temporary: temporary.has(fdi),
      bridge: bridges.find(b => fdi >= b.from && fdi <= b.to), upper
    }))
  );
}

function Tile({ fdi, notation, selected, onSelect, codes, missing, implant, temporary, bridge, upper }) {
  // Note: width comes from the parent grid track (1fr × 8). No flex.

  const counted = {};
  for (const c of codes) counted[c] = (counted[c] || 0) + 1;
  const items = Object.entries(counted);
  // Distinct category dots
  const distinctCats = [];
  for (const [code] of items) {
    const cat = PROC_BY_CODE[code].cat;
    if (!distinctCats.includes(cat)) distinctCats.push(cat);
  }

  const isSelected = selected;
  const bg = missing ? '#f7f6f2' : isSelected ? '#fff' : '#fefdf9';
  const border = isSelected ? '#0d7c6b' : missing ? '#e4ded4' : '#ece7dc';
  const count = codes.length;

  return React.createElement('button', {
    onClick: () => onSelect(fdi),
    style: {
      width: '100%', minWidth: 0, height: 68, padding: 0,
      background: bg,
      border: `${isSelected ? 2 : 1}px solid ${border}`,
      borderRadius: 6, cursor: 'pointer', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between',
      overflow: 'hidden', fontFamily: 'Manrope,sans-serif',
      boxShadow: isSelected ? '0 0 0 3px rgba(13,124,107,.12)' : 'none',
      opacity: missing ? 0.7 : 1,
    }
  },
    // Bridge connector indicator (top edge bar)
    bridge && React.createElement('div', { style: { position: 'absolute', top: 0, left: bridge.from === fdi ? '50%' : 0, right: bridge.to === fdi ? '50%' : 0, height: 3, background: PROC_CATS.bridge.accent } }),
    // FDI label
    React.createElement('div', {
      style: {
        padding: '4px 4px 2px', fontFamily: 'ui-monospace,monospace', fontSize: 11.5,
        fontWeight: 700, color: isSelected ? '#0d7c6b' : '#1a2320',
        textAlign: 'center', letterSpacing: '.02em',
      }
    }, fdiLabel(fdi, notation)),
    // Middle: status indicator (implant icon / missing X) + category dots
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2, padding: '0 2px' } },
      missing && React.createElement(Icon, { name: 'x', size: 14, color: '#c0392b', strokeWidth: 3 }),
      !missing && implant && React.createElement('div', {
        style: { width: 16, height: 12, borderRadius: 2, background: '#f3e8ff', border: '1px solid #9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b21a8' }
      }, React.createElement(ProcGlyph, { code: 'IMP-ABU', size: 8 })),
      !missing && !implant && distinctCats.length === 0 && React.createElement('div', { style: { width: 4, height: 4, borderRadius: '50%', background: '#e4ded4' } }),
      !missing && distinctCats.map(cat => React.createElement('div', {
        key: cat,
        style: { width: 6, height: 6, borderRadius: '50%', background: PROC_CATS[cat].accent }
      })),
    ),
    // Count badge
    count > 0 && React.createElement('div', {
      style: {
        position: 'absolute', top: 2, right: 2,
        background: '#1a2320', color: '#fff', fontSize: 9, fontWeight: 700,
        padding: '1px 4px', borderRadius: 7, minWidth: 13, textAlign: 'center', lineHeight: 1,
      }
    }, count),
    // Temporary indicator
    temporary && React.createElement('div', { style: { position: 'absolute', bottom: 2, left: 4, fontSize: 8, fontWeight: 700, color: '#d97706', letterSpacing: '.04em' } }, 'DOC'),
  );
}

// ── Popis (free-text note) ─────────────────────────────────────────────────────────
function PopisCard() {
  const [popis, setPopis] = React.useState('A3,5 · Bezkovová zirkonová korunka pre zub 26.\nPacientka má alergiu na nikel — bez kovových komponentov.\nSkúška hotovej práce pred glazúrou. Mostík 45–47 lepiť až po kontrole okluzie.');
  const [color, setColor] = React.useState('A3,5');
  const [material, setMaterial] = React.useState('Zirkón');
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, 'Popis práce'),
      React.createElement('div', { style: { fontSize: 10.5, color: '#8a9490' } }, 'Voľný text · viditeľný technikovi aj na pracovnom liste'),
    ),
    // Quick metadata pills — color (VITA shade), material — same row, small
    React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
      React.createElement(MetaField, { label: 'Farba', value: color, onChange: setColor, width: 78, mono: true }),
      React.createElement(MetaField, { label: 'Materiál', value: material, onChange: setMaterial, width: 130 }),
      React.createElement(MetaField, { label: 'Termín', value: '15. 5. 2025', onChange: () => {}, width: 110 }),
      React.createElement(MetaField, { label: 'Spotr. čas', value: '0 : 00', onChange: () => {}, width: 80, mono: true }),
    ),
    React.createElement('textarea', {
      value: popis, onChange: e => setPopis(e.target.value),
      placeholder: 'Špecifické požiadavky, alergie, farba, materiál, technické poznámky pre technika…',
      style: {
        flex: 1, minHeight: 100,
        padding: '10px 12px',
        border: '1px solid #e4ded4', borderRadius: 8,
        fontFamily: 'Manrope,sans-serif', fontSize: 12.5, lineHeight: 1.5,
        background: '#fbfaf6', outline: 'none', resize: 'none', color: '#1a2320',
      },
      onFocus: e => { e.target.style.borderColor = '#0d7c6b'; e.target.style.background = '#fff'; },
      onBlur:  e => { e.target.style.borderColor = '#e4ded4'; e.target.style.background = '#fbfaf6'; },
    }),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5, color: '#8a9490' } },
      React.createElement('div', { style: { display: 'flex', gap: 10 } },
        React.createElement('button', { style: chipBtnStyle }, '+ Šablóna'),
        React.createElement('button', { style: chipBtnStyle }, '+ Alergia'),
        React.createElement('button', { style: chipBtnStyle }, '+ Farba'),
      ),
      React.createElement('span', null, popis.length, ' / 1000 znakov')
    )
  );
}

function MetaField({ label, value, onChange, width, mono }) {
  return React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5a6b66' } },
    React.createElement('span', { style: { fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 9.5 } }, label),
    React.createElement('input', {
      value: value, onChange: e => onChange(e.target.value),
      style: {
        width, padding: '4px 8px', border: '1px solid #e4ded4', borderRadius: 5,
        fontFamily: mono ? 'ui-monospace,monospace' : 'Manrope,sans-serif',
        fontSize: 11.5, fontWeight: 600, color: '#1a2320', background: '#fff', outline: 'none',
      }
    })
  );
}

const chipBtnStyle = {
  background: '#fbfaf6', border: '1px solid #e4ded4', borderRadius: 9999,
  padding: '3px 9px', fontSize: 10.5, fontWeight: 600, color: '#5a6b66',
  fontFamily: 'Manrope,sans-serif', cursor: 'pointer',
};

// ── Data table (the spreadsheet) ──────────────────────────────────────────────────
function DataTable({ items, total, fmt, selected, notation, procs, bridges }) {
  // Build display rows. Highlight rows for selected tooth.
  const codeOf = (it) => it.code;
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' } },
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderBottom: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      React.createElement('div', null,
        React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, 'Tabuľka úkonov'),
        React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, 'Klik na riadok ho zvýrazní v kríži · klávesnica F3 = nový · F4 = duplikovať')
      ),
      React.createElement('div', { style: { display: 'flex', gap: 4 } },
        React.createElement('button', { style: btnStyle('ghost') }, 'F2 Vyhľadať'),
        React.createElement('button', { style: btnStyle('outline') }, 'F4 Kópia'),
        React.createElement('button', { style: btnStyle('primary') }, '+ F3 Nový'),
      )
    ),
    // Header
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '28px 60px 90px 1fr 50px 50px 92px 92px', padding: '7px 12px', background: '#f4f1ea', fontSize: 9.5, fontWeight: 700, color: '#5a6b66', textTransform: 'uppercase', letterSpacing: '.04em', gap: 8, borderBottom: '1px solid #ece7dc' } },
      React.createElement('span', null, ''),
      React.createElement('span', null, 'Zub'),
      React.createElement('span', null, 'Kód'),
      React.createElement('span', null, 'Popis'),
      React.createElement('span', { style: { textAlign: 'center' } }, 'Ks'),
      React.createElement('span', { style: { textAlign: 'center' } }, 'Kov'),
      React.createElement('span', { style: { textAlign: 'right' } }, 'Cena ZT'),
      React.createElement('span', { style: { textAlign: 'right' } }, 'Cena lek.'),
    ),
    // Rows
    React.createElement('div', { style: { flex: 1, overflowY: 'auto', minHeight: 240 } },
      ...items.map((it, i) => {
        const cat = PROC_CATS[it.p.cat];
        const isOnSelected = it.tooth === String(selected) || (it.tooth.includes('–') && (() => {
          const [a, b] = it.tooth.split('–').map(n => parseInt(n));
          return selected >= a && selected <= b;
        })());
        return React.createElement('div', {
          key: i,
          style: {
            display: 'grid', gridTemplateColumns: '28px 60px 90px 1fr 50px 50px 92px 92px',
            padding: '7px 12px', borderTop: i ? '1px solid #f0ede5' : 'none',
            alignItems: 'center', gap: 8, fontSize: 12,
            background: isOnSelected ? '#fbf9f1' : '#fff',
            cursor: 'pointer',
          }
        },
          React.createElement('div', { style: { width: 14, height: 24, borderRadius: 2, background: cat.accent } }),
          React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: isOnSelected ? '#0d7c6b' : '#1a2320', fontSize: 11.5 } }, it.tooth),
          React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 600, color: '#0d7c6b' } }, it.code),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
            React.createElement('div', { style: { width: 18, height: 18, borderRadius: 4, background: cat.bg, color: cat.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
              React.createElement(ProcGlyph, { code: it.code, size: 10 })
            ),
            React.createElement('span', { style: { color: '#1a2320', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it.p.name)
          ),
          React.createElement('span', { style: { textAlign: 'center', color: '#1a2320' } }, it.qty),
          React.createElement('span', { style: { textAlign: 'center', color: '#8a9490', fontSize: 11 } }, it.p.cat === 'crown' ? '—' : '·'),
          React.createElement('span', { style: { textAlign: 'right', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320' } }, fmt(it.p.price)),
          React.createElement('span', { style: { textAlign: 'right', color: '#5a6b66' } }, fmt(it.p.price * it.qty))
        );
      }),
      // Empty input row placeholder
      React.createElement('div', {
        style: {
          display: 'grid', gridTemplateColumns: '28px 60px 90px 1fr 50px 50px 92px 92px',
          padding: '7px 12px', borderTop: '2px dashed #e4ded4', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#b0bdb9', background: '#fbfaf6',
        }
      },
        React.createElement('div', null),
        React.createElement('input', { placeholder: '__', style: cellInputStyle, defaultValue: '' }),
        React.createElement('input', { placeholder: 'Kód…', style: cellInputStyle, defaultValue: '' }),
        React.createElement('input', { placeholder: 'začnite písať pre návrhy z katalógu…', style: cellInputStyle }),
        React.createElement('input', { placeholder: '1', style: { ...cellInputStyle, textAlign: 'center' }, defaultValue: '1' }),
        React.createElement('input', { placeholder: '—', style: { ...cellInputStyle, textAlign: 'center' } }),
        React.createElement('input', { placeholder: '0,00', style: { ...cellInputStyle, textAlign: 'right' } }),
        React.createElement('input', { placeholder: '0,00', style: { ...cellInputStyle, textAlign: 'right' } }),
      )
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '28px 60px 90px 1fr 50px 50px 92px 92px', padding: '10px 12px', background: '#fbfaf6', borderTop: '1px solid #ece7dc', alignItems: 'center', gap: 8 } },
      React.createElement('span', null), React.createElement('span', null), React.createElement('span', null),
      React.createElement('span', { style: { fontSize: 11, color: '#8a9490', fontWeight: 600 } }, `${items.length} položiek`),
      React.createElement('span', null), React.createElement('span', null),
      React.createElement('span', { style: { textAlign: 'right', fontSize: 11, color: '#8a9490', fontWeight: 600 } }, 'Spolu:'),
      React.createElement('span', { style: { textAlign: 'right', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 14, fontWeight: 800, color: '#1a2320' } }, fmt(total)),
    )
  );
}

const cellInputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '3px 6px',
  border: '1px solid #ece7dc', borderRadius: 4, background: '#fff',
  fontSize: 11.5, fontFamily: 'Manrope,sans-serif', outline: 'none', color: '#1a2320',
};

function btnStyle(variant) {
  const base = { padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope,sans-serif', border: 'none' };
  if (variant === 'primary') return { ...base, background: '#0d7c6b', color: '#fff' };
  if (variant === 'outline') return { ...base, background: '#fff', color: '#1a2320', border: '1px solid #e4ded4' };
  return { ...base, background: 'transparent', color: '#5a6b66' };
}

Object.assign(window, { VariantGrid, LupaButton });
