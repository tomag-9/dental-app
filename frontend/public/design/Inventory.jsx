// Inventory.jsx — Molaris Inventory (Sklad)

function Inventory({ onNavigate, onCreate }) {
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const workspace = window.MolarisAPI.useWorkspace();

  const fallbackItems = [
    { id: 1, code: 'KER-001', name: 'Keramická hmota IPS e.max', category: 'Keramika', unit: 'g',  stock: 420, min: 200, price: 0.85, supplier: 'Ivoclar' },
    { id: 2, code: 'ZIR-014', name: 'Zirkónový blok 98×16 mm',   category: 'Zirkón',   unit: 'ks', stock: 12,  min: 6,   price: 78.00, supplier: 'Zirkonzahn' },
    { id: 3, code: 'KOV-007', name: 'Kovová zliatina CoCr',      category: 'Kov',      unit: 'g',  stock: 1850,min: 500, price: 0.42, supplier: 'BEGO' },
    { id: 4, code: 'AKR-022', name: 'Akrylátový prášok ružový',  category: 'Akrylát',  unit: 'g',  stock: 88,  min: 100, price: 0.18, supplier: 'GC Europe' },
    { id: 5, code: 'VOS-003', name: 'Modelovací vosk tvrdý',     category: 'Vosk',     unit: 'g',  stock: 540, min: 200, price: 0.12, supplier: 'Yeti' },
    { id: 6, code: 'IMP-018', name: 'Implantát Straumann RC',    category: 'Implantát',unit: 'ks', stock: 4,   min: 8,   price: 145.00,supplier: 'Straumann' },
    { id: 7, code: 'ABU-009', name: 'Abutment titánový',         category: 'Implantát',unit: 'ks', stock: 22,  min: 10,  price: 64.00, supplier: 'Straumann' },
    { id: 8, code: 'SAD-004', name: 'Sadra modrá tvrdá',         category: 'Sadra',    unit: 'kg', stock: 0,   min: 5,   price: 4.20,  supplier: 'Picodent' },
  ];
  const items = workspace.warehouse && workspace.warehouse.length ? workspace.warehouse : fallbackItems;

  const stockState = (it) => {
    if (it.stock === 0) return { label: 'Vypredané', color: 'cancelled' };
    if (it.stock < it.min) return { label: 'Nízky stav', color: 'new' };
    return { label: 'Skladom', color: 'done' };
  };

  const filtered = items.filter(it => {
    const q = search.toLowerCase();
    const matchSearch = !q || [it.name, it.code, it.category, it.supplier].some(v => v.toLowerCase().includes(q));
    if (!matchSearch) return false;
    if (tab === 'low') return it.stock > 0 && it.stock < it.min;
    if (tab === 'out') return it.stock === 0;
    return true;
  });

  const totalValue = items.reduce((s, it) => s + it.stock * it.price, 0);
  const lowCount = items.filter(it => it.stock > 0 && it.stock < it.min).length;
  const outCount = items.filter(it => it.stock === 0).length;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: 'Sklad',
      subtitle: 'Správa skladových zásob a dentálnych materiálov.',
      actions: [
        React.createElement(Button, { key: 'import', variant: 'outline' },
          React.createElement(Icon, { name: 'upload', size: 14 }), 'Importovať'),
        React.createElement(Button, { key: 'add', onClick: onCreate },
          React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať položku'),
      ]
    }),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'Celkom položiek', value: String(items.length), icon: 'package', tone: 'teal' }),
      React.createElement(StatCard, { label: 'Hodnota skladu',   value: totalValue.toFixed(2).replace('.', ',') + ' €', icon: 'euro', tone: 'green' }),
      React.createElement(StatCard, { label: 'Nízky stav',        value: String(lowCount), icon: 'alertTriangle', tone: 'amber' }),
      React.createElement(StatCard, { label: 'Vypredané',         value: String(outCount), icon: 'archive', tone: 'red' }),
    ),

    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
        React.createElement(Tabs, {
          value: tab, onChange: setTab,
          tabs: [
            { value: 'all', label: `Všetky (${items.length})` },
            { value: 'low', label: `Nízky stav (${lowCount})` },
            { value: 'out', label: `Vypredané (${outCount})` },
          ]
        }),
        React.createElement(SearchInput, {
          value: search, onChange: setSearch, placeholder: 'Kód, názov, dodávateľ…', width: 260
        })
      ),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        filtered.length === 0
          ? React.createElement(EmptyState, { title: 'Žiadne položky', description: 'Skúste upraviť vyhľadávanie alebo filter.' })
          : React.createElement(DataTable, {
              columns: [
                { key: 'code', label: 'Kód', width: 100, render: r => React.createElement('span', { style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, color: '#5a6b66' } }, r.code) },
                { key: 'name', label: 'Názov', render: r => React.createElement('div', null,
                    React.createElement('div', { style: { fontWeight: 600, color: '#1a2320' } }, r.name),
                    React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, r.category)
                  )},
                { key: 'stock', label: 'Stav', width: 130, render: r => {
                    const ratio = Math.min(1, r.stock / Math.max(r.min * 2, 1));
                    const barColor = r.stock === 0 ? '#c0392b' : r.stock < r.min ? '#d97706' : '#0d7c6b';
                    return React.createElement('div', null,
                      React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: '#1a2320' } }, `${r.stock} ${r.unit}`),
                      React.createElement('div', { style: { fontSize: 10.5, color: '#8a9490', marginBottom: 4 } }, `Min: ${r.min} ${r.unit}`),
                      React.createElement('div', { style: { height: 4, background: '#eeecea', borderRadius: 2, overflow: 'hidden' } },
                        React.createElement('div', { style: { width: `${ratio * 100}%`, height: '100%', background: barColor, transition: 'width .3s' } })
                      )
                    );
                  }},
                { key: 'price', label: 'Cena/j.', width: 90, align: 'right', render: r => `${r.price.toFixed(2).replace('.', ',')} €` },
                { key: 'supplier', label: 'Dodávateľ', width: 130, render: r => r.supplier },
                { key: 'status', label: 'Stav', width: 110, render: r => {
                    const s = stockState(r);
                    return React.createElement(Badge, { color: s.color }, s.label);
                  }},
                { key: 'actions', label: '', width: 80, align: 'right', render: r =>
                    React.createElement('div', { style: { display: 'flex', gap: 2, justifyContent: 'flex-end' } },
                      React.createElement(IconButton, { name: 'edit', title: 'Upraviť' }),
                      React.createElement(IconButton, { name: 'trash', title: 'Zmazať', destructive: true })
                    )
                },
              ],
              data: filtered,
            })
      )
    )
  );
}

Object.assign(window, { Inventory });
