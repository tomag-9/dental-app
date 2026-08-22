// Superadmin.jsx — Molaris Superadmin (platform-level management).
//
// Every tab reads live data through window.MolarisAPI.superadmin. Tabs that had
// no backend behind them (Bezpečnosť, Integrácie) were removed together with
// their sidebar entries in #109 — a mock in production UI is worse than a
// missing feature.
//
// The sidebar drives which tab is shown via the `currentPage` prop:
// `sa_overview`, `sa_tenants`, `sa_users`, `sa_audit`, `sa_system`, `sa_billing`.

const SA_PLAN_LABELS = { free: 'Bezplatný', pro: 'Pro', enterprise: 'Enterprise' };
const SA_PLAN_COLORS = {
  free: { bg: '#f3f4f6', t: '#1f2937' },
  pro: { bg: '#d4f0eb', t: '#085c4e' },
  enterprise: { bg: '#f3e8ff', t: '#7e22ce' },
};
const SA_SUB_STATUS_LABELS = {
  active: 'Aktívne',
  past_due: 'Po splatnosti',
  cancelled: 'Zrušené',
  inactive: 'Neaktívne',
};
const SA_SUB_STATUS_BADGE = {
  active: 'done',
  past_due: 'cancelled',
  cancelled: 'cancelled',
  inactive: 'draft',
};
const SA_ROLE_COLORS = {
  superadmin: { bg: '#1a2320', t: '#fef3c7' },
  admin: { bg: '#d4f0eb', t: '#085c4e' },
  technician: { bg: '#fef3c7', t: '#92400e' },
  user: { bg: '#f0ede5', t: '#5a6b66' },
};
const SA_HEALTH_COLORS = { ok: '#0d7c6b', warning: '#d97706', error: '#c0392b' };
const SA_HEALTH_LABELS = { ok: 'V poriadku', warning: 'Upozornenie', error: 'Chyba', degraded: 'Obmedzený' };
const SA_CHECK_LABELS = {
  database: 'Databáza (PostgreSQL)',
  migrations: 'Migrácie',
  memory: 'Pamäť',
};

function saFmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function saFmtNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('sk-SK') : '—';
}

/**
 * Shared loader for the superadmin tabs: runs `loader`, tracks
 * loading / error / permission-denied state and exposes a retry.
 */
function useSuperadminData(loader, deps) {
  const [state, setState] = React.useState({ status: 'loading', data: null, error: '' });
  const [reloadToken, setReloadToken] = React.useState(0);
  const depList = deps || [];

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null, error: '' });
    Promise.resolve()
      .then(loader)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: '' });
      })
      .catch((error) => {
        if (cancelled) return;
        const denied = (error && error.status === 403) || isPermissionDeniedError(error && error.message);
        setState({
          status: denied ? 'permission' : 'error',
          data: null,
          error: (error && error.message) || 'Načítanie zlyhalo.',
        });
      });
    return () => { cancelled = true; };
    // `loader` is intentionally not a dependency: callers pass an inline
    // closure, so the explicit `deps` list is what decides when to refetch.
  }, [reloadToken, ...depList]);

  return { ...state, reload: () => setReloadToken((n) => n + 1) };
}

/** Renders loading / error / permission states; returns null once data is ready. */
function saStatePanel(state, emptyTitle) {
  if (state.status === 'loading') {
    return React.createElement(ScreenStatePanel, { state: 'loading', message: 'Načítavam platformové dáta…' });
  }
  if (state.status === 'permission') {
    return React.createElement(ScreenStatePanel, {
      state: 'permission',
      description: 'Táto sekcia je dostupná iba superadministrátorovi platformy.',
    });
  }
  if (state.status === 'error') {
    return React.createElement(ScreenStatePanel, {
      state: 'error',
      title: emptyTitle || 'Dáta sa nepodarilo načítať',
      error: state.error,
      onRetry: state.reload,
    });
  }
  return null;
}

function Superadmin({ currentPage = 'sa_overview' }) {
  const routeToTab = {
    sa_overview: 'overview',
    sa_tenants: 'tenants',
    sa_users: 'users',
    sa_audit: 'audit',
    sa_system: 'system',
    sa_billing: 'billing',
  };
  const tab = routeToTab[currentPage] || 'overview';

  const headers = {
    overview: { title: 'Prehľad platformy', subtitle: 'Kľúčové ukazovatele naprieč všetkými tenantmi.' },
    tenants: { title: 'Tenanti', subtitle: 'Laboratóriá pripojené do platformy.' },
    users: { title: 'Používatelia platformy', subtitle: 'Účty naprieč všetkými tenantmi.' },
    audit: { title: 'Audit log', subtitle: 'Záznam akcií naprieč platformou.' },
    system: { title: 'Systém', subtitle: 'Zdravie služieb a beh prostredia.' },
    billing: { title: 'Fakturácia platformy', subtitle: 'Predplatné laboratórií, MRR a ARR.' },
  };
  const h = headers[tab];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, { title: h.title, subtitle: h.subtitle }),
    tab === 'overview' && React.createElement(SaOverviewTab, null),
    tab === 'tenants' && React.createElement(SaTenantsTab, null),
    tab === 'users' && React.createElement(SaUsersTab, null),
    tab === 'audit' && React.createElement(SaAuditTab, null),
    tab === 'system' && React.createElement(SaSystemTab, null),
    tab === 'billing' && React.createElement(SaBillingTab, null),
  );
}

// ── Prehľad ──────────────────────────────────────────────────────────────────
function SaOverviewTab() {
  const state = useSuperadminData(() => window.MolarisAPI.superadmin.fetchSuperadminMetrics());
  const panel = saStatePanel(state, 'Prehľad sa nepodarilo načítať');
  if (panel) return panel;

  const m = state.data || {};
  const activity = Array.isArray(m.recent_activity) ? m.recent_activity : [];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      React.createElement(StatCard, {
        label: 'Laboratóriá', value: saFmtNumber(m.total_labs), icon: 'building', tone: 'teal',
        sub: `+${saFmtNumber(m.new_labs_this_month)} tento mesiac`,
      }),
      React.createElement(StatCard, {
        label: 'Aktívni používatelia', value: saFmtNumber(m.total_users), icon: 'users', tone: 'green',
        sub: `+${saFmtNumber(m.new_users_this_month)} tento mesiac`,
      }),
      React.createElement(StatCard, {
        label: 'MRR', value: fmtEur(m.mrr), icon: 'euro', tone: 'purple',
        sub: `ARR ${fmtEur(m.arr)}`,
      }),
      React.createElement(StatCard, {
        label: 'Aktívne predplatné', value: saFmtNumber(m.active_subscriptions), icon: 'receipt', tone: 'amber',
        sub: `${saFmtNumber(m.past_due_subscriptions)} po splatnosti`,
      }),
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'V skúšobnej dobe', value: saFmtNumber(m.trial_labs), icon: 'clock', tone: 'blue' }),
      React.createElement(StatCard, { label: 'Zrušené tento mesiac', value: saFmtNumber(m.cancelled_this_month), icon: 'trendingDown', tone: 'red' }),
      React.createElement(StatCard, { label: 'Churn (tento mesiac)', value: `${String(m.churn_rate ?? '0').replace('.', ',')} %`, icon: 'activity', tone: 'amber' }),
    ),
    React.createElement(Card, null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Posledná aktivita')),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        activity.length === 0
          ? React.createElement(EmptyState, {
              title: 'Žiadna zaznamenaná aktivita',
              description: 'Audit log zatiaľ neobsahuje žiadne záznamy.',
            })
          : React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
              ...activity.map((it, i) => React.createElement('div', {
                key: it.id ?? i,
                style: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid #f0ede5' },
              },
                React.createElement('div', { style: { width: 28, height: 28, borderRadius: 7, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
                  React.createElement(Icon, { name: 'activity', size: 14 })
                ),
                React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                  React.createElement('div', { style: { fontSize: 12.5, color: '#1a2320', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it.description || it.action),
                  React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } },
                    it.action, ' · ', it.actor || 'systém', it.lab ? ` · ${it.lab}` : ''
                  ),
                ),
                React.createElement('span', { style: { fontSize: 11, color: '#8a9490', flexShrink: 0 } }, saFmtDateTime(it.created_at)),
              ))
            )
      )
    )
  );
}

// ── Tenanti ──────────────────────────────────────────────────────────────────
function SaTenantsTab() {
  const state = useSuperadminData(() => Promise.all([
    window.MolarisAPI.superadmin.fetchAllLabs(),
    window.MolarisAPI.superadmin.fetchSubscriptions().catch(() => []),
    window.MolarisAPI.superadmin.fetchAllUsers().catch(() => []),
  ]).then(([labs, subscriptions, users]) => ({ labs, subscriptions, users })));

  const panel = saStatePanel(state, 'Tenantov sa nepodarilo načítať');
  if (panel) return panel;

  const { labs, subscriptions, users } = state.data;
  const subByLab = {};
  for (const sub of subscriptions) subByLab[sub.lab] = sub;
  const usersByLab = {};
  for (const user of users) {
    if (user.lab == null) continue;
    usersByLab[user.lab] = (usersByLab[user.lab] || 0) + 1;
  }

  const rows = labs.map((lab) => {
    const sub = subByLab[lab.id];
    return {
      id: lab.id,
      name: lab.name,
      slug: lab.slug,
      city: lab.city,
      users: usersByLab[lab.id] || 0,
      plan: sub ? sub.plan : null,
      status: sub ? sub.status : null,
      mrr: sub ? sub.mrr : null,
      created_at: lab.created_at,
    };
  });

  return React.createElement(Card, null,
    React.createElement(CardHeader, null,
      React.createElement(CardTitle, null, `Tenanti (laboratóriá) — ${rows.length}`)
    ),
    React.createElement(CardContent, { style: { paddingTop: 0 } },
      rows.length === 0
        ? React.createElement(EmptyState, { title: 'Žiadne laboratóriá', description: 'Do platformy zatiaľ nie je pripojený žiadny tenant.' })
        : React.createElement(DataTable, {
            columns: [
              { key: 'name', label: 'Tenant', render: (t) => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                  React.createElement('div', { style: { width: 32, height: 32, borderRadius: 7, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
                    React.createElement(Icon, { name: 'building', size: 15 })
                  ),
                  React.createElement('div', null,
                    React.createElement('div', { style: { fontWeight: 600, color: '#1a2320' } }, t.name),
                    React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1, fontFamily: 'ui-monospace, monospace' } }, t.slug || '—')
                  )
                ) },
              { key: 'city', label: 'Mesto', width: 130, render: (t) => t.city || '—' },
              { key: 'plan', label: 'Plán', width: 110, render: (t) => {
                  if (!t.plan) return React.createElement('span', { style: { color: '#8a9490' } }, 'Bez predplatného');
                  const c = SA_PLAN_COLORS[t.plan] || SA_PLAN_COLORS.free;
                  return React.createElement('span', { style: { display: 'inline-block', padding: '2px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.t } }, SA_PLAN_LABELS[t.plan] || t.plan);
                } },
              { key: 'users', label: 'Používateľov', width: 110, align: 'center' },
              { key: 'mrr', label: 'MRR', width: 100, align: 'right', render: (t) => React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700 } }, t.mrr == null ? '—' : fmtEur(t.mrr)) },
              { key: 'status', label: 'Predplatné', width: 130, render: (t) => t.status
                  ? React.createElement(Badge, { color: SA_SUB_STATUS_BADGE[t.status] || 'draft' }, SA_SUB_STATUS_LABELS[t.status] || t.status)
                  : React.createElement('span', { style: { color: '#8a9490' } }, '—') },
              { key: 'created_at', label: 'Registrovaný', width: 120, render: (t) => fmtDate(t.created_at) },
            ],
            data: rows,
          })
    )
  );
}

// ── Používatelia ─────────────────────────────────────────────────────────────
function SaUsersTab() {
  const state = useSuperadminData(() => Promise.all([
    window.MolarisAPI.superadmin.fetchAllUsers(),
    window.MolarisAPI.superadmin.fetchAllLabs().catch(() => []),
  ]).then(([users, labs]) => ({ users, labs })));

  const [search, setSearch] = React.useState('');
  const [labFilter, setLabFilter] = React.useState('all');

  const panel = saStatePanel(state, 'Používateľov sa nepodarilo načítať');
  if (panel) return panel;

  const { users, labs } = state.data;
  const labNames = {};
  for (const lab of labs) labNames[lab.id] = lab.name;

  const needle = search.trim().toLowerCase();
  const rows = users.filter((u) => {
    if (labFilter === 'none' && u.lab != null) return false;
    if (labFilter !== 'all' && labFilter !== 'none' && String(u.lab) !== labFilter) return false;
    if (!needle) return true;
    const haystack = [u.username, u.email, u.first_name, u.last_name, u.nickname].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(needle);
  });

  const selectStyle = {
    padding: '7px 10px', borderRadius: 8, border: '1px solid #e4ded4', background: '#fff',
    fontSize: 12.5, fontFamily: 'Manrope,sans-serif', color: '#1a2320',
  };

  return React.createElement(Card, null,
    React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
      React.createElement(CardTitle, null, `Používatelia naprieč tenantmi — ${rows.length}`),
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Meno alebo e-mail…', width: 220 }),
        React.createElement('select', {
          value: labFilter,
          onChange: (e) => setLabFilter(e.target.value),
          'aria-label': 'Filtrovať podľa laboratória',
          style: selectStyle,
        },
          React.createElement('option', { value: 'all' }, 'Všetky laboratóriá'),
          React.createElement('option', { value: 'none' }, 'Bez laboratória'),
          ...labs.map((lab) => React.createElement('option', { key: lab.id, value: String(lab.id) }, lab.name))
        )
      )
    ),
    React.createElement(CardContent, { style: { paddingTop: 0 } },
      rows.length === 0
        ? React.createElement(EmptyState, {
            title: 'Žiadni používatelia',
            description: users.length === 0 ? 'Platforma zatiaľ nemá žiadne účty.' : 'Filtru nezodpovedá žiadny účet.',
          })
        : React.createElement(DataTable, {
            columns: [
              { key: 'name', label: 'Používateľ', render: (u) => React.createElement('div', null,
                  React.createElement('div', { style: { fontWeight: 600 } }, [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username),
                  React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, u.email || u.username)
                ) },
              { key: 'lab', label: 'Tenant', render: (u) => (u.lab_details && u.lab_details.name) || labNames[u.lab] || '— (platforma)' },
              { key: 'role', label: 'Rola', width: 130, render: (u) => {
                  const c = SA_ROLE_COLORS[u.role] || SA_ROLE_COLORS.user;
                  return React.createElement('span', { style: { display: 'inline-block', padding: '2px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.t } }, u.role);
                } },
              { key: 'date_joined', label: 'Registrovaný', width: 130, render: (u) => fmtDate(u.date_joined) },
              { key: 'is_active', label: 'Stav', width: 110, render: (u) => React.createElement(Badge, { color: u.is_active ? 'done' : 'cancelled' }, u.is_active ? 'Aktívny' : 'Zablokovaný') },
            ],
            data: rows,
          })
    )
  );
}

// ── Audit log ────────────────────────────────────────────────────────────────
const SA_AUDIT_PAGE_SIZE = 50;

function SaAuditTab() {
  const [page, setPage] = React.useState(1);
  const state = useSuperadminData(
    () => window.MolarisAPI.superadmin.fetchAuditLogs({ page, pageSize: SA_AUDIT_PAGE_SIZE }),
    [page],
  );

  const panel = saStatePanel(state, 'Audit log sa nepodarilo načítať');
  if (panel) return panel;

  const { results, count, next, previous } = state.data;
  const totalPages = Math.max(1, Math.ceil((count || results.length) / SA_AUDIT_PAGE_SIZE));

  return React.createElement(Card, null,
    React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
      React.createElement(CardTitle, null, `Audit log — ${saFmtNumber(count)} záznamov`),
      React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        React.createElement(Button, {
          variant: 'outline', size: 'sm', disabled: !previous, onClick: () => setPage((p) => Math.max(1, p - 1)),
        }, React.createElement(Icon, { name: 'chevronLeft', size: 12 }), 'Predošlé'),
        React.createElement('span', { style: { fontSize: 12, color: '#5a6b66' } }, `${page} / ${totalPages}`),
        React.createElement(Button, {
          variant: 'outline', size: 'sm', disabled: !next, onClick: () => setPage((p) => p + 1),
        }, 'Ďalšie', React.createElement(Icon, { name: 'chevronRight', size: 12 })),
      )
    ),
    React.createElement(CardContent, { style: { paddingTop: 0 } },
      results.length === 0
        ? React.createElement(EmptyState, { title: 'Audit log je prázdny', description: 'Zatiaľ neboli zaznamenané žiadne akcie.' })
        : React.createElement('div', {
            style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, background: '#1a2320', borderRadius: 8, padding: 14, color: '#d4cfc5', overflowX: 'auto' },
          },
            ...results.map((e) => React.createElement('div', {
              key: e.id,
              style: { display: 'flex', gap: 14, padding: '4px 0', whiteSpace: 'nowrap', alignItems: 'center' },
            },
              React.createElement('span', { style: { color: '#8a9490', minWidth: 130 } }, saFmtDateTime(e.created_at)),
              React.createElement('span', { style: { color: '#b0ddd5', minWidth: 150 } }, e.action),
              React.createElement('span', { style: { color: '#fbfaf6', flex: 1 } }, e.description || `${e.entity_type || ''} ${e.entity_id ?? ''}`.trim() || '—'),
              React.createElement('span', { style: { color: '#8a9490' } }, e.actor_username || 'systém', ' @ ', e.lab_name || '—'),
            ))
          )
    )
  );
}

// ── Systém ───────────────────────────────────────────────────────────────────
function SaSystemTab() {
  const state = useSuperadminData(() => window.MolarisAPI.superadmin.fetchSystemHealth());
  const panel = saStatePanel(state, 'Stav systému sa nepodarilo načítať');
  if (panel) return panel;

  const health = state.data || {};
  const checks = Array.isArray(health.checks) ? health.checks : [];
  const metrics = health.metrics || {};
  const runtime = health.runtime || {};
  const overallColor = SA_HEALTH_COLORS[health.status] || '#d97706';

  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 } },
    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement(CardTitle, null, 'Stav služieb'),
        React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: overallColor } },
          React.createElement('span', { style: { width: 9, height: 9, borderRadius: '50%', background: overallColor, boxShadow: `0 0 0 3px ${overallColor}22` } }),
          SA_HEALTH_LABELS[health.status] || health.status || '—'
        )
      ),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        checks.length === 0
          ? React.createElement(EmptyState, { title: 'Žiadne kontroly', description: 'Backend nevrátil žiadnu kontrolu stavu.' })
          : React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden', background: '#fff' } },
              ...checks.map((c, i) => {
                const col = SA_HEALTH_COLORS[c.status] || '#8a9490';
                return React.createElement('div', {
                  key: c.service,
                  style: { display: 'grid', gridTemplateColumns: '16px 200px 1fr', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid #f0ede5' },
                },
                  React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: col, boxShadow: `0 0 0 3px ${col}22` } }),
                  React.createElement('span', { style: { fontSize: 13, fontWeight: 600 } }, SA_CHECK_LABELS[c.service] || c.service),
                  React.createElement('span', { style: { fontSize: 12, color: '#5a6b66' } }, c.detail || SA_HEALTH_LABELS[c.status] || c.status),
                );
              })
            ),
        React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 10 } },
          'Zistené ', saFmtDateTime(health.generated_at)
        )
      )
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Prostredie')),
        React.createElement(CardContent, null,
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 } },
            React.createElement(SaSysRow, { label: 'Django', value: runtime.django_version || '—' }),
            React.createElement(SaSysRow, { label: 'Python', value: runtime.python_version || '—' }),
            React.createElement(SaSysRow, { label: 'Čakajúce migrácie', value: runtime.pending_migrations == null ? '—' : saFmtNumber(runtime.pending_migrations) }),
            runtime.memory && React.createElement(SaSysRow, {
              label: 'Využitie pamäte',
              value: `${String(runtime.memory.percent_used).replace('.', ',')} % z ${saFmtNumber(runtime.memory.total_mb)} MB`,
            }),
          )
        )
      ),
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Platforma v číslach')),
        React.createElement(CardContent, null,
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 } },
            React.createElement(SaSysRow, { label: 'Laboratóriá', value: saFmtNumber(metrics.labs) }),
            React.createElement(SaSysRow, { label: 'Používatelia', value: saFmtNumber(metrics.users) }),
            React.createElement(SaSysRow, { label: 'Čakajúce pozvánky', value: saFmtNumber(metrics.pending_invitations) }),
            React.createElement(SaSysRow, { label: 'Neprečítané notifikácie', value: saFmtNumber(metrics.unread_notifications) }),
          )
        )
      )
    )
  );
}

function SaSysRow({ label, value }) {
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '4px 0', borderBottom: '1px dashed #f0ede5' } },
    React.createElement('span', { style: { color: '#8a9490' } }, label),
    React.createElement('span', { style: { fontWeight: 600, color: '#1a2320', textAlign: 'right' } }, value)
  );
}

// ── Fakturácia platformy ─────────────────────────────────────────────────────
function SaBillingTab() {
  const state = useSuperadminData(() => Promise.all([
    window.MolarisAPI.superadmin.fetchSubscriptions(),
    window.MolarisAPI.superadmin.fetchAllLabs().catch(() => []),
    window.MolarisAPI.superadmin.fetchSuperadminMetrics().catch(() => null),
  ]).then(([subscriptions, labs, metrics]) => ({ subscriptions, labs, metrics })));

  const panel = saStatePanel(state, 'Predplatné sa nepodarilo načítať');
  if (panel) return panel;

  const { subscriptions, labs, metrics } = state.data;
  const labNames = {};
  for (const lab of labs) labNames[lab.id] = lab.name;

  const sumMrr = subscriptions
    .filter((s) => s.status === 'active' || s.status === 'past_due')
    .reduce((acc, s) => acc + (Number(s.mrr) || 0), 0);
  const mrr = metrics ? metrics.mrr : sumMrr;
  const arr = metrics ? metrics.arr : sumMrr * 12;
  const pastDue = subscriptions.filter((s) => s.status === 'past_due');
  const pastDueAmount = pastDue.reduce((acc, s) => acc + (Number(s.mrr) || 0), 0);

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'MRR', value: fmtEur(mrr), icon: 'euro', tone: 'teal' }),
      React.createElement(StatCard, { label: 'ARR projekcia', value: fmtEur(arr), icon: 'trendingUp', tone: 'green' }),
      React.createElement(StatCard, {
        label: 'Po splatnosti', value: fmtEur(pastDueAmount), icon: 'alertTriangle', tone: 'amber',
        sub: `${pastDue.length} predplatné`,
      }),
    ),
    React.createElement(Card, null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, null, `Predplatné tenantov — ${subscriptions.length}`)),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        subscriptions.length === 0
          ? React.createElement(EmptyState, { title: 'Žiadne predplatné', description: 'Zatiaľ nie je evidované žiadne platformové predplatné.' })
          : React.createElement(DataTable, {
              columns: [
                { key: 'lab', label: 'Tenant', render: (s) => labNames[s.lab] || `#${s.lab}` },
                { key: 'plan', label: 'Plán', width: 120, render: (s) => {
                    const c = SA_PLAN_COLORS[s.plan] || SA_PLAN_COLORS.free;
                    return React.createElement('span', { style: { display: 'inline-block', padding: '2px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.t } }, SA_PLAN_LABELS[s.plan] || s.plan);
                  } },
                { key: 'seats', label: 'Miesta', width: 80, align: 'center' },
                { key: 'mrr', label: 'MRR', width: 110, align: 'right', render: (s) => React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700 } }, s.mrr == null ? '—' : fmtEur(s.mrr)) },
                { key: 'current_period_end', label: 'Koniec obdobia', width: 130, render: (s) => fmtDate(s.current_period_end) },
                { key: 'trial_ends_at', label: 'Koniec skúšky', width: 130, render: (s) => fmtDate(s.trial_ends_at) },
                { key: 'status', label: 'Stav', width: 130, render: (s) => React.createElement(Badge, { color: SA_SUB_STATUS_BADGE[s.status] || 'draft' }, SA_SUB_STATUS_LABELS[s.status] || s.status) },
              ],
              data: subscriptions,
            })
      )
    )
  );
}

Object.assign(window, { Superadmin });
