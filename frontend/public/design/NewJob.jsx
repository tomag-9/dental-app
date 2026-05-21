// NewJob.jsx — Molaris New Job creation modal (multi-step form)

function NewJob({ open, onClose }) {
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();
  const [data, setData] = React.useState({
    patient: '',
    clinic: '',
    doctor: '',
    technician: '',
    received: new Date().toISOString().slice(0, 10),
    due: '',
    priority: 'normal',
    note: '',
    patientLabel: '',
    patientAge: '',
    items: [
      { code: 'KOR-ZIR', name: 'Korunka zirkónová', tooth: '14', tooth_scope: '', qty: 1, price: 280.00 }
    ]
  });

  const steps = [
    { label: 'Pacient',   icon: 'user' },
    { label: 'Položky',   icon: 'briefcase' },
    { label: 'Termín',    icon: 'calendar' },
    { label: 'Súhrn',     icon: 'check' },
  ];

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const total = data.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const selectedPatient = (workspace.patients || []).find((patient) => String(patient.id) === String(data.patient));
  const patientMeta = getNewJobPatientMeta(selectedPatient, data);

  const reset = () => { setStep(0); setData(d => ({ ...d, patient: '', patientLabel: '', patientAge: '', clinic: '', doctor: '', technician: '', due: '', note: '' })); };
  const canSubmit = data.patient && data.clinic && data.items.length && data.items.every((it) => it.code && Number(it.qty) > 0);
  const submit = async () => {
    if (!canSubmit) { setError('Vyberte pacienta, kliniku a aspoň jednu položku z cenníka.'); return; }
    setSaving(true); setError('');
    try {
      await window.MolarisAPI.createJob({
        patient: Number(data.patient),
        clinic: Number(data.clinic),
        doctor: data.doctor ? Number(data.doctor) : null,
        technician: data.technician ? Number(data.technician) : null,
        start_date: data.received || null,
        due_date: data.due || null,
        priority: data.priority,
        description: data.note || data.items.map((it) => it.name).join(', '),
        items: data.items.map((it) => ({
          price_list_code: it.code,
          tooth: it.tooth_scope ? null : (it.tooth || null),
          tooth_scope: it.tooth_scope || null,
          quantity: Number(it.qty) || 1,
          procedure_category: it.cat || null,
        })),
      });
      setSaving(false);
      onClose();
      reset();
    } catch (err) {
      setSaving(false);
      setError((err && err.data && JSON.stringify(err.data)) || (err && err.message) || 'Prácu sa nepodarilo vytvoriť.');
    }
  };

  React.useEffect(() => { if (open) { setStep(0); setError(''); } }, [open]);

  if (!open) return null;

  return React.createElement(LargeJobModal, {
    onClose: () => { onClose(); reset(); },
    title: 'Nová práca',
    subtitle: `Krok ${step + 1} z ${steps.length} · ${steps[step].label}`,
    meta: patientMeta,
    footer: [
      React.createElement(Button, { key: 'c', variant: 'outline', onClick: () => { onClose(); reset(); } }, 'Zrušiť'),
      step > 0 && React.createElement(Button, { key: 'b', variant: 'outline', onClick: () => setStep(step - 1) },
        React.createElement(Icon, { name: 'arrowLeft', size: 13 }), 'Späť'),
      step < steps.length - 1
        ? React.createElement(Button, { key: 'n', onClick: () => setStep(step + 1) }, 'Ďalej',
            React.createElement(Icon, { name: 'arrowRight', size: 13 }))
        : React.createElement(Button, { key: 's', onClick: submit, disabled: saving || !canSubmit },
            React.createElement(Icon, { name: 'check', size: 14 }), saving ? 'Vytváram…' : 'Vytvoriť prácu')
    ].filter(Boolean)
  },
    error && React.createElement(ErrorState, { title: 'Prácu sa nepodarilo vytvoriť', message: error }),
    React.createElement(JobStepper, { steps, step }),
    step === 0 && React.createElement(StepPatient, { data, set, setData, workspace }),
    step === 1 && React.createElement(StepItems, { data, setData, fmt, total, workspace, patientMeta }),
    step === 2 && React.createElement(StepSchedule, { data, set }),
    step === 3 && React.createElement(StepSummary, { data, fmt, total, workspace })
  );
}

function getNewJobPatientMeta(patient, data) {
  const raw = patient && (patient.raw || patient);
  const first = patient && (patient.first || patient.first_name || raw?.first_name || raw?.first);
  const last = patient && (patient.last || patient.last_name || raw?.last_name || raw?.last);
  const name = [first, last].filter(Boolean).join(' ') || data.patientLabel || (data.patient ? `Pacient #${data.patient}` : 'Pacient nevybraný');
  const age = data.patientAge || patient?.age || patient?.age_years || raw?.age || raw?.age_years || '—';
  return { name, age: String(age || '—'), workId: 'nová práca' };
}

const DENTAL_SCOPE_LABELS = {
  A: 'Celý chrup',
  U: 'Horná čeľusť',
  L: 'Dolná čeľusť',
  Q1: 'Kvadrant 1',
  Q2: 'Kvadrant 2',
  Q3: 'Kvadrant 3',
  Q4: 'Kvadrant 4',
};

function normalizeDentalScope(value) {
  const raw = String(value || '').trim().toUpperCase();
  return DENTAL_SCOPE_LABELS[raw] ? raw : '';
}

function isFdiTarget(value) {
  return /^\d{2}(-\d{2})?$/.test(String(value || '').trim());
}

function procedureTargetLabel(item) {
  const scope = normalizeDentalScope(item && (item.tooth_scope || item.scope));
  if (scope) return scope;
  return String((item && item.tooth) || '');
}

function procedureTargetText(item, notation) {
  const scope = normalizeDentalScope(item && (item.tooth_scope || item.scope));
  if (scope) return `${scope} · ${DENTAL_SCOPE_LABELS[scope]}`;
  const tooth = item && item.tooth;
  if (!tooth) return '—';
  return String(tooth).includes('-') ? tooth : fdiLabel(Number(tooth), notation);
}

function LargeJobModal({ title, subtitle, meta, children, footer, onClose }) {
  return React.createElement('div', {
    style: { position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(24,20,16,.52)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 },
    onMouseDown: onClose,
  },
    React.createElement('div', {
      style: { width: 'calc(100vw - 16px)', height: 'calc(100vh - 16px)', maxWidth: 1520, background: '#fbfaf6', borderRadius: 12, border: '1px solid #e4ded4', boxShadow: '0 24px 90px rgba(0,0,0,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      onMouseDown: (event) => event.stopPropagation(),
    },
      React.createElement('div', { style: { height: 64, padding: '0 22px', borderBottom: '1px solid #e4ded4', background: '#fff', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 } },
        React.createElement('div', { style: { width: 36, height: 36, borderRadius: 9, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          React.createElement(Icon, { name: 'briefcase', size: 18 })
        ),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('h2', { style: { margin: 0, fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 18, fontWeight: 800, color: '#1a2320', letterSpacing: 0 } }, title),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', fontSize: 12, color: '#8a9490', marginTop: 2 } },
            React.createElement('span', null, subtitle),
            meta && React.createElement('span', { style: { color: '#c8c0b4' } }, '·'),
            meta && React.createElement('strong', { style: { color: '#1a2320', fontWeight: 800 } }, meta.name),
            meta && React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11 } }, `· ${meta.age === '—' ? 'vek nezadaný' : `${meta.age} r.`}`),
            meta && React.createElement('span', null, '· Práca'),
            meta && React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', color: '#0d7c6b', fontWeight: 800 } }, meta.workId)
          )
        ),
        React.createElement(IconButton, { name: 'x', title: 'Zatvoriť', onClick: onClose, size: 32 })
      ),
      React.createElement('div', { style: { flex: 1, overflow: 'auto', padding: 22 } }, children),
      React.createElement('div', { style: { padding: '14px 22px', borderTop: '1px solid #e4ded4', background: '#fff', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 } }, footer)
    )
  );
}

function JobStepper({ steps, step }) {
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 } },
    ...steps.map((s, i) => {
      const active = i === step;
      const done = i < step;
      return React.createElement('div', {
        key: s.label,
        style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${active ? '#0d7c6b' : '#e4ded4'}`, background: active ? '#d4f0eb' : done ? '#f7fbf9' : '#fff' }
      },
        React.createElement('div', { style: { width: 28, height: 28, borderRadius: 14, background: done ? '#0d7c6b' : active ? '#fff' : '#f0ede5', color: done ? '#fff' : active ? '#0d7c6b' : '#8a9490', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800, fontSize: 11 } },
          done ? React.createElement(Icon, { name: 'check', size: 13 }) : i + 1
        ),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 12.5, fontWeight: 800, color: active ? '#0d7c6b' : '#1a2320' } }, s.label),
          React.createElement('div', { style: { fontSize: 10.5, color: '#8a9490', marginTop: 1 } }, i === 0 ? 'Subjekty' : i === 1 ? 'Zubný kríž' : i === 2 ? 'Termíny' : 'Kontrola')
        )
      );
    })
  );
}

function StepPatient({ data, set, setData, workspace }) {
  const patients = workspace.patients || [];
  const clinics = workspace.clinics || [];
  const doctors = workspace.doctors || [];
  const technicians = workspace.technicians || [];
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
    React.createElement(FormField, {
      label: 'Pacient', required: true, value: data.patient, onChange: e => {
        const patient = patients.find((p) => String(p.id) === String(e.target.value));
        const meta = getNewJobPatientMeta(patient, { patient: e.target.value, patientLabel: '' });
        setData((current) => ({ ...current, patient: e.target.value, patientLabel: meta.name, patientAge: meta.age === '—' ? '' : meta.age }));
      },
      type: 'select',
      options: patients.length ? patients.map((p) => ({ value: String(p.id), label: `${p.first} ${p.last}` })) : [
        { value: 'kovacova', label: 'Mária Kováčová' },
        { value: 'horvath',  label: 'Peter Horváth' },
        { value: 'blahova',  label: 'Jana Blahová' },
        { value: 'new',      label: '+ Vytvoriť nového pacienta…' },
      ]
    }),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
      React.createElement(FormField, {
        label: 'Klinika', required: true, value: data.clinic, onChange: e => set('clinic', e.target.value),
        type: 'select',
        options: clinics.length ? clinics.map((c) => ({ value: String(c.id), label: c.name })) : [
          { value: 'ba', label: 'Klinika Bratislava' },
          { value: 'ke', label: 'ZubMed Košice' },
          { value: 'za', label: 'DentaPrima Žilina' },
        ]
      }),
      React.createElement(FormField, {
        label: 'Odosielajúci lekár', required: true, value: data.doctor, onChange: e => set('doctor', e.target.value),
        type: 'select',
        options: doctors.length ? doctors.map((d) => ({ value: String(d.id), label: `${d.title ? d.title + ' ' : ''}${d.first} ${d.last}` })) : [
          { value: 'novak',   label: 'MUDr. Pavol Novák' },
          { value: 'blaho',   label: 'MUDr. Eva Blaho' },
          { value: 'sloboda', label: 'MUDr. Igor Sloboda' },
        ]
      })
    ),
    React.createElement(FormField, {
      label: 'Pridelený technik',
      value: data.technician, onChange: e => set('technician', e.target.value),
      type: 'select',
      helpText: 'Voliteľné — môžete prideliť neskôr.',
      options: technicians.length ? technicians.map((t) => ({ value: String(t.id), label: `${t.first} ${t.last} — vyťaženie ${t.workload} %` })) : [
        { value: 'novak-j',  label: 'Ján Novák — vyťaženie 85 %' },
        { value: 'mrazova',  label: 'Anna Mrázová — vyťaženie 72 %' },
        { value: 'bartos',   label: 'Marek Bartoš — vyťaženie 60 %' },
        { value: 'polak',    label: 'Štefan Polák — vyťaženie 95 %' },
      ]
    })
  );
}

function StepItems({ data, setData, fmt, total, workspace, patientMeta }) {
  const [notation, setNotation] = React.useState('fdi');
  const [selectedTooth, setSelectedTooth] = React.useState(String(data.items[0]?.tooth || 26));
  const [quick, setQuick] = React.useState('');
  const designCatalog = window.PROC_CATALOG || [];
  const fallbackCatalog = designCatalog.length ? designCatalog : [
    { code: 'KOR-ZIR', name: 'Korunka zirkónová', cat: 'crown', price: 280.00 },
    { code: 'MOS-3Z',  name: 'Mostík 3-členný', cat: 'bridge', price: 540.00 },
    { code: 'INL-KER', name: 'Inlay keramický', cat: 'filling', price: 210.00 },
    { code: 'PRO-CEL', name: 'Snímateľná prot.', cat: 'denture', price: 480.00 },
    { code: 'IMP-KOR', name: 'Korunka na implantát', cat: 'implant', price: 320.00 },
  ];
  const catalog = (workspace.priceList && workspace.priceList.length ? workspace.priceList : fallbackCatalog)
    .map((item) => {
      const known = (window.PROC_BY_CODE && window.PROC_BY_CODE[item.code]) || {};
      return {
        code: item.code || known.code || item.name,
        name: item.name || known.name || item.code,
        price: Number(item.price ?? known.price ?? 0),
        cat: item.cat || known.cat || 'tech',
      };
    });
  const catalogByCode = Object.fromEntries(catalog.map((item) => [item.code, item]));
  const findCatalogItem = (code) => {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return null;
    return catalogByCode[normalized] || catalog.find((item) => item.code.startsWith(normalized) || item.name.toLowerCase().includes(normalized.toLowerCase())) || null;
  };
  const itemsByTooth = data.items.reduce((acc, item) => {
    const tooth = String(item.tooth || '');
    if (!tooth || normalizeDentalScope(item.tooth_scope)) return acc;
    (acc[tooth] = acc[tooth] || []).push(item);
    return acc;
  }, {});
  const selectedItems = itemsByTooth[String(selectedTooth)] || [];
  const addItem = (code = '', tooth = selectedTooth, qty = 1, toothScope = '') => {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const picked = catalogByCode[normalizedCode] || catalog[0] || { code: normalizedCode, name: normalizedCode, price: 0, cat: 'tech' };
    const scope = normalizeDentalScope(toothScope || tooth);
    setData(d => ({
      ...d,
      items: [...d.items, {
        code: normalizedCode || picked.code || '',
        name: normalizedCode ? picked.name : '',
        tooth: scope ? '' : String(tooth || ''),
        tooth_scope: scope,
        qty,
        price: normalizedCode ? picked.price : 0,
        cat: picked.cat || 'tech',
      }]
    }));
  };
  const removeItem = (i) => setData(d => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, k, v) => setData(d => ({ ...d, items: d.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it) }));
  const runQuickAdd = () => {
    const parts = quick.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    const firstTarget = parts[0];
    const scope = normalizeDentalScope(firstTarget);
    const maybeTooth = scope || isFdiTarget(firstTarget) ? parts.shift() : selectedTooth;
    const code = (parts.shift() || catalog[0]?.code || '').toUpperCase();
    const found = findCatalogItem(code);
    if (!found) return;
    const qty = Number(parts.shift() || 1) || 1;
    addItem(found.code, scope ? '' : maybeTooth, qty, scope);
    if (!scope) setSelectedTooth(String(maybeTooth));
    setQuick('');
  };
  const openToothDetail = () => window.dispatchEvent(new CustomEvent('open-tooth-detail', {
    detail: {
      fdi: Number(selectedTooth),
      initialSelected: Number(selectedTooth),
      notation,
      readonly: true,
      patient: patientMeta,
      items: data.items,
    }
  }));

  return React.createElement('div', { style: { background: '#fbfaf6', border: '1px solid #e4ded4', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 620 } },
    React.createElement('div', { style: { padding: '10px 14px', background: '#fff', borderBottom: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12.5, color: '#1a2320' } },
          React.createElement('span', { style: { fontWeight: 800 } }, 'Aktívny zub'),
          React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', color: '#0d7c6b', fontWeight: 800 } }, fdiLabel(Number(selectedTooth), notation)),
          React.createElement('span', { style: { color: '#8a9490' } }, `· ${selectedItems.length} položiek`)
        )
      ),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
        React.createElement('div', { style: { position: 'relative' } },
          React.createElement('input', {
            value: quick,
            onChange: (event) => setQuick(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') runQuickAdd(); },
            placeholder: 'Rýchle zadanie: 26 KOR-ZIR 1 alebo U KOR-ZIR 1',
            style: { width: 260, padding: '6px 10px 6px 28px', border: '1px solid #0d7c6b', borderRadius: 6, fontSize: 12, fontFamily: 'ui-monospace,monospace', outline: 'none', background: '#fff', color: '#1a2320' }
          }),
          React.createElement('span', { style: { position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 800, color: '#0d7c6b' } }, '↵')
        ),
        window.NotationToggle && React.createElement(NotationToggle, { value: notation, onChange: setNotation })
      )
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(500px, 560px) minmax(640px, 1fr)', gap: 14, padding: 14, flex: 1, minHeight: 0, overflow: 'auto' } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 } },
        React.createElement(JobCompactToothGrid, { selectedTooth, setSelectedTooth, notation, itemsByTooth, onOpenDetail: openToothDetail }),
        React.createElement(JobDescriptionCard, { data, setData })
      ),
      React.createElement(JobItemsTable, { data, catalog, updateItem, removeItem, addItem, fmt, total, selectedTooth, setSelectedTooth })
    )
  );
}

function SegmentedControl({ value, onChange, options }) {
  return React.createElement('div', { style: { display: 'inline-flex', padding: 2, borderRadius: 8, background: '#f0ede5', border: '1px solid #e4ded4' } },
    ...options.map((option) => {
      const active = value === option.value;
      return React.createElement('button', {
        key: option.value,
        onClick: () => onChange(option.value),
        style: {
          border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
          background: active ? '#fff' : 'transparent',
          color: active ? '#0d7c6b' : '#5a6b66',
          boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
          fontSize: 11.5, fontWeight: 800, fontFamily: 'Manrope,sans-serif'
        }
      }, option.label);
    })
  );
}

function JobAnatomicalChart({ selectedTooth, setSelectedTooth, notation, itemsByTooth }) {
  const renderRow = (teeth, upper) => React.createElement('div', {
    style: { display: 'grid', gridTemplateColumns: 'repeat(16, minmax(34px, 1fr))', gap: 7, alignItems: upper ? 'end' : 'start' }
  },
    ...teeth.map((fdi) => React.createElement(JobToothButton, {
      key: fdi,
      fdi,
      notation,
      selected: String(fdi) === String(selectedTooth),
      items: itemsByTooth[String(fdi)] || [],
      onSelect: () => setSelectedTooth(String(fdi)),
    }))
  );
  return React.createElement('div', { style: { padding: 18, borderRadius: 10, background: '#fff', border: '1px solid #ece7dc', overflowX: 'auto' } },
    React.createElement('div', { style: { minWidth: 660 } },
      renderRow(window.FDI_UPPER || [], true),
      React.createElement('div', { style: { height: 44, margin: '10px 0', borderTop: '2px solid #e4ded4', borderBottom: '2px solid #e4ded4', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', color: '#8a9490', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' } },
        React.createElement('span', { style: { textAlign: 'left' } }, 'Pravá strana pacienta'),
        React.createElement('span', { style: { color: '#0d7c6b' } }, 'Stredová línia'),
        React.createElement('span', { style: { textAlign: 'right' } }, 'Ľavá strana pacienta')
      ),
      renderRow(window.FDI_LOWER || [], false)
    ),
  );
}

function JobToothButton({ fdi, notation, selected, items, onSelect }) {
  const hasImplant = items.some((item) => String(item.code || '').startsWith('IMP'));
  const missing = items.some((item) => item.code === 'EXT-001');
  return React.createElement('button', {
    onClick: onSelect,
    style: {
      minWidth: 0, border: selected ? '2px solid #0d7c6b' : '1px solid transparent',
      borderRadius: 8, background: selected ? '#eefbf8' : '#fff', padding: '5px 2px 6px',
      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      boxShadow: selected ? '0 8px 20px rgba(13,124,107,.12)' : 'none'
    }
  },
    window.ToothShape
      ? React.createElement(ToothShape, { fdi, selected, implant: hasImplant, missing, size: 34 })
      : React.createElement('div', { style: { width: 28, height: 44, borderRadius: 14, border: '1px solid #9aa5a0' } }),
    React.createElement('span', { style: { fontSize: 10.5, color: selected ? '#0d7c6b' : '#5a6b66', fontWeight: 800 } }, fdiLabel(fdi, notation)),
    items.length > 0 && React.createElement('span', { style: { minWidth: 18, height: 18, borderRadius: 9, background: '#0d7c6b', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } }, items.length)
  );
}

function JobCompactToothGrid({ selectedTooth, setSelectedTooth, notation, itemsByTooth, onOpenDetail }) {
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, padding: 14, overflowX: 'auto' } },
    React.createElement('div', { style: { minWidth: 500 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 10 } },
        React.createElement('div', null,
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 800, color: '#1a2320' } }, 'Zubný kríž'),
            React.createElement('button', {
              onClick: onOpenDetail,
              title: 'Otvoriť detail zubného kríža',
              style: { width: 28, height: 28, padding: 0, background: '#fbfaf6', border: '1px solid #e4ded4', borderRadius: 6, color: '#0d7c6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
            }, React.createElement(Icon, { name: 'search', size: 14 }))
          ),
          React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, 'Kompaktné zobrazenie všetkých 32 zubov')
        ),
        React.createElement('div', { style: { display: 'flex', gap: 6, fontSize: 9.5, color: '#5a6b66', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 240 } },
          ...['crown', 'bridge', 'implant', 'filling', 'tech'].map((catKey) => {
            const cat = (window.PROC_CATS && window.PROC_CATS[catKey]) || { accent: '#8a9490', label: catKey };
            return React.createElement('span', { key: catKey, style: { display: 'inline-flex', alignItems: 'center', gap: 3 } },
              React.createElement('span', { style: { width: 7, height: 7, borderRadius: '50%', background: cat.accent } }),
              cat.label.slice(0, 4)
            );
          })
        )
      ),
      React.createElement('div', { style: quadrantLabelStyle },
        React.createElement('div', { style: { textAlign: 'right' } }, 'Hore · pravá'),
        React.createElement('div', null),
        React.createElement('div', null, 'Hore · ľavá')
      ),
      React.createElement(JobTileRow, { teeth: window.FDI_UPPER || [], notation, selectedTooth, setSelectedTooth, itemsByTooth }),
      React.createElement('div', { style: { height: 1, background: 'repeating-linear-gradient(to right, #c8c0b4 0 4px, transparent 4px 8px)', margin: '8px 2px' } }),
      React.createElement(JobTileRow, { teeth: window.FDI_LOWER || [], notation, selectedTooth, setSelectedTooth, itemsByTooth }),
      React.createElement('div', { style: { ...quadrantLabelStyle, padding: '4px 2px 0' } },
        React.createElement('div', { style: { textAlign: 'right' } }, 'Dolu · pravá'),
        React.createElement('div', null),
        React.createElement('div', null, 'Dolu · ľavá')
      )
    )
  );
}

function JobTileRow({ teeth, notation, selectedTooth, setSelectedTooth, itemsByTooth }) {
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr) 14px repeat(8, 1fr)', gap: 4, alignItems: 'stretch' } },
    ...teeth.slice(0, 8).map((fdi) => React.createElement(JobTile, { key: fdi, fdi, notation, selectedTooth, setSelectedTooth, items: itemsByTooth[String(fdi)] || [] })),
    React.createElement('div', { key: 'mid', style: { width: '100%' } }),
    ...teeth.slice(8).map((fdi) => React.createElement(JobTile, { key: fdi, fdi, notation, selectedTooth, setSelectedTooth, items: itemsByTooth[String(fdi)] || [] }))
  );
}

function JobTile({ fdi, notation, selectedTooth, setSelectedTooth, items }) {
  const selected = String(fdi) === String(selectedTooth);
  const distinctCats = [];
  for (const item of items) {
    const cat = item.cat || (window.PROC_BY_CODE && window.PROC_BY_CODE[item.code]?.cat) || 'tech';
    if (!distinctCats.includes(cat)) distinctCats.push(cat);
  }
  return React.createElement('button', {
    onClick: () => setSelectedTooth(String(fdi)),
    style: {
      width: '100%', minWidth: 0, height: 72, padding: 0, background: selected ? '#fff' : '#fefdf9',
      border: `${selected ? 2 : 1}px solid ${selected ? '#0d7c6b' : '#ece7dc'}`,
      borderRadius: 6, cursor: 'pointer', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'space-between',
      overflow: 'hidden', fontFamily: 'Manrope,sans-serif',
      boxShadow: selected ? '0 0 0 3px rgba(13,124,107,.12)' : 'none'
    }
  },
    React.createElement('div', { style: { padding: '4px 4px 0', fontFamily: 'ui-monospace,monospace', fontSize: 12, fontWeight: 800, color: selected ? '#0d7c6b' : '#1a2320', textAlign: 'center', lineHeight: 1.1 } }, fdiLabel(fdi, notation)),
    React.createElement('div', { style: { minHeight: 15, display: 'flex', justifyContent: 'center', alignItems: 'center' } },
      items.length > 0
        ? React.createElement('span', { style: { minWidth: 16, height: 15, padding: '0 5px', borderRadius: 8, background: '#1a2320', color: '#fff', fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 } }, items.length)
        : React.createElement('span', { style: { width: 4, height: 4, borderRadius: '50%', background: 'transparent' } })
    ),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2, padding: '0 2px' } },
      distinctCats.length === 0 && React.createElement('div', { style: { width: 4, height: 4, borderRadius: '50%', background: '#e4ded4' } }),
      ...distinctCats.map((cat) => {
        const colors = (window.PROC_CATS && window.PROC_CATS[cat]) || { accent: '#8a9490' };
        return React.createElement('div', { key: cat, style: { width: 6, height: 6, borderRadius: '50%', background: colors.accent } });
      })
    )
  );
}

function JobDescriptionCard({ data, setData }) {
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 190 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } },
      React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 800, color: '#1a2320' } }, 'Popis práce'),
      React.createElement('div', { style: { fontSize: 10.5, color: '#8a9490' } }, 'Voľný text pre technika')
    ),
    React.createElement('textarea', {
      value: data.note,
      onChange: (event) => setData((current) => ({ ...current, note: event.target.value })),
      placeholder: 'Špecifické požiadavky, farba, materiál, alergie, poznámky k skúške alebo odovzdaniu...',
      style: { flex: 1, minHeight: 110, padding: '10px 12px', border: '1px solid #e4ded4', borderRadius: 8, fontFamily: 'Manrope,sans-serif', fontSize: 12.5, lineHeight: 1.5, background: '#fbfaf6', outline: 'none', resize: 'vertical', color: '#1a2320' }
    }),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10.5, color: '#8a9490' } },
      React.createElement('span', null, 'Popis sa použije aj ako poznámka pri vytvorení práce.'),
      React.createElement('span', null, `${String(data.note || '').length} / 1000`)
    )
  );
}

function JobItemsTable({ data, catalog, updateItem, removeItem, addItem, fmt, total, selectedTooth, setSelectedTooth }) {
  const [draft, setDraft] = React.useState({ tooth: String(selectedTooth || ''), code: '', qty: 1 });
  React.useEffect(() => setDraft((current) => ({ ...current, tooth: String(selectedTooth || '') })), [selectedTooth]);
  const catalogByCode = Object.fromEntries(catalog.map((item) => [item.code, item]));
  const pickCatalog = (code) => {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return null;
    return catalogByCode[normalized] || catalog.find((item) => item.code.startsWith(normalized) || item.name.toLowerCase().includes(normalized.toLowerCase()));
  };
  const applyCode = (rowIndex, code) => {
    const normalized = String(code || '').trim().toUpperCase();
    const found = catalogByCode[normalized];
    updateItem(rowIndex, 'code', normalized);
    if (found) {
      updateItem(rowIndex, 'name', found.name);
      updateItem(rowIndex, 'price', found.price);
    }
  };
  const selectCodeForRow = (rowIndex, item) => {
    updateItem(rowIndex, 'code', item.code);
    updateItem(rowIndex, 'name', item.name);
    updateItem(rowIndex, 'price', item.price);
  };
  const addDraft = () => {
    const found = pickCatalog(draft.code);
    if (!found) return;
    const scope = normalizeDentalScope(draft.tooth);
    addItem(found.code, scope ? '' : (draft.tooth || selectedTooth), Number(draft.qty) || 1, scope);
    if (!scope) setSelectedTooth(String(draft.tooth || selectedTooth));
    setDraft({ tooth: String(draft.tooth || selectedTooth), code: '', qty: 1 });
  };
  const updateTarget = (rowIndex, value) => {
    const scope = normalizeDentalScope(value);
    if (scope) {
      updateItem(rowIndex, 'tooth_scope', scope);
      updateItem(rowIndex, 'tooth', '');
      return;
    }
    updateItem(rowIndex, 'tooth_scope', '');
    updateItem(rowIndex, 'tooth', value);
  };
  return React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 520 } },
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderBottom: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } },
      React.createElement('div', null,
        React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 800, color: '#1a2320' } }, 'Tabuľka úkonov'),
        React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, 'Kód napíšte do riadku a vyberte z návrhov.')
      ),
      React.createElement('button', { onClick: () => setDraft({ tooth: String(selectedTooth || ''), code: '', qty: 1 }), style: tableBtnStyle('outline') }, '+ F3 Nový')
    ),
      React.createElement('div', { style: tableHeaderStyle },
      React.createElement('span', null),
      React.createElement('span', null, 'Zub/oblasť'),
      React.createElement('span', null, 'Kód'),
      React.createElement('span', null, 'Popis'),
      React.createElement('span', { style: { textAlign: 'center' } }, 'Ks'),
      React.createElement('span', { style: { textAlign: 'right' } }, 'Cena ZT'),
      React.createElement('span', { style: { textAlign: 'right' } }, 'Cena lek.'),
      React.createElement('span', null)
    ),
    React.createElement('div', { style: { flex: 1, overflowY: 'auto', minHeight: 260 } },
      ...data.items.map((it, i) => {
        const known = catalogByCode[it.code] || {};
        const cat = (window.PROC_CATS && window.PROC_CATS[it.cat || known.cat || 'tech']) || { accent: '#8a9490', bg: '#f0ede5', fg: '#5a6b66' };
        const target = procedureTargetLabel(it);
        const selected = String(it.tooth || '') === String(selectedTooth) && !it.tooth_scope;
        return React.createElement('div', {
          key: i,
          onClick: () => it.tooth && !it.tooth_scope && setSelectedTooth(String(it.tooth)),
          style: { ...tableRowStyle, background: selected ? '#fbf9f1' : '#fff', cursor: 'pointer' }
        },
          React.createElement('div', { style: { width: 14, height: 24, borderRadius: 2, background: cat.accent } }),
          React.createElement('input', { value: target, onChange: e => updateTarget(i, e.target.value), title: 'FDI zub alebo A/U/L/Q1-Q4', style: { ...cellInputStyle, fontFamily: 'ui-monospace,monospace', fontWeight: 800 } }),
          React.createElement(ProcedureCodeDropdown, {
            catalog,
            value: it.code || '',
            onInput: (value) => applyCode(i, value),
            onPick: (item) => selectCodeForRow(i, item),
          }),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
            React.createElement('div', { style: { width: 18, height: 18, borderRadius: 4, background: cat.bg, color: cat.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
              window.ProcGlyph && it.code ? React.createElement(ProcGlyph, { code: it.code, size: 10 }) : null
            ),
            React.createElement('span', { style: { color: '#1a2320', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 } }, it.name || known.name || 'Vyberte kód')
          ),
          React.createElement('input', { type: 'number', min: 1, value: it.qty, onChange: e => updateItem(i, 'qty', e.target.value), style: { ...cellInputStyle, textAlign: 'center' } }),
          React.createElement('input', { type: 'number', step: '0.01', value: it.price, onChange: e => updateItem(i, 'price', e.target.value), style: { ...cellInputStyle, textAlign: 'right' } }),
          React.createElement('span', { style: { textAlign: 'right', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 800, color: '#1a2320', fontSize: 12 } }, fmt((Number(it.price) || 0) * (Number(it.qty) || 0))),
          React.createElement(IconButton, { name: 'trash', destructive: true, onClick: (event) => { event.stopPropagation(); removeItem(i); }, size: 26 })
        );
      }),
      React.createElement('div', { style: { ...tableRowStyle, borderTop: '2px dashed #e4ded4', background: '#fbfaf6', color: '#b0bdb9' } },
        React.createElement('div', null),
        React.createElement('input', { value: draft.tooth, onChange: e => setDraft({ ...draft, tooth: e.target.value.toUpperCase() }), placeholder: '26/U/Q1', title: 'FDI zub alebo A/U/L/Q1-Q4', style: { ...cellInputStyle, fontFamily: 'ui-monospace,monospace', fontWeight: 800 } }),
        React.createElement(ProcedureCodeDropdown, {
          catalog,
          value: draft.code,
          onInput: (value) => setDraft({ ...draft, code: value.toUpperCase() }),
          onPick: (item) => setDraft({ ...draft, code: item.code }),
          onEnter: addDraft,
          placeholder: 'Kód...',
        }),
        React.createElement('input', { value: pickCatalog(draft.code)?.name || '', readOnly: true, placeholder: 'začnite písať pre návrhy...', style: cellInputStyle }),
        React.createElement('input', { type: 'number', min: 1, value: draft.qty, onChange: e => setDraft({ ...draft, qty: e.target.value }), onKeyDown: e => { if (e.key === 'Enter') addDraft(); }, style: { ...cellInputStyle, textAlign: 'center' } }),
        React.createElement('input', { value: pickCatalog(draft.code)?.price || '', readOnly: true, placeholder: '0,00', style: { ...cellInputStyle, textAlign: 'right' } }),
        React.createElement('input', { value: pickCatalog(draft.code) ? (Number(pickCatalog(draft.code).price || 0) * (Number(draft.qty) || 1)).toFixed(2) : '', readOnly: true, placeholder: '0,00', style: { ...cellInputStyle, textAlign: 'right' } }),
        React.createElement(IconButton, { name: 'plus', title: 'Pridať riadok', onClick: addDraft, size: 26 })
      )
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: tableColumns, padding: '10px 12px', background: '#fbfaf6', borderTop: '1px solid #ece7dc', alignItems: 'center', gap: 8 } },
      React.createElement('span', null), React.createElement('span', null), React.createElement('span', null),
      React.createElement('span', { style: { fontSize: 11, color: '#8a9490', fontWeight: 700 } }, `${data.items.length} položiek`),
      React.createElement('span', null),
      React.createElement('span', { style: { textAlign: 'right', fontSize: 11, color: '#8a9490', fontWeight: 700 } }, 'Spolu:'),
      React.createElement('span', { style: { textAlign: 'right', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 14, fontWeight: 800, color: '#1a2320' } }, fmt(total)),
      React.createElement('span', null)
    )
  );
}

function ProcedureCodeDropdown({ catalog, value, onInput, onPick, onEnter, placeholder = 'Kód...' }) {
  const [open, setOpen] = React.useState(false);
  const query = String(value || '').trim().toUpperCase();
  const options = (query
    ? catalog.filter((item) => item.code.toUpperCase().includes(query) || item.name.toLowerCase().includes(query.toLowerCase()))
    : catalog
  ).slice(0, 12);
  return React.createElement('div', { style: { position: 'relative', width: '100%' } },
    React.createElement('input', {
      value,
      onFocus: () => setOpen(true),
      onChange: (event) => { onInput(event.target.value.toUpperCase()); setOpen(true); },
      onBlur: () => window.setTimeout(() => setOpen(false), 120),
      onKeyDown: (event) => {
        if (event.key === 'Enter') {
          const exact = catalog.find((item) => item.code.toUpperCase() === query) || options[0];
          if (exact) onPick(exact);
          if (onEnter) onEnter();
          setOpen(false);
        }
      },
      placeholder,
      style: { ...cellInputStyle, fontFamily: 'ui-monospace,monospace', fontWeight: 800, color: '#0d7c6b', paddingRight: 22 }
    }),
    React.createElement(Icon, { name: 'chevronDown', size: 12, color: '#8a9490', style: { position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' } }),
    open && React.createElement('div', {
      style: {
        position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
        maxHeight: 260, overflowY: 'auto', background: '#fff', border: '1px solid #d8d1c5',
        borderRadius: 7, boxShadow: '0 12px 28px rgba(26,35,32,.16)', padding: 4
      }
    },
      options.length === 0
        ? React.createElement('div', { style: { padding: '8px 9px', fontSize: 11.5, color: '#8a9490' } }, 'Žiadny kód')
        : options.map((item) => {
            const cat = (window.PROC_CATS && window.PROC_CATS[item.cat]) || window.PROC_CATS?.tech || { bg: '#f0ede5', fg: '#5a6b66' };
            return React.createElement('button', {
              key: item.code,
              type: 'button',
              onMouseDown: (event) => { event.preventDefault(); onPick(item); setOpen(false); },
              style: {
                width: '100%', border: 'none', background: item.code === value ? '#eefbf8' : '#fff',
                borderRadius: 5, padding: '7px 8px', display: 'grid', gridTemplateColumns: '74px 1fr auto',
                gap: 8, alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontFamily: 'Manrope,sans-serif'
              }
            },
              React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 800, color: '#0d7c6b' } }, item.code),
              React.createElement('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: '#1a2320' } }, item.name),
              React.createElement('span', { style: { padding: '2px 6px', borderRadius: 999, background: cat.bg, color: cat.fg, fontSize: 10.5, fontWeight: 800 } }, `${Number(item.price || 0).toFixed(0)} €`)
            );
          })
    )
  );
}

const quadrantLabelStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 14px 1fr',
  fontSize: 9.5,
  fontWeight: 800,
  color: '#8a9490',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0 2px 4px'
};

const tableColumns = '28px 60px 92px minmax(160px,1fr) 50px 92px 92px 28px';

const tableHeaderStyle = {
  display: 'grid',
  gridTemplateColumns: tableColumns,
  padding: '7px 12px',
  background: '#f4f1ea',
  fontSize: 9.5,
  fontWeight: 800,
  color: '#5a6b66',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  gap: 8,
  borderBottom: '1px solid #ece7dc'
};

const tableRowStyle = {
  display: 'grid',
  gridTemplateColumns: tableColumns,
  padding: '7px 12px',
  borderTop: '1px solid #f0ede5',
  alignItems: 'center',
  gap: 8,
  fontSize: 12
};

const cellInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '3px 6px',
  border: '1px solid #ece7dc',
  borderRadius: 4,
  background: '#fff',
  fontSize: 11.5,
  fontFamily: 'Manrope,sans-serif',
  outline: 'none',
  color: '#1a2320'
};

function tableBtnStyle(variant) {
  const base = { padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope,sans-serif', border: 'none' };
  if (variant === 'outline') return { ...base, background: '#fff', color: '#1a2320', border: '1px solid #e4ded4' };
  return { ...base, background: '#0d7c6b', color: '#fff' };
}

const panelStyle = {
  background: '#fff',
  border: '1px solid #e4ded4',
  borderRadius: 10,
  padding: 14,
  boxShadow: '0 1px 2px rgba(26,35,32,.04)'
};

const rowInputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '5px 8px',
  border: '1px solid #e4ded4', borderRadius: 5, background: '#fff',
  fontSize: 12, fontFamily: 'Manrope,sans-serif', outline: 'none', color: '#1a2320'
};

function StepSchedule({ data, set }) {
  const priorities = [
    { value: 'low',    label: 'Nízka',  desc: 'Štandardná fronta',     color: '#8a9490', bg: '#f0ede5' },
    { value: 'normal', label: 'Normálna', desc: 'Štandardný termín',   color: '#0d7c6b', bg: '#d4f0eb' },
    { value: 'high',   label: 'Vysoká', desc: 'Urgentné — prioritne', color: '#d97706', bg: '#fef3c7' },
    { value: 'urgent', label: 'Urgent', desc: 'Pacient v ordinácii',  color: '#c0392b', bg: '#fee2e2' },
  ];
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
      React.createElement(FormField, { label: 'Dátum prijatia', type: 'date', value: data.received, onChange: e => set('received', e.target.value) }),
      React.createElement(FormField, { label: 'Požadovaný termín odovzdania', type: 'date', required: true, value: data.due, onChange: e => set('due', e.target.value) })
    ),
    React.createElement('div', null,
      React.createElement('label', { style: { display: 'block', fontSize: 12, fontWeight: 500, color: '#1a2320', marginBottom: 8 } }, 'Priorita'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 } },
        ...priorities.map(p => {
          const active = data.priority === p.value;
          return React.createElement('button', {
            key: p.value, onClick: () => set('priority', p.value),
            style: {
              padding: '10px 12px', borderRadius: 8,
              border: active ? `2px solid ${p.color}` : '1px solid #e4ded4',
              background: active ? p.bg : '#fff', cursor: 'pointer',
              fontFamily: 'Manrope,sans-serif', textAlign: 'left',
              transition: 'border-color .12s, background .12s'
            }
          },
            React.createElement('div', { style: { fontSize: 12.5, fontWeight: 700, color: active ? p.color : '#1a2320' } }, p.label),
            React.createElement('div', { style: { fontSize: 10.5, color: active ? p.color : '#8a9490', marginTop: 2, opacity: 0.85 } }, p.desc)
          );
        })
      )
    ),
    React.createElement(FormField, {
      label: 'Poznámka pre technika',
      type: 'textarea', rows: 4,
      value: data.note, onChange: e => set('note', e.target.value),
      placeholder: 'Špecifické požiadavky, alergie pacienta, farba, materiál…'
    })
  );
}

function StepSummary({ data, fmt, total }) {
  const priLabel = { low: 'Nízka', normal: 'Normálna', high: 'Vysoká', urgent: 'Urgent' };
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
    React.createElement('div', { style: { padding: '12px 14px', background: '#d4f0eb', border: '1px solid #b0ddd5', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 } },
      React.createElement(Icon, { name: 'checkCircle', size: 18, color: '#0d7c6b' }),
      React.createElement('span', { style: { fontSize: 12.5, color: '#085c4e', fontWeight: 500 } },
        'Skontrolujte zhrnutie. Po vytvorení bude práca v stave ', React.createElement('strong', null, 'Nová'), '.'
      )
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
      React.createElement(SummaryRow, { label: 'Pacient',    value: data.patient || '—' }),
      React.createElement(SummaryRow, { label: 'Klinika',    value: data.clinic || '—' }),
      React.createElement(SummaryRow, { label: 'Lekár',      value: data.doctor || '—' }),
      React.createElement(SummaryRow, { label: 'Technik',    value: data.technician || 'Nepridelený' }),
      React.createElement(SummaryRow, { label: 'Prijaté',    value: data.received }),
      React.createElement(SummaryRow, { label: 'Termín',     value: data.due || '—' }),
      React.createElement(SummaryRow, { label: 'Priorita',   value: priLabel[data.priority] }),
      React.createElement(SummaryRow, { label: 'Položky',    value: `${data.items.length}` })
    ),
    React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', border: '1px solid #ece7dc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320' } },
      React.createElement('span', null, 'Celkom (bez DPH)'),
      React.createElement('span', { style: { fontSize: 16 } }, fmt(total))
    ),
    data.note && React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 } }, 'Poznámka'),
      React.createElement('div', { style: { padding: 12, background: '#fef9c3', borderLeft: '3px solid #d97706', borderRadius: 6, fontSize: 12.5, color: '#713f12', lineHeight: 1.5 } }, data.note)
    )
  );
}

function SummaryRow({ label, value }) {
  return React.createElement('div', { style: { padding: '8px 12px', background: '#fff', border: '1px solid #ece7dc', borderRadius: 7 } },
    React.createElement('div', { style: { fontSize: 10.5, fontWeight: 600, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 } }, label),
    React.createElement('div', { style: { fontSize: 12.5, color: '#1a2320', fontWeight: 500 } }, value)
  );
}

Object.assign(window, { NewJob });
