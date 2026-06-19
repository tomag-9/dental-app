// Invoices.jsx — Molaris Invoices (Faktúry)

function Invoices({ onNavigate, onCreate }) {
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const [selected, setSelected] = React.useState(null);
  const [actionError, setActionError] = React.useState('');
  const [exporting, setExporting] = React.useState(false);
  const workspace = window.MolarisAPI.useWorkspace();
  const canCreate = window.canCreateRecords ? window.canCreateRecords() : false;

  const exportInvoices = async () => {
    setExporting(true);
    setActionError('');
    try {
      await window.MolarisAPI.downloadInvoicesExport('csv');
    } catch (err) {
      setActionError((err && err.message) || 'Export faktúr sa nepodarilo stiahnuť.');
    } finally {
      setExporting(false);
    }
  };

  const pageHeader = React.createElement(PageHeader, {
    title: 'Faktúry',
    subtitle: 'Správa a prehľad faktúr vystavených klinikám.',
    actions: [
      React.createElement(Button, { key: 'export', variant: 'outline', onClick: exportInvoices, disabled: exporting },
        React.createElement(Icon, { name: 'download', size: 14 }), exporting ? 'Exportujem…' : 'CSV export'),
      React.createElement(Button, {
        key: 'new',
        onClick: canCreate ? onCreate : undefined,
        disabled: !canCreate,
        title: canCreate ? undefined : 'Faktúru môže vytvoriť iba administrátor laboratória.',
      },
        React.createElement(Icon, { name: 'plus', size: 14 }), 'Nová faktúra'),
    ]
  });

  if (workspace.loading) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, { state: 'loading', message: 'Načítavam faktúry…' })
    );
  }

  if (workspace.error) {
    const permissionDenied = isPermissionDeniedError(workspace.error);
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, {
        state: permissionDenied ? 'permission' : 'error',
        title: 'Nepodarilo sa načítať faktúry',
        description: 'Na zobrazenie faktúr nemáte oprávnenie.',
        error: workspace.error,
        onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
      })
    );
  }

  const invoices = workspace.invoices || [];

  const filtered = invoices.filter(i => {
    const q = search.toLowerCase();
    const m = !q || [i.number, i.clinic].some(v => (v || '').toLowerCase().includes(q));
    if (!m) return false;
    if (tab !== 'all') return i.status === tab;
    return true;
  });

  const totals = {
    issued: invoices.filter(i => i.status === 'issued').reduce((s, i) => s + i.amount, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    draft: invoices.filter(i => i.status === 'draft').reduce((s, i) => s + i.amount, 0),
  };
  const fmt = n => (n || 0).toFixed(2).replace('.', ',') + ' €';
  const countLabel = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    pageHeader,

    React.createElement('div', { className: 'stat-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'Zaplatené', value: fmt(totals.paid), icon: 'checkCircle', tone: 'green', sub: countLabel(invoices.filter(i => i.status === 'paid').length, 'faktúra', 'faktúry') }),
      React.createElement(StatCard, { label: 'Čaká na platbu', value: fmt(totals.issued), icon: 'clock', tone: 'amber', sub: countLabel(invoices.filter(i => i.status === 'issued').length, 'vystavená', 'vystavené') }),
      React.createElement(StatCard, { label: 'Koncepty', value: fmt(totals.draft), icon: 'fileText', tone: 'teal', sub: countLabel(invoices.filter(i => i.status === 'draft').length, 'čaká odoslanie', 'čakajú odoslanie') }),
      React.createElement(StatCard, { label: 'Priemerná doba úhrady', value: '—', icon: 'activity', tone: 'purple' }),
    ),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 } },
      React.createElement(InvoiceLifecycleGuide, { invoice: { status: tab === 'all' ? '' : tab } }),
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Výstupy')),
        React.createElement(CardContent, { style: { display: 'grid', gap: 10 } },
          React.createElement(InfoCell, { label: 'PDF faktúry', value: 'Detail faktúry → PDF' }),
          React.createElement(InfoCell, { label: 'CSV export', value: 'Číslo, klinika, dátumy, stav, suma' })
        )
      )
    ),

    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
        React.createElement(Tabs, {
          value: tab, onChange: setTab,
          tabs: [
            { value: 'all', label: 'Všetky' },
            { value: 'draft', label: 'Koncepty' },
            { value: 'issued', label: 'Vystavené' },
            { value: 'paid', label: 'Zaplatené' },
            { value: 'cancelled', label: 'Zrušené' },
          ]
        }),
        React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Číslo faktúry, klinika…', width: 280 })
      ),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        filtered.length === 0
          ? React.createElement(EmptyState, { title: 'Žiadne faktúry', description: search || tab !== 'all' ? 'Skúste upraviť vyhľadávanie alebo filter.' : 'Začnite vytvorením prvej faktúry.' })
          : React.createElement(DataTable, {
              onRowClick: setSelected,
              columns: [
                { key: 'number', label: 'Číslo', render: r => React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 600, color: '#0d7c6b' } }, r.number) },
                { key: 'clinic', label: 'Klinika', render: r => React.createElement('div', { style: { fontWeight: 500 } }, r.clinic) },
                { key: 'issued', label: 'Vystavené', width: 110 },
                { key: 'due', label: 'Splatnosť', width: 110, render: r => {
                    const overdue = r.status === 'issued' && r.raw && r.raw.due_date && new Date(r.raw.due_date) < new Date();
                    return React.createElement('span', { style: { color: overdue ? '#c0392b' : '#1a2320', fontWeight: overdue ? 600 : 400 } }, r.due);
                  }},
                { key: 'items', label: 'Položky', width: 70, align: 'center', render: r => r.items },
                { key: 'amount', label: 'Suma', width: 110, align: 'right', render: r =>
                    React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320' } }, fmt(r.amount))
                },
                { key: 'status', label: 'Stav', width: 110, render: r => React.createElement(InvoiceStatusBadge, { invoice: r }) },
                { key: 'actions', label: '', width: 110, align: 'right', render: r =>
                    React.createElement(InvoiceActions, { invoice: r, compact: true, onView: setSelected, onError: setActionError })
                },
              ],
              data: filtered,
            })
      )
    ),

    actionError && React.createElement(ErrorState, { title: 'Akcia zlyhala', message: actionError, onRetry: () => setActionError('') }),
    React.createElement(InvoiceDrawer, { invoice: selected, onClose: () => setSelected(null), onError: setActionError })
  );
}

function InvoiceDrawer({ invoice, onClose, onError }) {
  if (!invoice) return null;

  return React.createElement(Drawer, {
    open: !!invoice, onClose,
    width: 560,
    title: invoice.number,
    subtitle: `${invoice.clinic} · vystavené ${invoice.issued || '—'}`,
    footer: React.createElement(InvoiceActions, { invoice, onClose, onError })
  },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 18 } },
      React.createElement(InvoiceForm, { invoice }),
      React.createElement(InvoiceLineItems, { invoice }),
      React.createElement(InvoiceLifecycleGuide, { invoice }),
      React.createElement(InvoiceAuditTrail, { invoice })
    )
  );
}

Object.assign(window, { Invoices });
