// Superadmin.jsx — Molaris Superadmin (platform-level management).
// The sidebar drives which tab is shown via the `currentPage` prop — sidebar
// items like `sa_tenants`, `sa_users`, `sa_audit`, `sa_system`, `sa_overview`,
// `sa_security`, `sa_billing`, `sa_integrations` all resolve here.

function Superadmin({ onNavigate, currentPage = 'sa_overview' }) {
  // Map sidebar route → internal tab key
  const routeToTab = {
    sa_overview:     'overview',
    sa_tenants:      'tenants',
    sa_users:        'users',
    sa_audit:        'audit',
    sa_system:       'system',
    sa_security:     'security',
    sa_billing:      'billing',
    sa_integrations: 'integrations',
  };
  const tab = routeToTab[currentPage] || 'overview';

  // Page-level header (kept simple — sidebar already brands as Superadmin)
  const headers = {
    overview:     { title: 'Prehľad platformy',         subtitle: 'Kľúčové ukazovatele a stav prostredia Molaris SaaS.' },
    tenants:      { title: 'Tenanti',                    subtitle: 'Laboratóriá pripojené do platformy.' },
    users:        { title: 'Používatelia platformy',     subtitle: 'Účty naprieč všetkými tenantmi.' },
    audit:        { title: 'Audit log',                  subtitle: 'Záznam akcií v reálnom čase.' },
    system:       { title: 'Systém',                     subtitle: 'Zdravie služieb, verzia a údržba.' },
    security:     { title: 'Bezpečnosť platformy',       subtitle: 'Politiky prihlásenia, kľúče a šifrovanie.' },
    billing:      { title: 'Fakturácia platformy',       subtitle: 'Faktúry vystavené tenantom a MRR.' },
    integrations: { title: 'Integrácie',                 subtitle: 'Webhooky, API kľúče a externé služby.' },
  };
  const h = headers[tab];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: h.title,
      subtitle: h.subtitle,
      actions: tab === 'tenants'
        ? [React.createElement(Button, { key: 'a' }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať tenanta')]
        : tab === 'users'
          ? [React.createElement(Button, { key: 'a' }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať používateľa')]
          : []
    }),

    tab === 'overview'     && React.createElement(OverviewTab),
    tab === 'tenants'      && React.createElement(TenantsTab),
    tab === 'users'        && React.createElement(UsersTab),
    tab === 'audit'        && React.createElement(AuditTab),
    tab === 'system'       && React.createElement(SystemTab),
    tab === 'security'     && React.createElement(SecurityTab),
    tab === 'billing'      && React.createElement(BillingTab),
    tab === 'integrations' && React.createElement(IntegrationsTab),
  );
}

function OverviewTab() {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'Aktívne laboratóriá', value: '12', icon: 'building', tone: 'teal', sub: '+2 tento mesiac' }),
      React.createElement(StatCard, { label: 'Používatelia',         value: '184', icon: 'users', tone: 'green', delta: '+8 %' }),
      React.createElement(StatCard, { label: 'Mesačný MRR',           value: '4 280 €', icon: 'euro', tone: 'purple' }),
      React.createElement(StatCard, { label: 'Dostupnosť (30 d)',    value: '99,97 %', icon: 'activity', tone: 'amber', sub: 'SLA 99,9 %' }),
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } },
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Posledná aktivita')),
        React.createElement(CardContent, { style: { paddingTop: 0 } },
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            ...[
              { icon: 'building', text: 'Nový tenant — DentaPlus Trnava', when: 'pred 12 min' },
              { icon: 'users',    text: '2 nové používateľské účty (CADCAM ZA)', when: 'pred 1 h' },
              { icon: 'alertTriangle', text: 'Pohoda webhook zlyhal 3× — služba "down"', when: 'pred 2 h', warn: true },
              { icon: 'archive',  text: 'Záloha DB dokončená (32 GB)', when: 'pred 6 h' },
            ].map((it, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid #f0ede5' } },
              React.createElement('div', { style: { width: 28, height: 28, borderRadius: 7, background: it.warn ? '#fee2e2' : '#d4f0eb', color: it.warn ? '#991b1b' : '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                React.createElement(Icon, { name: it.icon, size: 14 })
              ),
              React.createElement('span', { style: { flex: 1, fontSize: 12.5, color: '#1a2320' } }, it.text),
              React.createElement('span', { style: { fontSize: 11, color: '#8a9490' } }, it.when),
            ))
          )
        )
      ),
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Stav služieb')),
        React.createElement(CardContent, { style: { paddingTop: 0 } },
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            ...[
              { name: 'API gateway',    status: 'up',   uptime: '99,99 %' },
              { name: 'PostgreSQL',     status: 'up',   uptime: '99,98 %' },
              { name: 'Mail (SMTP)',    status: 'up',   uptime: '99,80 %' },
              { name: 'Pohoda webhook', status: 'down', uptime: '94,20 %' },
            ].map(s => {
              const col = { up: '#0d7c6b', down: '#c0392b', degraded: '#d97706' }[s.status];
              return React.createElement('div', { key: s.name, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#fbfaf6', border: '1px solid #f0ede5', borderRadius: 8 } },
                React.createElement('div', { style: { width: 8, height: 8, borderRadius: '50%', background: col, boxShadow: `0 0 0 3px ${col}22` } }),
                React.createElement('span', { style: { flex: 1, fontSize: 12.5, fontWeight: 600, color: '#1a2320' } }, s.name),
                React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11.5, fontWeight: 700, color: '#5a6b66' } }, s.uptime),
              );
            })
          )
        )
      ),
    )
  );
}

function TenantsTab() {
  const tenants = [
    { id: 1, name: 'Molaris BA',      slug: 'mol-ba',     plan: 'Pro',     users: 12, jobs: 234, status: 'active',  mrr: 480, since: '2023' },
    { id: 2, name: 'Zubná Technika KE', slug: 'zt-ke',     plan: 'Pro',     users: 8,  jobs: 156, status: 'active',  mrr: 480, since: '2023' },
    { id: 3, name: 'CADCAM Žilina',     slug: 'cadcam-za', plan: 'Business',users: 18, jobs: 412, status: 'active',  mrr: 980, since: '2022' },
    { id: 4, name: 'Estetika Lab',      slug: 'est-lab',   plan: 'Starter', users: 3,  jobs: 42,  status: 'trial',   mrr: 0,   since: '2025' },
    { id: 5, name: 'DentaPlus',         slug: 'denta-plus',plan: 'Pro',     users: 6,  jobs: 89,  status: 'suspended', mrr: 0, since: '2024' },
  ];
  const planColors = { Starter: { bg: '#f3f4f6', t: '#1f2937' }, Pro: { bg: '#d4f0eb', t: '#085c4e' }, Business: { bg: '#f3e8ff', t: '#7e22ce' } };
  const statusBadge = { active: 'done', trial: 'new', suspended: 'cancelled' };
  const statusLabel = { active: 'Aktívny', trial: 'Skúšobný', suspended: 'Pozastavený' };

  return React.createElement(Card, null,
    React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Tenanti (laboratóriá)')),
    React.createElement(CardContent, { style: { paddingTop: 0 } },
      React.createElement(DataTable, {
        columns: [
          { key: 'name', label: 'Tenant', render: t => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              React.createElement('div', { style: { width: 32, height: 32, borderRadius: 7, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                React.createElement(Icon, { name: 'building', size: 15 })
              ),
              React.createElement('div', null,
                React.createElement('div', { style: { fontWeight: 600, color: '#1a2320' } }, t.name),
                React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1, fontFamily: 'ui-monospace, monospace' } }, t.slug, '.molaris.sk')
              )
            )},
          { key: 'plan', label: 'Plán', width: 100, render: t => {
              const c = planColors[t.plan];
              return React.createElement('span', { style: { display: 'inline-block', padding: '2px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.t } }, t.plan);
            }},
          { key: 'users', label: 'Používateľov', width: 110, align: 'center' },
          { key: 'jobs',  label: 'Prác (M)', width: 100, align: 'center' },
          { key: 'mrr',   label: 'MRR', width: 90, align: 'right', render: t => React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700 } }, t.mrr === 0 ? '—' : `${t.mrr} €`) },
          { key: 'status',label: 'Stav', width: 120, render: t => React.createElement(Badge, { color: statusBadge[t.status] }, statusLabel[t.status]) },
          { key: 'a', label: '', width: 90, align: 'right', render: () =>
              React.createElement('div', { style: { display: 'flex', gap: 2, justifyContent: 'flex-end' } },
                React.createElement(IconButton, { name: 'externalLink', title: 'Otvoriť ako tenant' }),
                React.createElement(IconButton, { name: 'settings', title: 'Konfigurácia' })
              )
          }
        ],
        data: tenants
      })
    )
  );
}

function UsersTab() {
  const users = [
    { id: 1, name: 'Ján Novák',      email: 'jan.novak@molaris.sk',   tenant: 'Molaris BA',      role: 'admin',      lastLogin: 'pred 2 min', active: true },
    { id: 2, name: 'Anna Mrázová',   email: 'anna.m@molaris.sk',      tenant: 'Molaris BA',      role: 'user',       lastLogin: 'pred 18 min',active: true },
    { id: 3, name: 'Lukáš Bartoš',   email: 'lukas@zt-ke.sk',           tenant: 'Zubná Technika KE', role: 'admin',      lastLogin: 'pred 2 h',   active: true },
    { id: 4, name: 'Mária Polák',    email: 'maria.p@cadcam.sk',        tenant: 'CADCAM Žilina',     role: 'user',       lastLogin: 'pred 1 dňom',active: true },
    { id: 5, name: 'Admin Platform', email: 'admin@molaris.sk',       tenant: '— (platforma)',     role: 'superadmin', lastLogin: 'práve teraz',active: true },
  ];
  const roleColor = { superadmin: { bg: '#1a2320', t: '#fef3c7' }, admin: { bg: '#d4f0eb', t: '#085c4e' }, user: { bg: '#f0ede5', t: '#5a6b66' } };
  return React.createElement(Card, null,
    React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Používatelia naprieč tenantmi')),
    React.createElement(CardContent, { style: { paddingTop: 0 } },
      React.createElement(DataTable, {
        columns: [
          { key: 'name', label: 'Používateľ', render: u => React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 600 } }, u.name),
              React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, u.email)
            )},
          { key: 'tenant', label: 'Tenant' },
          { key: 'role', label: 'Rola', width: 130, render: u => {
              const c = roleColor[u.role];
              return React.createElement('span', { style: { display: 'inline-block', padding: '2px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.t } }, u.role);
            }},
          { key: 'lastLogin', label: 'Posledné prihlásenie', width: 160 },
          { key: 'active',    label: 'Stav', width: 100, render: u => React.createElement(Badge, { color: u.active ? 'done' : 'cancelled' }, u.active ? 'Aktívny' : 'Zablokovaný') },
          { key: 'a', label: '', width: 60, align: 'right', render: () => React.createElement(IconButton, { name: 'moreHorizontal' }) }
        ],
        data: users
      })
    )
  );
}

function AuditTab() {
  const events = [
    { time: '14:08:22', level: 'info',    actor: 'jan.novak',  event: 'job.update', desc: '#12 → in_progress', tenant: 'mol-ba' },
    { time: '14:02:11', level: 'info',    actor: 'anna.m',     event: 'auth.login', desc: 'Úspešné prihlásenie', tenant: 'mol-ba' },
    { time: '13:48:50', level: 'warn',    actor: 'system',     event: 'invoice.overdue', desc: 'INV-2025-009 po splatnosti 14 dní', tenant: 'zt-ke' },
    { time: '13:21:09', level: 'info',    actor: 'admin@plat', event: 'tenant.update', desc: 'Plán denta-plus → suspended', tenant: '—' },
    { time: '12:55:30', level: 'error',   actor: 'system',     event: 'webhook.failed', desc: 'Pohoda export 5xx (retry 3/3)', tenant: 'cadcam-za' },
    { time: '12:10:01', level: 'info',    actor: 'maria.p',    event: 'patient.create', desc: 'Pacient #284', tenant: 'cadcam-za' },
  ];
  const levelStyle = {
    info:  { bg: '#d4f0eb', color: '#085c4e' },
    warn:  { bg: '#fef3c7', color: '#92400e' },
    error: { bg: '#fee2e2', color: '#991b1b' },
  };
  return React.createElement(Card, null,
    React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement(CardTitle, null, 'Audit log (dnes)'),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement(Button, { variant: 'outline', size: 'sm' },
          React.createElement(Icon, { name: 'download', size: 12 }), 'Stiahnuť CSV'),
        React.createElement(Button, { variant: 'outline', size: 'sm' },
          React.createElement(Icon, { name: 'filter', size: 12 }), 'Filtre')
      )
    ),
    React.createElement(CardContent, { style: { paddingTop: 0 } },
      React.createElement('div', { style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, background: '#1a2320', borderRadius: 8, padding: 14, color: '#d4cfc5', overflowX: 'auto' } },
        ...events.map((e, i) => {
          const s = levelStyle[e.level];
          return React.createElement('div', { key: i, style: { display: 'flex', gap: 14, padding: '4px 0', whiteSpace: 'nowrap', alignItems: 'center' } },
            React.createElement('span', { style: { color: '#8a9490' } }, e.time),
            React.createElement('span', { style: { padding: '0 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em' } }, e.level),
            React.createElement('span', { style: { color: '#b0ddd5', minWidth: 130 } }, e.event),
            React.createElement('span', { style: { color: '#fbfaf6' } }, e.desc),
            React.createElement('span', { style: { marginLeft: 'auto', color: '#8a9490' } }, e.actor, ' @ ', e.tenant)
          );
        })
      )
    )
  );
}

function SystemTab() {
  const services = [
    { name: 'API gateway',    status: 'up',   latency: '42 ms',  uptime: '99,99 %' },
    { name: 'PostgreSQL',     status: 'up',   latency: '8 ms',   uptime: '99,98 %' },
    { name: 'Redis cache',    status: 'up',   latency: '2 ms',   uptime: '100 %' },
    { name: 'Mail (SMTP)',    status: 'up',   latency: '180 ms', uptime: '99,80 %' },
    { name: 'Pohoda webhook', status: 'down', latency: '—',      uptime: '94,20 %' },
    { name: 'S3 storage',     status: 'up',   latency: '120 ms', uptime: '99,95 %' },
  ];
  const statusCol = { up: '#0d7c6b', down: '#c0392b', degraded: '#d97706' };
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 } },
    React.createElement(Card, null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Stav služieb')),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden', background: '#fff' } },
          ...services.map((s, i) => React.createElement('div', {
            key: s.name,
            style: { display: 'grid', gridTemplateColumns: '16px 1fr 100px 100px', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid #f0ede5' }
          },
            React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: statusCol[s.status], boxShadow: `0 0 0 3px ${statusCol[s.status]}22` } }),
            React.createElement('span', { style: { fontSize: 13, fontWeight: 600 } }, s.name),
            React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: '#5a6b66', textAlign: 'right' } }, s.latency),
            React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 12, fontWeight: 700, color: '#1a2320', textAlign: 'right' } }, s.uptime),
          ))
        )
      )
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Verzia')),
        React.createElement(CardContent, null,
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 } },
            React.createElement(SysRow, { label: 'Verzia API', value: 'v3.14.2' }),
            React.createElement(SysRow, { label: 'Verzia frontend', value: 'v2.8.0' }),
            React.createElement(SysRow, { label: 'Posledný deploy', value: '2 dni dozadu' }),
            React.createElement(SysRow, { label: 'Build', value: React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 11.5 } }, '7b3f9a2') })
          )
        )
      ),
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Údržba')),
        React.createElement(CardContent, null,
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            React.createElement(Button, { variant: 'outline', size: 'sm', style: { width: '100%' } },
              React.createElement(Icon, { name: 'refreshCw', size: 13 }), 'Reštart služieb'),
            React.createElement(Button, { variant: 'outline', size: 'sm', style: { width: '100%' } },
              React.createElement(Icon, { name: 'archive', size: 13 }), 'Spustiť zálohu'),
            React.createElement(Button, { variant: 'destructive', size: 'sm', style: { width: '100%' } },
              React.createElement(Icon, { name: 'alertTriangle', size: 13 }), 'Maintenance režim')
          )
        )
      )
    )
  );
}

function SysRow({ label, value }) {
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px dashed #f0ede5' } },
    React.createElement('span', { style: { color: '#8a9490' } }, label),
    React.createElement('span', { style: { fontWeight: 600, color: '#1a2320' } }, value)
  );
}

// ── Bezpečnosť platformy ─────────────────────────────────────────────────────────
function SecurityTab() {
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } },
    React.createElement(Card, null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Politiky prihlásenia')),
      React.createElement(CardContent, null,
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
          React.createElement(SaToggleRow, { label: 'Vyžadovať 2FA pre adminov',  desc: 'Druhý faktor pre rolu administrátor a vyššie.', value: true }),
          React.createElement(SaToggleRow, { label: 'SSO (Google Workspace)',     desc: 'Povolené prihlasovanie cez SSO.',              value: true }),
          React.createElement(SaToggleRow, { label: 'Vynútiť silné heslo',        desc: 'Minimálne 12 znakov, mix znakov.',             value: false }),
          React.createElement(SaToggleRow, { label: 'Auto-odhlásenie po 30 min',  desc: 'Pri nečinnosti relácie.',                       value: true }),
        )
      )
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'API kľúče')),
        React.createElement(CardContent, null,
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            ...[
              { name: 'Pohoda export', last: 'pred 2 h' },
              { name: 'Mobile app',    last: 'pred 4 min' },
              { name: 'Reporting BI',  last: 'pred 1 dňom' },
            ].map(k => React.createElement('div', { key: k.name, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fbfaf6', border: '1px solid #f0ede5', borderRadius: 8 } },
              React.createElement(Icon, { name: 'lock', size: 13, color: '#5a6b66' }),
              React.createElement('span', { style: { flex: 1, fontSize: 12.5, fontWeight: 600, color: '#1a2320' } }, k.name),
              React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 10.5, color: '#8a9490' } }, 'sk_••••', k.name.slice(0, 4).toLowerCase()),
              React.createElement('span', { style: { fontSize: 11, color: '#8a9490' } }, k.last),
            ))
          ),
          React.createElement(Button, { variant: 'outline', size: 'sm', style: { marginTop: 12 } },
            React.createElement(Icon, { name: 'plus', size: 13 }), 'Vygenerovať kľúč')
        )
      ),
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Šifrovanie')),
        React.createElement(CardContent, null,
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 } },
            React.createElement(SysRow, { label: 'Šifrovanie v databáze', value: 'AES-256 (at rest)' }),
            React.createElement(SysRow, { label: 'TLS verzia',             value: '1.3' }),
            React.createElement(SysRow, { label: 'Rotácia kľúčov',         value: '90 dní' }),
          )
        )
      ),
    )
  );
}

function SaToggleRow({ label, desc, value }) {
  const [v, setV] = React.useState(value);
  return React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: '#fbfaf6', border: '1px solid #f0ede5', borderRadius: 8 } },
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, label),
      React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 2 } }, desc),
    ),
    React.createElement('button', {
      onClick: () => setV(!v),
      style: {
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: v ? '#0d7c6b' : '#d4cfc5', position: 'relative', flexShrink: 0,
        transition: 'background .15s', padding: 0,
      }
    },
      React.createElement('div', { style: { position: 'absolute', top: 2, left: v ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' } })
    )
  );
}

// ── Fakturácia platformy ──────────────────────────────────────────────────────────
function BillingTab() {
  const invoices = [
    { id: 'PL-2025-014', tenant: 'CADCAM Žilina',   plan: 'Business', amount: 980, status: 'paid',    due: '02.4.2025' },
    { id: 'PL-2025-013', tenant: 'Molaris BA',      plan: 'Pro',      amount: 480, status: 'paid',    due: '02.4.2025' },
    { id: 'PL-2025-012', tenant: 'Zubná Technika KE',plan: 'Pro',     amount: 480, status: 'pending', due: '15.4.2025' },
    { id: 'PL-2025-011', tenant: 'DentaPlus',       plan: 'Pro',      amount: 480, status: 'overdue', due: '01.3.2025' },
  ];
  const statusBadge = { paid: 'done', pending: 'new', overdue: 'cancelled' };
  const statusLabel = { paid: 'Uhradená', pending: 'Čaká', overdue: 'Po splatnosti' };
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'MRR',              value: '4 280 €', icon: 'euro',       tone: 'teal' }),
      React.createElement(StatCard, { label: 'ARR projekcia',    value: '51 360 €',icon: 'trendingUp', tone: 'green' }),
      React.createElement(StatCard, { label: 'Po splatnosti',    value: '480 €',   icon: 'alertTriangle', tone: 'amber', sub: '1 faktúra' }),
    ),
    React.createElement(Card, null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Faktúry tenantov')),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        React.createElement(DataTable, {
          columns: [
            { key: 'id',     label: 'Číslo',   render: r => React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11.5, fontWeight: 600 } }, r.id) },
            { key: 'tenant', label: 'Tenant' },
            { key: 'plan',   label: 'Plán', width: 100 },
            { key: 'amount', label: 'Suma', width: 100, align: 'right', render: r => React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700 } }, `${r.amount} €`) },
            { key: 'due',    label: 'Splatnosť', width: 110 },
            { key: 'status', label: 'Stav', width: 120, render: r => React.createElement(Badge, { color: statusBadge[r.status] }, statusLabel[r.status]) },
            { key: 'a',      label: '', width: 60, align: 'right', render: () => React.createElement(IconButton, { name: 'externalLink' }) },
          ],
          data: invoices,
        })
      )
    )
  );
}

// ── Integrácie ────────────────────────────────────────────────────────────────────
function IntegrationsTab() {
  const integrations = [
    { name: 'Pohoda (účtovníctvo)',  state: 'down',  desc: 'Synchronizácia faktúr a partnerov.',     events: '12 / hod' },
    { name: 'Stripe (platby)',       state: 'up',    desc: 'Spracovanie kariet a SEPA inkás.',       events: '4 / hod' },
    { name: 'Mailgun (e-mail)',      state: 'up',    desc: 'Transakčné a notifikačné e-maily.',      events: '180 / hod' },
    { name: 'Telegram / Slack',      state: 'up',    desc: 'Notifikácie tímom v reálnom čase.',      events: '8 / hod' },
    { name: 'S3 storage',            state: 'up',    desc: 'Archív príloh a STL modelov.',           events: '—' },
  ];
  return React.createElement(Card, null,
    React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement(CardTitle, null, 'Externé služby a webhooky'),
      React.createElement(Button, { variant: 'outline', size: 'sm' }, React.createElement(Icon, { name: 'plus', size: 13 }), 'Pridať integráciu')
    ),
    React.createElement(CardContent, { style: { paddingTop: 0 } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        ...integrations.map(it => {
          const col = { up: '#0d7c6b', down: '#c0392b', degraded: '#d97706' }[it.state];
          return React.createElement('div', { key: it.name, style: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fbfaf6', border: '1px solid #f0ede5', borderRadius: 8 } },
            React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: col, boxShadow: `0 0 0 3px ${col}22`, flexShrink: 0 } }),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, it.name),
              React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 1 } }, it.desc),
            ),
            React.createElement('span', { style: { fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#5a6b66' } }, it.events),
            React.createElement(IconButton, { name: 'settings', title: 'Konfigurácia' }),
          );
        })
      )
    )
  );
}

Object.assign(window, { Superadmin });
