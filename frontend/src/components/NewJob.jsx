// NewJobDrawer.jsx — Molaris "Nová práca" flow (restyled: centered modal + left step rail)
// Requires: form-controls.jsx (Select, PatientCombobox, Field, parseRC, fmtRC), Shared.jsx, Icon.jsx
// Exports NewJobDrawer({ open, onClose }) — name kept for app compatibility.

const NJ_STEPS = [
  { label: 'Pacient', desc: 'Komu patrí práca', title: 'Pacient a klinika', help: 'Vyhľadajte pacienta alebo ho rýchlo vytvorte, a priraďte prácu ku klinike a lekárovi.' },
  { label: 'Položky', desc: 'Výkony z cenníka',  title: 'Položky práce',     help: 'Pridajte výkony z cenníka. Cena sa dotiahne automaticky, možno ju upraviť pre túto prácu.' },
  { label: 'Termín',  desc: 'Termín a priorita', title: 'Termín a priorita', help: 'Stanovte termín odovzdania a prioritu spracovania v laboratóriu.' },
  { label: 'Súhrn',   desc: 'Kontrola a vytvorenie', title: 'Súhrn',          help: 'Skontrolujte údaje pred vytvorením práce.' },
];
const NJ_PROCEDURE_CATEGORIES = new Set(['crown', 'bridge', 'denture', 'implant', 'orthodontic', 'repair', 'other']);

function njTodaySk() {
  const d = new Date();
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function njDateToIso(dateStr) {
  const date = njParseSkDate(dateStr);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function njParseSkDate(dateStr) {
  const m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec((dateStr || '').trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function njPatientFromApi(patient) {
  const raw = patient && (patient.raw || patient);
  return {
    ...patient,
    id: patient && patient.id,
    first: (patient && patient.first) || (raw && raw.first_name) || '',
    last: (patient && patient.last) || (raw && raw.last_name) || '',
    birth: (patient && patient.birth) || (raw && (raw.national_id || raw.birth_number)) || '',
    phone: (patient && patient.phone) || (raw && raw.phone) || '',
    email: (patient && patient.email) || (raw && raw.email) || '',
  };
}

function NewJobDrawer({ open, onClose, initialPatient }) {
  const [step, setStep] = React.useState(0);
  const workspace = window.MolarisAPI.useWorkspace();
  const apiPatients = (workspace.patients || []).map(njPatientFromApi);
  const [patients, setPatients] = React.useState(apiPatients);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState({
    patient: initialPatient ? njPatientFromApi(initialPatient) : null, clinic: null, doctor: null, technician: null,
    received: njTodaySk(), due: '', priority: 'normal', note: '', toothColor: '', items: [],
  });

  const set = (k, v) => setData(d => ({ ...d, [k]: v }));
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const total = data.items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
  const reset = () => {
    setStep(0);
    setError('');
    setData({ patient: null, clinic: null, doctor: null, technician: null, received: njTodaySk(), due: '', priority: 'normal', note: '', toothColor: '', items: [] });
  };
  const close = () => { onClose(); reset(); };
  React.useEffect(() => {
    setPatients(apiPatients);
  }, [workspace.patients]);
  const clinicOptions = (workspace.clinics || []).map(c => ({ value: String(c.id), label: c.name, sub: c.address || '' }));
  const doctorOptions = (workspace.doctors || []).map(d => ({
    value: String(d.id),
    label: `${d.title ? `${d.title} ` : ''}${d.first || ''} ${d.last || ''}`.trim(),
    sub: d.clinic || '',
    clinicId: d.raw && d.raw.clinic != null ? String(d.raw.clinic) : '',
  }));
  const technicianOptions = (workspace.technicians || []).map(t => ({ value: String(t.id), label: `${t.first || ''} ${t.last || ''}`.trim(), meta: t.workload != null ? `${t.workload} %` : '', sub: t.specialization || '' }));
  const catalog = (workspace.priceList || []).map(item => ({ code: item.code, name: item.name, price: Number(item.price) || 0, cat: item.category || '' }));
  const addPatient = (p) => { const np = { ...p, id: null, jobs: 0, isNew: true }; setPatients(l => [np, ...l]); return np; };
  const filteredDoctors = data.clinic
    ? doctorOptions.filter(option => option.clinicId === String(data.clinic.value) || (!option.clinicId && option.sub === data.clinic.label))
    : [];
  const canSubmit = Boolean(data.patient && data.clinic && data.items.length && data.items.every(item => item.code && Number(item.qty) > 0 && (!item.tooth || item.toothScope || /^\d{2}$/.test(item.tooth))));
  const submitJob = async () => {
    if (!canSubmit) {
      setError('Vyberte pacienta, kliniku a aspoň jednu položku z cenníka.');
      return;
    }
    const firstItem = data.items[0];
    setSaving(true);
    setError('');
    try {
      let patientId = data.patient.id;
      if (!patientId && data.patient.isNew) {
        const createdPatient = await window.MolarisAPI.createRecord('/crm/patients/', {
          first_name: data.patient.first,
          last_name: data.patient.last,
          birth_number: data.patient.birth,
          phone: data.patient.phone || '',
          email: data.patient.email || '',
        });
        patientId = createdPatient.id;
      }
      await window.MolarisAPI.createJob({
        patient: Number(patientId),
        clinic: Number(data.clinic.value),
        doctor: data.doctor ? Number(data.doctor.value) : null,
        technician: data.technician ? Number(data.technician.value) : null,
        start_date: njDateToIso(data.received),
        due_date: njDateToIso(data.due),
        priority: data.priority,
        tooth_color: data.toothColor || null,
        description: data.note || data.items.map(item => item.name).filter(Boolean).join(', ') || (firstItem && firstItem.name) || 'Nová práca',
        items: data.items.map(item => ({
          price_list_code: item.code,
          tooth: item.toothScope ? null : (/^\d{2}$/.test(String(item.tooth || '')) ? String(item.tooth) : null),
          tooth_scope: item.toothScope || null,
          quantity: Number(item.qty) || 1,
          procedure_category: NJ_PROCEDURE_CATEGORIES.has(item.cat) ? item.cat : null,
        })),
      });
      window.showToast && window.showToast('Práca bola vytvorená', { tone: 'success' });
      window.dispatchEvent(new Event('molaris-workspace-refresh'));
      close();
    } catch (err) {
      setError((err && err.data && JSON.stringify(err.data)) || (err && err.message) || 'Prácu sa nepodarilo vytvoriť.');
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    if (open) {
      setStep(0);
      setError('');
      if (initialPatient) setData(d => ({ ...d, patient: njPatientFromApi(initialPatient) }));
    }
    const onKey = e => { if (e.key === 'Escape' && open) close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, initialPatient]);
  if (!open) return null;

  const canNext = step === 0
    ? Boolean(data.patient && data.clinic && (data.doctor || filteredDoctors.length === 0))
    : step === 1
      ? Boolean(data.items.length && data.items.every(item => item.code && Number(item.qty) > 0 && (!item.tooth || item.toothScope || /^\d{2}$/.test(item.tooth))))
      : step === 2
        ? Boolean(njParseSkDate(data.received) && njParseSkDate(data.due) && njParseSkDate(data.due) >= njParseSkDate(data.received))
        : true;
  const s = NJ_STEPS[step];
  const wide = step === 1;

  return React.createElement('div', {
    onClick: close,
    style: { position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(26,35,32,.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }
  },
    React.createElement('div', {
      onClick: e => e.stopPropagation(),
      style: {
        width: wide ? 'min(1300px, 96vw)' : 720, maxWidth: '100%', height: wide ? '90vh' : 640, maxHeight: '92vh', background: '#fff',
        borderRadius: 16, boxShadow: '0 30px 80px rgba(26,35,32,.28)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', animation: 'popIn .18s ease-out',
        transition: 'width .25s ease, height .25s ease',
      }
    },
      // ── header ──
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid #ece7dc', flexShrink: 0 } },
        React.createElement('div', { style: { width: 36, height: 36, borderRadius: 10, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
          React.createElement(Icon, { name: 'briefcase', size: 18 })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' } },
            React.createElement('h2', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 17, fontWeight: 700, color: '#1a2320', margin: 0, letterSpacing: '-0.015em', whiteSpace: 'nowrap' } }, 'Nová práca'),
            data.patient && React.createElement('span', { style: { fontSize: 12.5, color: '#5a6b66', display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, overflow: 'hidden' } },
              React.createElement('span', { style: { color: '#c8c0b4' } }, '·'),
              React.createElement('span', { title: `${data.patient.last} ${data.patient.first}`, style: { fontWeight: 600, color: '#1a2320', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, `${data.patient.last} ${data.patient.first}`),
              (() => { const rc = parseRC(data.patient.birth); return rc && React.createElement('span', { style: { whiteSpace: 'nowrap' } }, `${rc.age} r.`); })()
            )
          ),
          !data.patient && React.createElement('p', { style: { fontSize: 11.5, color: '#8a9490', margin: '2px 0 0' } }, 'Vytvorenie novej dentálnej zákazky')
        ),
        React.createElement(IconButton, { name: 'x', title: 'Zatvoriť (Esc)', onClick: close })
      ),
      // ── horizontal step tabs ──
      React.createElement(StepTabs, { steps: NJ_STEPS, step, setStep }),
      // ── body: content ──
      React.createElement('div', { style: { flex: 1, display: 'flex', minHeight: 0 } },
        React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } },
          React.createElement('div', { style: { flex: 1, overflowY: 'auto', overflowX: wide ? 'auto' : 'visible', padding: wide ? '16px 22px' : '20px 26px' } },
            React.createElement('div', { style: { maxWidth: wide ? 'none' : 600, margin: wide ? 0 : '0 auto' } },
              !wide && React.createElement('div', { style: { marginBottom: 16 } },
                React.createElement('h3', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 16, fontWeight: 700, color: '#1a2320', margin: 0, letterSpacing: '-0.015em' } }, s.title),
                React.createElement('p', { style: { fontSize: 12.5, color: '#5a6b66', margin: '5px 0 0', lineHeight: 1.5, maxWidth: 460 } }, s.help)
              ),
              error && React.createElement('div', { style: { marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #f5c0bb', background: '#fde8e6', color: '#c0392b', fontSize: 12.5 } }, error),
              step === 0 && React.createElement(StepPatient, { data, set, patients, addPatient, clinicOptions, filteredDoctors, technicianOptions }),
              step === 1 && React.createElement(NJItems, { catalog, items: data.items, onItemsChange: items => set('items', items) }),
              step === 2 && React.createElement(StepSchedule, { data, set }),
              step === 3 && React.createElement(StepSummary, { data, fmt, total, items: data.items })
            )
          )
        )
      ),
      // ── footer ──
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid #ece7dc', background: '#fbfaf6', flexShrink: 0 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
          React.createElement('span', { style: { fontSize: 11.5, color: '#8a9490', fontWeight: 500 } }, 'Spolu bez DPH'),
          React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 18, fontWeight: 700, color: '#1a2320', letterSpacing: '-0.01em' } }, fmt(total))
        ),
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          step > 0 && React.createElement(Button, { variant: 'outline', onClick: () => setStep(step - 1) },
            React.createElement(Icon, { name: 'arrowLeft', size: 13 }), 'Späť'),
          step < NJ_STEPS.length - 1
            ? React.createElement(Button, { onClick: () => canNext && setStep(step + 1), disabled: !canNext }, 'Ďalej', React.createElement(Icon, { name: 'arrowRight', size: 13 }))
            : React.createElement(Button, { onClick: submitJob, disabled: saving || !canSubmit }, React.createElement(Icon, { name: 'check', size: 14 }), saving ? 'Vytváram…' : 'Vytvoriť prácu')
        )
      )
    )
  );
}

function StepTabs({ steps, step, setStep }) {
  return React.createElement('div', { style: { display: 'flex', alignItems: 'stretch', padding: '0 20px', background: '#fbfaf6', borderBottom: '1px solid #ece7dc', flexShrink: 0, gap: 0 } },
    ...steps.map((s, i) => {
      const active = i === step, done = i < step;
      const last = i === steps.length - 1;
      return React.createElement(React.Fragment, { key: i },
        React.createElement('div', {
          onClick: () => done && setStep(i),
          style: { display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px 11px 0', cursor: done ? 'pointer' : 'default', flexShrink: 0 }
        },
          React.createElement('div', {
            style: {
              width: 24, height: 24, borderRadius: '50%',
              background: done ? '#0d7c6b' : active ? '#fff' : '#f0ede5',
              border: active ? '2px solid #0d7c6b' : done ? 'none' : '1px solid #e4ded4',
              color: done ? '#fff' : active ? '#0d7c6b' : '#8a9490',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11, fontWeight: 700, boxSizing: 'border-box',
              transition: 'background .15s, border-color .15s',
            }
          }, done ? React.createElement(Icon, { name: 'check', size: 12 }) : (i + 1)),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', lineHeight: 1.2 } },
            React.createElement('span', { style: { fontSize: 12.5, fontWeight: active ? 700 : 600, color: active ? '#0d7c6b' : done ? '#1a2320' : '#8a9490', whiteSpace: 'nowrap' } }, s.label)
          )
        ),
        !last && React.createElement('div', { style: { alignSelf: 'center', width: 28, height: 1, background: done ? '#0d7c6b' : '#e4ded4', flexShrink: 0, margin: '0 2px' } })
      );
    })
  );
}

// ── group label ──
function GroupLabel({ children }) {
  return React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 } }, children);
}

function StepPatient({ data, set, patients, addPatient, clinicOptions, filteredDoctors, technicianOptions }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
    React.createElement('div', null,
      React.createElement(PatientCombobox, {
        patients, value: data.patient, required: true,
        onChange: p => set('patient', p), onCreate: p => addPatient(p),
      })
    ),
    React.createElement('div', { style: { height: 1, background: '#ece7dc' } }),
    React.createElement('div', null,
      React.createElement(GroupLabel, null, 'Priradenie'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
          React.createElement(Select, { label: 'Klinika', required: true, value: data.clinic && data.clinic.value, onChange: o => { set('clinic', o); set('doctor', null); }, options: clinicOptions, placeholder: clinicOptions.length ? 'Vybrať kliniku…' : 'Žiadne kliniky' }),
          React.createElement(Select, { label: 'Odosielajúci lekár', required: filteredDoctors.length > 0, disabled: !data.clinic || filteredDoctors.length === 0, value: data.doctor && data.doctor.value, onChange: o => set('doctor', o), options: filteredDoctors, placeholder: !data.clinic ? 'Najprv vyberte kliniku' : filteredDoctors.length ? 'Vybrať lekára…' : 'Klinika nemá lekára — pokračujte bez lekára' })
        ),
        React.createElement(Select, { label: 'Pridelený technik', value: data.technician && data.technician.value, onChange: o => set('technician', o), options: technicianOptions, placeholder: 'Nepridelený — prideliť neskôr', help: 'Voliteľné. Percento vyjadruje aktuálne vyťaženie technika.' })
      )
    )
  );
}

function StepSchedule({ data, set }) {
  const priorities = [
    { value: 'low',    label: 'Nízka',    desc: 'Štandardná fronta',    color: '#8a9490', bg: '#f0ede5' },
    { value: 'normal', label: 'Normálna', desc: 'Štandardný termín',    color: '#0d7c6b', bg: '#d4f0eb' },
    { value: 'high',   label: 'Vysoká',   desc: 'Urgentné — prioritne', color: '#d97706', bg: '#fef3c7' },
    { value: 'urgent', label: 'Urgent',   desc: 'Pacient v ordinácii',  color: '#c0392b', bg: '#fee2e2' },
  ];
  const receivedDate = njParseSkDate(data.received);
  const dueDate = njParseSkDate(data.due);
  const receivedError = data.received && !receivedDate ? 'Použite formát D. M. RRRR.' : '';
  const dueError = data.due && !dueDate
    ? 'Použite formát D. M. RRRR.'
    : receivedDate && dueDate && dueDate < receivedDate ? 'Termín nemôže byť pred dátumom prijatia.' : '';
  const dateStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e4ded4', borderRadius: 7, background: '#fff', color: '#1a2320', fontFamily: 'Manrope,sans-serif', fontSize: 13, outline: 'none' };
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
      React.createElement(Field, { label: 'Dátum prijatia', required: true, error: receivedError },
        React.createElement('input', { value: data.received, onChange: e => set('received', e.target.value), style: dateStyle })),
      React.createElement(Field, { label: 'Požadovaný termín odovzdania', required: true, error: dueError },
        React.createElement('input', { value: data.due, onChange: e => set('due', e.target.value), placeholder: 'D. M. RRRR', style: dateStyle }))
    ),
    React.createElement('div', null,
      React.createElement(GroupLabel, null, 'Priorita'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 } },
        ...priorities.map(p => {
          const active = data.priority === p.value;
          return React.createElement('button', {
            key: p.value, onClick: () => set('priority', p.value),
            style: {
              padding: '11px 12px', borderRadius: 9,
              border: active ? `2px solid ${p.color}` : '1px solid #e4ded4',
              background: active ? p.bg : '#fff', cursor: 'pointer',
              fontFamily: 'Manrope,sans-serif', textAlign: 'left', transition: 'border-color .12s, background .12s'
            }
          },
            React.createElement('div', { style: { fontSize: 12.5, fontWeight: 700, color: active ? p.color : '#1a2320' } }, p.label),
            React.createElement('div', { style: { fontSize: 10.5, color: active ? p.color : '#8a9490', marginTop: 2, opacity: 0.85 } }, p.desc)
          );
        })
      )
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 } },
      React.createElement(Field, { label: 'Farba' },
        React.createElement('input', {
          value: data.toothColor || '', list: 'nj-tooth-colors',
          onChange: e => set('toothColor', e.target.value),
          placeholder: 'Vyberte alebo napíšte…',
          style: dateStyle
        }),
        React.createElement('datalist', { id: 'nj-tooth-colors' },
          ...['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'C1', 'C2', 'D2', 'D3', 'BL1', 'BL2', 'BL3'].map(color =>
            React.createElement('option', { key: color, value: color })))
      ),
      React.createElement(Field, { label: 'Poznámka pre technika' },
        React.createElement('textarea', {
          value: data.note, onChange: e => set('note', e.target.value), rows: 4,
          placeholder: 'Špecifické požiadavky, alergie pacienta, materiál…',
          style: { width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #e4ded4', borderRadius: 7, background: '#fff', color: '#1a2320', fontFamily: 'Manrope,sans-serif', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 84 }
        })
      )
    )
  );
}

function StepSummary({ data, fmt, total, items }) {
  const priMap = { low: { l: 'Nízka', c: '#8a9490', bg: '#f0ede5' }, normal: { l: 'Normálna', c: '#0d7c6b', bg: '#d4f0eb' }, high: { l: 'Vysoká', c: '#d97706', bg: '#fef3c7' }, urgent: { l: 'Urgent', c: '#c0392b', bg: '#fee2e2' } };
  const pri = priMap[data.priority];
  const p = data.patient;
  const rc = p ? parseRC(p.birth) : null;
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    p && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: '#eef7f4', border: '1px solid #b0ddd5', borderRadius: 10 } },
      React.createElement('div', { style: { width: 40, height: 40, borderRadius: '50%', background: '#0d7c6b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 14, fontWeight: 700, flexShrink: 0 } }, `${p.first[0]}${p.last[0]}`),
      React.createElement('div', { style: { minWidth: 0 } },
        React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 15, fontWeight: 700, color: '#1a2320' } }, `${p.first} ${p.last}`),
        React.createElement('div', { style: { fontSize: 11.5, color: '#5a6b66', marginTop: 2 } },
          React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace' } }, fmtRC(p.birth)), rc ? ` · ${rc.dobShort} · ${rc.sex}, ${rc.age} r.` : '')
      )
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
      React.createElement(NJSummaryRow, { label: 'Klinika',  value: data.clinic ? data.clinic.label : '—' }),
      React.createElement(NJSummaryRow, { label: 'Lekár',    value: data.doctor ? data.doctor.label : '—' }),
      React.createElement(NJSummaryRow, { label: 'Technik',  value: data.technician ? data.technician.label : 'Nepridelený' }),
      React.createElement(NJSummaryRow, { label: 'Priorita', value: pri.l, chip: pri }),
      React.createElement(NJSummaryRow, { label: 'Prijaté',  value: data.received }),
      React.createElement(NJSummaryRow, { label: 'Termín',   value: data.due || '—' }),
      React.createElement(NJSummaryRow, { label: 'Farba',    value: data.toothColor || '—' })
    ),
    React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 10, overflow: 'hidden' } },
      ...items.map((it, i) => React.createElement('div', {
        key: i, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: i ? '1px solid #f0ede5' : 'none', background: '#fff', fontSize: 12.5 }
      },
        React.createElement('span', { style: { color: '#1a2320' } }, it.name,
          it.toothScope && React.createElement('span', { style: { color: '#8a9490', marginLeft: 6 } }, `· ${NJ_SCOPE_LABELS[it.toothScope] || it.toothScope}`),
          !it.toothScope && it.tooth && React.createElement('span', { style: { color: '#8a9490', marginLeft: 6 } }, `· zub ${it.tooth}`),
          React.createElement('span', { style: { color: '#8a9490', marginLeft: 6 } }, `· ${it.qty}×`)),
        React.createElement('span', { style: { fontWeight: 600, color: '#1a2320' } }, fmt((Number(it.qty) || 0) * (Number(it.price) || 0)))
      )),
      React.createElement('div', { style: { padding: '12px 14px', background: '#fbfaf6', borderTop: '1px solid #ece7dc', display: 'flex', justifyContent: 'space-between', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320' } },
        React.createElement('span', null, 'Celkom bez DPH'),
        React.createElement('span', { style: { fontSize: 16 } }, fmt(total)))
    ),
    data.note && React.createElement('div', null,
      React.createElement(GroupLabel, null, 'Poznámka'),
      React.createElement('div', { style: { padding: 12, background: '#fef9c3', borderLeft: '3px solid #d97706', borderRadius: 6, fontSize: 12.5, color: '#713f12', lineHeight: 1.5 } }, data.note))
  );
}

function NJSummaryRow({ label, value, chip }) {
  return React.createElement('div', { style: { padding: '8px 12px', background: '#fff', border: '1px solid #ece7dc', borderRadius: 8 } },
    React.createElement('div', { style: { fontSize: 10, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 } }, label),
    chip
      ? React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 9999, fontSize: 11.5, fontWeight: 700, background: chip.bg, color: chip.c } }, value)
      : React.createElement('div', { style: { fontSize: 12.5, color: '#1a2320', fontWeight: 500 } }, value)
  );
}

Object.assign(window, { NewJobDrawer });
