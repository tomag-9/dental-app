// Jobs.jsx — Molaris Jobs list (refreshed with SVG icons, row click → detail)

function Jobs({ onNavigate, onOpenJob, onNewJob }) {
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const [jobToDelete, setJobToDelete] = React.useState(null);
  const [remoteJobs, setRemoteJobs] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();
  const canCreate = window.canCreateRecords ? window.canCreateRecords() : false;

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
      window.MolarisAPI.fetchJobs({ search, status: tab })
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

  const filtered = remoteJobs ? allJobs : allJobs.filter(j => {
    const q = search.toLowerCase();
    const m = !q || [j.patient, j.clinic, j.doctor, String(j.id), j.type].some(v => (v || '').toLowerCase().includes(q));
    if (!m) return false;
    if (tab !== 'all' && j.status !== tab) return false;
    return true;
  });

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    pageHeader,

    React.createElement('div', { className: 'stat-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'Otvorené', value: String(counts.new + counts.in_progress), icon: 'inbox', tone: 'amber', sub: `${counts.new} nové` }),
      React.createElement(StatCard, { label: 'Čaká faktúru', value: String(counts.finished_unfactured), icon: 'fileText', tone: 'teal' }),
      React.createElement(StatCard, { label: 'Vyfakturované', value: String(counts.finished_factured), icon: 'checkCircle', tone: 'green' }),
      React.createElement(StatCard, { label: 'Uzavreté / zrušené', value: String(counts.closed + counts.cancelled), icon: 'x', tone: 'red' }),
    ),

    React.createElement(JobLifecycleGuide, { rawJob: { status: tab === 'all' ? '' : tab } }),

    React.createElement(Card, null,
      React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Export prác')),
      React.createElement(CardContent, { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(InfoCell, { label: 'Formát CSV', value: 'ID, pacient, klinika, lekár, termín, stav, cena' }),
        React.createElement(InfoCell, { label: 'Tok sťahovania', value: 'Tlačidlo CSV export používa serverový export prác' })
      )
    ),

    React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
        React.createElement(Tabs, {
          value: tab, onChange: setTab,
          tabs: [
            { value: 'all',         label: `Všetky (${allJobs.length})` },
            { value: 'new',         label: `Nové (${counts.new})` },
            { value: 'in_progress', label: `V priebehu (${counts.in_progress})` },
            { value: 'completed',   label: `Dokončené (${counts.completed})` },
            { value: 'finished_unfactured', label: `Čaká faktúru (${counts.finished_unfactured})` },
            { value: 'finished_factured', label: `Fakturované (${counts.finished_factured})` },
            { value: 'closed', label: `Uzavreté (${counts.closed})` },
            { value: 'cancelled', label: `Zrušené (${counts.cancelled})` },
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
                              workId: '2025/' + String(r.id).padStart(3, '0'),
                              age: 50 + (r.id % 30),
                            },
                            fdi: 26,
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
