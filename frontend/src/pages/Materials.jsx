// Materials.jsx — Molaris LOT/MDR traceability, connected to /api/v1/materials/.

const MAT_COLORS = { ink: '#1a2320', muted: '#8a9490', teal: '#0d7c6b', tealDark: '#085c4e', line: '#e4ded4', paper: '#fbfaf6' };
const LOT_STATUS = {
  active: { label: 'Aktívna', color: 'progress', dot: '#0d7c6b' },
  open: { label: 'Otvorená', color: 'new', dot: '#d97706' },
  depleted: { label: 'Spotrebovaná', color: 'draft', dot: '#8a9490' },
  discarded: { label: 'Vyradená', color: 'cancelled', dot: '#c0392b' },
};
const PRODUCT_TYPES = [
  { value: 'single', label: 'Korunka (single)' },
  { value: 'bridge', label: 'Mostík' },
  { value: 'arch', label: 'Celá čeľusť' },
  { value: 'other', label: 'Iné' },
];
const CATEGORY_OPTIONS = [
  { value: 'keramika', label: 'Keramika' }, { value: 'zirkon', label: 'Zirkón' },
  { value: 'kov', label: 'Kov' }, { value: 'implant', label: 'Implantológia' },
  { value: 'pomocny', label: 'Pomocný materiál' }, { value: 'ine', label: 'Iné' },
];

function matNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toLocaleString('sk-SK', { maximumFractionDigits: 3 });
}
function matDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString('sk-SK') : '—'; }
function expiryMeta(lot) {
  const key = lot.expiry_state || (!lot.expiry ? 'none' : ((new Date(lot.expiry) - new Date()) / 86400000 < 0 ? 'expired' : 'ok'));
  const days = lot.expiry ? Math.ceil((new Date(`${lot.expiry}T23:59:59`) - new Date()) / 86400000) : null;
  if (key === 'expired') return { key, color: '#c0392b', label: 'Po expirácii', days };
  if (key === 'soon') return { key, color: '#d97706', label: `Expiruje o ${Math.max(days, 0)} dní`, days };
  if (key === 'none') return { key, color: '#8a9490', label: 'Bez expirácie', days };
  return { key: 'ok', color: '#16a34a', label: 'Platná', days };
}
function apiMessage(error) {
  if (!error) return 'Neznáma chyba.';
  const data = error.data;
  if (data && typeof data === 'object') {
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === 'string') return first;
  }
  return error.message || String(error);
}

function Materials() {
  const [page, setPage] = React.useState('lots');
  const [data, setData] = React.useState({ lots: [], catalog: [], manufacturers: [], recipes: [], usage: [], jobs: [] });
  const [state, setState] = React.useState('loading');
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState(null);

  const load = React.useCallback(async () => {
    setState('loading'); setError('');
    try {
      const api = window.MolarisAPI.materials;
      const [manufacturers, catalog, lots, recipes, usage, jobs] = await Promise.all([
        api.manufacturers.list(), api.catalog.list(), api.lots.list(), api.recipes.list(), api.fetchUsage(),
        window.MolarisAPI.fetchJobs ? window.MolarisAPI.fetchJobs().catch(() => []) : Promise.resolve([]),
      ]);
      setData({ manufacturers, catalog, lots, recipes, usage, jobs });
      setState('ready');
    } catch (e) { setError(apiMessage(e)); setState(e.status === 403 ? 'permission' : 'error'); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const mutate = async (work, message) => {
    try { await work(); setNotice({ tone: 'success', text: message }); await load(); return true; }
    catch (e) { setNotice({ tone: 'error', text: apiMessage(e) }); return false; }
  };
  const activeLots = data.lots.filter(l => ['active', 'open'].includes(l.status));
  const expSoon = data.lots.filter(l => expiryMeta(l).key === 'soon' && !['discarded', 'depleted'].includes(l.status)).length;
  const expired = data.lots.filter(l => expiryMeta(l).key === 'expired' && l.status !== 'discarded').length;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 22 } },
    React.createElement(PageHeader, {
      title: 'Materiály',
      subtitle: 'Dohľadateľnosť materiálov a šarží (LOT) podľa MDR — katalóg, výrobcovia, recepty a použitie na zákazkách.',
    }),
    notice && React.createElement('div', {
      role: 'status', style: { display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 9,
        background: notice.tone === 'error' ? '#fde8e6' : '#eef7f4', border: `1px solid ${notice.tone === 'error' ? '#f5c0bb' : '#b0ddd5'}`,
        color: notice.tone === 'error' ? '#991b1b' : '#085c4e', fontSize: 12.5 },
    }, React.createElement(Icon, { name: notice.tone === 'error' ? 'alertTriangle' : 'checkCircle', size: 15 }), notice.text,
      React.createElement('button', { onClick: () => setNotice(null), 'aria-label': 'Zavrieť', style: { marginLeft: 'auto', border: 0, background: 'none', cursor: 'pointer', color: 'inherit' } }, React.createElement(Icon, { name: 'x', size: 14 }))),
    state !== 'ready'
      ? React.createElement(ScreenStatePanel, { state, title: 'Materiály sa nepodarilo načítať', description: 'Na túto časť nemáte oprávnenie.', error, onRetry: load })
      : React.createElement(React.Fragment, null,
          (expired > 0 || expSoon > 0) && React.createElement('div', {
            style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: expired ? '#fde8e6' : '#fef3c7', border: `1px solid ${expired ? '#f5c0bb' : '#fde68a'}` }
          }, React.createElement(Icon, { name: 'alertTriangle', size: 18, color: expired ? '#c0392b' : '#d97706' }),
            React.createElement('div', { style: { flex: 1, fontSize: 12.5 } },
              expired > 0 && React.createElement('strong', { style: { color: '#c0392b' } }, `${expired} šarží po expirácii. `),
              expSoon > 0 && `${expSoon} šarží expiruje do 60 dní (FEFO priorita).`),
            React.createElement(Button, { size: 'sm', variant: 'outline', onClick: () => setPage('lots') }, 'Zobraziť šarže')),
          React.createElement('div', { className: 'stat-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
            React.createElement(StatCard, { label: 'Aktívne šarže', value: String(activeLots.length), icon: 'layers', tone: 'teal' }),
            React.createElement(StatCard, { label: 'Materiály v katalógu', value: String(data.catalog.length), icon: 'package', tone: 'blue' }),
            React.createElement(StatCard, { label: 'Expiruje do 60 dní', value: String(expSoon), icon: 'clock', tone: 'amber' }),
            React.createElement(StatCard, { label: 'Po expirácii', value: String(expired), icon: 'alertTriangle', tone: 'red' })),
          React.createElement(Tabs, { value: page, onChange: setPage, tabs: [
            { value: 'lots', label: `Šarže (${data.lots.length})` }, { value: 'catalog', label: 'Katalóg' },
            { value: 'manufacturers', label: 'Výrobcovia' }, { value: 'recipes', label: 'Recepty' },
            { value: 'usage', label: 'Použitie & MDR' },
          ] }),
          page === 'lots' && React.createElement(LotsPage, { data, mutate }),
          page === 'catalog' && React.createElement(CatalogPage, { data, mutate }),
          page === 'manufacturers' && React.createElement(ManufacturersPage, { data, mutate }),
          page === 'recipes' && React.createElement(RecipesPage, { data, mutate }),
          page === 'usage' && React.createElement(UsagePage, { data, setNotice })
        )
  );
}

function ExpiryPill({ lot }) {
  const ex = expiryMeta(lot);
  return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: ex.color } },
    React.createElement(Icon, { name: ex.key === 'expired' ? 'alertTriangle' : 'clock', size: 12 }), lot.expiry ? matDate(lot.expiry) : 'Bez expirácie',
    ex.key === 'soon' && React.createElement('span', { style: { fontSize: 10.5 } }, `· ${Math.max(ex.days, 0)} d`));
}
function MatViewToggle({ view, onChange }) {
  const button = (value, icon, title) => React.createElement('button', { key: value, title, onClick: () => onChange(value),
    style: { width: 32, height: 32, border: 0, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: view === value ? '#fff' : 'transparent', color: view === value ? MAT_COLORS.teal : MAT_COLORS.muted, boxShadow: view === value ? '0 1px 2px rgba(0,0,0,.06)' : 'none' }
  }, React.createElement(Icon, { name: icon, size: 15 }));
  return React.createElement('div', { style: { display: 'inline-flex', padding: 3, gap: 2, borderRadius: 8, background: '#f0ede5' } }, button('cards', 'dashboard', 'Karty'), button('table', 'menu', 'Tabuľka'));
}

function LotsPage({ data, mutate }) {
  const [search, setSearch] = React.useState(''); const [statusTab, setStatusTab] = React.useState('all'); const [view, setView] = React.useState('cards');
  const [detail, setDetail] = React.useState(null); const [edit, setEdit] = React.useState(null); const [discard, setDiscard] = React.useState(null);
  const [label, setLabel] = React.useState(null); const [conformity, setConformity] = React.useState(null); const [fefo, setFefo] = React.useState(false);
  const counts = {
    all: data.lots.length, active: data.lots.filter(l => l.status === 'active').length, open: data.lots.filter(l => l.status === 'open').length,
    expiring: data.lots.filter(l => ['soon', 'expired'].includes(expiryMeta(l).key) && !['discarded', 'depleted'].includes(l.status)).length,
    archived: data.lots.filter(l => ['discarded', 'depleted'].includes(l.status)).length,
  };
  const filtered = data.lots.filter(l => {
    const catalog = l.catalog_details || data.catalog.find(c => c.id === l.catalog);
    const q = search.toLowerCase();
    if (q && ![l.lot, l.short_code, catalog?.name, catalog?.code, catalog?.manufacturer_name].some(v => String(v || '').toLowerCase().includes(q))) return false;
    if (statusTab === 'expiring') return ['soon', 'expired'].includes(expiryMeta(l).key) && !['discarded', 'depleted'].includes(l.status);
    if (statusTab === 'archived') return ['discarded', 'depleted'].includes(l.status);
    return statusTab === 'all' || l.status === statusTab;
  });
  const removeLot = () => mutate(() => window.MolarisAPI.materials.lots.update(discard.id, { status: 'discarded' }), `Šarža ${discard.lot} bola vyradená`).then(ok => { if (ok) { setDiscard(null); setDetail(null); } });
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
      React.createElement(Tabs, { value: statusTab, onChange: setStatusTab, tabs: [
        { value: 'all', label: `Všetky (${counts.all})` }, { value: 'active', label: `Aktívne (${counts.active})` },
        { value: 'open', label: `Otvorené (${counts.open})` }, { value: 'expiring', label: `Expirujúce (${counts.expiring})` },
        { value: 'archived', label: `Archív (${counts.archived})` },
      ] }),
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
        React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'LOT, kód, materiál…', width: 220 }),
        React.createElement(MatViewToggle, { view, onChange: setView }),
        React.createElement(Button, { variant: 'outline', onClick: () => setFefo(true) }, React.createElement(Icon, { name: 'briefcase', size: 14 }), 'Priradiť na zákazku'),
        React.createElement(Button, { onClick: () => setEdit({}) }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Príjem šarže'))),
    filtered.length === 0 ? React.createElement(Card, null, React.createElement(CardContent, { style: { paddingTop: 20 } }, React.createElement(EmptyState, { title: 'Žiadne šarže', description: 'Upravte filter alebo prijmite novú šaržu.' }))) :
      view === 'cards' ? React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 } },
        ...filtered.map(l => React.createElement(LotCard, { key: l.id, lot: l, catalog: l.catalog_details || data.catalog.find(c => c.id === l.catalog), onClick: () => setDetail(l), onLabel: () => setLabel(l) }))) :
        React.createElement(Card, null, React.createElement(CardContent, { style: { paddingTop: 20 } }, React.createElement(LotsTable, { lots: filtered, catalog: data.catalog, onRow: setDetail, onLabel: setLabel }))),
    React.createElement(LotDetailDrawer, { lot: detail, usage: data.usage, catalog: data.catalog, onClose: () => setDetail(null), onEdit: l => { setDetail(null); setEdit(l); }, onDiscard: setDiscard, onLabel: setLabel, onConformity: setConformity }),
    React.createElement(LotFormDrawer, { lot: edit, catalog: data.catalog, onClose: () => setEdit(null), onSave: payload => mutate(() => edit.id ? window.MolarisAPI.materials.lots.update(edit.id, payload) : window.MolarisAPI.materials.lots.create(payload), edit.id ? `Šarža ${payload.lot} bola upravená` : `Šarža ${payload.lot} bola naskladnená`).then(ok => ok && setEdit(null)) }),
    React.createElement(LotLabelModal, { lot: label, catalog: data.catalog, onClose: () => setLabel(null) }),
    React.createElement(ConformityModal, { lot: conformity, onClose: () => setConformity(null) }),
    React.createElement(FefoDrawer, { open: fefo, data, onClose: () => setFefo(false), mutate }),
    React.createElement(ConfirmDialog, { open: !!discard, title: 'Vyradiť šaržu', message: discard ? `Naozaj vyradiť šaržu ${discard.lot}? Nebude dostupná pre nové zákazky.` : '', confirmText: 'Vyradiť', destructive: true, onConfirm: removeLot, onCancel: () => setDiscard(null) })
  );
}

function LotCard({ lot, catalog, onClick, onLabel }) {
  const status = LOT_STATUS[lot.status] || LOT_STATUS.active; const percent = Number(lot.qty_received) ? Math.round(Number(lot.qty_remaining) / Number(lot.qty_received) * 100) : 0;
  return React.createElement('div', { onClick, tabIndex: 0, onKeyDown: e => (e.key === 'Enter' || e.key === ' ') && onClick(),
    style: { background: '#fff', border: `1px solid ${MAT_COLORS.line}`, borderLeft: `3px solid ${status.dot}`, borderRadius: 12, padding: 15, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow .12s, transform .12s' },
    onMouseEnter: e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(26,35,32,.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; },
    onMouseLeave: e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 } },
      React.createElement('div', { style: { minWidth: 0 } }, React.createElement('div', { style: { fontSize: 13.5, fontWeight: 700 } }, catalog?.name || '—'), React.createElement('div', { style: { fontSize: 11, color: MAT_COLORS.muted, marginTop: 2 } }, catalog?.manufacturer_name || '—')),
      React.createElement(Badge, { color: status.color }, status.label)),
    React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
      React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 12, fontWeight: 700, color: MAT_COLORS.teal, background: '#eef7f4', padding: '2px 8px', borderRadius: 5 } }, `LOT ${lot.lot}`),
      React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11, color: MAT_COLORS.muted } }, lot.short_code),
      catalog?.mdr_class && React.createElement(Badge, { color: 'progress' }, `MDR ${catalog.mdr_class}`)),
    React.createElement('div', null,
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 } }, React.createElement('span', { style: { color: '#5a6b66' } }, 'Zostatok'), React.createElement('strong', null, `${matNumber(lot.qty_remaining)} / ${matNumber(lot.qty_received)} ${catalog?.unit || ''}`)),
      React.createElement('div', { style: { height: 5, background: '#eeecea', borderRadius: 3, overflow: 'hidden' } }, React.createElement('div', { style: { width: `${percent}%`, height: '100%', background: percent < 20 ? '#c0392b' : percent < 50 ? '#d97706' : MAT_COLORS.teal } }))),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0ede5', paddingTop: 9 } }, React.createElement(ExpiryPill, { lot }),
      React.createElement('button', { onClick: e => { e.stopPropagation(); onLabel(); }, style: { border: 0, background: 'none', color: '#5a6b66', cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', font: '600 11.5px Manrope' } }, React.createElement(Icon, { name: 'printer', size: 13 }), 'Štítok')));
}

function LotsTable({ lots, catalog, onRow, onLabel }) {
  return React.createElement(DataTable, { data: lots, onRowClick: onRow, columns: [
    { key: 'lot', label: 'LOT / kód', width: 150, render: l => React.createElement('div', null, React.createElement('div', { style: { fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: MAT_COLORS.teal } }, l.lot), React.createElement('div', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 10.5, color: MAT_COLORS.muted } }, l.short_code)) },
    { key: 'name', label: 'Materiál', render: l => { const c = l.catalog_details || catalog.find(x => x.id === l.catalog); return React.createElement('div', null, React.createElement('strong', null, c?.name || '—'), React.createElement('div', { style: { fontSize: 11, color: MAT_COLORS.muted } }, c?.manufacturer_name || '—')); } },
    { key: 'qty', label: 'Zostatok', width: 120, render: l => `${matNumber(l.qty_remaining)} / ${matNumber(l.qty_received)} ${l.catalog_details?.unit || ''}` },
    { key: 'expiry', label: 'Expirácia', width: 150, render: l => React.createElement(ExpiryPill, { lot: l }) },
    { key: 'status', label: 'Stav', width: 120, render: l => React.createElement(Badge, { color: (LOT_STATUS[l.status] || LOT_STATUS.active).color }, (LOT_STATUS[l.status] || LOT_STATUS.active).label) },
    { key: 'action', label: '', width: 50, align: 'right', render: l => React.createElement('div', { onClick: e => e.stopPropagation() }, React.createElement(IconButton, { name: 'printer', title: 'Štítok', onClick: () => onLabel(l) })) },
  ] });
}

function LotDetailDrawer({ lot, usage, catalog, onClose, onEdit, onDiscard, onLabel, onConformity }) {
  if (!lot) return null; const c = lot.catalog_details || catalog.find(x => x.id === lot.catalog); const status = LOT_STATUS[lot.status] || LOT_STATUS.active; const ex = expiryMeta(lot);
  const used = usage.filter(u => (u.lines || []).some(line => Number(line.source_lot_id) === Number(lot.id)));
  return React.createElement(Drawer, { open: true, onClose, width: 540, title: c?.name || 'Šarža', subtitle: `${lot.short_code} · LOT ${lot.lot}`, footer: [
    React.createElement(Button, { key: 'discard', variant: 'destructive', disabled: lot.status === 'discarded', onClick: () => onDiscard(lot) }, React.createElement(Icon, { name: 'archive', size: 13 }), 'Vyradiť'),
    React.createElement('div', { key: 'space', style: { flex: 1 } }), React.createElement(Button, { key: 'label', variant: 'outline', onClick: () => onLabel(lot) }, React.createElement(Icon, { name: 'printer', size: 13 }), 'Štítok'),
    React.createElement(Button, { key: 'edit', onClick: () => onEdit(lot) }, React.createElement(Icon, { name: 'edit', size: 13 }), 'Upraviť'),
  ] }, React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, React.createElement(Badge, { color: status.color }, status.label), c?.mdr_class && React.createElement(Badge, { color: 'progress' }, `MDR ${c.mdr_class}`), React.createElement(Badge, { color: 'outline' }, c?.mode === 'single' ? 'Jednorázová' : 'Opakované použitie')),
    React.createElement('div', { style: { padding: '12px 14px', borderRadius: 10, background: MAT_COLORS.paper, border: '1px solid #ece7dc' } }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 } }, React.createElement('span', { style: { fontSize: 12, color: '#5a6b66' } }, 'Zostatok šarže'), React.createElement('strong', null, `${matNumber(lot.qty_remaining)} / ${matNumber(lot.qty_received)} ${c?.unit || ''}`))),
    React.createElement('div', { style: { display: 'flex', gap: 9, padding: '10px 12px', borderRadius: 9, alignItems: 'center', background: ex.key === 'expired' ? '#fde8e6' : ex.key === 'soon' ? '#fef3c7' : '#eef7f4', border: `1px solid ${ex.key === 'expired' ? '#f5c0bb' : ex.key === 'soon' ? '#fde68a' : '#b0ddd5'}` } }, React.createElement(Icon, { name: ex.key === 'expired' ? 'alertTriangle' : 'clock', size: 15, color: ex.color }), React.createElement('span', { style: { fontSize: 12.5 } }, ex.key === 'expired' ? `Šarža je po expirácii (${matDate(lot.expiry)}) — nesmie sa použiť do zákazky.` : ex.key === 'soon' ? `Šarža expiruje ${matDate(lot.expiry)} — FEFO priorita.` : ex.key === 'none' ? 'Materiál bez dátumu expirácie.' : `Platná do ${matDate(lot.expiry)}.`)),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
      React.createElement(MatInfoCell, { label: 'Výrobca', value: c?.manufacturer_name || '—' }), React.createElement(MatInfoCell, { label: 'Kód materiálu', value: c?.code || '—', mono: true }),
      React.createElement(MatInfoCell, { label: 'Prijaté', value: matDate(lot.received) }), React.createElement(MatInfoCell, { label: 'Otvorené', value: lot.opened ? matDate(lot.opened) : 'Neotvorené' }),
      React.createElement(MatInfoCell, { label: 'Expirácia', value: lot.expiry ? matDate(lot.expiry) : 'Bez expirácie' }), React.createElement(MatInfoCell, { label: 'Umiestnenie', value: lot.location || '—' })),
    c?.stock_code && React.createElement('div', { style: { display: 'flex', gap: 9, padding: '10px 12px', borderRadius: 9, border: '1px dashed #b0ddd5', alignItems: 'center' } }, React.createElement(Icon, { name: 'package', size: 15, color: MAT_COLORS.teal }), React.createElement('span', { style: { fontSize: 12.5, color: '#5a6b66' } }, 'Prepojené so skladovou kartou'), React.createElement('strong', { style: { fontFamily: 'ui-monospace,monospace', color: MAT_COLORS.teal } }, c.stock_code)),
    React.createElement(Button, { variant: 'outline', onClick: () => onConformity(lot) }, React.createElement(Icon, { name: 'fileText', size: 13 }), 'Prehlásenie o zhode'),
    React.createElement('div', null, React.createElement('strong', { style: { fontSize: 12.5 } }, `Použité v zákazkách (${used.length})`), used.length === 0 ? React.createElement('p', { style: { fontSize: 12, color: MAT_COLORS.muted } }, 'Táto šarža zatiaľ nebola použitá v žiadnej zákazke.') : used.map(u => React.createElement('div', { key: u.id, style: { marginTop: 8, padding: '9px 11px', border: '1px solid #ece7dc', borderRadius: 8, fontSize: 12.5 } }, `Práca #${u.job} · ${u.patient_label}`, React.createElement('div', { style: { color: MAT_COLORS.muted, fontSize: 11 } }, `${matDate(u.date)} · ${u.technician || '—'}`))))
  ));
}
function MatInfoCell({ label, value, mono }) { return React.createElement('div', { style: { padding: '9px 11px', borderRadius: 8, background: MAT_COLORS.paper, border: '1px solid #ece7dc' } }, React.createElement('div', { style: { fontSize: 10, fontWeight: 700, color: MAT_COLORS.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 } }, label), React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, fontFamily: mono ? 'ui-monospace,monospace' : 'Manrope' } }, value)); }

function LotFormDrawer({ lot, catalog, onClose, onSave }) {
  const blank = { catalog: catalog[0]?.id || '', short_code: `Š-${String(Date.now()).slice(-4)}`, lot: '', received: new Date().toISOString().slice(0, 10), expiry: '', opened: '', qty_received: 1, qty_remaining: 1, location: '', status: 'active' };
  const [form, setForm] = React.useState(blank); React.useEffect(() => { if (lot) setForm({ ...blank, ...lot, catalog: lot.catalog || lot.catalog_details?.id, expiry: lot.expiry || '', opened: lot.opened || '' }); }, [lot]);
  if (!lot) return null; const set = (key, value) => setForm(current => ({ ...current, [key]: value })); const c = catalog.find(x => Number(x.id) === Number(form.catalog));
  const submit = () => onSave({ ...form, catalog: Number(form.catalog), qty_received: Number(form.qty_received), qty_remaining: lot.id ? Number(form.qty_remaining) : Number(form.qty_received), expiry: form.expiry || null, opened: form.opened || null });
  return React.createElement(Drawer, { open: true, onClose, width: 500, title: lot.id ? 'Upraviť šaržu' : 'Príjem šarže (LOT)', subtitle: lot.id ? lot.short_code : 'Nová skladová šarža s dohľadateľnosťou', footer: [React.createElement(Button, { key: 'cancel', variant: 'outline', onClick: onClose }, 'Zrušiť'), React.createElement(Button, { key: 'save', disabled: !form.catalog || !form.lot.trim() || Number(form.qty_received) <= 0, onClick: submit }, lot.id ? 'Uložiť' : 'Naskladniť šaržu')] },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      React.createElement(FormField, { label: 'Materiál (z katalógu)', type: 'select', value: form.catalog, onChange: e => set('catalog', e.target.value), options: catalog.map(x => ({ value: x.id, label: `${x.code} · ${x.name}` })), required: true }),
      c && React.createElement('div', { style: { display: 'flex', gap: 8 } }, React.createElement(Badge, { color: 'outline' }, c.manufacturer_name), c.mdr_class && React.createElement(Badge, { color: 'progress' }, `MDR ${c.mdr_class}`), React.createElement(Badge, { color: 'draft' }, `Jednotka: ${c.unit}`)),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } }, React.createElement(FormField, { label: 'Číslo šarže (LOT)', value: form.lot, onChange: e => set('lot', e.target.value.toUpperCase()), required: true, placeholder: 'napr. LX2405' }), React.createElement(FormField, { label: `Prijaté množstvo (${c?.unit || ''})`, type: 'number', value: form.qty_received, onChange: e => set('qty_received', e.target.value) })),
      lot.id && React.createElement(FormField, { label: `Zostatok (${c?.unit || ''})`, type: 'number', value: form.qty_remaining, onChange: e => set('qty_remaining', e.target.value) }),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } }, React.createElement(FormField, { label: 'Dátum príjmu', type: 'date', value: form.received, onChange: e => set('received', e.target.value) }), React.createElement(FormField, { label: 'Expirácia', type: 'date', value: form.expiry, onChange: e => set('expiry', e.target.value), helpText: 'Prázdne = bez expirácie' })),
      React.createElement(FormField, { label: 'Umiestnenie', value: form.location, onChange: e => set('location', e.target.value), placeholder: 'Sklad A · Regál 1' }),
      React.createElement('div', { style: { display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8, background: '#eef7f4', border: '1px solid #b0ddd5', color: MAT_COLORS.tealDark, fontSize: 12 } }, React.createElement(Icon, { name: 'shield', size: 14 }), 'Šarža sa automaticky zaradí do FEFO poradia a bude dostupná pri MDR výbere na zákazke.')));
}

function CatalogPage({ data, mutate }) {
  const [search, setSearch] = React.useState(''); const [edit, setEdit] = React.useState(null); const [remove, setRemove] = React.useState(null);
  const filtered = data.catalog.filter(c => !search || [c.code, c.name, c.manufacturer_name].some(v => String(v || '').toLowerCase().includes(search.toLowerCase())));
  const save = payload => mutate(() => edit.id ? window.MolarisAPI.materials.catalog.update(edit.id, payload) : window.MolarisAPI.materials.catalog.create(payload), edit.id ? `Materiál ${payload.code} upravený` : `Materiál ${payload.code} pridaný do katalógu`).then(ok => ok && setEdit(null));
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' } }, React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Kód, názov, výrobca…', width: 260 }), React.createElement(Button, { onClick: () => setEdit({}) }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Nový materiál')),
    React.createElement(Card, null, React.createElement(CardContent, { style: { paddingTop: 20 } }, filtered.length === 0 ? React.createElement(EmptyState, { title: 'Žiadne materiály' }) : React.createElement(DataTable, { data: filtered, onRowClick: setEdit, columns: [
      { key: 'code', label: 'Kód', width: 110, render: c => React.createElement('strong', { style: { fontFamily: 'ui-monospace,monospace', color: '#5a6b66' } }, c.code) },
      { key: 'name', label: 'Materiál', render: c => React.createElement('div', null, React.createElement('strong', null, c.name), React.createElement('div', { style: { fontSize: 11, color: MAT_COLORS.muted } }, c.category || '—')) },
      { key: 'manufacturer', label: 'Výrobca', width: 170, render: c => c.manufacturer_name }, { key: 'mdr', label: 'MDR', width: 80, render: c => c.mdr_class ? React.createElement(Badge, { color: 'progress' }, `MDR ${c.mdr_class}`) : '—' },
      { key: 'mode', label: 'Režim', width: 110, render: c => c.mode === 'single' ? 'Jednorázová' : 'Opakované' }, { key: 'lots', label: 'Šarže', width: 70, align: 'center', render: c => data.lots.filter(l => Number(l.catalog) === Number(c.id)).length },
      { key: 'action', label: '', width: 50, align: 'right', render: c => React.createElement('div', { onClick: e => e.stopPropagation() }, React.createElement(IconButton, { name: 'trash', destructive: true, title: 'Zmazať', onClick: () => setRemove(c) })) },
    ] }))),
    React.createElement(CatalogDrawer, { item: edit, manufacturers: data.manufacturers, onClose: () => setEdit(null), onSave: save }),
    React.createElement(ConfirmDialog, { open: !!remove, title: 'Zmazať materiál', message: remove ? `Naozaj zmazať ${remove.name} (${remove.code}) z katalógu?` : '', confirmText: 'Zmazať', destructive: true, onCancel: () => setRemove(null), onConfirm: () => mutate(() => window.MolarisAPI.materials.catalog.remove(remove.id), `Materiál ${remove.code} zmazaný`).then(ok => ok && setRemove(null)) })
  );
}
function CatalogDrawer({ item, manufacturers, onClose, onSave }) {
  const blank = { code: '', name: '', manufacturer: manufacturers[0]?.id || '', category: 'keramika', unit: 'ks', mdr_class: 'IIa', mode: 'single', allow_in_job: true, stock_code: '', note: '' };
  const [form, setForm] = React.useState(blank); React.useEffect(() => { if (item) setForm({ ...blank, ...item, manufacturer: item.manufacturer || '' }); }, [item]); if (!item) return null;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return React.createElement(Drawer, { open: true, onClose, width: 500, title: item.id ? 'Upraviť materiál' : 'Nový materiál v katalógu', footer: [React.createElement(Button, { key: 'c', variant: 'outline', onClick: onClose }, 'Zrušiť'), React.createElement(Button, { key: 's', disabled: !form.code.trim() || !form.name.trim() || !form.manufacturer, onClick: () => onSave({ ...form, manufacturer: Number(form.manufacturer), mdr_class: form.mdr_class || null, stock_code: form.stock_code || null }) }, 'Uložiť')] },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 } }, React.createElement(FormField, { label: 'Kód (PREFIX-NNNN)', value: form.code, onChange: e => set('code', e.target.value.toUpperCase()), required: true }), React.createElement(FormField, { label: 'Názov materiálu', value: form.name, onChange: e => set('name', e.target.value), required: true })),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } }, React.createElement(FormField, { label: 'Výrobca', type: 'select', value: form.manufacturer, onChange: e => set('manufacturer', e.target.value), options: manufacturers.map(m => ({ value: m.id, label: m.name })) }), React.createElement(FormField, { label: 'Kategória', type: 'select', value: form.category, onChange: e => set('category', e.target.value), options: CATEGORY_OPTIONS })),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 } }, React.createElement(FormField, { label: 'Jednotka', value: form.unit, onChange: e => set('unit', e.target.value) }), React.createElement(FormField, { label: 'MDR trieda', type: 'select', value: form.mdr_class || '', onChange: e => set('mdr_class', e.target.value), options: [{ value: '', label: 'Bez MDR' }, ...['I', 'IIa', 'IIb', 'III'].map(x => ({ value: x, label: x }))] }), React.createElement(FormField, { label: 'Režim', type: 'select', value: form.mode, onChange: e => set('mode', e.target.value), options: [{ value: 'single', label: 'Jednorázová' }, { value: 'repeat', label: 'Opakované' }] })),
      React.createElement(FormField, { label: 'Prepojenie na sklad (SKU, voliteľné)', value: form.stock_code || '', onChange: e => set('stock_code', e.target.value.toUpperCase()), placeholder: 'KER-001' }),
      React.createElement(MatToggleRow, { checked: form.allow_in_job, onChange: v => set('allow_in_job', v), title: 'Smie do zákazky', desc: 'Materiál sa dá priradiť na prácu a vstúpi do MDR prehlásenia.' }),
      React.createElement(FormField, { label: 'Poznámka', type: 'textarea', value: form.note, onChange: e => set('note', e.target.value) })));
}
function MatToggleRow({ checked, onChange, title, desc }) { return React.createElement('button', { type: 'button', onClick: () => onChange(!checked), style: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 9, border: `1px solid ${MAT_COLORS.line}`, background: '#fff', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'Manrope' } }, React.createElement('div', { style: { flex: 1 } }, React.createElement('div', { style: { fontSize: 13, fontWeight: 600 } }, title), React.createElement('div', { style: { fontSize: 11.5, color: MAT_COLORS.muted } }, desc)), React.createElement('div', { style: { width: 40, height: 22, borderRadius: 99, background: checked ? MAT_COLORS.teal : '#d4cfc5', position: 'relative' } }, React.createElement('div', { style: { position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' } }))); }

function ManufacturersPage({ data, mutate }) {
  const [edit, setEdit] = React.useState(null); const [remove, setRemove] = React.useState(null);
  const cards = data.manufacturers.map(m => React.createElement('div', {
    key: m.id,
    style: { background: '#fff', border: `1px solid ${MAT_COLORS.line}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 11 } },
      React.createElement('div', { style: { width: 44, height: 44, borderRadius: 10, background: MAT_COLORS.ink, color: '#fbfaf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 } }, m.prefix),
      React.createElement('div', null,
        React.createElement('div', { style: { fontWeight: 700, fontSize: 14 } }, m.name),
        React.createElement('div', { style: { fontSize: 11.5, color: MAT_COLORS.muted } }, m.country || '—'))),
    React.createElement('div', { style: { fontSize: 12, color: '#5a6b66', lineHeight: 1.45, minHeight: 34 } }, m.note || '—'),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0ede5', paddingTop: 9, alignItems: 'center' } },
      React.createElement('span', { style: { fontSize: 11.5, color: MAT_COLORS.muted } }, `${data.catalog.filter(c => Number(c.manufacturer) === Number(m.id)).length} materiálov · prefix ${m.prefix}`),
      React.createElement('div', null,
        React.createElement(IconButton, { name: 'edit', title: 'Upraviť', onClick: () => setEdit(m) }),
        React.createElement(IconButton, { name: 'trash', destructive: true, title: 'Zmazať', onClick: () => setRemove(m) })))));
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, React.createElement(Button, { onClick: () => setEdit({}) }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať výrobcu')),
    data.manufacturers.length === 0 ? React.createElement(EmptyState, { title: 'Žiadni výrobcovia' }) : React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 } }, ...cards),
    React.createElement(ManufacturerDrawer, { item: edit, onClose: () => setEdit(null), onSave: payload => mutate(() => edit.id ? window.MolarisAPI.materials.manufacturers.update(edit.id, payload) : window.MolarisAPI.materials.manufacturers.create(payload), edit.id ? `Výrobca ${payload.name} upravený` : `Výrobca ${payload.name} pridaný`).then(ok => ok && setEdit(null)) }),
    React.createElement(ConfirmDialog, { open: !!remove, title: 'Zmazať výrobcu', message: remove ? `Naozaj zmazať výrobcu ${remove.name}?` : '', destructive: true, confirmText: 'Zmazať', onCancel: () => setRemove(null), onConfirm: () => mutate(() => window.MolarisAPI.materials.manufacturers.remove(remove.id), `Výrobca ${remove.name} zmazaný`).then(ok => ok && setRemove(null)) })
  );
}
function ManufacturerDrawer({ item, onClose, onSave }) { const [form, setForm] = React.useState({ name: '', prefix: '', country: '', note: '' }); React.useEffect(() => { if (item) setForm({ name: '', prefix: '', country: '', note: '', ...item }); }, [item]); if (!item) return null; const set = (k, v) => setForm(f => ({ ...f, [k]: v })); return React.createElement(Drawer, { open: true, onClose, width: 440, title: item.id ? 'Upraviť výrobcu' : 'Pridať výrobcu', footer: [React.createElement(Button, { key: 'c', variant: 'outline', onClick: onClose }, 'Zrušiť'), React.createElement(Button, { key: 's', disabled: !form.name.trim() || !form.prefix.trim(), onClick: () => onSave(form) }, 'Uložiť')] }, React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } }, React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 } }, React.createElement(FormField, { label: 'Názov výrobcu', value: form.name, onChange: e => set('name', e.target.value), required: true }), React.createElement(FormField, { label: 'Prefix', value: form.prefix, onChange: e => set('prefix', e.target.value.toUpperCase()), required: true })), React.createElement(FormField, { label: 'Krajina', value: form.country, onChange: e => set('country', e.target.value) }), React.createElement(FormField, { label: 'Poznámka', type: 'textarea', value: form.note, onChange: e => set('note', e.target.value) }))); }

function RecipesPage({ data, mutate }) {
  const [edit, setEdit] = React.useState(null); const [remove, setRemove] = React.useState(null);
  const typeLabel = value => PRODUCT_TYPES.find(x => x.value === value)?.label || value;
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 } }, React.createElement('p', { style: { fontSize: 12.5, color: MAT_COLORS.muted, margin: 0, maxWidth: 520 } }, 'Šablóny materiálového zloženia produktov — pri priradení materiálu na zákazku predvyplnia FEFO výber šarží.'), React.createElement(Button, { onClick: () => setEdit({}) }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Nový recept')),
    data.recipes.length === 0 ? React.createElement(EmptyState, { title: 'Žiadne recepty' }) : React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 } }, ...data.recipes.map(r => React.createElement('div', { key: r.id, style: { background: '#fff', border: `1px solid ${MAT_COLORS.line}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 8 } }, React.createElement('div', null, React.createElement('div', { style: { fontWeight: 700, fontSize: 14 } }, r.name), React.createElement('div', { style: { fontSize: 11.5, color: MAT_COLORS.muted } }, typeLabel(r.product_type))), r.mdr && React.createElement(Badge, { color: 'progress' }, 'MDR')),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } }, ...(r.lines || []).map(line => { const c = line.catalog_details || data.catalog.find(x => x.id === line.catalog); return React.createElement('div', { key: line.id || line.catalog, style: { display: 'flex', gap: 8, padding: '6px 9px', background: MAT_COLORS.paper, border: '1px solid #ece7dc', borderRadius: 7, fontSize: 12 } }, React.createElement('span', { style: { width: 66, fontFamily: 'ui-monospace,monospace', fontSize: 10.5, color: MAT_COLORS.teal, fontWeight: 700 } }, c?.code || '—'), React.createElement('span', { style: { flex: 1 } }, c?.name || '—'), React.createElement('strong', null, `${matNumber(line.qty)} ${c?.unit || ''}`)); })),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f0ede5', paddingTop: 9 } }, React.createElement(IconButton, { name: 'edit', title: 'Upraviť', onClick: () => setEdit(r) }), React.createElement(IconButton, { name: 'trash', destructive: true, title: 'Zmazať', onClick: () => setRemove(r) }))))),
    React.createElement(RecipeDrawer, { item: edit, catalog: data.catalog, onClose: () => setEdit(null), onSave: payload => mutate(() => edit.id ? window.MolarisAPI.materials.recipes.update(edit.id, payload) : window.MolarisAPI.materials.recipes.create(payload), edit.id ? `Recept „${payload.name}“ upravený` : `Recept „${payload.name}“ vytvorený`).then(ok => ok && setEdit(null)) }),
    React.createElement(ConfirmDialog, { open: !!remove, title: 'Zmazať recept', message: remove ? `Naozaj zmazať recept „${remove.name}“?` : '', destructive: true, confirmText: 'Zmazať', onCancel: () => setRemove(null), onConfirm: () => mutate(() => window.MolarisAPI.materials.recipes.remove(remove.id), 'Recept zmazaný').then(ok => ok && setRemove(null)) }));
}
function RecipeDrawer({ item, catalog, onClose, onSave }) {
  const blank = { name: '', product_type: 'single', mdr: true, lines: [] };
  const [form, setForm] = React.useState(blank);
  React.useEffect(() => {
    if (item) setForm({ ...blank, ...item, lines: (item.lines || []).map(line => ({ catalog: line.catalog, qty: line.qty, note: line.note || '' })) });
  }, [item]);
  if (!item) return null;
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const setLine = (index, key, value) => setForm(current => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line) }));
  const rows = form.lines.map((line, index) => React.createElement('div', {
    key: index, style: { display: 'grid', gridTemplateColumns: '2fr 70px 1fr 32px', gap: 8, alignItems: 'center' },
  },
    React.createElement('select', { value: line.catalog, onChange: event => setLine(index, 'catalog', event.target.value), style: matInputStyle() },
      ...catalog.filter(entry => entry.allow_in_job).map(entry => React.createElement('option', { key: entry.id, value: entry.id }, `${entry.code} · ${entry.name}`))),
    React.createElement('input', { type: 'number', min: '0.001', step: '0.001', value: line.qty, onChange: event => setLine(index, 'qty', event.target.value), style: matInputStyle() }),
    React.createElement('input', { value: line.note, placeholder: 'poznámka', onChange: event => setLine(index, 'note', event.target.value), style: matInputStyle() }),
    React.createElement(IconButton, { name: 'trash', destructive: true, title: 'Odstrániť', onClick: () => set('lines', form.lines.filter((_, lineIndex) => lineIndex !== index)) })));
  const payload = () => ({ ...form, lines: form.lines.map(line => ({ ...line, catalog: Number(line.catalog), qty: Number(line.qty) })) });
  return React.createElement(Drawer, {
    open: true, onClose, width: 560, title: item.id ? 'Upraviť recept' : 'Nový recept (materiálové zloženie)',
    footer: [
      React.createElement(Button, { key: 'cancel', variant: 'outline', onClick: onClose }, 'Zrušiť'),
      React.createElement(Button, { key: 'save', disabled: !form.name.trim() || !form.lines.length, onClick: () => onSave(payload()) }, 'Uložiť recept'),
    ],
  }, React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 } },
      React.createElement(FormField, { label: 'Názov receptu', value: form.name, onChange: event => set('name', event.target.value), required: true }),
      React.createElement(FormField, { label: 'Typ produktu', type: 'select', value: form.product_type, onChange: event => set('product_type', event.target.value), options: PRODUCT_TYPES })),
    React.createElement('div', null,
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
        React.createElement('strong', { style: { fontSize: 12.5 } }, `Položky zloženia (${form.lines.length})`),
        React.createElement(Button, { size: 'sm', variant: 'outline', onClick: () => set('lines', [...form.lines, { catalog: catalog.find(entry => entry.allow_in_job)?.id || '', qty: 1, note: '' }]) }, React.createElement(Icon, { name: 'plus', size: 12 }), 'Pridať')),
      form.lines.length === 0
        ? React.createElement('p', { style: { color: MAT_COLORS.muted, fontSize: 12 } }, 'Zatiaľ žiadne položky. Pridajte materiály z katalógu.')
        : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } }, ...rows)),
    React.createElement(MatToggleRow, { checked: form.mdr, onChange: value => set('mdr', value), title: 'MDR relevantný recept', desc: 'Použitie z tohto receptu sa zapíše do prehlásenia o zhode.' })));
}
function matInputStyle() { return { width: '100%', boxSizing: 'border-box', padding: '7px 8px', border: `1px solid ${MAT_COLORS.line}`, borderRadius: 7, fontSize: 12, fontFamily: 'Manrope', background: '#fff' }; }

function UsagePage({ data, setNotice }) { const [conformity, setConformity] = React.useState(null); return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } }, React.createElement('div', { style: { display: 'flex', gap: 8, padding: '11px 15px', background: '#eef7f4', border: '1px solid #b0ddd5', borderRadius: 10, alignItems: 'center' } }, React.createElement(Icon, { name: 'shield', size: 16, color: MAT_COLORS.teal }), React.createElement('span', { style: { fontSize: 12.5, color: MAT_COLORS.tealDark } }, 'Audit log použitia — pre každú zákazku je zaznamenané, ktoré presné šarže boli použité (snapshot názvu, výrobcu, LOT a expirácie v čase použitia).')), data.usage.length === 0 ? React.createElement(EmptyState, { title: 'Žiadne použitie materiálov', description: 'Materiály priraďte na zákazku zo záložky Šarže.' }) : data.usage.map(u => React.createElement(Card, { key: u.id }, React.createElement(CardContent, { style: { paddingTop: 18 } }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 } }, React.createElement('div', null, React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, React.createElement('strong', { style: { fontFamily: 'Plus Jakarta Sans', fontSize: 15 } }, `Práca #${u.job}`), React.createElement(Badge, { color: 'draft' }, u.patient_label)), React.createElement('div', { style: { fontSize: 11.5, color: MAT_COLORS.muted, marginTop: 3 } }, `${matDate(u.date)} · Technik: ${u.technician || '—'}`)), React.createElement(Button, { size: 'sm', variant: 'outline', onClick: () => setConformity(u) }, React.createElement(Icon, { name: 'fileText', size: 13 }), 'Prehlásenie o zhode')), React.createElement(DataTable, { data: u.lines || [], columns: [{ key: 'name', label: 'Materiál', render: l => React.createElement('div', null, React.createElement('strong', null, l.name), React.createElement('div', { style: { fontSize: 11, color: MAT_COLORS.muted } }, `${l.manufacturer} · ${l.code}`)) }, { key: 'lot', label: 'LOT', width: 120, render: l => React.createElement('strong', { style: { fontFamily: 'ui-monospace,monospace', color: MAT_COLORS.teal } }, l.lot) }, { key: 'expiry', label: 'Expirácia', width: 120, render: l => matDate(l.expiry) }, { key: 'mdr', label: 'MDR', width: 80, render: l => l.mdr_class ? React.createElement(Badge, { color: 'progress' }, `MDR ${l.mdr_class}`) : '—' }, { key: 'qty', label: 'Množstvo', width: 100, align: 'right', render: l => `${matNumber(l.qty)} ${l.unit}` }] })))), React.createElement(ConformityModal, { usage: conformity, onClose: () => setConformity(null), setNotice })); }

function FefoDrawer({ open, data, onClose, mutate }) {
  const [job, setJob] = React.useState('');
  const [recipe, setRecipe] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [picked, setPicked] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (open) { setJob(''); setRecipe(''); setResult(null); setPicked({}); }
  }, [open]);
  if (!open) return null;
  const loadFefo = async (recipeId, jobId = job) => {
    setRecipe(recipeId); setResult(null); setPicked({});
    if (!recipeId) return;
    setLoading(true);
    try {
      const response = await window.MolarisAPI.materials.fetchFefo(recipeId, jobId || undefined);
      const defaults = {};
      (response.lines || []).forEach(line => { if (line.lots?.[0]) defaults[line.catalog.id] = line.lots[0].id; });
      setResult(response); setPicked(defaults);
    } finally { setLoading(false); }
  };
  const lines = result?.lines || [];
  const selectedCount = lines.filter(line => picked[line.catalog.id]).length;
  const confirm = () => {
    const payload = {
      job: Number(job), recipe: Number(recipe),
      lines: lines.map(line => ({ catalog: line.catalog.id, lot: picked[line.catalog.id], qty: Number(line.required_qty) })).filter(line => line.lot),
    };
    mutate(() => window.MolarisAPI.materials.createUsage(payload), `Priradených ${payload.lines.length} materiálov · zapísané do MDR auditu`).then(ok => ok && onClose());
  };
  const lineCards = lines.map(line => {
    const lotButtons = (line.lots || []).map((lot, index) => {
      const selected = picked[line.catalog.id] === lot.id;
      return React.createElement('button', {
        key: lot.id, type: 'button', onClick: () => setPicked(current => ({ ...current, [line.catalog.id]: lot.id })),
        style: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${selected ? MAT_COLORS.teal : '#ece7dc'}`, background: selected ? '#eef7f4' : '#fff', cursor: 'pointer', marginTop: 5, fontFamily: 'Manrope' },
      },
        React.createElement('span', { style: { width: 15, height: 15, borderRadius: '50%', border: `2px solid ${selected ? MAT_COLORS.teal : '#c8c0b4'}` } }),
        React.createElement('strong', { style: { fontFamily: 'ui-monospace,monospace', color: MAT_COLORS.teal, fontSize: 11.5 } }, lot.lot),
        index === 0 && React.createElement('span', { style: { fontSize: 9.5, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 } }, 'FEFO'),
        React.createElement('span', { style: { flex: 1 } }), React.createElement('span', { style: { fontSize: 11 } }, matDate(lot.expiry)),
        React.createElement('span', { style: { fontSize: 11, color: MAT_COLORS.muted } }, `${matNumber(lot.qty_remaining)} ${line.catalog.unit}`));
    });
    return React.createElement('div', { key: line.catalog.id, style: { padding: 12, border: '1px solid #ece7dc', borderRadius: 10, background: line.lots.length ? '#fff' : '#faf8f3' } },
      React.createElement('div', { style: { marginBottom: 8 } }, React.createElement('strong', { style: { fontSize: 13 } }, line.catalog.name), React.createElement('div', { style: { fontSize: 11, color: MAT_COLORS.muted } }, `${line.catalog.manufacturer_name} · ${line.catalog.code} · potreba ${matNumber(line.required_qty)} ${line.catalog.unit}`)),
      line.lots.length ? lotButtons : React.createElement('div', { style: { color: '#c0392b', fontSize: 11.5 } }, 'Žiadna použiteľná šarža na sklade'));
  });
  return React.createElement(Drawer, {
    open, onClose, width: 620, title: 'Priradiť materiál na zákazku', subtitle: 'FEFO výber šarží — systém navrhne najskôr expirujúce',
    footer: [React.createElement(Button, { key: 'cancel', variant: 'outline', onClick: onClose }, 'Zrušiť'), React.createElement(Button, { key: 'save', disabled: !job || !recipe || selectedCount === 0, onClick: confirm }, React.createElement(Icon, { name: 'check', size: 13 }), `Priradiť (${selectedCount})`)],
  }, React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
    React.createElement(FormField, { label: 'Zákazka', type: 'select', value: job, onChange: event => { const value = event.target.value; setJob(value); if (recipe) loadFefo(recipe, value); }, options: data.jobs.map(item => ({ value: item.id, label: `Práca #${item.id} · ${item.patient || item.patientName || item.name || ''}` })) }),
    React.createElement(FormField, { label: 'Predvyplniť z receptu', type: 'select', value: recipe, onChange: event => loadFefo(event.target.value), options: data.recipes.map(item => ({ value: item.id, label: item.name })) }),
    loading ? React.createElement(LoadingState, { message: 'Hľadám FEFO šarže…' }) : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } }, ...lineCards)));
}

function MatModal({ open, onClose, title, subtitle, children, footer, width = 560 }) { if (!open) return null; return React.createElement('div', { onClick: onClose, style: { position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(26,35,32,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 } }, React.createElement('div', { role: 'dialog', 'aria-modal': 'true', onClick: e => e.stopPropagation(), style: { width, maxWidth: '100%', maxHeight: '90vh', background: '#fff', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' } }, React.createElement('div', { style: { padding: '16px 22px', borderBottom: `1px solid ${MAT_COLORS.line}`, display: 'flex', justifyContent: 'space-between' } }, React.createElement('div', null, React.createElement('h2', { style: { margin: 0, font: '700 17px Plus Jakarta Sans' } }, title), subtitle && React.createElement('p', { style: { fontSize: 12, color: MAT_COLORS.muted, margin: '3px 0 0' } }, subtitle)), React.createElement(IconButton, { name: 'x', title: 'Zatvoriť', onClick: onClose })), React.createElement('div', { style: { overflowY: 'auto', padding: 22 } }, children), footer && React.createElement('div', { style: { padding: '14px 22px', borderTop: `1px solid ${MAT_COLORS.line}`, display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f7f6f2' } }, footer))); }
function CodeGlyph({ seed, size = 78 }) { const cells = 7; const rects = []; for (let row = 0; row < cells; row += 1) for (let col = 0; col < cells; col += 1) { let hash = 0; const text = `${seed}${row * cells + col}`; for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) & 0xffff; if (hash % 2) rects.push(React.createElement('rect', { key: `${row}-${col}`, x: col * size / cells, y: row * size / cells, width: size / cells, height: size / cells, fill: MAT_COLORS.ink })); } return React.createElement('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { border: `1px solid ${MAT_COLORS.line}`, borderRadius: 4 } }, ...rects); }
function LotLabelModal({ lot, catalog, onClose }) {
  if (!lot) return null;
  const material = lot.catalog_details || catalog.find(item => item.id === lot.catalog);
  const fields = [
    ['LOT', lot.lot], ['Expirácia', lot.expiry ? matDate(lot.expiry) : 'Bez expirácie'],
    ['Prijaté', matDate(lot.received)], ['Množstvo', `${matNumber(lot.qty_received)} ${material?.unit || ''}`],
    ['Umiestnenie', lot.location || '—'],
  ];
  const fieldRows = fields.map(([label, value]) => React.createElement('div', { key: label, style: { display: 'grid', gridTemplateColumns: '90px 1fr', fontSize: 11.5, padding: '3px 0' } },
    React.createElement('span', { style: { color: MAT_COLORS.muted } }, label),
    React.createElement('strong', { style: { fontFamily: label === 'LOT' ? 'ui-monospace,monospace' : 'inherit' } }, value)));
  return React.createElement(MatModal, {
    open: true, onClose, width: 460, title: 'Štítok šarže', subtitle: 'MDR identifikácia · pripravené na tlač',
    footer: [React.createElement(Button, { key: 'close', variant: 'outline', onClick: onClose }, 'Zavrieť'), React.createElement(Button, { key: 'print', onClick: () => window.MolarisAPI.materials.downloadLotLabel(lot.id, lot.short_code) }, React.createElement(Icon, { name: 'printer', size: 13 }), 'Stiahnuť PDF')],
  }, React.createElement('div', { className: 'mat-print-area', style: { border: `2px solid ${MAT_COLORS.ink}`, borderRadius: 10, padding: 18, display: 'flex', gap: 16 } },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 } }, React.createElement(CodeGlyph, { seed: `${lot.lot}${lot.short_code}` }), React.createElement('strong', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11 } }, lot.short_code)),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { font: '700 15px Plus Jakarta Sans' } }, material?.name || '—'),
      React.createElement('div', { style: { fontSize: 11.5, color: '#5a6b66' } }, `${material?.manufacturer_name || '—'} · ${material?.code || ''}`),
      React.createElement('div', { style: { margin: '10px 0' } }, material?.mdr_class && React.createElement(Badge, { color: 'progress' }, `MDR ${material.mdr_class}`)),
      ...fieldRows)));
}
function ConformityModal({ lot, usage, onClose, setNotice }) {
  if (!usage && !lot) return null;
  const download = async () => {
    try {
      if (usage) await window.MolarisAPI.materials.downloadUsageConformity(usage.id);
      else await window.MolarisAPI.materials.downloadLotConformity(lot.id, lot.short_code);
    } catch (error) { if (setNotice) setNotice({ tone: 'error', text: apiMessage(error) }); }
  };
  const lines = usage?.lines || [{ name: lot.catalog_details?.name, manufacturer: lot.catalog_details?.manufacturer_name, code: lot.catalog_details?.code, lot: lot.lot, expiry: lot.expiry, mdr_class: lot.catalog_details?.mdr_class, qty: lot.qty_received, unit: lot.catalog_details?.unit }];
  const columns = [
    { key: 'name', label: 'Materiál' }, { key: 'manufacturer', label: 'Výrobca' }, { key: 'code', label: 'Kód' },
    { key: 'lot', label: 'LOT' }, { key: 'expiry', label: 'Exp.', render: line => matDate(line.expiry) },
    { key: 'mdr', label: 'MDR', render: line => line.mdr_class || '—' }, { key: 'qty', label: 'Množ.', render: line => `${matNumber(line.qty)} ${line.unit || ''}` },
  ];
  return React.createElement(MatModal, {
    open: true, onClose, width: 640, title: 'Prehlásenie o zhode', subtitle: usage ? `Práca #${usage.job} · ${usage.patient_label}` : lot.short_code,
    footer: [React.createElement(Button, { key: 'close', variant: 'outline', onClick: onClose }, 'Zavrieť'), React.createElement(Button, { key: 'print', onClick: download }, React.createElement(Icon, { name: 'printer', size: 13 }), 'Stiahnuť PDF')],
  }, React.createElement('div', { className: 'mat-print-area' },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', borderBottom: `2px solid ${MAT_COLORS.ink}`, paddingBottom: 12, marginBottom: 16 } },
      React.createElement('div', null, React.createElement('div', { style: { font: '800 19px Plus Jakarta Sans' } }, 'Prehlásenie o zhode'), React.createElement('div', { style: { fontSize: 12, color: '#5a6b66' } }, 'podľa nariadenia (EÚ) 2017/745 (MDR)')),
      React.createElement('strong', { style: { color: MAT_COLORS.teal } }, 'Molaris Lab')),
    React.createElement('div', { style: { fontSize: 12.5, fontWeight: 700, marginBottom: 8 } }, 'Použité materiály a šarže'),
    React.createElement(DataTable, { data: lines, columns }),
    React.createElement('p', { style: { fontSize: 11.5, color: '#5a6b66', lineHeight: 1.6, marginTop: 16 } }, 'Laboratórium prehlasuje, že zdravotnícka pomôcka na mieru bola zhotovená v súlade s nariadením MDR 2017/745, príloha XIII. Použité materiály a ich šarže sú uvedené vyššie a sú dohľadateľné.')));
}

Object.assign(window, { Materials });
