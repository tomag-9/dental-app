// Technicians.jsx — Molaris Technicians (Technici)

function Technicians({ onNavigate, onCreate }) {
  const [search, setSearch] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();
  const techs = workspace.technicians || [];
  const filtered = techs.filter(t => !search || `${t.first} ${t.last} ${t.specialty} ${t.role}`.toLowerCase().includes(search.toLowerCase()));
  const initials = t => `${(t.first || '?')[0]}${(t.last || '?')[0]}`;
  const loadColor = w => w >= 90 ? '#c0392b' : w >= 75 ? '#d97706' : w >= 50 ? '#0d7c6b' : '#8a9490';
  const pageHeader = React.createElement(PageHeader, {
    title: 'Technici',
    subtitle: 'Tím technických pracovníkov a ich vyťaženie.',
    actions: [React.createElement(Button, { key: 'add', onClick: onCreate, disabled: workspace.loading }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať technika')]
  });

  if (workspace.loading) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, { state: 'loading', message: 'Načítavam technikov…' })
    );
  }

  if (workspace.error) {
    const permissionDenied = isPermissionDeniedError(workspace.error);
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, {
        state: permissionDenied ? 'permission' : 'error',
        title: 'Nepodarilo sa načítať technikov',
        description: 'Na zobrazenie technikov nemáte oprávnenie.',
        error: workspace.error,
        onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
      })
    );
  }

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    pageHeader,
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 } },
      ...(filtered.length === 0
        ? [React.createElement(EmptyState, { key: 'empty', title: 'Žiadni technici', description: search ? 'Skúste upraviť vyhľadávanie.' : 'Začnite vytvorením prvého technika.' })]
        : filtered.map(t => React.createElement(Card, { key: t.id },
        React.createElement('div', { style: { padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 } },
          React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#d4f0eb', color: '#085c4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 14, fontWeight: 700, flexShrink: 0 } }, initials(t)),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('h3', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 14.5, fontWeight: 700, color: '#1a2320', margin: 0, letterSpacing: '-0.01em' } }, `${t.first} ${t.last}`),
            React.createElement('p', { style: { fontSize: 11.5, color: '#0d7c6b', margin: '2px 0 0', fontWeight: 600 } }, t.role),
            React.createElement('p', { style: { fontSize: 11.5, color: '#8a9490', margin: '4px 0 0' } }, t.specialty)
          ),
          React.createElement(IconButton, { name: 'moreHorizontal', title: 'Viac' })
        ),
        React.createElement('div', { style: { padding: '0 20px 14px', display: 'flex', flexDirection: 'column', gap: 8 } },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5 } },
            React.createElement('span', { style: { color: '#5a6b66' } }, 'Vyťaženie'),
            React.createElement('span', { style: { fontWeight: 700, color: loadColor(t.workload), fontFamily: 'Plus Jakarta Sans,sans-serif' } }, `${t.workload} %`)
          ),
          React.createElement('div', { style: { height: 6, background: '#f0ede5', borderRadius: 3, overflow: 'hidden' } },
            React.createElement('div', { style: { width: `${t.workload}%`, height: '100%', background: loadColor(t.workload), transition: 'width .3s' } })
          )
        ),
        React.createElement('div', { style: { borderTop: '1px solid #f0ede5', background: '#fbfaf6', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 } },
          React.createElement('span', { style: { color: '#8a9490' } }, 'Tento mesiac'),
          React.createElement('span', { style: { fontWeight: 700, color: '#1a2320', fontFamily: 'Plus Jakarta Sans,sans-serif' } }, `${t.jobsThisMonth} prác`)
        )
      )))
    )
  );
}

Object.assign(window, { Technicians });
