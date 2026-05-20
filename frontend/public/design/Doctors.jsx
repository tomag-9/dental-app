// Doctors.jsx — Molaris Doctors (Lekári)

function Doctors({ onNavigate, onCreate }) {
  const [search, setSearch] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();
  const fallbackDoctors = [
    { id: 1, title: 'MUDr.', first: 'Pavol', last: 'Novák',   clinic: 'Klinika Bratislava', specialty: 'Protetika',     phone: '+421 905 111 222', email: 'novak@klinikaba.sk', activeJobs: 4 },
    { id: 2, title: 'MUDr.', first: 'Eva',   last: 'Blaho',   clinic: 'ZubMed Košice',      specialty: 'Implantológia', phone: '+421 905 333 444', email: 'blaho@zubmed.sk',   activeJobs: 3 },
    { id: 3, title: 'MUDr.', first: 'Igor',  last: 'Sloboda', clinic: 'DentaPrima Žilina',  specialty: 'Konzervačná',   phone: '+421 905 555 666', email: 'sloboda@dp.sk',     activeJobs: 2 },
    { id: 4, title: 'MUDr.', first: 'Monika',last: 'Krížová', clinic: 'Klinika Bratislava', specialty: 'Estetická',     phone: '+421 905 777 888', email: 'krizova@klinikaba.sk', activeJobs: 1 },
    { id: 5, title: 'MDDr.', first: 'Jakub', last: 'Polák',   clinic: 'Smile Centrum Nitra', specialty: 'Ortodoncia',   phone: '+421 905 999 000', email: 'polak@smile.sk',    activeJobs: 0 },
    { id: 6, title: 'MUDr.', first: 'Lucia', last: 'Šimková', clinic: 'Estetika Prešov',    specialty: 'Protetika',     phone: '+421 905 121 343', email: 'simkova@est.sk',    activeJobs: 0 },
  ];
  const doctors = workspace.doctors && workspace.doctors.length ? workspace.doctors : fallbackDoctors;
  const filtered = doctors.filter(d => !search || `${d.first} ${d.last} ${d.clinic} ${d.specialty}`.toLowerCase().includes(search.toLowerCase()));
  const initials = d => `${d.first[0]}${d.last[0]}`;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: 'Lekári',
      subtitle: 'Odosielajúci lekári a ich kontaktné údaje.',
      actions: [React.createElement(Button, { key: 'add', onClick: onCreate }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať lekára')]
    }),
    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
        React.createElement(CardTitle, null, `Všetci lekári (${filtered.length})`),
        React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Meno, klinika, špecializácia…', width: 300 })
      ),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        React.createElement(DataTable, {
          columns: [
            { key: 'name', label: 'Lekár', render: d => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: '#d4f0eb', color: '#085c4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11, fontWeight: 700 } }, initials(d)),
                React.createElement('div', null,
                  React.createElement('div', { style: { fontWeight: 600, color: '#1a2320' } }, `${d.title} ${d.first} ${d.last}`),
                  React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, d.specialty)
                )
              )},
            { key: 'clinic', label: 'Klinika', render: d => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                React.createElement(Icon, { name: 'building', size: 12, color: '#8a9490' }), d.clinic
              )},
            { key: 'contact', label: 'Kontakt', render: d => React.createElement('div', { style: { fontSize: 12 } },
                React.createElement('div', null, d.phone),
                React.createElement('div', { style: { color: '#8a9490', fontSize: 11.5, marginTop: 1 } }, d.email)
              )},
            { key: 'jobs', label: 'Aktívne práce', width: 130, align: 'center', render: d =>
                d.activeJobs === 0
                  ? React.createElement('span', { style: { color: '#b0bdb9' } }, '—')
                  : React.createElement(Badge, { color: 'progress' }, `${d.activeJobs} ${d.activeJobs === 1 ? 'práca' : 'práce'}`)
            },
            { key: 'actions', label: '', width: 80, align: 'right', render: () =>
                React.createElement('div', { style: { display: 'flex', gap: 2, justifyContent: 'flex-end' } },
                  React.createElement(IconButton, { name: 'edit', title: 'Upraviť' }),
                  React.createElement(IconButton, { name: 'trash', title: 'Zmazať', destructive: true })
                )
            }
          ],
          data: filtered
        })
      )
    )
  );
}

Object.assign(window, { Doctors });
