// variant-anatomical.jsx — Variant A: classic FDI dental cross with anatomical tooth shapes.
//   Left side: 4-quadrant cross. Tooth shapes are real-looking. Procedure glyphs stack above
//   (upper jaw → above the crown) or below (lower jaw → below the crown). Selected tooth
//   shows a teal halo. Bridge spans get a horizontal connector bar. Right side: procedure
//   table + add-from-catalog popover. Click a row → tooth highlights; click tooth → table filters.

function VariantAnatomical() {
  const [notation, setNotation] = React.useState('fdi');
  const [selected, setSelected] = React.useState(DEMO_STATE.selected);
  const [filterTooth, setFilterTooth] = React.useState(true);
  const proceduresByTooth = DEMO_STATE.procedures;
  const missing = new Set(DEMO_STATE.missing);
  const implants = new Set(DEMO_STATE.implants);
  const temporary = new Set(DEMO_STATE.temporary);
  const bridges = DEMO_STATE.bridges;

  // All work items as a flat list (the right-side table)
  const allItems = [];
  for (const [tooth, codes] of Object.entries(proceduresByTooth)) {
    for (const code of codes) {
      const p = PROC_BY_CODE[code];
      if (!p) continue;
      // For bridges, only show once (on the first tooth of the bridge span)
      if (p.cat === 'bridge') {
        const b = bridges.find(b => String(b.from) === tooth);
        if (!b) continue;
        allItems.push({ tooth: `${b.from}–${b.to}`, code, p, qty: b.to - b.from + 1, span: b });
      } else {
        allItems.push({ tooth, code, p, qty: 1 });
      }
    }
  }
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const total = allItems.reduce((s, i) => s + i.p.price * i.qty, 0);

  // Filter table by tooth if filter is on
  const visibleItems = filterTooth
    ? allItems.filter(i => i.tooth === String(selected) || (i.span && selected >= i.span.from && selected <= i.span.to))
    : allItems;

  return React.createElement('div', { style: outerStyle },
    // ── Toolbar ────────────────────────────────────────────
    React.createElement('div', { style: toolbarStyle },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em' } }, 'Krok 2 z 4'),
          React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 17, fontWeight: 700, color: '#1a2320', marginTop: 2 } }, 'Položky práce')
        ),
        React.createElement('div', { style: { width: 1, height: 32, background: '#e4ded4' } }),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 1 } },
          React.createElement('span', { style: tagLabel }, 'Pacient'),
          React.createElement('span', { style: tagValue }, 'Mária Kováčová · 851215')
        ),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 1 } },
          React.createElement('span', { style: tagLabel }, 'Lekár'),
          React.createElement('span', { style: tagValue }, 'MUDr. Pavol Novák')
        ),
      ),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement('span', { style: { fontSize: 11, color: '#8a9490' } }, 'Notácia:'),
        React.createElement(NotationToggle, { value: notation, onChange: setNotation })
      )
    ),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 20, padding: 20 } },
      // ── LEFT: Dental cross ───────────────────────────────
      React.createElement('div', null,
        React.createElement('div', { style: chartCardStyle },
          React.createElement('div', { style: chartHeaderStyle },
            React.createElement('div', null,
              React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, 'Zubný kríž'),
              React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, 'Klik na zub označí výkony · pravý-klik označí ako chýbajúci')
            ),
            React.createElement(ChartLegend)
          ),

          // Patient-facing labels (R / L)
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '14px 32px 4px', fontSize: 10.5, fontWeight: 700, color: '#8a9490', letterSpacing: '.08em' } },
            React.createElement('span', null, 'PACIENT · PRAVÁ'),
            React.createElement('span', null, 'PACIENT · ĽAVÁ')
          ),

          // Upper row
          React.createElement(ToothRow, {
            teeth: FDI_UPPER, notation, selected, onSelect: setSelected,
            proceduresByTooth, missing, implants, temporary, bridges,
            upper: true
          }),

          // Midline
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0', gap: 8 } },
            React.createElement('div', { style: { flex: 1, height: 1, background: 'repeating-linear-gradient(to right, #c8c0b4 0 6px, transparent 6px 12px)' } }),
            React.createElement('span', { style: { fontSize: 10, color: '#b0bdb9', fontFamily: 'ui-monospace, monospace' } }, '— okluzálna rovina —'),
            React.createElement('div', { style: { flex: 1, height: 1, background: 'repeating-linear-gradient(to right, #c8c0b4 0 6px, transparent 6px 12px)' } }),
          ),

          // Lower row
          React.createElement(ToothRow, {
            teeth: FDI_LOWER, notation, selected, onSelect: setSelected,
            proceduresByTooth, missing, implants, temporary, bridges,
            upper: false
          }),

          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '4px 32px 16px', fontSize: 10.5, fontWeight: 700, color: '#8a9490', letterSpacing: '.08em' } },
            React.createElement('span', null, 'PRAVÁ'),
            React.createElement('span', null, 'ĽAVÁ')
          ),
        ),

        // Selected tooth context card
        React.createElement(SelectedToothCard, {
          fdi: selected, notation,
          codes: (proceduresByTooth[selected] || []),
          missing: missing.has(selected),
          implant: implants.has(selected),
          temporary: temporary.has(selected),
        })
      ),

      // ── RIGHT: Procedures table + catalog ────────────────
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        // Catalog
        React.createElement(CatalogPanel, { selected, notation }),
        // Table
        React.createElement(ProceduresTable, {
          items: visibleItems, total, fmt, filterTooth, setFilterTooth, selected, notation
        })
      )
    )
  );
}

// ── Tooth row (upper or lower) ────────────────────────────────────────────────────
function ToothRow({ teeth, notation, selected, onSelect, proceduresByTooth, missing, implants, temporary, bridges, upper }) {
  // Insert midline gap between quadrants (positions 8 and 9)
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: '6px 24px', gap: 2, position: 'relative' } },
    ...teeth.map((fdi, i) => {
      const isMidlineRight = i === 7; // last of left quadrant → add gap to right
      const codes = proceduresByTooth[fdi] || [];
      const bridge = bridges.find(b => fdi >= b.from && fdi <= b.to);
      const bridgeStart = bridge && fdi === bridge.from;
      const bridgeMid = bridge && fdi !== bridge.from && fdi !== bridge.to;
      const bridgeEnd = bridge && fdi === bridge.to;
      return React.createElement(ToothCell, {
        key: fdi, fdi, notation,
        selected: selected === fdi, onSelect,
        codes, missing: missing.has(fdi), implant: implants.has(fdi), temporary: temporary.has(fdi),
        bridge, bridgeStart, bridgeMid, bridgeEnd,
        upper,
        extraMarginRight: isMidlineRight ? 14 : 0,
      });
    })
  );
}

// ── Individual tooth cell with procedure glyphs above/below ───────────────────────
function ToothCell({ fdi, notation, selected, onSelect, codes, missing, implant, temporary, bridge, bridgeStart, bridgeMid, bridgeEnd, upper, extraMarginRight }) {
  // Glyphs to render: dedupe code-level for compact display, but keep multiplicity in a count badge
  const counted = {};
  for (const c of codes) counted[c] = (counted[c] || 0) + 1;
  const glyphList = Object.entries(counted).map(([code, n]) => ({ code, n }));

  // Glyph strip — placed above for upper, below for lower (i.e. occlusal side)
  const stripContent = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minHeight: 36 } },
    ...glyphList.slice(0, 3).map(({ code, n }, i) => {
      const p = PROC_BY_CODE[code];
      const cat = PROC_CATS[p.cat];
      return React.createElement('div', {
        key: code,
        title: p.name + (n > 1 ? ` ×${n}` : ''),
        style: {
          width: 20, height: 20, borderRadius: 5,
          background: cat.bg, color: cat.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${cat.accent}33`,
          position: 'relative',
        }
      },
        React.createElement(ProcGlyph, { code, size: 12 }),
        n > 1 && React.createElement('span', {
          style: { position: 'absolute', top: -5, right: -5, fontSize: 9, fontWeight: 700, background: '#1a2320', color: 'white', borderRadius: 8, padding: '1px 4px', minWidth: 12, textAlign: 'center', lineHeight: 1 }
        }, n),
      );
    }),
    glyphList.length > 3 && React.createElement('div', { style: { fontSize: 9, color: '#8a9490', fontWeight: 700 } }, `+${glyphList.length - 3}`)
  );

  const label = fdiLabel(fdi, notation);

  // Bridge connector bar — rendered as an absolute element on the crown level
  const bridgeBar = bridge && React.createElement('div', {
    style: {
      position: 'absolute',
      left: bridgeStart ? '50%' : 0,
      right: bridgeEnd ? '50%' : 0,
      [upper ? 'bottom' : 'top']: upper ? 8 : 8,
      height: 3, background: PROC_CATS.bridge.accent,
      zIndex: 0,
    }
  });

  return React.createElement('div', {
    onClick: () => onSelect(fdi),
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      cursor: 'pointer', userSelect: 'none', position: 'relative',
      marginRight: extraMarginRight, padding: '2px 1px', borderRadius: 6,
      background: selected ? 'rgba(13,124,107,.06)' : 'transparent',
      transition: 'background .12s',
    }
  },
    // upper: glyph strip ON TOP, then tooth, then label
    // lower: label first, then tooth, then glyph strip BELOW
    upper && stripContent,
    upper && React.createElement('div', { style: { position: 'relative' } },
      bridgeBar,
      React.createElement(ToothShape, { fdi, selected, missing, implant, temporary, size: 36 })
    ),
    React.createElement('div', {
      style: {
        fontFamily: 'ui-monospace, monospace', fontSize: 10.5, fontWeight: 700,
        color: selected ? '#0d7c6b' : '#5a6b66', letterSpacing: '.02em',
        padding: '2px 4px', borderRadius: 4,
        background: selected ? '#fff' : 'transparent',
        border: selected ? '1px solid #0d7c6b' : '1px solid transparent',
      }
    }, label),
    !upper && React.createElement('div', { style: { position: 'relative' } },
      bridgeBar,
      React.createElement(ToothShape, { fdi, selected, missing, implant, temporary, size: 36 })
    ),
    !upper && stripContent,
  );
}

// ── Chart legend ──────────────────────────────────────────────────────────────────
function ChartLegend() {
  const items = [
    { color: '#0d7c6b', label: 'Vybraný' },
    { color: '#9333ea', label: 'Implantát' },
    { color: '#c0392b', label: 'Chýba' },
    { color: '#d97706', label: 'Dočasná' },
  ];
  return React.createElement('div', { style: { display: 'flex', gap: 10 } },
    ...items.map(it => React.createElement('div', { key: it.label, style: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: '#5a6b66' } },
      React.createElement('div', { style: { width: 8, height: 8, borderRadius: 2, background: it.color } }),
      it.label
    ))
  );
}

// ── Selected tooth context card ───────────────────────────────────────────────────
function SelectedToothCard({ fdi, notation, codes, missing, implant, temporary }) {
  const type = toothType(fdi);
  const typeLabel = { incisor: 'Rezák', canine: 'Očný zub', premolar: 'Predstoličkov', molar: 'Stolička' }[type];
  const flags = [];
  if (implant)   flags.push({ bg: PROC_CATS.implant.bg, fg: PROC_CATS.implant.fg, label: 'Implantát' });
  if (missing)   flags.push({ bg: PROC_CATS.extract.bg, fg: PROC_CATS.extract.fg, label: 'Chýba (extrahovaný)' });
  if (temporary) flags.push({ bg: '#fef3c7', fg: '#92400e', label: 'Dočasná práca' });
  return React.createElement('div', { style: { marginTop: 12, padding: '12px 14px', background: '#fefdf9', border: '1px solid #ece7dc', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 } },
    React.createElement(ToothShape, { fdi, selected: true, missing, implant, temporary, size: 40 }),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 15, fontWeight: 700, color: '#1a2320' } }, `Zub ${fdiLabel(fdi, notation)}`),
        notation !== 'fdi' && React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 10.5, color: '#8a9490' } }, `FDI ${fdi}`),
        React.createElement('span', { style: { fontSize: 11, color: '#8a9490' } }, `· ${typeLabel}`),
        ...flags.map((f, i) => React.createElement('span', { key: i, style: { background: f.bg, color: f.fg, fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 9999, textTransform: 'uppercase', letterSpacing: '.04em' } }, f.label))
      ),
      React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 3 } },
        codes.length === 0 ? 'Žiadne výkony — vyberte z katalógu vpravo.' : `${codes.length} výkon(ov) priradené tomuto zubu`
      )
    ),
    React.createElement('div', { style: { display: 'flex', gap: 6 } },
      React.createElement('button', { style: smallBtnStyle('outline') }, 'História'),
      React.createElement('button', { style: smallBtnStyle('primary') }, '+ Výkon')
    )
  );
}

// ── Catalog panel (procedure picker) ──────────────────────────────────────────────
function CatalogPanel({ selected, notation }) {
  const order = ['crown', 'bridge', 'filling', 'veneer', 'implant', 'denture', 'tech'];
  const [openCat, setOpenCat] = React.useState('crown');
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, overflow: 'hidden' } },
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderBottom: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      React.createElement('div', null,
        React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, 'Katalóg výkonov'),
        React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, `Klikom pridáte na zub `, React.createElement('strong', { style: { color: '#0d7c6b' } }, fdiLabel(selected, notation)))
      ),
      React.createElement('input', {
        placeholder: 'Hľadať kód alebo názov…',
        style: { width: 180, padding: '6px 10px', border: '1px solid #e4ded4', borderRadius: 6, fontSize: 11.5, outline: 'none', fontFamily: 'Manrope,sans-serif' }
      })
    ),
    React.createElement('div', { style: { display: 'flex', gap: 4, padding: 8, borderBottom: '1px solid #f0ede5', flexWrap: 'wrap' } },
      ...order.map(c => {
        const cat = PROC_CATS[c];
        const active = openCat === c;
        return React.createElement('button', {
          key: c, onClick: () => setOpenCat(c),
          style: {
            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: active ? cat.bg : 'transparent', color: active ? cat.fg : '#5a6b66',
            fontSize: 11, fontWeight: 600, fontFamily: 'Manrope,sans-serif',
          }
        }, cat.label)
      })
    ),
    React.createElement('div', { style: { padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 180, overflowY: 'auto' } },
      ...(CATALOG_GROUPED[openCat] || []).map(p => {
        const cat = PROC_CATS[p.cat];
        return React.createElement('button', {
          key: p.code,
          style: {
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            background: '#fff', border: '1px solid #ece7dc', borderRadius: 7, cursor: 'pointer',
            textAlign: 'left', fontFamily: 'Manrope,sans-serif',
            transition: 'border-color .1s, background .1s',
          },
          onMouseEnter: e => { e.currentTarget.style.borderColor = cat.accent; e.currentTarget.style.background = cat.bg + '55'; },
          onMouseLeave: e => { e.currentTarget.style.borderColor = '#ece7dc'; e.currentTarget.style.background = '#fff'; },
        },
          React.createElement('div', { style: { width: 26, height: 26, borderRadius: 6, background: cat.bg, color: cat.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
            React.createElement(ProcGlyph, { code: p.code, size: 14 })
          ),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: '#1a2320', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.name),
            React.createElement('div', { style: { fontSize: 10, color: '#8a9490', fontFamily: 'ui-monospace,monospace', marginTop: 1 } }, p.code)
          ),
          React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: '#1a2320', fontFamily: 'Plus Jakarta Sans,sans-serif', whiteSpace: 'nowrap' } }, p.price.toFixed(0), ' €')
        );
      })
    )
  );
}

// ── Procedures table (the actual data being entered) ──────────────────────────────
function ProceduresTable({ items, total, fmt, filterTooth, setFilterTooth, selected, notation }) {
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, overflow: 'hidden', flex: 1 } },
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderBottom: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      React.createElement('div', null,
        React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, 'Položky práce'),
        React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, `${items.length} položiek · klik na riadok zvýrazní zub v kríži`)
      ),
      React.createElement('label', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5a6b66', cursor: 'pointer' } },
        React.createElement('input', { type: 'checkbox', checked: filterTooth, onChange: e => setFilterTooth(e.target.checked) }),
        `Filtruj na zub ${fdiLabel(selected, notation)}`
      )
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '52px 1fr 68px 50px 92px 28px', padding: '8px 14px', background: '#f7f6f2', fontSize: 10, fontWeight: 700, color: '#5a6b66', textTransform: 'uppercase', letterSpacing: '.05em', gap: 8 } },
      React.createElement('span', null, 'Zub'),
      React.createElement('span', null, 'Výkon'),
      React.createElement('span', null, 'Kód'),
      React.createElement('span', { style: { textAlign: 'center' } }, 'Ks'),
      React.createElement('span', { style: { textAlign: 'right' } }, 'Cena'),
      React.createElement('span', null)
    ),
    React.createElement('div', { style: { maxHeight: 280, overflowY: 'auto' } },
      ...items.map((it, i) => {
        const cat = PROC_CATS[it.p.cat];
        return React.createElement('div', {
          key: i,
          style: { display: 'grid', gridTemplateColumns: '52px 1fr 68px 50px 92px 28px', padding: '8px 14px', borderTop: '1px solid #f0ede5', alignItems: 'center', gap: 8, background: '#fff' },
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
            React.createElement('div', { style: { width: 6, height: 22, borderRadius: 2, background: cat.accent } }),
            React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11.5, fontWeight: 700, color: '#1a2320' } }, it.tooth)
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
            React.createElement('div', { style: { width: 20, height: 20, borderRadius: 4, background: cat.bg, color: cat.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
              React.createElement(ProcGlyph, { code: it.code, size: 12 })
            ),
            React.createElement('span', { style: { fontSize: 12, color: '#1a2320', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it.p.name)
          ),
          React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 10.5, color: '#0d7c6b', fontWeight: 600 } }, it.code),
          React.createElement('span', { style: { fontSize: 12, textAlign: 'center', color: '#1a2320' } }, it.qty),
          React.createElement('span', { style: { fontSize: 12, fontWeight: 700, fontFamily: 'Plus Jakarta Sans,sans-serif', textAlign: 'right', color: '#1a2320' } }, fmt(it.p.price * it.qty)),
          React.createElement('button', { style: { width: 22, height: 22, border: 'none', background: 'transparent', color: '#8a9490', cursor: 'pointer', borderRadius: 4, padding: 0 } }, '×')
        );
      }),
      items.length === 0 && React.createElement('div', { style: { padding: '24px 14px', textAlign: 'center', fontSize: 12, color: '#8a9490' } },
        `Žiadne výkony pre zub ${fdiLabel(selected, notation)}. Vyberte z katalógu vyššie.`
      )
    ),
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderTop: '1px solid #ece7dc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement('span', { style: { fontSize: 11.5, color: '#8a9490' } }, 'Spolu (bez DPH)'),
      React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 16, fontWeight: 700, color: '#1a2320' } }, fmt(total))
    )
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────────
const outerStyle = {
  background: '#fbfaf6', border: '1px solid #e4ded4', borderRadius: 12,
  overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
  fontFamily: 'Manrope,sans-serif', color: '#1a2320',
};
const toolbarStyle = {
  padding: '14px 20px', background: '#fff', borderBottom: '1px solid #ece7dc',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
};
const tagLabel = { fontSize: 9.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em' };
const tagValue = { fontSize: 12, color: '#1a2320', fontWeight: 600 };
const chartCardStyle = { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10 };
const chartHeaderStyle = { padding: '12px 16px', borderBottom: '1px solid #f0ede5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };

function smallBtnStyle(variant) {
  if (variant === 'primary') return { padding: '5px 10px', borderRadius: 6, border: 'none', background: '#0d7c6b', color: 'white', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope,sans-serif' };
  return { padding: '5px 10px', borderRadius: 6, border: '1px solid #e4ded4', background: '#fff', color: '#1a2320', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope,sans-serif' };
}

Object.assign(window, { VariantAnatomical });
