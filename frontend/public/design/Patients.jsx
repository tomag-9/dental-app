// Patients.jsx — Molaris Patients list (refreshed)

function Patients({ onNavigate, onOpenPatient, onCreate }) {
  const [search, setSearch] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();

  if (workspace.loading) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      React.createElement(PageHeader, {
        title: 'Pacienti',
        subtitle: 'Správa kariet pacientov.',
        actions: [
          React.createElement(Button, { key: 'imp', variant: 'outline', disabled: true }, React.createElement(Icon, { name: 'upload', size: 14 }), 'Importovať'),
          React.createElement(Button, { key: 'n', disabled: true }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať pacienta'),
        ]
      }),
      React.createElement(Card, null,
        React.createElement(CardContent, null,
          React.createElement(LoadingState, { message: 'Načítavam pacientov…' })
        )
      )
    );
  }

  if (workspace.error) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      React.createElement(PageHeader, { title: 'Pacienti', subtitle: 'Správa kariet pacientov.' }),
      React.createElement(Card, null,
        React.createElement(CardContent, null,
          React.createElement(ErrorState, {
            title: 'Nepodarilo sa načítať pacientov',
            message: workspace.error,
            onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
          })
        )
      )
    );
  }

  const patients = workspace.patients || [];

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    return !q || `${p.first} ${p.last}`.toLowerCase().includes(q) || (p.birth || '').includes(q);
  });
  const initials = p => `${(p.first || '?')[0]}${(p.last || '?')[0]}`;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: 'Pacienti',
      subtitle: 'Správa kariet pacientov.',
      actions: [
        React.createElement(Button, { key: 'imp', variant: 'outline' }, React.createElement(Icon, { name: 'upload', size: 14 }), 'Importovať'),
        React.createElement(Button, { key: 'n', onClick: onCreate }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať pacienta'),
      ]
    }),

    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
        React.createElement(CardTitle, null, `Všetci pacienti (${filtered.length})`),
        React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Meno, priezvisko, rodné číslo…', width: 320 })
      ),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        filtered.length === 0
          ? React.createElement(EmptyState, { title: 'Nenašli sa žiadni pacienti', description: search ? 'Skúste upraviť vyhľadávanie.' : 'Začnite vytvorením prvého pacienta.' })
          : React.createElement(DataTable, {
              onRowClick: (p) => onOpenPatient && onOpenPatient(p.id),
              columns: [
                { key: 'name', label: 'Pacient', render: p =>
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                      React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: '#d4f0eb', color: '#085c4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11, fontWeight: 700 } }, initials(p)),
                      React.createElement('span', { style: { fontWeight: 600, color: '#1a2320' } }, `${p.first} ${p.last}`)
                    )
                },
                { key: 'birth', label: 'Rodné číslo', width: 140, render: p => React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: '#5a6b66' } }, p.birth) },
                { key: 'phone', label: 'Telefón',  render: p => p.phone || React.createElement('span', { style: { color: '#b0bdb9' } }, '—') },
                { key: 'email', label: 'E-mail',    render: p => p.email || React.createElement('span', { style: { color: '#b0bdb9' } }, '—') },
                { key: 'jobs',  label: 'Práce', width: 90, align: 'center', render: p =>
                    React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#0d7c6b' } }, p.jobs)
                },
                { key: 'actions', label: '', width: 90, align: 'right', render: (p) =>
                    React.createElement('div', { style: { display: 'flex', gap: 2, justifyContent: 'flex-end' }, onClick: e => e.stopPropagation() },
                      React.createElement(IconButton, { name: 'eye', title: 'Detail', onClick: () => onOpenPatient && onOpenPatient(p.id) }),
                      React.createElement(IconButton, { name: 'edit', title: 'Upraviť' })
                    )
                }
              ],
              data: filtered
            })
      )
    )
  );
}

Object.assign(window, { Patients });
