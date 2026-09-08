// Jobs.jsx — Molaris Jobs list (refreshed with SVG icons, row click → detail)

function Jobs({ onNavigate, onOpenJob, onNewJob }) {
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const [jobToDelete, setJobToDelete] = React.useState(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [clinicFilter, setClinicFilter] = React.useState([]);
  const filterRef = useClickOutside(() => setFilterOpen(false));
  const [remoteJobs, setRemoteJobs] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();
  const canCreate = window.canCreateRecords ? window.canCreateRecords() : false;
  // 'completed' groups 4 backend statuses; the server can only filter on one, so fetch
  // unfiltered and let the client-side filter below apply the grouped match.
  const COMPLETED_TAB_STATUSES = ['completed', 'finished_unfactured', 'finished_factured', 'closed'];

  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!window.MolarisAPI.fetchJobs) return;
      if (window.MolarisAPI.isAuthenticated && !window.MolarisAPI.isAuthenticated()) {
        setRemoteJobs(null);
        setError('');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      window.MolarisAPI.fetchJobs({ search, status: tab === 'completed' ? 'all' : tab })
        .then((jobs) => { if (!cancelled) setRemoteJobs(jobs); })
        .catch((err) => {
          if (!cancelled) {
            setError((err && err.message) || 'Zoznam prác sa nepodarilo filtrovať.');
            setRemoteJobs(null);
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search, tab]);

  const pageHeader = React.createElement(PageHeader, {
    title: 'Práce',
    subtitle: 'Prehľad, správa a stav zákaziek.',
    actions: [
      React.createElement('div', { key: 'filters', ref: filterRef, style: { position: 'relative' } },
        React.createElement(Button, { variant: 'outline', onClick: () => setFilterOpen(value => !value) },
          React.createElement(Icon, { name: 'filter', size: 14 }), 'Filtre',
          clinicFilter.length > 0 && React.createElement(Badge, { color: 'progress' }, clinicFilter.length)),
        filterOpen && React.createElement('div', {
          style: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 240, background: '#fff', border: '1px solid #e4ded4', borderRadius: 10, boxShadow: '0 14px 36px rgba(26,35,32,.14)', zIndex: 40, padding: 10 }
        },
          React.createElement('div', { style: { fontSize: 10.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.05em', padding: '2px 4px 8px' } }, 'Klinika'),
          ...(window.__MOLARIS_WORKSPACE?.jobs || []).map(job => job.clinic).filter((clinic, index, all) => clinic && all.indexOf(clinic) === index).map(clinic =>
            React.createElement('label', { key: clinic, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12.5, color: '#1a2320', cursor: 'pointer' } },
              React.createElement('input', {
                type: 'checkbox', checked: clinicFilter.includes(clinic),
                onChange: () => setClinicFilter(current => current.includes(clinic) ? current.filter(value => value !== clinic) : [...current, clinic])
              }), clinic)),
          clinicFilter.length > 0 && React.createElement('button', {
            onClick: () => setClinicFilter([]),
            style: { marginTop: 6, width: '100%', padding: 6, border: 0, borderRadius: 6, background: '#f4f1ea', color: '#0d7c6b', fontFamily: 'Manrope,sans-serif', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }
          }, 'Vymazať filtre')
        )
      ),
      React.createElement(Button, {
        key: 'n',
        onClick: canCreate ? onNewJob : undefined,
        disabled: !canCreate,
        title: canCreate ? undefined : 'Novú prácu môže vytvoriť iba administrátor laboratória.',
      }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Nová práca'),
      React.createElement(Button, {
        key: 'export',
        variant: 'outline',
        disabled: exporting,
        onClick: async () => {
          setExporting(true);
          setError('');
          try {
            await window.MolarisAPI.downloadJobsExport('csv');
          } catch (err) {
            setError((err && err.message) || 'CSV export prác sa nepodarilo stiahnuť.');
          } finally {
            setExporting(false);
          }
        },
      }, React.createElement(Icon, { name: 'download', size: 14 }), exporting ? 'Exportujem…' : 'CSV export'),
    ]
  });

  if (workspace.loading && !remoteJobs) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, { state: 'loading', message: 'Načítavam práce…' })
    );
  }

  if (workspace.error && !remoteJobs) {
    const permissionDenied = isPermissionDeniedError(workspace.error);
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, {
        state: permissionDenied ? 'permission' : 'error',
        title: 'Nepodarilo sa načítať práce',
        description: 'Na zobrazenie prác nemáte oprávnenie.',
        error: workspace.error,
        onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
      })
    );
  }

  const allJobs = remoteJobs || workspace.jobs || [];
  const statusMeta = {
    new: { label: 'Nové', badge: 'new' },
    in_progress: { label: 'V priebehu', badge: 'progress' },
    completed: { label: 'Dokončené', badge: 'done' },
    finished_unfactured: { label: 'Hotové / nevyfakturované', badge: 'done' },
    finished_factured: { label: 'Hotové / fakturované', badge: 'factured' },
    closed: { label: 'Uzavreté', badge: 'factured' },
    cancelled: { label: 'Zrušené', badge: 'cancelled' },
  };
  const statusKeys = Object.keys(statusMeta);
  const counts = statusKeys.reduce((a, s) => { a[s] = allJobs.filter(j => j.status === s).length; return a; }, {});
  const completedCount = counts.completed + counts.finished_unfactured + counts.finished_factured + counts.closed;

  const filtered = allJobs.filter(j => {
    const q = search.toLowerCase();
    const m = !q || [j.patient, j.clinic, j.doctor, String(j.id), j.type].some(v => (v || '').toLowerCase().includes(q));
    if (!m) return false;
    if (tab === 'completed') {
      if (!COMPLETED_TAB_STATUSES.includes(j.status)) return false;
    } else if (tab !== 'all' && j.status !== tab) {
      return false;
    }
    if (clinicFilter.length && !clinicFilter.includes(j.clinic)) return false;
    return true;
  });

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    pageHeader,

    React.createElement('div', { className: 'stat-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'Nové', value: String(counts.new), icon: 'inbox', tone: 'amber' }),
      React.createElement(StatCard, { label: 'V priebehu', value: String(counts.in_progress), icon: 'activity', tone: 'teal' }),
      React.createElement(StatCard, { label: 'Dokončené', value: String(completedCount), icon: 'checkCircle', tone: 'green' }),
      React.createElement(StatCard, { label: 'Zrušené', value: String(counts.cancelled), icon: 'x', tone: 'red' }),
    ),

    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
        React.createElement(Tabs, {
          value: tab, onChange: setTab,
          tabs: [
            { value: 'all',         label: `Všetky (${allJobs.length})` },
            { value: 'new',         label: `Nové (${counts.new})` },
            { value: 'in_progress', label: `V priebehu (${counts.in_progress})` },
            { value: 'completed',   label: `Dokončené (${completedCount})` },
          ]
        }),
        React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Pacient, lekár, ID…', width: 280 })
      ),
      error && React.createElement(ErrorState, { title: 'Filtrovanie zlyhalo', message: error, onRetry: () => { setError(''); setRemoteJobs(null); } }),
      loading && React.createElement('div', { style: { padding: '0 18px 12px', fontSize: 12, color: '#8a9490' } }, 'Načítavam filtrované práce...'),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        filtered.length === 0
          ? React.createElement(EmptyState, { title: 'Žiadne práce', description: search || tab !== 'all' ? 'Skúste upraviť vyhľadávanie alebo filter.' : 'Začnite vytvorením prvej práce.' })
          : React.createElement(DataTable, {
              onRowClick: (r) => onOpenJob && onOpenJob(r.id),
              columns: [
                { key: 'id', label: 'ID', width: 70, render: r => React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0d7c6b' } }, `#${r.id}`) },
                { key: 'patient', label: 'Pacient', render: r => React.createElement('div', null,
                    React.createElement('div', { style: { fontWeight: 600 } }, r.patient),
                    React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, r.type)
                  )},
                { key: 'clinic', label: 'Klinika', render: r => r.clinic },
                { key: 'doctor', label: 'Lekár', render: r => r.doctor },
                { key: 'due', label: 'Termín', width: 110 },
                { key: 'status', label: 'Stav', width: 120, render: r => React.createElement(Badge, { color: (statusMeta[r.status] || statusMeta.new).badge }, (statusMeta[r.status] || { label: r.status }).label) },
                { key: 'actions', label: '', width: 140, align: 'right', render: r =>
                    React.createElement('div', { style: { display: 'flex', gap: 2, justifyContent: 'flex-end' }, onClick: e => e.stopPropagation() },
                      React.createElement(IconButton, {
                        name: 'search',
                        title: 'Detail zubného kríža',
                        onClick: () => window.dispatchEvent(new CustomEvent('open-tooth-detail', {
                          detail: {
                            patient: {
                              name: r.patient,
                              workId: `#${r.id}`,
                            },
                            // The chart derives everything from the job payload
                            // (tooth maps + items) — see buildToothChartState.
                            job: r.raw || null,
                            readonly: true,
                          }
                        }))
                      }),
                      React.createElement(IconButton, { name: 'eye', title: 'Detail', onClick: () => onOpenJob && onOpenJob(r.id) }),
                      React.createElement(IconButton, { name: 'edit', title: 'Upraviť', onClick: () => onOpenJob && onOpenJob(r.id) }),
                      React.createElement(IconButton, { name: 'trash', title: 'Zmazať', destructive: true, onClick: () => setJobToDelete(r) })
                    )
                }
              ],
              data: filtered
            })
      )
    ),

    React.createElement(ConfirmDialog, {
      open: !!jobToDelete, title: 'Zmazať prácu',
      message: jobToDelete ? `Naozaj chcete zmazať prácu #${jobToDelete.id}? Táto akcia sa nedá vrátiť späť.` : '',
      confirmText: deleting ? 'Mažem…' : 'Zmazať', cancelText: 'Zrušiť', destructive: true,
      onConfirm: deleting ? undefined : async () => {
        if (!jobToDelete) return;
        setDeleting(true);
        setError('');
        try {
          await window.MolarisAPI.deleteJob(jobToDelete.id);
          setRemoteJobs(null);
          setJobToDelete(null);
        } catch (err) {
          setError((err && err.message) || 'Prácu sa nepodarilo zmazať.');
        } finally {
          setDeleting(false);
        }
      },
      onCancel: deleting ? undefined : () => setJobToDelete(null),
    })
  );
}

Object.assign(window, { Jobs });
