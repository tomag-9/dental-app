// variant-detail.jsx — the dental cross (zubný kríž) shown as a detail overlay.
//   Read-only by default, with an "Upraviť" toggle that writes back to the job.
//   Mounted once from App.jsx as <ToothDetailModal> and opened by dispatching a
//   window CustomEvent 'open-tooth-detail'.
//
// Data (#116) — the chart is derived from the API payload, never from fixtures:
//   · Job.input_tooth_procedures   — chrup na vstupe
//   · Job.output_tooth_procedures  — výsledná práca (prekrýva vstup)
//   · Patient.tooth_procedures     — kumulatívna mapa pacienta (PatientDetail)
//   · JobItem.tooth / tooth_scope / tooth_state / bridge_span
// `buildToothChartState()` below is the single pure derivation; it is exposed on
// window so the tooth-chart smoke check can exercise it without a DOM.
//
// Notation: FDI (18–48) is canonical everywhere, matching apps/jobs/dental.py.
// Palmer/Universal are display-only conversions done in polozky-shared.jsx.

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
const REGION_SCOPE_ALIASES = {
  A: 'all',
  U: 'upper',
  L: 'lower',
  Q1: 'q1',
  Q2: 'q2',
  Q3: 'q3',
  Q4: 'q4',
};

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

// ── Chart derivation ──────────────────────────────────────────────────────────────
// Pure: turns the API payload into everything the cross needs to draw. Kept free of
// React so it can be unit-checked (scripts/tooth-chart-smoke.mjs).
//
//   job              — a Job as returned by /api/jobs/jobs/ (raw, not normalised)
//   items            — JobItem list; defaults to job.items
//   toothProcedures  — a bare tooth map (Patient.tooth_procedures) used when there
//                      is no job, e.g. the patient's cumulative chart
//
// Tooth map values may be a single value ("crown") or a list (["ONL-KER","LEP-001"]),
// which is what the backend's JSONField allows today.
const TOOTH_STATE_KEYWORDS = { missing: 'missing', implant: 'implants', temporary: 'temporary' };
const FDI_ALL = new Set([...FDI_UPPER, ...FDI_LOWER]);

function buildToothChartState({ job = null, items = null, toothProcedures = null } = {}) {
  const procs = {};
  const missing = new Set();
  const implants = new Set();
  const temporary = new Set();
  const bridges = [];
  const regionProcedures = [];
  const sets = { missing, implants, temporary };

  const addCode = (tooth, code) => {
    const key = String(tooth || '').trim();
    if (!key || !code) return;
    const list = (procs[key] = procs[key] || []);
    if (!list.includes(code)) list.push(code);
  };
  const markState = (tooth, state) => {
    const bucket = sets[TOOTH_STATE_KEYWORDS[String(state || '').toLowerCase()]];
    if (bucket && Number(tooth)) bucket.add(Number(tooth));
  };

  // Tooth maps, weakest first: patient cumulative → job input → job output.
  const maps = [
    toothProcedures,
    job && job.input_tooth_procedures,
    job && job.output_tooth_procedures,
  ];
  for (const map of maps) {
    if (!map || typeof map !== 'object') continue;
    for (const [tooth, value] of Object.entries(map)) {
      const codes = Array.isArray(value) ? value : [value];
      for (const code of codes) {
        if (code == null || code === '') continue;
        addCode(tooth, String(code));
        markState(tooth, code);
      }
    }
  }

  // Job items — the authoritative per-tooth work.
  const list = Array.isArray(items) ? items : (job && Array.isArray(job.items) ? job.items : []);
  for (const item of list) {
    const code = item.code || item.price_list_code;
    if (!code) continue;
    const scope = normalizeRegionScope(item.tooth_scope || item.scope);
    if (scope) {
      regionProcedures.push({
        id: item.id != null ? `item-${item.id}` : `item-${regionProcedures.length}`,
        scope,
        code,
        date: item.created_at ? new Date(item.created_at).toLocaleDateString('sk-SK') : '',
        note: item.description || item.name || '',
      });
      continue;  // region work is listed separately, never drawn on the cross
    }

    const span = expandFdiSpan(item.bridge_span);
    if (span.length >= 2) {
      // `teeth` is the span in display order; from/to are the numeric ends, which is
      // what the label (#98) and the FDI notation expect.
      const from = Math.min(...span);
      const to = Math.max(...span);
      if (!bridges.some((b) => b.from === from && b.to === to && b.code === code)) {
        bridges.push({ from, to, code, teeth: span });
      }
      for (const tooth of span) addCode(tooth, code);
    }

    const teeth = expandFdiSpan(item.tooth);
    for (const tooth of teeth) {
      addCode(tooth, code);
      markState(tooth, item.tooth_state);
    }
    if (teeth.length === 0 && span.length >= 2) markState(span[0], item.tooth_state);
  }

  return { procs, missing, implants, temporary, bridges, regionProcedures, items: list };
}

// '45-47' → [45, 46, 47]; '26' → [26]; anything unknown → []. Mirrors
// apps/jobs/dental.py:expand_fdi_range, including the en/em-dash spellings.
function expandFdiSpan(value) {
  const raw = String(value == null ? '' : value).trim().replace(/[–—]/g, '-');
  if (!raw) return [];
  if (!raw.includes('-')) {
    const fdi = Number(raw);
    return FDI_ALL.has(fdi) ? [fdi] : [];
  }
  const [startRaw, endRaw] = raw.split('-');
  const start = Number(String(startRaw).trim());
  const end = Number(String(endRaw).trim());
  const arch = FDI_UPPER.includes(start) && FDI_UPPER.includes(end)
    ? FDI_UPPER
    : (FDI_LOWER.includes(start) && FDI_LOWER.includes(end) ? FDI_LOWER : null);
  if (!arch) return [];
  const [lo, hi] = [arch.indexOf(start), arch.indexOf(end)].sort((a, b) => a - b);
  return arch.slice(lo, hi + 1);
}

// Backend scope codes (A/U/L/Q1..Q4) → the panel's scope ids.
function normalizeRegionScope(value) {
  const raw = String(value == null ? '' : value).trim().toUpperCase();
  if (!raw) return '';
  if (REGION_SCOPE_ALIASES[raw]) return REGION_SCOPE_ALIASES[raw];
  const lower = raw.toLowerCase();
  return REGION_BY_ID[lower] ? lower : '';
}

function ToothCrossDetail({
  initialSelected, notation: initialNotation, readonly = true,
  patient, onClose, job = null, items = null, toothProcedures = null, onSaved = null,
}) {
  // Derived first: the initially focused tooth is the first one that actually
  // carries work, so the chart opens on data rather than on a fixed FDI code.
  const base = buildToothChartState({ job, items, toothProcedures });
  const firstWorkedTooth = [...FDI_UPPER, ...FDI_LOWER].find((fdi) => (base.procs[String(fdi)] || []).length > 0);

  const [notation, setNotation] = React.useState(initialNotation || 'fdi');
  const [selected, setSelected] = React.useState(initialSelected || firstWorkedTooth || 11);
  const [isEditing, setIsEditing] = React.useState(!readonly);
  const [regionScope, setRegionScope] = React.useState('all');
  const [highlightRegion, setHighlightRegion] = React.useState(false);
  // Local overrides while editing. `null` = nothing edited yet, so the chart shows
  // exactly what the API returned.
  const [draft, setDraft] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');

  // While editing, the draft map IS the whole chart — feeding `job` back in would
  // re-merge input_tooth_procedures and resurrect teeth the user just cleared.
  // Items stay in, because a billed item is not something the chart may delete.
  const chart = draft ? buildToothChartState({ toothProcedures: draft.procedures, items: draft.items }) : base;
  const { procs, missing, implants, temporary, bridges, regionProcedures } = chart;
  const chartItems = chart.items;
  const canEdit = Boolean(job && job.id);

  // Toggling a tooth in edit mode writes into `draft.procedures`, which is the exact
  // shape of Job.output_tooth_procedures — so saving is a plain PATCH of that field.
  const currentMap = () => {
    if (draft) return { ...draft.procedures };
    const out = {};
    for (const [tooth, codes] of Object.entries(base.procs)) out[tooth] = [...codes];
    return out;
  };
  const setToothCodes = (fdi, codes) => {
    const next = currentMap();
    if (codes && codes.length) next[String(fdi)] = codes;
    else delete next[String(fdi)];
    setDraft({ procedures: next, items: chartItems });
    setSaveError('');
  };
  const toggleMissing = (fdi) => {
    const codes = (currentMap()[String(fdi)] || []).filter((c) => c !== 'missing');
    setToothCodes(fdi, missing.has(fdi) ? codes : [...codes, 'missing']);
  };
  const save = async () => {
    if (!draft || !canEdit) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await window.MolarisAPI.updateJob(job.id, { output_tooth_procedures: draft.procedures });
      setDraft(null);
      setIsEditing(false);
      if (onSaved) onSaved(updated);
    } catch (err) {
      setSaveError((err && err.message) || 'Uloženie zubného kríža zlyhalo.');
    } finally {
      setSaving(false);
    }
  };

  // Work items behind the chart, for the summary list under the cross.
  const allProcs = chartItems.map((item, i) => {
    const code = item.code || item.price_list_code;
    const p = PROC_BY_CODE[code] || {
      code,
      name: item.description || item.name || code,
      price: Number(item.unit_price != null ? item.unit_price : item.price) || 0,
      cat: item.procedure_category || 'tech',
    };
    return {
      key: item.id != null ? item.id : i,
      tooth: String(item.bridge_span || item.tooth || item.tooth_scope || '—'),
      code,
      p,
      qty: Number(item.quantity != null ? item.quantity : item.qty) || 1,
    };
  });
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
            (patient && patient.name) || 'Pacient nezadaný',
            React.createElement('span', { style: { color: '#b0bdb9', margin: '0 6px' } }, '·'),
            patient && patient.age && patient.age !== '—' ? `${patient.age} r.` : 'vek nezadaný',
            React.createElement('span', { style: { color: '#b0bdb9', margin: '0 6px' } }, '·'),
            'práca ',
        React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', color: '#0d7c6b', fontWeight: 600 } }, (patient && patient.workId) || (job && job.id ? `#${job.id}` : '—'))
          )
        )
      ),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        React.createElement('span', { style: { fontSize: 11, color: '#8a9490' } }, 'Notácia:'),
        React.createElement(NotationToggle, { value: notation, onChange: setNotation }),
        React.createElement('div', { style: { width: 1, height: 26, background: '#e4ded4', margin: '0 4px' } }),
        canEdit && React.createElement('button', {
          onClick: () => { setIsEditing(e => !e); setSaveError(''); },
          title: 'Upraviť stav chrupu na tejto práci',
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
        canEdit && isEditing && React.createElement('button', {
          onClick: save,
          disabled: saving || !draft,
          title: draft ? 'Uložiť zmeny do práce' : 'Žiadne zmeny na uloženie',
          style: {
            padding: '7px 14px', borderRadius: 6, border: 'none',
            background: draft && !saving ? '#0d7c6b' : '#cfd8d5', color: '#fff',
            fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif',
            cursor: draft && !saving ? 'pointer' : 'default',
          }
        }, saving ? 'Ukladám…' : 'Uložiť'),
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
          React.createElement('div', { style: { fontSize: 11, color: saveError ? '#c0392b' : '#8a9490' } },
            saveError || (isEditing ? 'Klik = vybrať · pravý-klik = prepnúť „chýba“' : 'Iba zobrazenie (read-only)'))
        ),
        // Labels — patient orientation
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '4px 38px 2px', fontSize: 10, fontWeight: 700, color: '#8a9490', letterSpacing: '.08em' } },
          React.createElement('span', null, 'PRAVÁ'), React.createElement('span', null, 'ĽAVÁ')
        ),
        // Upper row
        React.createElement(DetailToothRow, { teeth: FDI_UPPER, notation, selected, onSelect: setSelected, onToggleMissing: isEditing ? toggleMissing : null, procs, missing, implants, temporary, bridges, upper: true, big: true, highlightSet: regionHighlightSet }),
        // Midline
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', padding: '6px 0', gap: 8 } },
          React.createElement('div', { style: { flex: 1, height: 1, background: 'repeating-linear-gradient(to right, #c8c0b4 0 6px, transparent 6px 12px)' } }),
          React.createElement('span', { style: { fontSize: 10, color: '#b0bdb9', fontFamily: 'ui-monospace,monospace' } }, 'okluzálna rovina'),
          React.createElement('div', { style: { flex: 1, height: 1, background: 'repeating-linear-gradient(to right, #c8c0b4 0 6px, transparent 6px 12px)' } }),
        ),
        // Lower row
        React.createElement(DetailToothRow, { teeth: FDI_LOWER, notation, selected, onSelect: setSelected, onToggleMissing: isEditing ? toggleMissing : null, procs, missing, implants, temporary, bridges, upper: false, big: true, highlightSet: regionHighlightSet }),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '2px 38px 0', fontSize: 10, fontWeight: 700, color: '#8a9490', letterSpacing: '.08em' } },
          React.createElement('span', null, 'PRAVÁ'), React.createElement('span', null, 'ĽAVÁ')
        ),
      ),

      // BELOW the cross: selected-tooth info as a wide horizontal card
      React.createElement(FocusedToothBar, { fdi: selected, notation, codes: procs[selected] || [], missing: missing.has(selected), implant: implants.has(selected), temporary: temporary.has(selected) }),

      // Work items behind the chart (prices live here, not on the cross)
      allProcs.length > 0 && React.createElement(ProcSummaryPanel, { items: allProcs, total, fmt, selected }),

      // Region-scoped procedures (not drawn on the cross): full mouth / jaw / side / quadrant
      React.createElement(RegionProceduresPanel, {
        scope: regionScope, onScopeChange: setRegionScope,
        highlight: highlightRegion, onHighlightChange: setHighlightRegion,
        items: regionProcedures,
      })
    )
  );
}

// Larger version of a tooth row — same structure as Variant A but bigger.
function DetailToothRow({ teeth, notation, selected, onSelect, onToggleMissing, procs, missing, implants, temporary, bridges, upper, big, highlightSet }) {
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 3 } },
    ...teeth.map((fdi, i) => {
      const codes = procs[fdi] || [];
      const bridge = bridges.find(b => (b.teeth || []).includes(fdi));
      const isMidlineEnd = i === 7;
      return React.createElement(DetailToothCell, {
        key: fdi, fdi, notation,
        selected: selected === fdi, onSelect, onToggleMissing,
        codes, missing: missing.has(fdi), implant: implants.has(fdi), temporary: temporary.has(fdi),
        bridge,
        bridgeStart: bridge && fdi === bridge.teeth[0],
        bridgeEnd: bridge && fdi === bridge.teeth[bridge.teeth.length - 1],
        upper, big,
        marginRight: isMidlineEnd ? 18 : 0,
        regionHighlighted: highlightSet && highlightSet.has(fdi),
      });
    })
  );
}

function DetailToothCell({ fdi, notation, selected, onSelect, onToggleMissing, codes, missing, implant, temporary, bridge, bridgeStart, bridgeEnd, upper, big, marginRight, regionHighlighted }) {
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
    onContextMenu: onToggleMissing ? (e) => { e.preventDefault(); onToggleMissing(fdi); } : undefined,
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
function FocusedToothBar({ fdi, notation, codes, missing, implant, temporary }) {
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
            const cat = PROC_CATS[it.p.cat] || PROC_CATS.tech;
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
  const [props, setProps] = React.useState({ initialSelected: 11 });

  React.useEffect(() => {
    const onOpen = (e) => { setProps({ ...(e.detail || {}), __openedAt: Date.now() }); setOpen(true); };
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
        // Remount on every open so the chart re-derives from the payload it was
        // handed instead of keeping the previous job's draft.
        key: props.__openedAt || 0,
        initialSelected: props.fdi || props.initialSelected,
        notation: props.notation,
        readonly: props.readonly !== false,
        patient: props.patient,
        job: props.job || null,
        items: props.items || null,
        toothProcedures: props.toothProcedures || null,
        onSaved: props.onSaved || null,
        onClose: () => setOpen(false),
      })
    )
  );
}

// ─── Region procedures panel ──────────────────────────────────────────────────────
// Shows procedures performed on a WHOLE region (full mouth / jaw / side / quadrant).
// These aren't drawn on the dental cross — they live in their own table here.
function RegionProceduresPanel({ scope, onScopeChange, highlight, onHighlightChange, items }) {
  const visible = scope === 'all' ? items : items.filter(it => it.scope === scope);
  const region = REGION_BY_ID[scope] || REGION_BY_ID.all;
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
              const itemRegion = REGION_BY_ID[it.scope] || { short: it.scope || 'ALL' };
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

Object.assign(window, { ToothCrossDetail, ToothDetailModal, buildToothChartState, expandFdiSpan });
