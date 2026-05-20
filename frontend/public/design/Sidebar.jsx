// Sidebar.jsx — Molaris collapsible sidebar.
// Two distinct layouts:
//   · Admin / Používateľ — operational app (Práce, Pacienti, Sklad, Financie, Konfigurácia…)
//   · Superadmin       — platform control (Tenanti, Používatelia, Audit, Systém…)
// The role is decided by `user.role`; the matching link config is picked below.

function Sidebar({ currentPage, onNavigate, user = { name: 'Ján Novák', role: 'admin', initials: 'JN' }, onLogout }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [expandFinance, setExpandFinance] = React.useState(true);
  const [expandConfig, setExpandConfig] = React.useState(true);
  const [expandPlatform, setExpandPlatform] = React.useState(true);

  const isSuperadmin = user.role === 'superadmin';
  const isAdmin = user.role === 'admin';
  const roleLabels = { admin: 'Administrátor', superadmin: 'Superadmin', user: 'Používateľ' };

  // ── Link configs ────────────────────────────────────────────────────────────────
  // Admin / regular user — operational app
  const adminMain = [
    { id: 'dashboard',   name: 'Nástenka',   icon: 'dashboard' },
    { id: 'jobs',        name: 'Práce',       icon: 'briefcase' },
    { id: 'patients',    name: 'Pacienti',    icon: 'users' },
    { id: 'inventory',   name: 'Sklad',       icon: 'package' },
    { id: 'calendar',    name: 'Kalendár',    icon: 'calendar' },
  ];
  const adminFinance = [
    { id: 'finance',  name: 'Prehľad', icon: 'barChart' },
    { id: 'invoices', name: 'Faktúry', icon: 'fileText' },
  ];
  const adminConfig = [
    { id: 'clinics',      name: 'Kliniky',   icon: 'building' },
    { id: 'doctors',      name: 'Lekári',    icon: 'stethoscope' },
    { id: 'technicians',  name: 'Technici',  icon: 'wrench' },
    { id: 'pricelist',    name: 'Cenník',    icon: 'tag' },
  ];
  const adminBottom = [
    // Permissions is admin-only (regular users don't see it)
    ...(isAdmin ? [{ id: 'permissions', name: 'Oprávnenia', icon: 'shield' }] : []),
    { id: 'settings',    name: 'Nastavenia',  icon: 'settings' },
  ];

  // Superadmin — platform control only
  const saMain = [
    { id: 'sa_overview', name: 'Prehľad',       icon: 'activity'   },
    { id: 'sa_tenants',  name: 'Tenanti',       icon: 'building'   },
    { id: 'sa_users',    name: 'Používatelia',  icon: 'users'      },
    { id: 'sa_audit',    name: 'Audit log',     icon: 'fileText'   },
    { id: 'sa_system',   name: 'Systém',        icon: 'activity'   },
  ];
  const saPlatform = [
    { id: 'sa_security',     name: 'Bezpečnosť',          icon: 'lock'    },
    { id: 'sa_billing',      name: 'Platformová fakt.',   icon: 'receipt' },
    { id: 'sa_integrations', name: 'Integrácie',          icon: 'layers'  },
  ];
  const saBottom = [
    { id: 'settings', name: 'Môj profil', icon: 'user' },
  ];

  // ── Helpers ─────────────────────────────────────────────────────────────────────
  const navBtn = (id, name, icon, small = false) => {
    const active = currentPage === id;
    return React.createElement('button', {
      key: id, onClick: () => onNavigate(id), title: collapsed ? name : undefined,
      onMouseEnter: e => { if (!active) e.currentTarget.style.background = isSuperadmin ? '#2a3530' : '#e7e2d4'; },
      onMouseLeave: e => { if (!active) e.currentTarget.style.background = 'transparent'; },
      style: {
        display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '8px 0' : (small ? '6px 10px' : '7px 10px'),
        borderRadius: 6,
        background: active
          ? (isSuperadmin ? 'rgba(254,243,199,.14)' : '#d4f0eb')
          : 'transparent',
        color: active
          ? (isSuperadmin ? '#fef3c7' : '#085c4e')
          : (isSuperadmin ? '#c4cbc8' : '#4a5752'),
        fontWeight: active ? 600 : 500,
        fontSize: small ? 12.5 : 13, cursor: 'pointer', border: 'none',
        width: '100%', textAlign: 'left', fontFamily: 'Manrope,sans-serif',
        transition: 'background .1s, color .1s', whiteSpace: 'nowrap', overflow: 'hidden',
      }
    },
      React.createElement(Icon, {
        name: icon, size: small ? 15 : 16,
        color: active
          ? (isSuperadmin ? '#fef3c7' : '#0d7c6b')
          : (isSuperadmin ? '#8f9994' : '#6a7570')
      }),
      !collapsed && React.createElement('span', null, name)
    );
  };

  const sectionBtn = (label, icon, expanded, toggle) => React.createElement('button', {
    onClick: toggle,
    style: {
      display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
      justifyContent: collapsed ? 'center' : 'flex-start',
      padding: collapsed ? '8px 0' : '7px 10px', borderRadius: 6,
      background: 'transparent',
      color: isSuperadmin ? '#c4cbc8' : '#4a5752',
      fontSize: 13, fontWeight: 500,
      cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left',
      fontFamily: 'Manrope,sans-serif', transition: 'background .1s',
    }
  },
    React.createElement(Icon, { name: icon, size: 16, color: isSuperadmin ? '#8f9994' : '#6a7570' }),
    !collapsed && React.createElement(React.Fragment, null,
      React.createElement('span', { style: { flex: 1 } }, label),
      React.createElement(Icon, { name: expanded ? 'chevronDown' : 'chevronRight', size: 13, color: isSuperadmin ? '#8f9994' : '#8a9490' })
    )
  );

  const subGroup = (links) => React.createElement('div', {
    style: {
      marginLeft: 8, paddingLeft: 10,
      borderLeft: `1px solid ${isSuperadmin ? '#384842' : '#d4cfc5'}`,
      display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2
    }
  }, ...links.map(l => navBtn(l.id, l.name, l.icon, true)));

  // ── Theming for the chrome ──────────────────────────────────────────────────────
  const chrome = isSuperadmin
    ? { bg: '#1a2320', border: '#2a3530', divider: '#2a3530', subtleHover: '#2a3530', text: '#fbfaf6', subText: '#8f9994' }
    : { bg: '#f0ede5', border: '#e4ded4', divider: '#e4ded4', subtleHover: '#e7e2d4', text: '#1a2320', subText: '#8a9490' };

  return React.createElement('div', {
    style: {
      width: collapsed ? 64 : 224, minHeight: '100%', height: '100%',
      background: chrome.bg, display: 'flex', flexDirection: 'column', flexShrink: 0,
      borderRight: `1px solid ${chrome.border}`, transition: 'width .25s, background .25s',
      overflow: 'hidden',
    }
  },
    // ── Header ──
    React.createElement('div', {
      style: {
        height: 56, display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? 0 : '0 14px',
        borderBottom: `1px solid ${chrome.border}`, flexShrink: 0,
      }
    },
      collapsed
        ? React.createElement('button', {
            onClick: () => setCollapsed(false), title: 'Rozbaliť',
            style: { background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' },
            onMouseEnter: e => { e.currentTarget.style.background = chrome.subtleHover; },
            onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; }
          }, React.createElement(LogoMark, { size: 24 }))
        : React.createElement(React.Fragment, null,
            React.createElement(isSuperadmin ? LogoInverse : Logo, { markSize: 24, wordmarkSize: 17, gap: 9 }),
            React.createElement('button', {
              onClick: () => setCollapsed(true), title: 'Zbaliť',
              style: { background: 'none', border: 'none', color: chrome.subText, cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28 }
            }, React.createElement(Icon, { name: 'chevronLeft', size: 16 }))
          )
    ),

    // ── Mode tag (superadmin only) ──
    isSuperadmin && !collapsed && React.createElement('div', {
      style: { padding: '10px 14px 4px', display: 'flex', alignItems: 'center', gap: 7 }
    },
      React.createElement('span', {
        style: {
          fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em',
          textTransform: 'uppercase', color: '#fef3c7',
          background: 'rgba(254,243,199,.1)', padding: '3px 8px',
          borderRadius: 9999, border: '1px solid rgba(254,243,199,.25)',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }
      },
        React.createElement(Icon, { name: 'shield', size: 10, color: '#fef3c7' }),
        'Platforma'
      ),
    ),

    // ── Nav ──
    React.createElement('nav', { style: { flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' } },
      isSuperadmin
        ? React.createElement(React.Fragment, null,
            ...saMain.map(l => navBtn(l.id, l.name, l.icon)),
            React.createElement('div', { key: 'sa-platform', style: { marginTop: 6 } },
              sectionBtn('Platforma', 'layers', expandPlatform, () => setExpandPlatform(!expandPlatform)),
              !collapsed && expandPlatform && subGroup(saPlatform)
            ),
            React.createElement('div', { key: 'sa-bottom', style: { marginTop: 'auto', paddingTop: 10 } },
              ...saBottom.map(l => navBtn(l.id, l.name, l.icon))
            ),
          )
        : React.createElement(React.Fragment, null,
            ...adminMain.map(l => navBtn(l.id, l.name, l.icon)),

            isAdmin && React.createElement('div', { key: 'finance', style: { marginTop: 6 } },
              sectionBtn('Financie', 'euro', expandFinance, () => setExpandFinance(!expandFinance)),
              !collapsed && expandFinance && subGroup(adminFinance)
            ),

            isAdmin && React.createElement('div', { key: 'config', style: { marginTop: 6 } },
              sectionBtn('Konfigurácia', 'layers', expandConfig, () => setExpandConfig(!expandConfig)),
              !collapsed && expandConfig && subGroup(adminConfig)
            ),

            React.createElement('div', { key: 'admin-bottom', style: { marginTop: 'auto', paddingTop: 10 } },
              ...adminBottom.map(l => navBtn(l.id, l.name, l.icon))
            ),
          )
    ),

    // ── Footer (user) ──
    React.createElement('div', { style: { padding: 12, borderTop: `1px solid ${chrome.border}`, flexShrink: 0 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 9 } },
        React.createElement('div', {
          style: {
            width: 32, height: 32, borderRadius: '50%',
            background: isSuperadmin ? '#fef3c7' : '#d4f0eb',
            border: `1px solid ${isSuperadmin ? '#e9c977' : '#b0ddd5'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isSuperadmin ? '#7a5b0b' : '#085c4e',
            fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: 'Plus Jakarta Sans,sans-serif',
          }
        }, user.initials),
        !collapsed && React.createElement('div', { style: { overflow: 'hidden', flex: 1 } },
          React.createElement('p', { style: { fontSize: 12.5, fontWeight: 600, color: chrome.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, user.name),
          React.createElement('p', { style: { fontSize: 10.5, color: chrome.subText, margin: 0 } }, roleLabels[user.role] || 'Používateľ')
        ),
        !collapsed && React.createElement('button', {
          onClick: onLogout, title: 'Odhlásiť sa',
          style: { background: 'none', border: 'none', cursor: 'pointer', color: chrome.subText, padding: 6, borderRadius: 6, display: 'flex' },
          onMouseEnter: e => { e.currentTarget.style.background = chrome.subtleHover; e.currentTarget.style.color = isSuperadmin ? '#fef3c7' : '#0d7c6b'; },
          onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = chrome.subText; }
        }, React.createElement(Icon, { name: 'logOut', size: 15 }))
      )
    )
  );
}

Object.assign(window, { Sidebar });
