// Settings.jsx — Molaris Settings (Nastavenia)

function Settings({ onNavigate, user }) {
  const [tab, setTab] = React.useState('profile');
  const [me, setMe] = React.useState(user || null);
  const [lab, setLab] = React.useState((user && user.lab) || null);
  const [loading, setLoading] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState({ first_name: '', last_name: '', email: '', nickname: '', phone: '', position: '' });
  const [labForm, setLabForm] = React.useState({
    id: null,
    name: '',
    tax_id: '',
    vat_id: '',
    address: '',
    bank_account: '',
    invoice_prefix: 'INV',
    invoice_due_days: 14,
    vat_rate: 0,
    payment_method: 'bank_transfer',
    invoice_default_note: '',
  });
  const [notifPrefs, setNotifPrefs] = React.useState({});
  const [profileStatus, setProfileStatus] = React.useState('');
  const [labStatus, setLabStatus] = React.useState('');
  const [billingStatus, setBillingStatus] = React.useState('');
  const [notifStatus, setNotifStatus] = React.useState('');
  const [securityStatus, setSecurityStatus] = React.useState('');
  const [securityForm, setSecurityForm] = React.useState({ current: '', next: '', confirm: '' });
  const tabs = [
    { value: 'profile',     label: 'Profil',     icon: 'user' },
    { value: 'lab',         label: 'Laboratórium',icon: 'building' },
    { value: 'team',        label: 'Tím',        icon: 'users' },
    { value: 'notifications',label: 'Notifikácie',icon: 'bell' },
    { value: 'billing',     label: 'Fakturácia', icon: 'receipt' },
    { value: 'security',    label: 'Bezpečnosť', icon: 'shield' },
  ];

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!window.MolarisAPI || !window.MolarisAPI.fetchMe) return;
      setLoading(true);
      try {
        const data = await window.MolarisAPI.fetchMe();
        if (!alive) return;
        setMe(data);
        setLab(data.lab_details || null);
      } catch {
        if (!alive) return;
        setProfileStatus('Nepodarilo sa načítať profil.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (!me) return;
    setProfileForm((current) => ({
      ...current,
      first_name: me.first_name || '',
      last_name: me.last_name || '',
      email: me.email || '',
      nickname: me.nickname || '',
    }));
    setNotifPrefs(me.notification_preferences || {});
  }, [me]);

  React.useEffect(() => {
    if (!lab) return;
    setLabForm((current) => ({
      ...current,
      id: lab.id,
      name: lab.name || '',
      tax_id: lab.tax_id || '',
      vat_id: lab.vat_id || '',
      address: lab.address || '',
      bank_account: lab.bank_account || '',
      invoice_prefix: lab.invoice_prefix || 'INV',
      invoice_due_days: lab.invoice_due_days || 14,
      vat_rate: Number(lab.vat_rate || 0),
      payment_method: lab.payment_method || 'bank_transfer',
      invoice_default_note: lab.invoice_default_note || '',
    }));
  }, [lab]);

  const syncLocalUser = (updatedUser) => {
    if (!updatedUser) return;
    const name = [updatedUser.first_name, updatedUser.last_name].filter(Boolean).join(' ') || updatedUser.nickname || updatedUser.username;
    const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
    const saved = {
      id: updatedUser.id,
      name: name || 'Používateľ',
      email: updatedUser.email || '',
      username: updatedUser.username,
      role: updatedUser.role || 'admin',
      initials,
      lab: updatedUser.lab_details || null,
    };
    localStorage.setItem('molaris.user', JSON.stringify(saved));
    window.dispatchEvent(new CustomEvent('molaris-user-updated', { detail: saved }));
  };

  const handleProfileSave = async () => {
    if (!window.MolarisAPI || !window.MolarisAPI.updateMe) return;
    setProfileStatus('');
    try {
      const payload = {
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
        email: profileForm.email,
        nickname: profileForm.nickname || null,
      };
      const updated = await window.MolarisAPI.updateMe(payload);
      setMe(updated);
      syncLocalUser(updated);
      setProfileStatus('Zmeny uložené.');
    } catch {
      setProfileStatus('Uloženie zlyhalo.');
    }
  };

  const handleLabSave = async () => {
    if (!window.MolarisAPI || !window.MolarisAPI.updateLab) return;
    setLabStatus('');
    try {
      const payload = {
        name: labForm.name,
        tax_id: labForm.tax_id,
        vat_id: labForm.vat_id,
        address: labForm.address,
        bank_account: labForm.bank_account,
      };
      const updated = await window.MolarisAPI.updateLab(labForm.id, payload);
      setLab(updated);
      setLabStatus('Zmeny uložené.');
    } catch {
      setLabStatus('Uloženie zlyhalo.');
    }
  };

  const handleBillingSave = async () => {
    if (!window.MolarisAPI || !window.MolarisAPI.updateLab) return;
    setBillingStatus('');
    try {
      const payload = {
        invoice_prefix: labForm.invoice_prefix,
        invoice_due_days: Number(labForm.invoice_due_days || 0),
        vat_rate: Number(labForm.vat_rate || 0),
        payment_method: labForm.payment_method,
        invoice_default_note: labForm.invoice_default_note || '',
      };
      const updated = await window.MolarisAPI.updateLab(labForm.id, payload);
      setLab(updated);
      setBillingStatus('Zmeny uložené.');
    } catch {
      setBillingStatus('Uloženie zlyhalo.');
    }
  };

  const handleNotifSave = async () => {
    if (!window.MolarisAPI || !window.MolarisAPI.updateMe) return;
    setNotifStatus('');
    try {
      const updated = await window.MolarisAPI.updateMe({ notification_preferences: notifPrefs });
      setMe(updated);
      syncLocalUser(updated);
      setNotifStatus('Zmeny uložené.');
    } catch {
      setNotifStatus('Uloženie zlyhalo.');
    }
  };

  const handlePasswordSave = async () => {
    if (!window.MolarisAPI || !window.MolarisAPI.updateMe) return;
    setSecurityStatus('');
    if (!securityForm.next || securityForm.next !== securityForm.confirm) {
      setSecurityStatus('Nové heslo sa nezhoduje.');
      return;
    }
    try {
      await window.MolarisAPI.updateMe({ password: securityForm.next });
      setSecurityForm({ current: '', next: '', confirm: '' });
      setSecurityStatus('Heslo bolo zmenené.');
    } catch {
      setSecurityStatus('Zmena hesla zlyhala.');
    }
  };

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: 'Nastavenia',
      subtitle: 'Profil používateľa, parametre laboratória a integrácie.'
    }),
    React.createElement('div', { className: 'settings-grid', style: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18, alignItems: 'flex-start' } },
      // Side nav
      React.createElement(Card, { style: { padding: 8 } },
        React.createElement('nav', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
          ...tabs.map(t => {
            const active = tab === t.value;
            return React.createElement('button', {
              key: t.value, onClick: () => setTab(t.value),
              onMouseEnter: e => { if (!active) e.currentTarget.style.background = '#f0ede5'; },
              onMouseLeave: e => { if (!active) e.currentTarget.style.background = 'transparent'; },
              style: {
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: active ? '#d4f0eb' : 'transparent',
                color: active ? '#085c4e' : '#4a5752',
                fontWeight: active ? 600 : 500, fontSize: 13, fontFamily: 'Manrope,sans-serif',
                transition: 'background .1s, color .1s'
              }
            },
              React.createElement(Icon, { name: t.icon, size: 15, color: active ? '#0d7c6b' : '#6a7570' }),
              t.label
            );
          })
        )
      ),
      // Panel
      tab === 'profile' && React.createElement(ProfilePanel, {
        form: profileForm,
        onChange: setProfileForm,
        onSave: handleProfileSave,
        status: profileStatus,
        loading,
      }),
      tab === 'lab' && React.createElement(LabPanel, {
        form: labForm,
        onChange: setLabForm,
        onSave: handleLabSave,
        status: labStatus,
        loading,
      }),
      tab === 'team' && React.createElement(TeamPanel, null),
      tab === 'notifications' && React.createElement(NotificationsPanel, {
        preferences: notifPrefs,
        onChange: setNotifPrefs,
        onSave: handleNotifSave,
        status: notifStatus,
      }),
      tab === 'billing' && React.createElement(BillingPanel, {
        form: labForm,
        onChange: setLabForm,
        onSave: handleBillingSave,
        status: billingStatus,
      }),
      tab === 'security' && React.createElement(SecurityPanel, {
        form: securityForm,
        onChange: setSecurityForm,
        onSave: handlePasswordSave,
        status: securityStatus,
      }),
    )
  );
}

function PanelHeader({ title, desc }) {
  return React.createElement('div', { style: { padding: '18px 22px 14px', borderBottom: '1px solid #f0ede5' } },
    React.createElement('h2', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 16, fontWeight: 700, color: '#1a2320', margin: 0, letterSpacing: '-0.01em' } }, title),
    desc && React.createElement('p', { style: { fontSize: 12.5, color: '#8a9490', margin: '3px 0 0' } }, desc)
  );
}
function PanelBody({ children }) {
  return React.createElement('div', { style: { padding: 22, display: 'flex', flexDirection: 'column', gap: 18 } }, children);
}
function FormRow({ children, columns = 2 }) {
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: columns === 2 ? '1fr 1fr' : '1fr', gap: 12 } }, children);
}
function PanelFooter({ children }) {
  return React.createElement('div', { style: { padding: '14px 22px', borderTop: '1px solid #f0ede5', background: '#fbfaf6', display: 'flex', justifyContent: 'flex-end', gap: 8, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 } }, children);
}

function ProfilePanel({ form, onChange, onSave, status, loading }) {
  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Profil používateľa', desc: 'Vaše osobné údaje a kontakt.' }),
    React.createElement(PanelBody, null,
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
        React.createElement('div', { style: { width: 64, height: 64, borderRadius: '50%', background: '#d4f0eb', color: '#085c4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 20, fontWeight: 700 } }, 'JN'),
        React.createElement('div', null,
          React.createElement(Button, { variant: 'outline', size: 'sm' }, React.createElement(Icon, { name: 'upload', size: 13 }), 'Nahrať fotku'),
          React.createElement('p', { style: { fontSize: 11, color: '#8a9490', margin: '6px 0 0' } }, 'JPG, PNG · max 2 MB')
        )
      ),
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'Meno', value: form.first_name, onChange: (e) => onChange({ ...form, first_name: e.target.value }) }),
        React.createElement(FormField, { label: 'Priezvisko', value: form.last_name, onChange: (e) => onChange({ ...form, last_name: e.target.value }) })
      ),
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'E-mail', value: form.email, onChange: (e) => onChange({ ...form, email: e.target.value }), type: 'email' }),
        React.createElement(FormField, { label: 'Telefón', value: form.phone, onChange: (e) => onChange({ ...form, phone: e.target.value }) })
      ),
      React.createElement(FormField, { label: 'Pozícia', value: form.position, onChange: (e) => onChange({ ...form, position: e.target.value }) })
    ),
    React.createElement(PanelFooter, null,
      React.createElement('span', { style: { marginRight: 'auto', fontSize: 11.5, color: '#8a9490' } }, status || (loading ? 'Načítavam...' : '')),
      React.createElement(Button, { variant: 'outline' }, 'Zrušiť'),
      React.createElement(Button, { onClick: onSave }, 'Uložiť zmeny')
    )
  );
}

function LabPanel({ form, onChange, onSave, status, loading }) {
  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Laboratórium', desc: 'Identifikačné a fakturačné údaje laboratória.' }),
    React.createElement(PanelBody, null,
      React.createElement(FormField, { label: 'Názov laboratória', value: form.name, onChange: (e) => onChange({ ...form, name: e.target.value }) }),
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'IČO', value: form.tax_id, onChange: (e) => onChange({ ...form, tax_id: e.target.value }) }),
        React.createElement(FormField, { label: 'DIČ', value: form.vat_id, onChange: (e) => onChange({ ...form, vat_id: e.target.value }) })
      ),
      React.createElement(FormField, { label: 'Adresa', value: form.address, onChange: (e) => onChange({ ...form, address: e.target.value }) }),
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'IBAN', value: form.bank_account, onChange: (e) => onChange({ ...form, bank_account: e.target.value }) }),
        React.createElement(FormField, { label: 'Mena', type: 'select', value: 'EUR', onChange: () => {}, options: [{ value: 'EUR', label: 'EUR (€)' }], disabled: true })
      )
    ),
    React.createElement(PanelFooter, null,
      React.createElement('span', { style: { marginRight: 'auto', fontSize: 11.5, color: '#8a9490' } }, status || (loading ? 'Načítavam...' : '')),
      React.createElement(Button, { variant: 'outline' }, 'Zrušiť'),
      React.createElement(Button, { onClick: onSave }, 'Uložiť zmeny')
    )
  );
}

function TeamPanel() {
  const [members, setMembers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!window.MolarisAPI || !window.MolarisAPI.fetchLabMembers) {
      setLoading(false);
      return;
    }
    window.MolarisAPI.fetchLabMembers()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.results || []);
        const formatted = list.map(user => {
          const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Unknown';
          const role = user.role === 'superadmin' ? 'Superadmin' : (user.role === 'admin' ? 'Administrátor' : 'Technik');
          return {
            id: user.id,
            name,
            role,
            email: user.email || '',
            status: user.is_active ? 'active' : 'inactive',
          };
        });
        setMembers(formatted);
      })
      .catch(() => {
        setMembers([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const fallbackMembers = [
    { name: 'Ján Novák',  role: 'Administrátor', email: 'jan.novak@dl.sk',   status: 'active' },
    { name: 'Anna Mrázová', role: 'Technik',      email: 'anna.m@dl.sk',     status: 'active' },
    { name: 'Marek Bartoš', role: 'Technik',      email: 'marek.b@dl.sk',    status: 'active' },
    { name: 'Tereza H.',    role: 'Junior tech.', email: 'tereza.h@dl.sk',   status: 'pending' },
  ];
  const visibleMembers = members.length > 0 ? members : fallbackMembers;

  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Tím a oprávnenia', desc: 'Členovia laboratória s prístupom do aplikácie.' }),
    React.createElement('div', { style: { padding: 22 } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: 12 } },
        React.createElement(Button, { size: 'sm' }, React.createElement(Icon, { name: 'plus', size: 13 }), 'Pozvať člena')
      ),
      React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden', background: '#fff' } },
        loading ? React.createElement('div', { style: { padding: 16, textAlign: 'center', color: '#8a9490' } }, 'Načítavam...')
        : visibleMembers.map((m, i) => React.createElement('div', {
          key: m.id || i,
          style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid #f0ede5' }
        },
          React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: '#d4f0eb', color: '#085c4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11, fontWeight: 700 } }, m.name.split(' ').map(n => n[0]).join('').slice(0, 2)),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, m.name),
            React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490' } }, m.email)
          ),
          React.createElement('span', { style: { fontSize: 12, color: '#5a6b66' } }, m.role),
          React.createElement(Badge, { color: m.status === 'active' ? 'done' : 'new' }, m.status === 'active' ? 'Aktívny' : 'Pozvaný'),
          React.createElement(IconButton, { name: 'moreHorizontal', title: 'Viac' })
        ))
      )
    )
  );
}

function NotificationsPanel({ preferences, onChange, onSave, status }) {
  const notifs = [
    { key: 'new_job',   label: 'Nová práca',           desc: 'Pri vytvorení novej zákazky' },
    { key: 'job_due',   label: 'Blížiaci sa termín',   desc: '24 h pred termínom odovzdania' },
    { key: 'inv_paid',  label: 'Zaplatená faktúra',     desc: 'Po prijatí platby' },
    { key: 'low_stock', label: 'Nízky stav skladu',     desc: 'Položka pod minimálny stav' },
    { key: 'weekly',    label: 'Týždenný súhrn',        desc: 'Pondelok ráno, sumár predošlého tž.' },
  ];
  const readPref = (key, channel) => {
    const pref = preferences && preferences[key];
    if (!pref || typeof pref !== 'object') return false;
    return Boolean(pref[channel]);
  };
  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Notifikácie', desc: 'Vyberte si, kedy chcete dostávať upozornenia.' }),
    React.createElement('div', { style: { padding: 22 } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '0 12px 8px', fontSize: 10.5, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 } },
        React.createElement('span', null, 'Udalosť'),
        React.createElement('span', { style: { textAlign: 'center' } }, 'E-mail'),
        React.createElement('span', { style: { textAlign: 'center' } }, 'V apke'),
      ),
      React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden', background: '#fff' } },
        ...notifs.map((n, i) => React.createElement('div', {
          key: n.key,
          style: { display: 'grid', gridTemplateColumns: '1fr 80px 80px', alignItems: 'center', padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid #f0ede5' }
        },
          React.createElement('div', null,
            React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, n.label),
            React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 1 } }, n.desc)
          ),
          React.createElement(Toggle, {
            value: readPref(n.key, 'email'),
            onChange: (value) => onChange({
              ...preferences,
              [n.key]: { ...preferences[n.key], email: value, app: readPref(n.key, 'app') }
            })
          }),
          React.createElement(Toggle, {
            value: readPref(n.key, 'app'),
            onChange: (value) => onChange({
              ...preferences,
              [n.key]: { ...preferences[n.key], app: value, email: readPref(n.key, 'email') }
            })
          })
        ))
      )
    ),
    React.createElement(PanelFooter, null,
      React.createElement('span', { style: { marginRight: 'auto', fontSize: 11.5, color: '#8a9490' } }, status || ''),
      React.createElement(Button, { onClick: onSave }, 'Uložiť zmeny')
    )
  );
}

function Toggle({ value, onChange }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { setV(value); }, [value]);
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'center' } },
    React.createElement('button', {
      onClick: () => { const next = !v; setV(next); onChange && onChange(next); },
      style: {
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: v ? '#0d7c6b' : '#d4cfc5', position: 'relative', transition: 'background .15s', padding: 0
      }
    },
      React.createElement('div', {
        style: { position: 'absolute', top: 2, left: v ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }
      })
    )
  );
}

function BillingPanel({ form, onChange, onSave, status }) {
  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Fakturácia', desc: 'Predvolené nastavenia pre vystavovanie faktúr.' }),
    React.createElement(PanelBody, null,
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'Predpona čísla faktúry', value: form.invoice_prefix, onChange: (e) => onChange({ ...form, invoice_prefix: e.target.value }) }),
        React.createElement(FormField, { label: 'Splatnosť (dní)', value: String(form.invoice_due_days || ''), onChange: (e) => onChange({ ...form, invoice_due_days: e.target.value }), type: 'number' })
      ),
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'Sadzba DPH (%)', value: String(form.vat_rate || ''), onChange: (e) => onChange({ ...form, vat_rate: e.target.value }), type: 'number' }),
        React.createElement(FormField, { label: 'Spôsob platby', type: 'select', value: form.payment_method, onChange: (e) => onChange({ ...form, payment_method: e.target.value }), options: [
          { value: 'bank_transfer', label: 'Bankový prevod' }, { value: 'cash', label: 'Hotovosť' }, { value: 'card', label: 'Platobná karta' }
        ] })
      ),
      React.createElement(FormField, { label: 'Predvolená poznámka na faktúre', type: 'textarea', value: form.invoice_default_note, onChange: (e) => onChange({ ...form, invoice_default_note: e.target.value }) })
    ),
    React.createElement(PanelFooter, null,
      React.createElement('span', { style: { marginRight: 'auto', fontSize: 11.5, color: '#8a9490' } }, status || ''),
      React.createElement(Button, { variant: 'outline' }, 'Zrušiť'),
      React.createElement(Button, { onClick: onSave }, 'Uložiť zmeny')
    )
  );
}

function SecurityPanel({ form, onChange, onSave, status }) {
  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Bezpečnosť', desc: 'Heslo a dvojfázové overenie.' }),
    React.createElement(PanelBody, null,
      React.createElement('div', null,
        React.createElement('h3', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320', margin: '0 0 8px' } }, 'Zmena hesla'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 } },
          React.createElement(FormField, { label: 'Súčasné heslo', type: 'password', value: form.current, onChange: (e) => onChange({ ...form, current: e.target.value }) }),
          React.createElement(FormField, { label: 'Nové heslo', type: 'password', value: form.next, onChange: (e) => onChange({ ...form, next: e.target.value }) }),
          React.createElement(FormField, { label: 'Potvrdiť heslo', type: 'password', value: form.confirm, onChange: (e) => onChange({ ...form, confirm: e.target.value }) })
        )
      ),
      React.createElement('div', { style: { borderTop: '1px solid #f0ede5', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
        React.createElement('div', null,
          React.createElement('h3', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320', margin: '0 0 4px' } }, 'Dvojfázové overenie'),
          React.createElement('p', { style: { fontSize: 12, color: '#8a9490', margin: 0, maxWidth: 380 } }, 'Pridajte druhú vrstvu bezpečnosti pomocou autentifikačnej aplikácie.')
        ),
        React.createElement(Button, { variant: 'outline', size: 'sm' }, 'Aktivovať')
      ),
      React.createElement('div', { style: { borderTop: '1px solid #f0ede5', paddingTop: 16 } },
        React.createElement('h3', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320', margin: '0 0 8px' } }, 'Aktívne relácie'),
        React.createElement('div', { style: { fontSize: 12, color: '#5a6b66', display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#fbfaf6', border: '1px solid #ece7dc', borderRadius: 8 } },
          React.createElement('span', null, 'Chrome / macOS · Bratislava · ',
            React.createElement('span', { style: { color: '#0d7c6b', fontWeight: 600 } }, 'táto relácia')
          ),
          React.createElement('span', { style: { color: '#8a9490' } }, 'Posledná aktivita: práve teraz')
        )
      ),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8 } },
        React.createElement('span', { style: { marginRight: 'auto', fontSize: 11.5, color: '#8a9490', alignSelf: 'center' } }, status || ''),
        React.createElement(Button, { onClick: onSave }, 'Uložiť zmeny')
      )
    )
  );
}

Object.assign(window, { Settings });
