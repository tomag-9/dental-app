// CreateDrawers.jsx — small production create flows for primary Molaris entities.

function CreateEntityDrawer({ type, open, onClose }) {
  const workspace = window.MolarisAPI.useWorkspace();
  const config = CREATE_ENTITY_CONFIG[type];
  const [form, setForm] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open || !config) return;
    setForm(config.initial(workspace));
    setError('');
  }, [open, type]);

  if (!open || !config) return null;

  const set = (key, value) => setForm((current) => {
    const next = { ...current, [key]: value };
    if (type === 'invoice' && key === 'clinic_id') {
      const clinicId = Number(value || 0);
      const doctor = (workspace.doctors || []).find((item) => item.raw && item.raw.clinic === clinicId);
      next.doctor_id = doctor ? String(doctor.id) : '';
      next.job_ids = eligibleInvoiceJobs(workspace, next).map((job) => job.id);
    }
    if (type === 'invoice' && key === 'doctor_id') {
      next.job_ids = eligibleInvoiceJobs(workspace, next).map((job) => job.id);
    }
    return next;
  });
  const renderField = (field) => {
    if (field.type === 'job-checklist') {
      const selected = Array.isArray(form[field.name]) ? form[field.name] : [];
      return React.createElement(InvoiceJobChecklist, {
        key: field.name,
        field,
        selected,
        onChange: (next) => set(field.name, next),
      });
    }
    return React.createElement(FormField, {
      key: field.name,
      ...field,
      value: field.type === 'checkbox' ? !!form[field.name] : (form[field.name] || ''),
      onChange: (event) => set(field.name, field.type === 'checkbox' ? event.target.checked : event.target.value),
    });
  };
  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await config.submit(form);
      setSaving(false);
      onClose(true);
    } catch (err) {
      setSaving(false);
      if (err && err.status === 403) {
        setError('Na vytvorenie záznamu nemáte oprávnenie. Použite účet administrátora laboratória.');
      } else {
        setError((err && err.data && JSON.stringify(err.data)) || err.message || 'Záznam sa nepodarilo vytvoriť.');
      }
    }
  };

  return React.createElement(Drawer, {
    open,
    onClose: () => onClose(false),
    width: config.width || 560,
    title: config.title,
    subtitle: config.subtitle,
    footer: [
      React.createElement(Button, { key: 'cancel', variant: 'outline', onClick: () => onClose(false) }, 'Zrušiť'),
      React.createElement(Button, { key: 'save', onClick: submit, disabled: saving },
        React.createElement(Icon, { name: 'check', size: 14 }),
        saving ? 'Ukladám…' : config.saveText
      ),
    ],
  },
    error && React.createElement(ErrorState, { title: 'Uloženie zlyhalo', message: error }),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: config.columns || '1fr 1fr', gap: 12 } },
      ...config.fields(workspace, form).map(renderField)
    )
  );
}

function eligibleInvoiceJobs(workspace, form) {
  const clinicId = Number(form.clinic_id || 0);
  const doctorId = Number(form.doctor_id || 0);
  return (workspace.jobs || [])
    .filter((job) => {
      const raw = job.raw || {};
      if (!['completed', 'finished_unfactured'].includes(raw.status)) return false;
      if (clinicId && raw.clinic !== clinicId) return false;
      if (doctorId && raw.doctor !== doctorId) return false;
      return true;
    })
    .sort((a, b) => String(a.patient || '').localeCompare(String(b.patient || ''), 'sk'));
}

function defaultInvoiceForm(workspace) {
  const clinic = workspace.clinics && workspace.clinics[0] ? workspace.clinics[0] : null;
  const doctors = (workspace.doctors || []).filter((doctor) => !clinic || (doctor.raw && doctor.raw.clinic === clinic.id));
  const doctor = doctors[0] || null;
  const base = {
    clinic_id: clinic ? String(clinic.id) : '',
    doctor_id: doctor ? String(doctor.id) : '',
    job_ids: [],
    description_mode: 'structured',
    custom_description: 'Protetické práce',
    show_patient_list: true,
  };
  return {
    ...base,
    job_ids: eligibleInvoiceJobs(workspace, base).map((job) => job.id),
  };
}

function InvoiceJobChecklist({ field, selected, onChange }) {
  const jobs = field.jobs || [];
  const selectedSet = new Set(selected.map(Number));
  const toggle = (id) => {
    const next = selectedSet.has(id)
      ? selected.filter((item) => Number(item) !== id)
      : [...selected, id];
    onChange(next);
  };
  const setAll = () => onChange(jobs.map((job) => job.id));
  const clear = () => onChange([]);
  return React.createElement('div', { style: { gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement('label', { style: { fontSize: 12, fontWeight: 600, color: '#1a2320' } }, field.label),
      React.createElement('span', { style: { marginLeft: 'auto', fontSize: 11, color: '#8a9490' } }, `${selected.length}/${jobs.length}`),
      React.createElement(Button, { variant: 'outline', onClick: setAll }, 'Všetko'),
      React.createElement(Button, { variant: 'outline', onClick: clear }, 'Nič')
    ),
    jobs.length
      ? React.createElement('div', { style: { border: '1px solid #e4ded4', borderRadius: 7, maxHeight: 240, overflow: 'auto', background: '#fff' } },
          jobs.map((job) => React.createElement('label', {
            key: job.id,
            style: { display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', gap: 8, padding: '9px 10px', borderBottom: '1px solid #f0ede5', cursor: 'pointer', fontFamily: 'Manrope,sans-serif' },
          },
            React.createElement('input', { type: 'checkbox', checked: selectedSet.has(job.id), onChange: () => toggle(job.id), style: { width: 16, height: 16, accentColor: '#0d7c6b' } }),
            React.createElement('span', { style: { minWidth: 0 } },
              React.createElement('span', { style: { display: 'block', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, job.patient || `Pacient #${job.raw && job.raw.patient}`),
              React.createElement('span', { style: { display: 'block', fontSize: 11.5, color: '#5a6b66' } }, `${job.type} · ${job.due}`)
            ),
            React.createElement('span', { style: { fontSize: 12, color: '#5a6b66', fontVariantNumeric: 'tabular-nums' } }, fmtEur(job.raw && job.raw.price))
          ))
        )
      : React.createElement('div', { style: { border: '1px dashed #d4cfc5', borderRadius: 7, padding: 14, fontSize: 13, color: '#5a6b66', background: '#fbfaf7' } }, 'Pre zvolenú kliniku a lekára nie sú dokončené nefakturované práce.'),
    field.helpText && React.createElement('p', { style: { fontSize: 11, color: '#8a9490', margin: 0 } }, field.helpText)
  );
}

const CREATE_ENTITY_CONFIG = {
  patient: {
    title: 'Pridať pacienta',
    subtitle: 'Nová karta pacienta v laboratóriu.',
    saveText: 'Vytvoriť pacienta',
    initial: () => ({ first_name: '', last_name: '', birth_number: '', phone: '', email: '', address: '' }),
    fields: () => [
      { name: 'first_name', label: 'Meno', required: true },
      { name: 'last_name', label: 'Priezvisko', required: true },
      { name: 'birth_number', label: 'Rodné číslo', required: true },
      { name: 'phone', label: 'Telefón' },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'address', label: 'Adresa' },
    ],
    submit: (form) => window.MolarisAPI.createRecord('/crm/patients/', form),
  },
  clinic: {
    title: 'Pridať kliniku',
    subtitle: 'Nová klientska klinika.',
    saveText: 'Vytvoriť kliniku',
    initial: () => ({ name: '', ico: '', dic: '', email: '', phone: '', street: '', city: '', zip_code: '' }),
    fields: () => [
      { name: 'name', label: 'Názov kliniky', required: true },
      { name: 'ico', label: 'IČO' },
      { name: 'dic', label: 'DIČ' },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'phone', label: 'Telefón' },
      { name: 'street', label: 'Ulica' },
      { name: 'city', label: 'Mesto' },
      { name: 'zip_code', label: 'PSČ' },
    ],
    submit: (form) => window.MolarisAPI.createRecord('/crm/clinics/', form),
  },
  doctor: {
    title: 'Pridať lekára',
    subtitle: 'Lekár priradený ku klinike.',
    saveText: 'Vytvoriť lekára',
    initial: (workspace) => ({ title_before: 'MUDr.', first_name: '', last_name: '', clinic: workspace.clinics && workspace.clinics[0] ? String(workspace.clinics[0].id) : '', email: '', phone: '' }),
    fields: (workspace) => [
      { name: 'title_before', label: 'Titul' },
      { name: 'first_name', label: 'Meno', required: true },
      { name: 'last_name', label: 'Priezvisko', required: true },
      { name: 'clinic', label: 'Klinika', type: 'select', options: (workspace.clinics || []).map((c) => ({ value: String(c.id), label: c.name })) },
      { name: 'email', label: 'E-mail', type: 'email' },
      { name: 'phone', label: 'Telefón' },
    ],
    submit: (form) => window.MolarisAPI.createRecord('/crm/doctors/', { ...form, clinic: form.clinic ? Number(form.clinic) : null }),
  },
  technician: {
    title: 'Pridať technika',
    subtitle: 'Člen technického tímu.',
    saveText: 'Vytvoriť technika',
    initial: () => ({ first_name: '', last_name: '', role: 'Technik', specialty: '', email: '' }),
    fields: () => [
      { name: 'first_name', label: 'Meno', required: true },
      { name: 'last_name', label: 'Priezvisko', required: true },
      { name: 'role', label: 'Rola' },
      { name: 'specialty', label: 'Špecializácia' },
      { name: 'email', label: 'E-mail', type: 'email' },
    ],
    submit: (form) => window.MolarisAPI.createRecord('/jobs/technicians/', {
      first_name: form.first_name,
      last_name: form.last_name,
      contact_info: { role: form.role, specialty: form.specialty, email: form.email },
    }),
  },
  warehouse: {
    title: 'Pridať skladovú položku',
    subtitle: 'Materiál alebo komponent do skladu.',
    saveText: 'Vytvoriť položku',
    initial: () => ({ name: '', sku: '', category: '', quantity: '0', unit: 'ks', min_threshold: '0', cost_price: '', location: '' }),
    fields: () => [
      { name: 'name', label: 'Názov', required: true },
      { name: 'sku', label: 'Kód/SKU' },
      { name: 'category', label: 'Kategória' },
      { name: 'quantity', label: 'Množstvo', type: 'number' },
      { name: 'unit', label: 'Jednotka' },
      { name: 'min_threshold', label: 'Minimum', type: 'number' },
      { name: 'cost_price', label: 'Cena/j.', type: 'number' },
      { name: 'location', label: 'Dodávateľ/lokácia' },
    ],
    submit: (form) => window.MolarisAPI.createRecord('/warehouse/', form),
  },
  price: {
    title: 'Pridať položku cenníka',
    subtitle: 'Nový výkon dostupný pre práce.',
    saveText: 'Vytvoriť položku',
    initial: () => ({ code: '', description: '', price: '', valid_from: new Date().toISOString().slice(0, 10) }),
    fields: () => [
      { name: 'code', label: 'Kód', required: true },
      { name: 'description', label: 'Názov výkonu', required: true },
      { name: 'price', label: 'Cena bez DPH', type: 'number', required: true },
      { name: 'valid_from', label: 'Platné od', type: 'date' },
    ],
    submit: (form) => window.MolarisAPI.createRecord('/finance/price-list/', form),
  },
  invoice: {
    title: 'Nová faktúra',
    subtitle: 'Vystavenie faktúry z dokončených prác.',
    saveText: 'Vytvoriť faktúru',
    width: 720,
    columns: '1fr 1fr',
    initial: defaultInvoiceForm,
    fields: (workspace, form) => {
      const clinicId = Number(form.clinic_id || 0);
      const doctors = (workspace.doctors || []).filter((doctor) => !clinicId || (doctor.raw && doctor.raw.clinic === clinicId));
      const jobs = eligibleInvoiceJobs(workspace, form);
      return [
        { name: 'clinic_id', label: 'Klinika', required: true, type: 'select', options: (workspace.clinics || []).map((c) => ({ value: String(c.id), label: c.name })) },
        { name: 'doctor_id', label: 'Lekár', type: 'select', placeholder: 'Všetci lekári', options: doctors.map((d) => ({ value: String(d.id), label: `${d.title ? `${d.title} ` : ''}${d.first} ${d.last}`.trim() })) },
        { name: 'description_mode', label: 'Popis na faktúre', type: 'select', options: [
          { value: 'structured', label: 'Štruktúrovaný rozpis výkonov' },
          { value: 'custom', label: 'Voľný popis' },
        ] },
        { name: 'show_patient_list', label: 'Príloha', type: 'checkbox', placeholder: 'Pridať zoznam pacientov a prác ako prílohu' },
        ...(form.description_mode === 'custom'
          ? [{ name: 'custom_description', label: 'Voľný popis', type: 'textarea', rows: 2, required: true, helpText: 'Napr. Protetické práce.' }]
          : []),
        { name: 'job_ids', label: 'Pacienti/práce', type: 'job-checklist', jobs, helpText: 'Predvolene sú vybrané všetky dokončené nefakturované práce zvoleného lekára.' },
      ];
    },
    submit: (form) => window.MolarisAPI.createRecord('/invoices/', {
      clinic_id: Number(form.clinic_id),
      job_ids: (Array.isArray(form.job_ids) ? form.job_ids : []).map((id) => Number(id)).filter(Boolean),
      description_mode: form.description_mode || 'structured',
      custom_description: form.description_mode === 'custom' ? String(form.custom_description || '').trim() : '',
      show_patient_list: !!form.show_patient_list,
    }),
  },
};

Object.assign(window, { CreateEntityDrawer });
