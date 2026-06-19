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

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
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
      ...config.fields(workspace).map((field) => React.createElement(FormField, {
        key: field.name,
        ...field,
        value: form[field.name] || '',
        onChange: (event) => set(field.name, event.target.value),
      }))
    )
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
    initial: (workspace) => ({
      clinic_id: workspace.clinics && workspace.clinics[0] ? String(workspace.clinics[0].id) : '',
      job_ids: (workspace.jobs || [])
        .filter((job) => job.raw && ['completed', 'finished_unfactured'].includes(job.raw.status))
        .slice(0, 3)
        .map((job) => job.id)
        .join(', '),
    }),
    fields: (workspace) => [
      { name: 'clinic_id', label: 'Klinika', required: true, type: 'select', options: (workspace.clinics || []).map((c) => ({ value: String(c.id), label: c.name })) },
      { name: 'job_ids', label: 'ID prác', required: true, placeholder: 'napr. 12, 13, 14', helpText: 'Zadajte ID dokončených prác oddelené čiarkou.' },
    ],
    submit: (form) => window.MolarisAPI.createRecord('/invoices/', {
      clinic_id: Number(form.clinic_id),
      job_ids: String(form.job_ids || '').split(',').map((id) => Number(id.trim())).filter(Boolean),
    }),
  },
};

Object.assign(window, { CreateEntityDrawer });
