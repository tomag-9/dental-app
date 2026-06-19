// Clinics.jsx — Molaris Clinics (Kliniky)

function Clinics({ onNavigate, onCreate }) {
  const [search, setSearch] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();
  const canCreate = window.canCreateRecords ? window.canCreateRecords() : false;
  const clinics = workspace.clinics || [];
  const filtered = clinics.filter(c => !search || [c.name, c.address, c.ico].some(v => v.toLowerCase().includes(search.toLowerCase())));
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const pageHeader = React.createElement(PageHeader, {
    title: 'Kliniky',
    subtitle: 'Klientske kliniky a ich zmluvné údaje.',
    actions: [React.createElement(Button, {
      key: 'add',
      onClick: canCreate ? onCreate : undefined,
      disabled: workspace.loading || !canCreate,
      title: canCreate ? undefined : 'Kliniku môže vytvoriť iba administrátor laboratória.',
    }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať kliniku')]
  });

  if (workspace.loading) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, { state: 'loading', message: 'Načítavam kliniky…' })
    );
  }

  if (workspace.error) {
    const permissionDenied = isPermissionDeniedError(workspace.error);
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, {
        state: permissionDenied ? 'permission' : 'error',
        title: 'Nepodarilo sa načítať kliniky',
        description: 'Na zobrazenie kliník nemáte oprávnenie.',
        error: workspace.error,
        onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
      })
    );
  }

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    pageHeader,

    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 } },
      React.createElement('div', { style: { fontSize: 13, color: '#5a6b66' } },
        React.createElement('span', { style: { fontWeight: 600, color: '#1a2320' } }, filtered.length),
        ' z ', clinics.length, ' kliník'
      ),
      React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Názov, adresa, IČO…', width: 320 })
    ),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 } },
      ...(filtered.length === 0
        ? [React.createElement(EmptyState, { key: 'empty', title: 'Žiadne kliniky', description: search ? 'Skúste upraviť vyhľadávanie.' : 'Začnite vytvorením prvej kliniky.' })]
        : filtered.map(c => React.createElement(Card, { key: c.id, style: { display: 'flex', flexDirection: 'column' } },
        React.createElement('div', { style: { padding: '18px 20px 14px', borderBottom: '1px solid #f0ede5' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12 } },
            React.createElement('div', { style: { width: 44, height: 44, borderRadius: 10, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
              React.createElement(Icon, { name: 'building', size: 20 })
            ),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('h3', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 15, fontWeight: 700, color: '#1a2320', margin: 0, letterSpacing: '-0.01em' } }, c.name),
              React.createElement('p', { style: { fontSize: 11.5, color: '#8a9490', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 4 } },
                React.createElement(Icon, { name: 'mapPin', size: 11 }), c.address
              )
            ),
            React.createElement(IconButton, { name: 'moreHorizontal', title: 'Viac' })
          )
        ),
        React.createElement('div', { style: { padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, flex: 1 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, color: '#5a6b66' } },
            React.createElement(Icon, { name: 'phone', size: 12, color: '#8a9490' }), c.phone
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, color: '#5a6b66' } },
            React.createElement(Icon, { name: 'mail', size: 12, color: '#8a9490' }), c.email
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, color: '#5a6b66', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 } },
            React.createElement('span', { style: { color: '#b0bdb9' } }, 'IČO'), c.ico
          )
        ),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderTop: '1px solid #f0ede5', background: '#fbfaf6', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 } },
          React.createElement(MiniStat, { label: 'Lekári',  value: c.doctors }),
          React.createElement(MiniStat, { label: 'Práce',   value: c.activeJobs, highlight: c.activeJobs > 0 }),
          React.createElement(MiniStat, { label: 'YTD',     value: fmt(c.ytd) })
        )
      )))
    )
  );
}

function MiniStat({ label, value, highlight }) {
  return React.createElement('div', { style: { padding: '12px 16px', textAlign: 'center', borderRight: '1px solid #f0ede5' } },
    React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 14, fontWeight: 700, color: highlight ? '#0d7c6b' : '#1a2320' } }, value),
    React.createElement('div', { style: { fontSize: 10.5, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 } }, label)
  );
}

Object.assign(window, { Clinics });
