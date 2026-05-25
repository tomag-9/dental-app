// Finance.jsx — Molaris Finance overview (refreshed)

function Finance({ onNavigate }) {
  const workspace = window.MolarisAPI.useWorkspace();

  const pageHeader = React.createElement(PageHeader, {
    title: 'Financie',
    subtitle: 'Prehľad tržieb, faktúr a finančnej analytiky.',
    actions: [
      React.createElement(Button, { key: 'i', variant: 'outline', onClick: () => onNavigate('invoices') }, React.createElement(Icon, { name: 'fileText', size: 14 }), 'Faktúry'),
      React.createElement(Button, { key: 'p', variant: 'outline', onClick: () => onNavigate('pricelist') }, React.createElement(Icon, { name: 'tag', size: 14 }), 'Cenník'),
      React.createElement(Button, { key: 'e' }, React.createElement(Icon, { name: 'download', size: 14 }), 'Exportovať'),
    ]
  });

  if (workspace.loading) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(Card, null,
        React.createElement(CardContent, null,
          React.createElement(LoadingState, { message: 'Načítavam finančné dáta…' })
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
            title: 'Nepodarilo sa načítať finančné dáta',
            message: workspace.error,
            onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
          })
        )
      )
    );
  }

  const invoices = workspace.invoices || [];
  const issuedTotal = invoices.filter(i => i.status === 'issued').reduce((s, i) => s + i.amount, 0);
  const paidTotal = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const overdueCount = invoices.filter(i => i.status === 'issued' && i.raw && i.raw.due_date && new Date(i.raw.due_date) < new Date()).length;
  const metrics = [
    { label: 'Celkové tržby',     value: fmtEur(paidTotal), icon: 'euro', tone: 'green' },
    { label: 'Čakajúce faktúry',  value: String(invoices.filter(i => i.status === 'issued').length), icon: 'fileText', tone: 'amber', sub: fmtEur(issuedTotal) },
    { label: 'Po splatnosti',     value: String(overdueCount), icon: 'alertCircle', tone: 'red', sub: 'podľa splatnosti' },
    { label: 'Priem. doba úhrady', value: '—', icon: 'clock', tone: 'teal', sub: 'nie je k dispozícii' },
  ];

  const monthlyData = [
    { month: 'nov', revenue: 4200 },
    { month: 'dec', revenue: 6800 },
    { month: 'jan', revenue: 3900 },
    { month: 'feb', revenue: 7200 },
    { month: 'mar', revenue: 8100 },
    { month: 'apr', revenue: 9420 },
  ];
  const maxRev = Math.max(...monthlyData.map(m => m.revenue));

  const clinics = workspace.clinics || [];
  const totalClinicYtd = clinics.reduce((s, c) => s + (c.ytd || 0), 0);
  const topClinics = clinics.length
    ? clinics.slice(0, 5).map(c => ({ name: c.name, amount: c.ytd || 0, share: Math.max(6, Math.min(100, Math.round(((c.ytd || 0) / Math.max(1, totalClinicYtd)) * 100))) }))
    : [];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    pageHeader,

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      ...metrics.map(m => React.createElement(StatCard, { key: m.label, ...m }))
    ),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, alignItems: 'flex-start' } },
      React.createElement(Card, null,
        React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement(CardTitle, null, 'Mesačné tržby (6 mesiacov)'),
          React.createElement('span', { style: { fontSize: 11, color: '#8a9490' } }, 'v EUR')
        ),
        React.createElement(CardContent, null,
          React.createElement('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 14, height: 180, padding: '8px 4px 0' } },
            ...monthlyData.map(m => {
              const h = (m.revenue / maxRev) * 100;
              return React.createElement('div', { key: m.month, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 } },
                React.createElement('div', { style: { fontSize: 10.5, color: '#5a6b66', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 600 } }, (m.revenue / 1000).toFixed(1), 'k'),
                React.createElement('div', {
                  style: { width: '100%', height: `${h}%`, minHeight: 8, background: 'linear-gradient(180deg, #0d7c6b 0%, #16a085 100%)', borderRadius: '6px 6px 0 0', boxShadow: '0 -2px 4px rgba(13,124,107,.15)' }
                }),
                React.createElement('div', { style: { fontSize: 11, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 } }, m.month)
              );
            })
          )
        )
      ),
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Top kliniky podľa obratu')),
        React.createElement(CardContent, null,
          topClinics.length === 0
            ? React.createElement(EmptyState, { title: 'Žiadne dáta', description: 'Nie sú k dispozícii žiadne kliniky s obratom.' })
            : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
                ...topClinics.map((c) => React.createElement('div', { key: c.name },
                  React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
                    React.createElement('span', { style: { fontSize: 12.5, fontWeight: 500, color: '#1a2320' } }, c.name),
                    React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 12.5, fontWeight: 700, color: '#1a2320' } }, fmtEur(c.amount))
                  ),
                  React.createElement('div', { style: { height: 6, background: '#f0ede5', borderRadius: 3, overflow: 'hidden' } },
                    React.createElement('div', { style: { height: '100%', width: `${c.share}%`, background: '#0d7c6b', borderRadius: 3 } })
                  )
                ))
              )
        )
      )
    )
  );
}

Object.assign(window, { Finance });
