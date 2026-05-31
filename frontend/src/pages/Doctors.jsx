// Doctors.jsx — Molaris Doctors (Lekári)

function Doctors({ onNavigate, onCreate }) {
  const [search, setSearch] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();
  const doctors = workspace.doctors || [];
  const filtered = doctors.filter(d => !search || `${d.first} ${d.last} ${d.clinic} ${d.specialty}`.toLowerCase().includes(search.toLowerCase()));
  const initials = d => `${(d.first || '?')[0]}${(d.last || '?')[0]}`;
  const pageHeader = React.createElement(PageHeader, {
    title: 'Lekári',
    subtitle: 'Odosielajúci lekári a ich kontaktné údaje.',
    actions: [React.createElement(Button, { key: 'add', onClick: onCreate, disabled: workspace.loading }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať lekára')]
  });

  if (workspace.loading) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(Card, null,
        React.createElement(CardContent, null,
          React.createElement(LoadingState, { message: 'Načítavam lekárov…' })
        )
      )
    );
  }

  if (workspace.error) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(Card, null,
        React.createElement(CardContent, null,
          React.createElement(ErrorState, {
            title: 'Nepodarilo sa načítať lekárov',
            message: workspace.error,
            onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
          })
        )
      )
    );
  }

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    pageHeader,
    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
        React.createElement(CardTitle, null, `Všetci lekári (${filtered.length})`),
        React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Meno, klinika, špecializácia…', width: 300 })
      ),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        filtered.length === 0
          ? React.createElement(EmptyState, { title: 'Žiadni lekári', description: search ? 'Skúste upraviť vyhľadávanie.' : 'Začnite vytvorením prvého lekára.' })
          : React.createElement(DataTable, {
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
