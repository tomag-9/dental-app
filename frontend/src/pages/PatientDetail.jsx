// PatientDetail.jsx — Molaris Patient Detail

function PatientDetail({ patientId, onBack, onOpenJob }) {
  const workspace = window.MolarisAPI.useWorkspace();
  const workspacePatient = workspace.patients && workspace.patients.find((item) => String(item.id) === String(patientId));
  const patientJobs = workspace.jobs && workspacePatient
    ? workspace.jobs.filter((job) => job.raw && job.raw.patient === workspacePatient.id)
    : null;

  const [revenueStats, setRevenueStats] = React.useState(null);
  const [toothMap, setToothMap] = React.useState(null);

  React.useEffect(() => {
    if (!patientId) return;

    window.MolarisAPI.fetchPatientDetail(patientId)
      .then(data => { if (data && data.revenue_stats) setRevenueStats(data.revenue_stats); })
      .catch(() => {});

    window.MolarisAPI.fetchPatientToothMap(patientId)
      .then(data => { if (data) setToothMap(data); })
      .catch(() => {});
  }, [patientId]);

  const pageHeader = (title, subtitle) => React.createElement(PageHeader, {
    title,
    subtitle,
    breadcrumbs: [{ label: 'Pacienti', onClick: onBack }, { label: title }],
    actions: [
      React.createElement(Button, { key: 'b', variant: 'outline', onClick: onBack },
        React.createElement(Icon, { name: 'arrowLeft', size: 14 }), 'Späť'),
    ]
  });

  if (workspace.loading && !workspacePatient) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader('Pacient', 'Načítavam detail pacienta.'),
      React.createElement(ScreenStatePanel, { state: 'loading', message: 'Načítavam pacienta…' })
    );
  }

  if (workspace.error && !workspacePatient) {
    const permissionDenied = isPermissionDeniedError(workspace.error);
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader('Pacient', permissionDenied ? 'Na tohto pacienta nemáte oprávnenie.' : 'Detail pacienta sa nepodarilo načítať.'),
      React.createElement(ScreenStatePanel, {
        state: permissionDenied ? 'permission' : 'error',
        title: 'Nepodarilo sa načítať pacienta',
        description: 'Na zobrazenie detailu pacienta nemáte oprávnenie.',
        error: workspace.error,
        onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
      })
    );
  }

  if (!workspacePatient) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader('Pacient nenájdený', 'V API sa nenašla karta pacienta pre tento identifikátor.'),
      React.createElement(ScreenStatePanel, {
        state: 'empty',
        title: 'Pacient nenájdený',
        description: 'Skontrolujte výber pacienta alebo sa vráťte na zoznam.',
      })
    );
  }

  const p = {
    id: workspacePatient.id,
    title: '',
    first: workspacePatient.first,
    last: workspacePatient.last,
    birth: workspacePatient.birth,
    insurance: '—',
    age: workspacePatient.raw.age != null ? workspacePatient.raw.age : '',
    phone: workspacePatient.phone || '—',
    email: workspacePatient.email || '—',
    address: workspacePatient.raw.address || '—',
    clinic: patientJobs && patientJobs[0] ? patientJobs[0].clinic : '—',
    doctor: patientJobs && patientJobs[0] ? patientJobs[0].doctor : '—',
    note: 'Bez poznámky.',
    firstVisit: workspacePatient.raw.created_at ? new Date(workspacePatient.raw.created_at).toLocaleDateString('sk-SK') : '—',
    totalSpent: revenueStats ? parseFloat(revenueStats.total_revenue) : (patientJobs || []).reduce((sum, job) => sum + Number(job.raw.price || 0), 0),
  };

  const jobs = patientJobs
    ? patientJobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        statusLabel: job.status,
        received: job.raw.start_date ? new Date(job.raw.start_date).toLocaleDateString('sk-SK') : '—',
        due: job.due,
        total: Number(job.raw.price || 0),
      }))
    : [];

  const fmt = n => Number(n).toFixed(2).replace('.', ',') + ' €';
  const initials = `${(p.first || '?')[0]}${(p.last || '?')[0]}`;

  const toothMapEntries = toothMap ? Object.entries(toothMap) : [];

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: `${p.first} ${p.last}`,
      subtitle: `Pacient${p.age != null && p.age !== '' ? ` · ${p.age} rokov` : ''}`,
      breadcrumbs: [{ label: 'Pacienti', onClick: onBack }, { label: `${p.first} ${p.last}` }],
      actions: [
        React.createElement(Button, { key: 'b', variant: 'outline', onClick: onBack },
          React.createElement(Icon, { name: 'arrowLeft', size: 14 }), 'Späť'),
        React.createElement(Button, { key: 'e', variant: 'outline' },
          React.createElement(Icon, { name: 'edit', size: 14 }), 'Upraviť kartu'),
        React.createElement(Button, { key: 'n' },
          React.createElement(Icon, { name: 'plus', size: 14 }), 'Nová práca'),
      ]
    }),

    // Identity card
    React.createElement(Card, null,
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 20, padding: '22px 24px' } },
        React.createElement('div', {
          style: { width: 72, height: 72, borderRadius: '50%', background: '#d4f0eb', color: '#085c4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 26, fontWeight: 700, flexShrink: 0, border: '2px solid #b0ddd5' }
        }, initials),
        React.createElement('div', { style: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 } },
          React.createElement(IdCell, { label: 'Rodné číslo', value: React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace' } }, p.birth) }),
          React.createElement(IdCell, { label: 'Telefón', value: p.phone, icon: 'phone' }),
          React.createElement(IdCell, { label: 'E-mail', value: p.email, icon: 'mail' }),
          React.createElement(IdCell, { label: 'Adresa', value: p.address, icon: 'mapPin' }),
        )
      )
    ),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'flex-start' } },
      // Left: jobs history + stats
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 } },
          React.createElement(StatCard, { label: 'Práce celkom', value: String(revenueStats ? revenueStats.jobs_count : jobs.length), icon: 'briefcase', tone: 'teal' }),
          React.createElement(StatCard, { label: 'Aktívne',       value: String(jobs.filter(j => j.status === 'in_progress').length), icon: 'activity', tone: 'amber' }),
          React.createElement(StatCard, { label: 'Tržby (celkom)',value: fmt(p.totalSpent), icon: 'euro', tone: 'green' }),
        ),

        React.createElement(Card, null,
          React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement(CardTitle, null, 'História prác'),
            React.createElement('span', { style: { fontSize: 11.5, color: '#8a9490' } }, jobs.length, ' záznamov od ', p.firstVisit)
          ),
          React.createElement(CardContent, { style: { paddingTop: 0 } },
            jobs.length === 0
              ? React.createElement(EmptyState, { title: 'Žiadne práce', description: 'Pacient zatiaľ nemá evidované práce.' })
              : React.createElement(DataTable, {
              onRowClick: r => onOpenJob && onOpenJob(r.id),
              columns: [
                { key: 'id', label: 'ID', width: 70, render: r => React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0d7c6b' } }, `#${r.id}`) },
                { key: 'type', label: 'Typ', render: r => React.createElement('span', { style: { fontWeight: 500 } }, r.type) },
                { key: 'received', label: 'Prijaté', width: 110 },
                { key: 'due', label: 'Termín', width: 110 },
                { key: 'total', label: 'Suma', width: 100, align: 'right', render: r => React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700 } }, fmt(r.total)) },
                { key: 'status', label: 'Stav', width: 120, render: r => React.createElement(Badge, { color: r.status === 'in_progress' ? 'progress' : 'done' }, r.statusLabel) },
              ],
              data: jobs
            })
          )
        ),

        // Cumulative tooth map
        toothMapEntries.length > 0 && React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Zubný kríž – vykonané výkony')),
          React.createElement(CardContent, null,
            React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
              toothMapEntries.map(([tooth, procedure]) =>
                React.createElement('div', {
                  key: tooth,
                  style: {
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    background: '#f0faf7', border: '1px solid #b0ddd5', borderRadius: 8,
                    padding: '8px 12px', minWidth: 72,
                  }
                },
                  React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 15, color: '#0d7c6b' } }, tooth),
                  React.createElement('span', { style: { fontSize: 10.5, color: '#5a6b66', marginTop: 3, textAlign: 'center', maxWidth: 80 } },
                    typeof procedure === 'object' ? (procedure.code || procedure.description || JSON.stringify(procedure)) : String(procedure)
                  )
                )
              )
            )
          )
        )
      ),

      // Right: clinic + notes
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Klinika a lekár')),
          React.createElement(CardContent, null,
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 } },
              React.createElement('div', { style: { width: 40, height: 40, borderRadius: 8, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                React.createElement(Icon, { name: 'building', size: 18 })
              ),
              React.createElement('div', null,
                React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, p.clinic),
                React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 2 } }, 'Hviezdoslavovo nám. 12')
              )
            ),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #f0ede5' } },
              React.createElement('div', { style: { width: 40, height: 40, borderRadius: '50%', background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
                React.createElement(Icon, { name: 'stethoscope', size: 17 })
              ),
              React.createElement('div', null,
                React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, p.doctor),
                React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 2 } }, 'Protetika')
              )
            )
          )
        ),
        revenueStats && React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Finančný prehľad')),
          React.createElement(CardContent, null,
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
              React.createElement(IdCell, { label: 'Celkové tržby', value: fmt(revenueStats.total_revenue) }),
              React.createElement(IdCell, { label: 'Počet prác', value: String(revenueStats.jobs_count) }),
              React.createElement(IdCell, { label: 'Priemerná hodnota', value: fmt(revenueStats.avg_job_value) }),
            )
          )
        ),
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Poznámka')),
          React.createElement(CardContent, null,
            React.createElement('p', {
              style: { padding: 12, background: '#fef9c3', borderLeft: '3px solid #d97706', borderRadius: 6, fontSize: 12.5, color: '#713f12', lineHeight: 1.5, margin: 0 }
            }, p.note)
          )
        )
      )
    )
  );
}

function IdCell({ label, value, icon }) {
  return React.createElement('div', null,
    React.createElement('div', { style: { fontSize: 10.5, fontWeight: 600, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 } }, label),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1a2320', fontWeight: 500 } },
      icon && React.createElement(Icon, { name: icon, size: 12, color: '#8a9490' }),
      value
    )
  );
}

Object.assign(window, { PatientDetail });
