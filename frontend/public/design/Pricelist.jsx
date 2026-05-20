// Pricelist.jsx — Molaris Price List (Cenník)

function Pricelist({ onNavigate, onCreate }) {
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const workspace = window.MolarisAPI.useWorkspace();
  const fallbackItems = [
    { id: 1,  code: 'KOR-ZIR',  name: 'Korunka zirkónová',          category: 'koruny',   unit: 'ks', price: 280.00, vat: 20 },
    { id: 2,  code: 'KOR-KER',  name: 'Korunka celokeramická',      category: 'koruny',   unit: 'ks', price: 240.00, vat: 20 },
    { id: 3,  code: 'KOR-KOV',  name: 'Korunka kovokeramická',      category: 'koruny',   unit: 'ks', price: 180.00, vat: 20 },
    { id: 4,  code: 'MOS-3Z',   name: 'Mostík 3-členný zirkón',     category: 'mostiky',  unit: 'ks', price: 540.00, vat: 20 },
    { id: 5,  code: 'MOS-4Z',   name: 'Mostík 4-členný zirkón',     category: 'mostiky',  unit: 'ks', price: 720.00, vat: 20 },
    { id: 6,  code: 'INL-KER',  name: 'Inlay keramický',            category: 'vyplne',   unit: 'ks', price: 210.00, vat: 20 },
    { id: 7,  code: 'PRO-CEL',  name: 'Celková snímateľná protéza', category: 'protezy',  unit: 'ks', price: 480.00, vat: 20 },
    { id: 8,  code: 'PRO-CIA',  name: 'Čiastočná snímateľná prot.', category: 'protezy',  unit: 'ks', price: 380.00, vat: 20 },
    { id: 9,  code: 'IMP-ABU',  name: 'Implantátový abutment',      category: 'implant',  unit: 'ks', price: 120.00, vat: 20 },
    { id: 10, code: 'IMP-KOR',  name: 'Korunka na implantát',       category: 'implant',  unit: 'ks', price: 320.00, vat: 20 },
  ];
  const items = workspace.priceList && workspace.priceList.length ? workspace.priceList : fallbackItems;
  const cats = { all: 'Všetky', koruny: 'Korunky', mostiky: 'Mostíky', vyplne: 'Výplne', protezy: 'Protézy', implant: 'Implantológia' };
  const filtered = items.filter(i => {
    const m = !search || [i.code, i.name].some(v => v.toLowerCase().includes(search.toLowerCase()));
    if (!m) return false;
    if (tab !== 'all' && i.category !== tab) return false;
    return true;
  });
  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: 'Cenník',
      subtitle: 'Konfigurácia cien dentálnych výkonov a platnosti cenníka.',
      breadcrumbs: [{ label: 'Financie', onClick: () => onNavigate('finance') }, { label: 'Cenník' }],
      actions: [
        React.createElement(Button, { key: 'imp', variant: 'outline' }, React.createElement(Icon, { name: 'upload', size: 14 }), 'Importovať CSV'),
        React.createElement(Button, { key: 'add', onClick: onCreate }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať položku'),
      ]
    }),

    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { padding: 14, borderBottom: '1px solid #f0ede5', display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement('div', { style: { width: 38, height: 38, borderRadius: 8, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
          React.createElement(Icon, { name: 'tag', size: 18 })
        ),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320', fontSize: 14 } }, 'Cenník 2025'),
          React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 2 } }, 'Platný od 1. 1. 2025 · ', items.length, ' položiek · DPH 20 %')
        ),
        React.createElement(Badge, { color: 'progress' }, 'Aktívny')
      )
    ),

    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' } },
        React.createElement(Tabs, {
          value: tab, onChange: setTab,
          tabs: Object.entries(cats).map(([v, l]) => ({ value: v, label: l }))
        }),
        React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Kód alebo názov…', width: 280 })
      ),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        filtered.length === 0
          ? React.createElement(EmptyState, { title: 'Žiadne položky' })
          : React.createElement(DataTable, {
              columns: [
                { key: 'code', label: 'Kód', width: 110, render: r => React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: '#0d7c6b', fontWeight: 600 } }, r.code) },
                { key: 'name', label: 'Názov výkonu', render: r => React.createElement('span', { style: { fontWeight: 500 } }, r.name) },
                { key: 'cat',  label: 'Kategória', width: 130, render: r => React.createElement('span', { style: { color: '#8a9490', textTransform: 'capitalize' } }, cats[r.category] || r.category) },
                { key: 'unit', label: 'MJ', width: 60, align: 'center', render: r => r.unit },
                { key: 'price',label: 'Cena bez DPH', width: 130, align: 'right', render: r => React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700 } }, fmt(r.price)) },
                { key: 'total',label: 'S DPH', width: 110, align: 'right', render: r => React.createElement('span', { style: { color: '#5a6b66' } }, fmt(r.price * 1.20)) },
                { key: 'actions', label: '', width: 80, align: 'right', render: () =>
                    React.createElement('div', { style: { display: 'flex', gap: 2, justifyContent: 'flex-end' } },
                      React.createElement(IconButton, { name: 'edit', title: 'Upraviť' }),
                      React.createElement(IconButton, { name: 'copy', title: 'Duplikovať' })
                    )
                }
              ],
              data: filtered
            })
      )
    )
  );
}

Object.assign(window, { Pricelist });
