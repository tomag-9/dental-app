// Settings.jsx — Molaris Settings (Nastavenia)

function Settings({ onNavigate, user }) {
  const [tab, setTab] = React.useState('profile');
  const tabs = [
    { value: 'profile',     label: 'Profil',     icon: 'user' },
    { value: 'lab',         label: 'Laboratórium',icon: 'building' },
    { value: 'team',        label: 'Tím',        icon: 'users' },
    { value: 'notifications',label: 'Notifikácie',icon: 'bell' },
    { value: 'billing',     label: 'Fakturácia', icon: 'receipt' },
    { value: 'security',    label: 'Bezpečnosť', icon: 'shield' },
  ];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: 'Nastavenia',
      subtitle: 'Profil používateľa, parametre laboratória a integrácie.'
    }),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18, alignItems: 'flex-start' } },
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
      tab === 'profile' && React.createElement(ProfilePanel, null),
      tab === 'lab' && React.createElement(LabPanel, null),
      tab === 'team' && React.createElement(TeamPanel, null),
      tab === 'notifications' && React.createElement(NotificationsPanel, null),
      tab === 'billing' && React.createElement(BillingPanel, null),
      tab === 'security' && React.createElement(SecurityPanel, null),
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

function ProfilePanel() {
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
        React.createElement(FormField, { label: 'Meno', value: 'Ján', onChange: () => {} }),
        React.createElement(FormField, { label: 'Priezvisko', value: 'Novák', onChange: () => {} })
      ),
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'E-mail', value: 'jan.novak@molaris.sk', onChange: () => {}, type: 'email' }),
        React.createElement(FormField, { label: 'Telefón', value: '+421 905 111 222', onChange: () => {} })
      ),
      React.createElement(FormField, { label: 'Pozícia', value: 'Senior technik / Administrátor', onChange: () => {} })
    ),
    React.createElement(PanelFooter, null,
      React.createElement(Button, { variant: 'outline' }, 'Zrušiť'),
      React.createElement(Button, null, 'Uložiť zmeny')
    )
  );
}

function LabPanel() {
  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Laboratórium', desc: 'Identifikačné a fakturačné údaje laboratória.' }),
    React.createElement(PanelBody, null,
      React.createElement(FormField, { label: 'Názov laboratória', value: 'Molaris s.r.o.', onChange: () => {} }),
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'IČO', value: '12345678', onChange: () => {} }),
        React.createElement(FormField, { label: 'DIČ', value: '2024567891', onChange: () => {} })
      ),
      React.createElement(FormField, { label: 'Adresa', value: 'Záhradnícka 95, 821 08 Bratislava', onChange: () => {} }),
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'IBAN', value: 'SK68 1100 0000 0029 4012 3456', onChange: () => {} }),
        React.createElement(FormField, { label: 'Mena', type: 'select', value: 'EUR', onChange: () => {}, options: [{ value: 'EUR', label: 'EUR (€)' }, { value: 'CZK', label: 'CZK (Kč)' }] })
      )
    ),
    React.createElement(PanelFooter, null,
      React.createElement(Button, { variant: 'outline' }, 'Zrušiť'),
      React.createElement(Button, null, 'Uložiť zmeny')
    )
  );
}

function TeamPanel() {
  const members = [
    { name: 'Ján Novák',  role: 'Administrátor', email: 'jan.novak@dl.sk',   status: 'active' },
    { name: 'Anna Mrázová', role: 'Technik',      email: 'anna.m@dl.sk',     status: 'active' },
    { name: 'Marek Bartoš', role: 'Technik',      email: 'marek.b@dl.sk',    status: 'active' },
    { name: 'Tereza H.',    role: 'Junior tech.', email: 'tereza.h@dl.sk',   status: 'pending' },
  ];
  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Tím a oprávnenia', desc: 'Členovia laboratória s prístupom do aplikácie.' }),
    React.createElement('div', { style: { padding: 22 } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: 12 } },
        React.createElement(Button, { size: 'sm' }, React.createElement(Icon, { name: 'plus', size: 13 }), 'Pozvať člena')
      ),
      React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden', background: '#fff' } },
        ...members.map((m, i) => React.createElement('div', {
          key: i,
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

function NotificationsPanel() {
  const notifs = [
    { key: 'new_job',   label: 'Nová práca',           desc: 'Pri vytvorení novej zákazky',         email: true,  app: true },
    { key: 'job_due',   label: 'Blížiaci sa termín',   desc: '24 h pred termínom odovzdania',       email: true,  app: true },
    { key: 'inv_paid',  label: 'Zaplatená faktúra',     desc: 'Po prijatí platby',                   email: false, app: true },
    { key: 'low_stock', label: 'Nízky stav skladu',     desc: 'Položka pod minimálny stav',          email: true,  app: false },
    { key: 'weekly',    label: 'Týždenný súhrn',        desc: 'Pondelok ráno, sumár predošlého tž.', email: true,  app: false },
  ];
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
          React.createElement(Toggle, { value: n.email }),
          React.createElement(Toggle, { value: n.app })
        ))
      )
    )
  );
}

function Toggle({ value }) {
  const [v, setV] = React.useState(value);
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'center' } },
    React.createElement('button', {
      onClick: () => setV(!v),
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

function BillingPanel() {
  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Fakturácia', desc: 'Predvolené nastavenia pre vystavovanie faktúr.' }),
    React.createElement(PanelBody, null,
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'Predpona čísla faktúry', value: 'INV-', onChange: () => {} }),
        React.createElement(FormField, { label: 'Splatnosť (dní)', value: '14', onChange: () => {}, type: 'number' })
      ),
      React.createElement(FormRow, null,
        React.createElement(FormField, { label: 'Sadzba DPH (%)', value: '20', onChange: () => {}, type: 'number' }),
        React.createElement(FormField, { label: 'Spôsob platby', type: 'select', value: 'transfer', onChange: () => {}, options: [
          { value: 'transfer', label: 'Bankový prevod' }, { value: 'cash', label: 'Hotovosť' }, { value: 'card', label: 'Platobná karta' }
        ] })
      ),
      React.createElement(FormField, { label: 'Predvolená poznámka na faktúre', type: 'textarea', value: 'Ďakujeme za spoluprácu. Faktúru uhraďte do termínu splatnosti na uvedený účet.', onChange: () => {} })
    ),
    React.createElement(PanelFooter, null,
      React.createElement(Button, { variant: 'outline' }, 'Zrušiť'),
      React.createElement(Button, null, 'Uložiť zmeny')
    )
  );
}

function SecurityPanel() {
  return React.createElement(Card, null,
    React.createElement(PanelHeader, { title: 'Bezpečnosť', desc: 'Heslo a dvojfázové overenie.' }),
    React.createElement(PanelBody, null,
      React.createElement('div', null,
        React.createElement('h3', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320', margin: '0 0 8px' } }, 'Zmena hesla'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 } },
          React.createElement(FormField, { label: 'Súčasné heslo', type: 'password', value: '', onChange: () => {} }),
          React.createElement(FormField, { label: 'Nové heslo', type: 'password', value: '', onChange: () => {} }),
          React.createElement(FormField, { label: 'Potvrdiť heslo', type: 'password', value: '', onChange: () => {} })
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
      )
    )
  );
}

Object.assign(window, { Settings });
