// Permissions.jsx — Admin "Oprávnenia" page.
//
// Matrix where each row is a feature/module and each column is a role.
// Each cell is a 3-way segmented control: Upraviť (edit) / Vidieť (view) / Nič (none).
//
// Admin row is locked to "edit" everywhere (admin always has full access).
// You can also add a custom role from the toolbar — for the demo it just appears
// in local state with defaults derived from the closest existing role.

// ── Roles ────────────────────────────────────────────────────────────────────────
const PERM_ROLES_INITIAL = [
  { id: 'admin',     name: 'Administrátor', desc: 'Plný prístup k systému',         color: '#0d7c6b', bg: '#d4f0eb', members: 2,  locked: true },
  { id: 'sen_tech',  name: 'Senior technik', desc: 'Vedúci technik',                color: '#4f46e5', bg: '#e0e7ff', members: 3  },
  { id: 'tech',      name: 'Technik',        desc: 'Bežný technik',                  color: '#92400e', bg: '#fef3c7', members: 6  },
  { id: 'accountant',name: 'Účtovník',       desc: 'Financie a fakturácia',          color: '#9d174d', bg: '#fde7f3', members: 1  },
  { id: 'reception', name: 'Recepcia',       desc: 'Príjem prác a komunikácia',     color: '#5a6b66', bg: '#f0ede5', members: 2  },
];

// ── Modules (rows) grouped by area ────────────────────────────────────────────────
const PERM_MODULES = [
  { group: 'Hlavné moduly', items: [
    { id: 'dashboard', name: 'Nástenka',   icon: 'dashboard', desc: 'Domovský prehľad' },
    { id: 'jobs',      name: 'Práce',       icon: 'briefcase', desc: 'Zákazky a ich životný cyklus' },
    { id: 'patients',  name: 'Pacienti',    icon: 'users',     desc: 'Karta pacienta, história, zubný kríž' },
    { id: 'inventory', name: 'Sklad',       icon: 'package',   desc: 'Materiály a stavy' },
    { id: 'calendar',  name: 'Kalendár',    icon: 'calendar',  desc: 'Termíny a plánovanie' },
  ]},
  { group: 'Financie', items: [
    { id: 'finance',   name: 'Finančný prehľad', icon: 'barChart',  desc: 'Výnosy, náklady, marže' },
    { id: 'invoices',  name: 'Faktúry',          icon: 'fileText',  desc: 'Vystavovanie a evidencia' },
    { id: 'pricelist', name: 'Cenník',           icon: 'tag',       desc: 'Cenotvorba výkonov' },
  ]},
  { group: 'Konfigurácia', items: [
    { id: 'clinics',     name: 'Kliniky',     icon: 'building',    desc: 'Klienti laboratória' },
    { id: 'doctors',     name: 'Lekári',      icon: 'stethoscope', desc: 'Kontakty a väzba na kliniky' },
    { id: 'technicians', name: 'Technici',    icon: 'wrench',      desc: 'Tím a roly' },
  ]},
  { group: 'Systém', items: [
    { id: 'settings',    name: 'Nastavenia',  icon: 'settings',  desc: 'Profil, laboratórium, notifikácie' },
    { id: 'permissions', name: 'Oprávnenia',  icon: 'shield',    desc: 'Táto stránka' },
    { id: 'audit',       name: 'Audit log',   icon: 'fileText',  desc: 'História akcií používateľov' },
  ]},
];

// ── Default permission matrix ─────────────────────────────────────────────────────
// 3 states: 'edit' | 'view' | 'none'
const DEFAULT_PERMS = {
  admin:      Object.fromEntries(PERM_MODULES.flatMap(g => g.items).map(m => [m.id, 'edit'])),
  sen_tech: {
    dashboard: 'edit', jobs: 'edit', patients: 'edit', inventory: 'edit', calendar: 'edit',
    finance: 'view', invoices: 'view', pricelist: 'view',
    clinics: 'view', doctors: 'view', technicians: 'view',
    settings: 'view', permissions: 'none', audit: 'view',
  },
  tech: {
    dashboard: 'edit', jobs: 'edit', patients: 'view', inventory: 'edit', calendar: 'view',
    finance: 'none', invoices: 'none', pricelist: 'view',
    clinics: 'view', doctors: 'view', technicians: 'view',
    settings: 'view', permissions: 'none', audit: 'none',
  },
  accountant: {
    dashboard: 'view', jobs: 'view', patients: 'view', inventory: 'view', calendar: 'view',
    finance: 'edit', invoices: 'edit', pricelist: 'edit',
    clinics: 'view', doctors: 'view', technicians: 'view',
    settings: 'view', permissions: 'none', audit: 'view',
  },
  reception: {
    dashboard: 'view', jobs: 'edit', patients: 'edit', inventory: 'none', calendar: 'edit',
    finance: 'none', invoices: 'view', pricelist: 'view',
    clinics: 'view', doctors: 'view', technicians: 'view',
    settings: 'view', permissions: 'none', audit: 'none',
  },
};

const PERM_STATE_INFO = {
  edit: { label: 'Upraviť', short: 'E', icon: 'edit',  color: '#0d7c6b', bg: '#d4f0eb', border: '#a4d8cf' },
  view: { label: 'Vidieť',  short: 'V', icon: 'eye',   color: '#4f46e5', bg: '#e0e7ff', border: '#bcc6f4' },
  none: { label: 'Nič',     short: '—', icon: 'lock',  color: '#8a9490', bg: '#f0ede5', border: '#dcd5c8' },
};

function Permissions({ onNavigate }) {
  const [roles, setRoles] = React.useState(PERM_ROLES_INITIAL);
  const [perms, setPerms] = React.useState(DEFAULT_PERMS);
  const [activeRole, setActiveRole] = React.useState(null); // null = matrix view, 'role_id' = role detail
  const [dirty, setDirty] = React.useState(false);

  const setCell = (roleId, modId, state) => {
    if (roleId === 'admin') return; // admin locked
    setPerms(p => ({ ...p, [roleId]: { ...p[roleId], [modId]: state } }));
    setDirty(true);
  };
  const setRoleAll = (roleId, state) => {
    if (roleId === 'admin') return;
    setPerms(p => ({
      ...p,
      [roleId]: Object.fromEntries(Object.keys(p[roleId]).map(k => [k, state]))
    }));
    setDirty(true);
  };

  const allModules = PERM_MODULES.flatMap(g => g.items);
  const counts = (roleId) => {
    const r = perms[roleId] || {};
    return {
      edit: Object.values(r).filter(v => v === 'edit').length,
      view: Object.values(r).filter(v => v === 'view').length,
      none: Object.values(r).filter(v => v === 'none').length,
    };
  };

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 22 } },
    React.createElement(PageHeader, {
      title: 'Oprávnenia',
      subtitle: 'Nastavte čo môžu členovia tímu vidieť alebo upravovať v jednotlivých moduloch.',
      actions: [
        dirty && React.createElement(Button, { key: 'd', variant: 'outline', onClick: () => { setPerms(DEFAULT_PERMS); setDirty(false); } }, 'Zrušiť zmeny'),
        React.createElement(Button, { key: 's', disabled: !dirty, onClick: () => setDirty(false) },
          React.createElement(Icon, { name: 'check', size: 14 }),
          dirty ? 'Uložiť zmeny' : 'Uložené'
        ),
      ].filter(Boolean),
    }),

    // Role chip row — quick stats per role
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${roles.length}, 1fr)`, gap: 10 } },
      ...roles.map(r => {
        const c = counts(r.id);
        return React.createElement('div', {
          key: r.id,
          style: {
            background: '#fff', border: '1px solid #ece7dc', borderRadius: 10,
            padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
          }
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('div', {
              style: {
                width: 30, height: 30, borderRadius: 7,
                background: r.bg, color: r.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 12, fontWeight: 700,
                flexShrink: 0,
              }
            }, r.locked ? React.createElement(Icon, { name: 'shield', size: 14 }) : r.name.split(' ').map(n => n[0]).join('').slice(0, 2)),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { fontSize: 12.5, fontWeight: 700, color: '#1a2320', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, r.name),
              React.createElement('div', { style: { fontSize: 10.5, color: '#8a9490', marginTop: 1 } }, `${r.members} ${r.members === 1 ? 'člen' : (r.members < 5 ? 'členovia' : 'členov')}`),
            ),
          ),
          React.createElement('div', { style: { display: 'flex', gap: 4, fontSize: 10, fontFamily: 'ui-monospace,monospace' } },
            React.createElement('span', { style: { flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: PERM_STATE_INFO.edit.bg, color: PERM_STATE_INFO.edit.color, fontWeight: 700 } }, `${c.edit}E`),
            React.createElement('span', { style: { flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: PERM_STATE_INFO.view.bg, color: PERM_STATE_INFO.view.color, fontWeight: 700 } }, `${c.view}V`),
            React.createElement('span', { style: { flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: PERM_STATE_INFO.none.bg, color: PERM_STATE_INFO.none.color, fontWeight: 700 } }, `${c.none}—`),
          ),
        );
      })
    ),

    // Legend + bulk toolbar
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        padding: '10px 14px', background: '#fff', border: '1px solid #ece7dc', borderRadius: 10,
        flexWrap: 'wrap',
      }
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, color: '#5a6b66' } },
        React.createElement('span', { style: { fontWeight: 700, color: '#1a2320' } }, 'Legenda:'),
        ...['edit', 'view', 'none'].map(s => React.createElement('div', { key: s, style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
          React.createElement('span', {
            style: {
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: 5,
              background: PERM_STATE_INFO[s].bg, color: PERM_STATE_INFO[s].color,
              border: `1px solid ${PERM_STATE_INFO[s].border}`,
            }
          }, React.createElement(Icon, { name: PERM_STATE_INFO[s].icon, size: 11 })),
          PERM_STATE_INFO[s].label,
        )),
      ),
      React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490' } }, 'Klik na bunku zmení stav. Hlavička stĺpca nastaví všetky riadky pre danú rolu.'),
    ),

    // Matrix
    React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 12, overflow: 'hidden' } },
      // Header
      React.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: `minmax(220px, 1.6fr) repeat(${roles.length}, minmax(120px, 1fr))`,
          background: '#fbfaf6', borderBottom: '1px solid #ece7dc',
        }
      },
        React.createElement('div', { style: { padding: '12px 16px', fontSize: 10.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.06em' } }, 'Modul'),
        ...roles.map(r => React.createElement('div', {
          key: r.id, style: { padding: '12px 10px', borderLeft: '1px solid #ece7dc', textAlign: 'center' }
        },
          React.createElement('div', {
            style: {
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 9999,
              background: r.bg, color: r.color,
              fontSize: 11, fontWeight: 700,
            }
          },
            r.locked && React.createElement(Icon, { name: 'lock', size: 10 }),
            r.name,
          ),
          // Per-role bulk row (set all to edit / view / none)
          !r.locked && React.createElement('div', { style: { marginTop: 8, display: 'flex', gap: 3, justifyContent: 'center' } },
            ...['edit', 'view', 'none'].map(s => React.createElement('button', {
              key: s, onClick: () => setRoleAll(r.id, s), title: `Všetko: ${PERM_STATE_INFO[s].label}`,
              style: {
                padding: '2px 7px', borderRadius: 4,
                border: '1px solid #e4ded4', background: '#fff',
                color: PERM_STATE_INFO[s].color, fontSize: 10, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'ui-monospace,monospace',
              },
              onMouseEnter: e => { e.currentTarget.style.background = PERM_STATE_INFO[s].bg; e.currentTarget.style.borderColor = PERM_STATE_INFO[s].border; },
              onMouseLeave: e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e4ded4'; },
            }, `Všetko ${PERM_STATE_INFO[s].short}`)),
          ),
          r.locked && React.createElement('div', { style: { marginTop: 8, fontSize: 10.5, color: '#8a9490' } }, 'plný prístup'),
        )),
      ),

      // Rows grouped by section
      ...PERM_MODULES.map((group, gi) => React.createElement(React.Fragment, { key: group.group },
        React.createElement('div', {
          style: {
            padding: '8px 16px', background: '#f7f5ed',
            fontSize: 10.5, fontWeight: 700, color: '#5a6b66',
            textTransform: 'uppercase', letterSpacing: '.06em',
            borderTop: gi === 0 ? 'none' : '1px solid #ece7dc',
            borderBottom: '1px solid #ece7dc',
          }
        }, group.group),
        ...group.items.map((mod, mi) => React.createElement('div', {
          key: mod.id,
          style: {
            display: 'grid',
            gridTemplateColumns: `minmax(220px, 1.6fr) repeat(${roles.length}, minmax(120px, 1fr))`,
            borderTop: mi === 0 ? 'none' : '1px solid #f4f1e8',
            background: '#fff',
            transition: 'background .12s',
          },
          onMouseEnter: e => { e.currentTarget.style.background = '#fbfaf6'; },
          onMouseLeave: e => { e.currentTarget.style.background = '#fff'; },
        },
          React.createElement('div', { style: { padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement('div', {
              style: {
                width: 28, height: 28, borderRadius: 6, background: '#f0ede5', color: '#5a6b66',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }
            }, React.createElement(Icon, { name: mod.icon, size: 14 })),
            React.createElement('div', null,
              React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, mod.name),
              React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, mod.desc),
            ),
          ),
          ...roles.map(r => React.createElement('div', {
            key: r.id, style: { padding: '10px 8px', borderLeft: '1px solid #f4f1e8', display: 'flex', justifyContent: 'center', alignItems: 'center' }
          },
            React.createElement(PermTriToggle, {
              value: perms[r.id] ? perms[r.id][mod.id] : 'none',
              disabled: r.locked,
              onChange: (s) => setCell(r.id, mod.id, s),
            })
          )),
        ))
      )),

      // Footer note
      React.createElement('div', {
        style: {
          padding: '10px 16px', background: '#fbfaf6', borderTop: '1px solid #ece7dc',
          fontSize: 11.5, color: '#8a9490', display: 'flex', alignItems: 'center', gap: 8,
        }
      },
        React.createElement(Icon, { name: 'alertCircle', size: 12, color: '#8a9490' }),
        'Rola „Administrátor" má vždy plný prístup k všetkým modulom — nedá sa zmeniť.',
      ),
    ),
  );
}

// ── Tri-state segmented toggle: [E][V][—] ────────────────────────────────────────
function PermTriToggle({ value, onChange, disabled }) {
  const states = ['edit', 'view', 'none'];
  return React.createElement('div', {
    style: {
      display: 'inline-flex', padding: 2, borderRadius: 7,
      background: '#fbfaf6', border: '1px solid #ece7dc', gap: 1,
      opacity: disabled ? 0.6 : 1,
    }
  },
    ...states.map(s => {
      const info = PERM_STATE_INFO[s];
      const active = value === s;
      return React.createElement('button', {
        key: s,
        onClick: () => !disabled && onChange(s),
        disabled,
        title: info.label,
        style: {
          width: 30, height: 26, padding: 0, border: 'none',
          borderRadius: 5,
          background: active ? info.color : 'transparent',
          color: active ? '#fff' : info.color,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background .12s, color .12s',
        },
        onMouseEnter: e => { if (!active && !disabled) { e.currentTarget.style.background = info.bg; } },
        onMouseLeave: e => { if (!active && !disabled) { e.currentTarget.style.background = 'transparent'; } },
      }, React.createElement(Icon, { name: info.icon, size: 12 }));
    })
  );
}

Object.assign(window, { Permissions });
