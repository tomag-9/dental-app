// Permissions.jsx — API-backed lab role permission metadata.

const PERM_ROLE_DEFS = [
  { id: 'admin', name: 'Administrátor', desc: 'Plný prístup v rámci laboratória', color: '#0d7c6b', bg: '#d4f0eb', locked: true },
  { id: 'user', name: 'Používateľ', desc: 'Bežný člen laboratória', color: '#4f46e5', bg: '#e0e7ff' },
  { id: 'technician', name: 'Technik', desc: 'Výrobný tím a pracovné úlohy', color: '#92400e', bg: '#fef3c7' },
];

const PERM_MODULES = [
  { group: 'Laboratórium', items: [
    { id: 'lab', name: 'Laboratórium', icon: 'building', desc: 'Nastavenia a profil laboratória' },
    { id: 'user', name: 'Používatelia', icon: 'users', desc: 'Členovia tímu a pozvánky' },
  ]},
  { group: 'CRM', items: [
    { id: 'patient', name: 'Pacienti', icon: 'users', desc: 'Karty pacientov a história' },
    { id: 'clinic', name: 'Kliniky', icon: 'building', desc: 'Klientske kliniky' },
    { id: 'doctor', name: 'Lekári', icon: 'stethoscope', desc: 'Odosielajúci lekári' },
  ]},
  { group: 'Prevádzka', items: [
    { id: 'job', name: 'Práce', icon: 'briefcase', desc: 'Zákazky a ich životný cyklus' },
    { id: 'inventory', name: 'Sklad', icon: 'package', desc: 'Skladové zásoby' },
    { id: 'invoice', name: 'Faktúry', icon: 'fileText', desc: 'Fakturácia a úhrady' },
  ]},
  { group: 'Bezpečnosť', items: [
    { id: 'audit_log', name: 'Audit log', icon: 'fileText', desc: 'História bezpečnostných akcií' },
    { id: 'session', name: 'Relácie', icon: 'activity', desc: 'Aktívne prihlásenia' },
    { id: 'api_key', name: 'API kľúče', icon: 'lock', desc: 'Integrácie a tokeny' },
    { id: '2fa', name: 'Dvojfaktor', icon: 'shield', desc: 'Správa 2FA' },
  ]},
];

const PERM_STATE_INFO = {
  edit: { label: 'Upraviť', short: 'E', icon: 'edit', color: '#0d7c6b', bg: '#d4f0eb', border: '#a4d8cf' },
  view: { label: 'Vidieť', short: 'V', icon: 'eye', color: '#4f46e5', bg: '#e0e7ff', border: '#bcc6f4' },
  none: { label: 'Nič', short: '—', icon: 'lock', color: '#8a9490', bg: '#f0ede5', border: '#dcd5c8' },
};

const PERM_ACTION_SUFFIX = {
  lab: { read: 'lab:read', write: 'lab:write' },
  user: { read: 'user:read', write: 'user:write' },
  patient: { read: 'patient:read', write: 'patient:write' },
  clinic: { read: 'clinic:read', write: 'clinic:write' },
  doctor: { read: 'doctor:read', write: 'doctor:write' },
  job: { read: 'job:read', write: 'job:write' },
  inventory: { read: 'inventory:read', write: 'inventory:write' },
  invoice: { read: 'invoice:read', write: 'invoice:write' },
  audit_log: { read: 'audit_log:read' },
  session: { read: 'session:read', write: 'session:revoke' },
  api_key: { read: 'api_key:read', write: 'api_key:write' },
  '2fa': { read: '2fa:manage', write: '2fa:manage' },
};

const allPermissionModules = () => PERM_MODULES.flatMap(group => group.items);
const roleById = Object.fromEntries(PERM_ROLE_DEFS.map(role => [role.id, role]));

function Permissions({ onNavigate, user }) {
  const savedUser = user || (window.MolarisAPI.savedUser && window.MolarisAPI.savedUser()) || {};
  const labId = savedUser.lab && savedUser.lab.id;
  const [matrix, setMatrix] = React.useState(null);
  const [overrides, setOverrides] = React.useState([]);
  const [perms, setPerms] = React.useState({});
  const [baseline, setBaseline] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [statusText, setStatusText] = React.useState('');

  const buildState = (matrixData, overrideList) => {
    const next = {};
    const overrideMap = Object.fromEntries((overrideList || []).map(item => [`${item.role}:${item.action}`, item.allowed]));
    for (const role of PERM_ROLE_DEFS) {
      const baseActions = new Set(((matrixData && matrixData.matrix && matrixData.matrix[role.id]) || {}).actions || []);
      next[role.id] = {};
      for (const mod of allPermissionModules()) {
        const actions = PERM_ACTION_SUFFIX[mod.id] || {};
        const readAllowed = resolveActionAllowed(role.id, actions.read, baseActions, overrideMap);
        const writeAllowed = resolveActionAllowed(role.id, actions.write, baseActions, overrideMap);
        next[role.id][mod.id] = writeAllowed ? 'edit' : readAllowed ? 'view' : 'none';
      }
    }
    return next;
  };

  const load = React.useCallback(() => {
    if (!labId) {
      setLoading(false);
      setError('Laboratórium nie je dostupné pre aktuálneho používateľa.');
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([
      window.MolarisAPI.fetchPermissionsMatrix(),
      window.MolarisAPI.fetchLabRolePermissions(labId),
    ])
      .then(([matrixData, overrideData]) => {
        const list = Array.isArray(overrideData) ? overrideData : [];
        const next = buildState(matrixData, list);
        setMatrix(matrixData);
        setOverrides(list);
        setPerms(next);
        setBaseline(next);
        setStatusText('');
      })
      .catch((err) => {
        setError((err && err.message) || 'Oprávnenia sa nepodarilo načítať.');
      })
      .finally(() => setLoading(false));
  }, [labId]);

  React.useEffect(() => { load(); }, [load]);

  const setCell = (roleId, modId, state) => {
    if ((roleById[roleId] || {}).locked) return;
    setPerms(current => ({ ...current, [roleId]: { ...(current[roleId] || {}), [modId]: state } }));
    setStatusText('');
  };

  const setRoleAll = (roleId, state) => {
    if ((roleById[roleId] || {}).locked) return;
    const values = Object.fromEntries(allPermissionModules().map(mod => [mod.id, state]));
    setPerms(current => ({ ...current, [roleId]: values }));
    setStatusText('');
  };

  const dirtyChanges = collectPermissionChanges(baseline, perms);
  const dirty = dirtyChanges.length > 0;

  const save = async () => {
    if (!labId || !dirtyChanges.length) return;
    setSaving(true);
    setError('');
    setStatusText('');
    try {
      const requests = [];
      for (const change of dirtyChanges) {
        const actions = actionsForState(change.modId, change.next);
        for (const action of actions) {
          requests.push(window.MolarisAPI.saveLabRolePermission(labId, {
            role: change.roleId,
            action: action.name,
            allowed: action.allowed,
          }));
        }
      }
      await Promise.all(requests);
      const latest = await window.MolarisAPI.fetchLabRolePermissions(labId);
      const list = Array.isArray(latest) ? latest : [];
      const next = buildState(matrix, list);
      setOverrides(list);
      setPerms(next);
      setBaseline(next);
      setStatusText('Zmeny boli uložené.');
    } catch (err) {
      setError((err && err.data && JSON.stringify(err.data)) || (err && err.message) || 'Oprávnenia sa nepodarilo uložiť.');
    } finally {
      setSaving(false);
    }
  };

  const counts = (roleId) => {
    const rolePerms = perms[roleId] || {};
    return {
      edit: Object.values(rolePerms).filter(value => value === 'edit').length,
      view: Object.values(rolePerms).filter(value => value === 'view').length,
      none: Object.values(rolePerms).filter(value => value === 'none').length,
    };
  };

  const pageHeader = React.createElement(PageHeader, {
    title: 'Oprávnenia',
    subtitle: 'API riadené metadáta oprávnení pre roly v laboratóriu.',
    actions: [
      dirty && React.createElement(Button, { key: 'd', variant: 'outline', disabled: saving, onClick: () => { setPerms(baseline); setStatusText('Zmeny boli zahodené.'); } }, 'Zrušiť zmeny'),
      React.createElement(Button, { key: 's', disabled: !dirty || saving || loading, onClick: save },
        React.createElement(Icon, { name: 'check', size: 14 }),
        saving ? 'Ukladám…' : dirty ? 'Uložiť zmeny' : 'Uložené'
      ),
    ].filter(Boolean),
  });

  if (loading) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 22 } },
      pageHeader,
      React.createElement(Card, null, React.createElement(CardContent, null, React.createElement(LoadingState, { message: 'Načítavam oprávnenia…' })))
    );
  }

  if (error && !Object.keys(perms).length) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 22 } },
      pageHeader,
      React.createElement(Card, null,
        React.createElement(CardContent, null,
          React.createElement(ErrorState, { title: 'Nepodarilo sa načítať oprávnenia', message: error, onRetry: load })
        )
      )
    );
  }

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 22 } },
    pageHeader,

    React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', background: '#faf8f4', border: '1px solid #e8e1d4', borderRadius: 8, fontSize: 12.5, color: '#5a6b66' } },
      React.createElement(Icon, { name: 'info', size: 14, color: '#8a9490', style: { flexShrink: 0, marginTop: 1 } }),
      React.createElement('span', null,
        React.createElement('strong', { style: { color: '#1a2320' } }, 'Len metadáta — nie runtime enforcement. '),
        'Tieto záznamy sledujú zamýšľané oprávnenia pre každú rolu a sú viditeľné v UI. Backend vynucuje prístup pevne zakódovanými DRF permission triedami nezávisle od týchto nastavení. Zmeny tu ',
        React.createElement('em', null, 'nemenia'),
        ' skutočné API autorizačné pravidlá.'
      )
    ),

    error && React.createElement(ErrorState, { title: 'Uloženie zlyhalo', message: error }),
    statusText && React.createElement('div', { style: { padding: '10px 14px', border: '1px solid #b0ddd5', background: '#f0faf7', borderRadius: 8, color: '#0d7c6b', fontSize: 12.5, fontWeight: 600 } }, statusText),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${PERM_ROLE_DEFS.length}, 1fr)`, gap: 10 } },
      ...PERM_ROLE_DEFS.map(role => {
        const c = counts(role.id);
        return React.createElement('div', { key: role.id, style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('div', { style: { width: 30, height: 30, borderRadius: 7, background: role.bg, color: role.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 12, fontWeight: 700, flexShrink: 0 } },
              role.locked ? React.createElement(Icon, { name: 'shield', size: 14 }) : role.name.split(' ').map(n => n[0]).join('').slice(0, 2)
            ),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { fontSize: 12.5, fontWeight: 700, color: '#1a2320' } }, role.name),
              React.createElement('div', { style: { fontSize: 10.5, color: '#8a9490', marginTop: 1 } }, role.desc)
            )
          ),
          React.createElement('div', { style: { display: 'flex', gap: 4, fontSize: 10, fontFamily: 'ui-monospace,monospace' } },
            React.createElement('span', { style: statPill(PERM_STATE_INFO.edit) }, `${c.edit}E`),
            React.createElement('span', { style: statPill(PERM_STATE_INFO.view) }, `${c.view}V`),
            React.createElement('span', { style: statPill(PERM_STATE_INFO.none) }, `${c.none}—`)
          )
        );
      })
    ),

    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 14px', background: '#fff', border: '1px solid #ece7dc', borderRadius: 10, flexWrap: 'wrap' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, color: '#5a6b66' } },
        React.createElement('span', { style: { fontWeight: 700, color: '#1a2320' } }, 'Legenda:'),
        ...['edit', 'view', 'none'].map(state => React.createElement('div', { key: state, style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
          React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, background: PERM_STATE_INFO[state].bg, color: PERM_STATE_INFO[state].color, border: `1px solid ${PERM_STATE_INFO[state].border}` } },
            React.createElement(Icon, { name: PERM_STATE_INFO[state].icon, size: 11 })
          ),
          PERM_STATE_INFO[state].label
        ))
      ),
      React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490' } }, `${overrides.length} uložených override záznamov`)
    ),

    React.createElement('div', { style: { background: '#fff', border: '1px solid #ece7dc', borderRadius: 12, overflow: 'hidden' } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: `minmax(240px, 1.6fr) repeat(${PERM_ROLE_DEFS.length}, minmax(130px, 1fr))`, background: '#fbfaf6', borderBottom: '1px solid #ece7dc' } },
        React.createElement('div', { style: { padding: '12px 16px', fontSize: 10.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.06em' } }, 'Modul'),
        ...PERM_ROLE_DEFS.map(role => React.createElement('div', { key: role.id, style: { padding: '12px 10px', borderLeft: '1px solid #ece7dc', textAlign: 'center' } },
          React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 9999, background: role.bg, color: role.color, fontSize: 11, fontWeight: 700 } },
            role.locked && React.createElement(Icon, { name: 'lock', size: 10 }),
            role.name
          ),
          !role.locked && React.createElement('div', { style: { marginTop: 8, display: 'flex', gap: 3, justifyContent: 'center' } },
            ...['edit', 'view', 'none'].map(state => React.createElement('button', {
              key: state,
              onClick: () => setRoleAll(role.id, state),
              title: `Všetko: ${PERM_STATE_INFO[state].label}`,
              style: { padding: '2px 7px', borderRadius: 4, border: '1px solid #e4ded4', background: '#fff', color: PERM_STATE_INFO[state].color, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'ui-monospace,monospace' },
            }, `Všetko ${PERM_STATE_INFO[state].short}`))
          ),
          role.locked && React.createElement('div', { style: { marginTop: 8, fontSize: 10.5, color: '#8a9490' } }, 'plný prístup')
        ))
      ),
      ...PERM_MODULES.map((group, groupIndex) => React.createElement(React.Fragment, { key: group.group },
        React.createElement('div', { style: { padding: '8px 16px', background: '#f7f5ed', fontSize: 10.5, fontWeight: 700, color: '#5a6b66', textTransform: 'uppercase', letterSpacing: '.06em', borderTop: groupIndex === 0 ? 'none' : '1px solid #ece7dc', borderBottom: '1px solid #ece7dc' } }, group.group),
        ...group.items.map((mod, modIndex) => React.createElement('div', { key: mod.id, style: { display: 'grid', gridTemplateColumns: `minmax(240px, 1.6fr) repeat(${PERM_ROLE_DEFS.length}, minmax(130px, 1fr))`, borderTop: modIndex === 0 ? 'none' : '1px solid #f4f1e8', background: '#fff' } },
          React.createElement('div', { style: { padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement('div', { style: { width: 28, height: 28, borderRadius: 6, background: '#f0ede5', color: '#5a6b66', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
              React.createElement(Icon, { name: mod.icon, size: 14 })
            ),
            React.createElement('div', null,
              React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, mod.name),
              React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, mod.desc)
            )
          ),
          ...PERM_ROLE_DEFS.map(role => React.createElement('div', { key: role.id, style: { padding: '10px 8px', borderLeft: '1px solid #f4f1e8', display: 'flex', justifyContent: 'center', alignItems: 'center' } },
            React.createElement(PermTriToggle, {
              value: perms[role.id] ? perms[role.id][mod.id] : 'none',
              disabled: role.locked || saving,
              onChange: (state) => setCell(role.id, mod.id, state),
            })
          ))
        ))
      )),
      React.createElement('div', { style: { padding: '10px 16px', background: '#fbfaf6', borderTop: '1px solid #ece7dc', fontSize: 11.5, color: '#8a9490', display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement(Icon, { name: 'alertCircle', size: 12, color: '#8a9490' }),
        'Administrátor ostáva zamknutý na plný prístup. Zmeny sa ukladajú ako metadata override záznamy pre backend.'
      )
    )
  );
}

function resolveActionAllowed(roleId, actionName, baseActions, overrideMap) {
  if (!actionName) return false;
  const key = `${roleId}:${actionName}`;
  if (Object.prototype.hasOwnProperty.call(overrideMap, key)) return !!overrideMap[key];
  return baseActions.has(actionName);
}

function actionsForState(modId, state) {
  const actions = PERM_ACTION_SUFFIX[modId] || {};
  const read = actions.read;
  const write = actions.write;
  const values = [];
  if (read) values.push({ name: read, allowed: state === 'edit' || state === 'view' });
  if (write && write !== read) values.push({ name: write, allowed: state === 'edit' });
  return values;
}

function collectPermissionChanges(baseline, current) {
  const changes = [];
  for (const role of PERM_ROLE_DEFS) {
    if (role.locked) continue;
    for (const mod of allPermissionModules()) {
      const before = baseline[role.id] && baseline[role.id][mod.id];
      const next = current[role.id] && current[role.id][mod.id];
      if (before && next && before !== next) changes.push({ roleId: role.id, modId: mod.id, before, next });
    }
  }
  return changes;
}

function statPill(info) {
  return { flex: 1, textAlign: 'center', padding: '3px 0', borderRadius: 4, background: info.bg, color: info.color, fontWeight: 700 };
}

function PermTriToggle({ value, onChange, disabled }) {
  return React.createElement('div', { style: { display: 'inline-flex', padding: 2, borderRadius: 7, background: '#fbfaf6', border: '1px solid #ece7dc', gap: 1, opacity: disabled ? 0.6 : 1 } },
    ...['edit', 'view', 'none'].map(state => {
      const info = PERM_STATE_INFO[state];
      const active = value === state;
      return React.createElement('button', {
        key: state,
        onClick: () => !disabled && onChange(state),
        disabled,
        title: info.label,
        style: { width: 30, height: 26, padding: 0, border: 'none', borderRadius: 5, background: active ? info.color : 'transparent', color: active ? '#fff' : info.color, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background .12s, color .12s' },
        onMouseEnter: e => { if (!active && !disabled) e.currentTarget.style.background = info.bg; },
        onMouseLeave: e => { if (!active && !disabled) e.currentTarget.style.background = 'transparent'; },
      }, React.createElement(Icon, { name: info.icon, size: 12 }));
    })
  );
}

Object.assign(window, {
  Permissions,
  __MOLARIS_PERMISSION_TESTS: {
    actionsForState,
    collectPermissionChanges,
    resolveActionAllowed,
    buildPermissionState(matrix, overrides) {
      const overrideMap = Object.fromEntries((overrides || []).map(item => [`${item.role}:${item.action}`, item.allowed]));
      const result = {};
      for (const role of PERM_ROLE_DEFS) {
        const baseActions = new Set(((matrix && matrix.matrix && matrix.matrix[role.id]) || {}).actions || []);
        result[role.id] = {};
        for (const mod of allPermissionModules()) {
          const actions = PERM_ACTION_SUFFIX[mod.id] || {};
          const readAllowed = resolveActionAllowed(role.id, actions.read, baseActions, overrideMap);
          const writeAllowed = resolveActionAllowed(role.id, actions.write, baseActions, overrideMap);
          result[role.id][mod.id] = writeAllowed ? 'edit' : readAllowed ? 'view' : 'none';
        }
      }
      return result;
    },
  },
});
