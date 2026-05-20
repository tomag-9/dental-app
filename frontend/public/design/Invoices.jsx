// Invoices.jsx — Molaris Invoices (Faktúry)

function Invoices({ onNavigate, onCreate }) {
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const [selected, setSelected] = React.useState(null);
  const [actionError, setActionError] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();

  const fallbackInvoices = [
    { number: 'INV-2025-014', clinic: 'Klinika Bratislava', issued: '2. 5. 2025', due: '16. 5. 2025', amount: 1240.00, status: 'issued',  statusLabel: 'Vystavená', items: 4 },
    { number: 'INV-2025-013', clinic: 'ZubMed Košice',      issued: '30. 4. 2025', due: '14. 5. 2025', amount: 890.00,  status: 'issued',  statusLabel: 'Vystavená', items: 3 },
    { number: 'INV-2025-012', clinic: 'Klinika Bratislava', issued: '28. 4. 2025', due: '12. 5. 2025', amount: 1240.00, status: 'paid',    statusLabel: 'Zaplatená', items: 4 },
    { number: 'INV-2025-011', clinic: 'DentaPrima Žilina',  issued: '25. 4. 2025', due: '9. 5. 2025',  amount: 430.50,  status: 'paid',    statusLabel: 'Zaplatená', items: 2 },
    { number: 'INV-2025-010', clinic: 'DentaPrima Žilina',  issued: '20. 4. 2025', due: '4. 5. 2025',  amount: 720.00,  status: 'draft',   statusLabel: 'Koncept',   items: 3 },
    { number: 'INV-2025-009', clinic: 'ZubMed Košice',      issued: '18. 4. 2025', due: '2. 5. 2025',  amount: 2150.00, status: 'cancelled',statusLabel: 'Zrušená',  items: 6 },
    { number: 'INV-2025-008', clinic: 'Klinika Bratislava', issued: '12. 4. 2025', due: '26. 4. 2025', amount: 540.00,  status: 'paid',    statusLabel: 'Zaplatená', items: 2 },
  ];
  const invoices = workspace.invoices && workspace.invoices.length ? workspace.invoices : fallbackInvoices;

  const filtered = invoices.filter(i => {
    const q = search.toLowerCase();
    const m = !q || [i.number, i.clinic].some(v => v.toLowerCase().includes(q));
    if (!m) return false;
    if (tab !== 'all') return i.status === tab;
    return true;
  });

  const totals = {
    issued: invoices.filter(i => i.status === 'issued').reduce((s, i) => s + i.amount, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    draft: invoices.filter(i => i.status === 'draft').reduce((s, i) => s + i.amount, 0),
  };
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: 'Faktúry',
      subtitle: 'Správa a prehľad faktúr vystavených klinikám.',
      actions: [
        React.createElement(Button, { key: 'export', variant: 'outline' },
          React.createElement(Icon, { name: 'download', size: 14 }), 'Exportovať'),
        React.createElement(Button, { key: 'new', onClick: onCreate },
          React.createElement(Icon, { name: 'plus', size: 14 }), 'Nová faktúra'),
      ]
    }),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'Zaplatené (2025)', value: fmt(totals.paid), icon: 'checkCircle', tone: 'green', sub: '4 faktúry' }),
      React.createElement(StatCard, { label: 'Čaká na platbu',    value: fmt(totals.issued), icon: 'clock', tone: 'amber', sub: '2 vystavené' }),
      React.createElement(StatCard, { label: 'Koncepty',           value: fmt(totals.draft), icon: 'fileText', tone: 'teal', sub: '1 čaká odoslanie' }),
      React.createElement(StatCard, { label: 'Priemerná doba úhrady', value: '11 dní', icon: 'activity', tone: 'purple', delta: '-2 dni' }),
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
          ? React.createElement(EmptyState, { title: 'Žiadne faktúry', description: 'Skúste upraviť vyhľadávanie alebo filter.' })
          : React.createElement(DataTable, {
              onRowClick: setSelected,
              columns: [
                { key: 'number', label: 'Číslo', render: r => React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 600, color: '#0d7c6b' } }, r.number) },
                { key: 'clinic', label: 'Klinika', render: r => React.createElement('div', { style: { fontWeight: 500 } }, r.clinic) },
                { key: 'issued', label: 'Vystavené', width: 110 },
                { key: 'due', label: 'Splatnosť', width: 110, render: r => {
                    const overdue = r.status === 'issued' && r.due === '14. 5. 2025'; // synthetic
                    return React.createElement('span', { style: { color: overdue ? '#c0392b' : '#1a2320', fontWeight: overdue ? 600 : 400 } }, r.due);
                  }},
                { key: 'items', label: 'Položky', width: 70, align: 'center', render: r => r.items },
                { key: 'amount', label: 'Suma', width: 110, align: 'right', render: r =>
                    React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320' } }, fmt(r.amount))
                },
                { key: 'status', label: 'Stav', width: 110, render: r => React.createElement(Badge, { color: r.status }, r.statusLabel) },
                { key: 'actions', label: '', width: 110, align: 'right', render: r =>
                    React.createElement('div', { style: { display: 'flex', gap: 2, justifyContent: 'flex-end' }, onClick: e => e.stopPropagation() },
                      React.createElement(IconButton, { name: 'eye', title: 'Detail', onClick: () => setSelected(r) }),
                      React.createElement(IconButton, { name: 'download', title: 'Stiahnuť PDF', onClick: async () => {
                        try { if (r.id) await window.MolarisAPI.downloadInvoicePdf(r.id, `${r.number}.pdf`); }
                        catch (err) { setActionError('PDF sa nepodarilo stiahnuť.'); }
                      } }),
                      React.createElement(IconButton, { name: 'send', title: 'Odoslať', onClick: async () => {
                        try { if (r.id) await window.MolarisAPI.updateInvoiceStatus(r.id, 'issued'); }
                        catch (err) { setActionError((err && err.data && JSON.stringify(err.data)) || 'Faktúru sa nepodarilo označiť ako vystavenú.'); }
                      } }),
                    )
                },
              ],
              data: filtered,
            })
      )
    ),

    actionError && React.createElement(ErrorState, { title: 'Akcia zlyhala', message: actionError, onRetry: () => setActionError('') }),
    React.createElement(InvoiceDrawer, { invoice: selected, onClose: () => setSelected(null) })
  );
}

function InvoiceDrawer({ invoice, onClose }) {
  if (!invoice) return null;
  const fallbackLineItems = [
    { name: 'Korunka zirkónová', qty: 1, unit: 280.00, total: 280.00 },
    { name: 'Mostík 3-členný',   qty: 1, unit: 540.00, total: 540.00 },
    { name: 'Inlay keramický',   qty: 2, unit: 210.00, total: 420.00 },
  ];
  const lineItems = invoice.lineItems && invoice.lineItems.length ? invoice.lineItems : fallbackLineItems;
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const subtotal = lineItems.reduce((s, l) => s + l.total, 0);
  const vat = subtotal * 0.20;

  return React.createElement(Drawer, {
    open: !!invoice, onClose,
    width: 560,
    title: invoice.number,
    subtitle: `${invoice.clinic} · vystavené ${invoice.issued}`,
    footer: [
      React.createElement(Button, { key: 'c', variant: 'outline', onClick: onClose }, 'Zatvoriť'),
      React.createElement(Button, { key: 'p', variant: 'outline', onClick: () => invoice.id && window.MolarisAPI.downloadInvoicePdf(invoice.id, `${invoice.number}.pdf`) },
        React.createElement(Icon, { name: 'printer', size: 14 }), 'Tlač'),
      React.createElement(Button, { key: 's', onClick: async () => invoice.id && window.MolarisAPI.updateInvoiceStatus(invoice.id, 'issued') },
        React.createElement(Icon, { name: 'send', size: 14 }), 'Odoslať klinike'),
    ]
  },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 18 } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(InfoCell, { label: 'Stav',        value: React.createElement(Badge, { color: invoice.status }, invoice.statusLabel) }),
        React.createElement(InfoCell, { label: 'Splatnosť',   value: invoice.due }),
        React.createElement(InfoCell, { label: 'Suma celkom', value: React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fontSize: 16 } }, fmt(invoice.amount)) }),
        React.createElement(InfoCell, { label: 'Položky',     value: `${invoice.items}` }),
      ),
      React.createElement('div', null,
        React.createElement('h3', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320', margin: '0 0 8px', letterSpacing: '-0.01em' } }, 'Položky faktúry'),
        React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden', background: '#fff' } },
          ...lineItems.map((l, i) => React.createElement('div', {
            key: i,
            style: { display: 'grid', gridTemplateColumns: '1fr 50px 90px 90px', padding: '10px 14px', fontSize: 12.5, borderTop: i === 0 ? 'none' : '1px solid #f0ede5', alignItems: 'center' }
          },
            React.createElement('span', { style: { fontWeight: 500 } }, l.name),
            React.createElement('span', { style: { textAlign: 'center', color: '#8a9490' } }, l.qty + '×'),
            React.createElement('span', { style: { textAlign: 'right', color: '#8a9490' } }, fmt(l.unit)),
            React.createElement('span', { style: { textAlign: 'right', fontWeight: 600, fontFamily: 'Plus Jakarta Sans,sans-serif' } }, fmt(l.total)),
          )),
          React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderTop: '1px solid #f0ede5', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', color: '#5a6b66' } },
              React.createElement('span', null, 'Medzisúčet'), React.createElement('span', null, fmt(subtotal))
            ),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', color: '#5a6b66' } },
              React.createElement('span', null, 'DPH 20 %'), React.createElement('span', null, fmt(vat))
            ),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320', fontSize: 14, marginTop: 2 } },
              React.createElement('span', null, 'Celkom'), React.createElement('span', null, fmt(subtotal + vat))
            )
          )
        )
      ),
      React.createElement(Section, { title: 'Súvisiace práce' },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          ...['#12 Mária Kováčová', '#11 Peter Horváth', '#10 Jana Blahová'].map(j =>
            React.createElement('a', {
              key: j, href: '#', onClick: e => e.preventDefault(),
              style: { fontSize: 12.5, color: '#0d7c6b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px dashed #ece7dc' }
            }, React.createElement(Icon, { name: 'briefcase', size: 13 }), j,
               React.createElement(Icon, { name: 'arrowRight', size: 12, style: { marginLeft: 'auto' } })
            )
          )
        )
      )
    )
  );
}

function InfoCell({ label, value }) {
  return React.createElement('div', { style: { padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #ece7dc' } },
    React.createElement('div', { style: { fontSize: 10.5, fontWeight: 600, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 } }, label),
    React.createElement('div', { style: { fontSize: 13, color: '#1a2320', fontWeight: 500 } }, value)
  );
}

Object.assign(window, { Invoices });
