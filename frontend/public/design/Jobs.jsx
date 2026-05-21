// Jobs.jsx — Molaris Jobs list (refreshed with SVG icons, row click → detail)

function Jobs({ onNavigate, onOpenJob, onNewJob }) {
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const [jobToDelete, setJobToDelete] = React.useState(null);
  const [remoteJobs, setRemoteJobs] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const workspace = window.MolarisAPI.useWorkspace();

  const fallbackJobs = [
    { id: 12, patient: 'Mária Kováčová', clinic: 'Klinika Bratislava', doctor: 'MUDr. Novák',   type: 'Mostík zirkón',  due: '15. 5. 2025', status: 'in_progress' },
    { id: 11, patient: 'Peter Horváth',  clinic: 'ZubMed Košice',      doctor: 'MUDr. Blaho',   type: 'Korunka',         due: '12. 5. 2025', status: 'new' },
    { id: 10, patient: 'Jana Blahová',   clinic: 'DentaPrima Žilina',  doctor: 'MUDr. Sloboda', type: 'Snímateľná prot.',due: '8. 5. 2025',  status: 'new' },
    { id: 9,  patient: 'Tomáš Varga',    clinic: 'Klinika Bratislava', doctor: 'MUDr. Novák',   type: 'Implantát + abut.',due: '3. 5. 2025', status: 'completed' },
    { id: 8,  patient: 'Eva Oláhová',    clinic: 'ZubMed Košice',      doctor: 'MUDr. Blaho',   type: 'Inlay keramický', due: '28. 4. 2025', status: 'completed' },
    { id: 7,  patient: 'Michal Gábor',   clinic: 'DentaPrima Žilina',  doctor: 'MUDr. Sloboda', type: 'Korunka',         due: '20. 4. 2025', status: 'cancelled' },
  ];
  const workspaceJobs = workspace.jobs && workspace.jobs.length ? workspace.jobs : fallbackJobs;
  const allJobs = remoteJobs || workspaceJobs;

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

  const statusMeta = {
    new:        { label: 'Nové',       badge: 'new' },
    in_progress:{ label: 'V priebehu', badge: 'progress' },
    completed:  { label: 'Dokončené',  badge: 'done' },
    cancelled:  { label: 'Zrušené',    badge: 'cancelled' },
  };
  const counts = ['new','in_progress','completed','cancelled'].reduce((a, s) => { a[s] = workspaceJobs.filter(j => j.status === s).length; return a; }, {});

  const filtered = remoteJobs ? allJobs : allJobs.filter(j => {
    const q = search.toLowerCase();
    const m = !q || [j.patient, j.clinic, j.doctor, String(j.id), j.type].some(v => v.toLowerCase().includes(q));
    if (!m) return false;
    if (tab !== 'all' && j.status !== tab) return false;
    return true;
  });

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: 'Práce',
      subtitle: 'Prehľad, správa a stav zákaziek.',
      actions: [
        React.createElement(Button, { key: 'n', onClick: onNewJob }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Nová práca'),
      ]
    }),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      React.createElement(StatCard, { label: 'Nové',        value: String(counts.new),        icon: 'inbox',     tone: 'amber' }),
      React.createElement(StatCard, { label: 'V priebehu',  value: String(counts.in_progress),icon: 'activity',  tone: 'teal' }),
      React.createElement(StatCard, { label: 'Dokončené',   value: String(counts.completed),  icon: 'checkCircle',tone: 'green' }),
      React.createElement(StatCard, { label: 'Zrušené',     value: String(counts.cancelled),  icon: 'x',         tone: 'red' }),
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
          ]
        }),
        React.createElement(SearchInput, { value: search, onChange: setSearch, placeholder: 'Pacient, lekár, ID…', width: 280 })
      ),
      error && React.createElement(ErrorState, { title: 'Filtrovanie zlyhalo', message: error }),
      loading && React.createElement('div', { style: { padding: '0 18px 12px', fontSize: 12, color: '#8a9490' } }, 'Načítavam filtrované práce...'),
      React.createElement(CardContent, { style: { paddingTop: 0 } },
        filtered.length === 0
          ? React.createElement(EmptyState, { title: 'Žiadne práce', description: 'Skúste upraviť vyhľadávanie alebo filter.' })
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
                      React.createElement(IconButton, { name: 'trash', title: 'Zmazať', destructive: true, onClick: () => setJobToDelete(r.id) })
                    )
                }
              ],
              data: filtered
            })
      )
    ),

    React.createElement(ConfirmDialog, {
      open: !!jobToDelete, title: 'Zmazať prácu',
      message: 'Naozaj chcete zmazať túto prácu? Táto akcia sa nedá vrátiť späť.',
      confirmText: 'Zmazať', cancelText: 'Zrušiť', destructive: true,
      onConfirm: () => setJobToDelete(null), onCancel: () => setJobToDelete(null),
    })
  );
}

Object.assign(window, { Jobs });
