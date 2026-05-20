// PatientDetail.jsx — Molaris Patient Detail

function PatientDetail({ patientId, onBack, onOpenJob }) {
  const workspace = window.MolarisAPI.useWorkspace();
  const workspacePatient = workspace.patients && workspace.patients.find((item) => String(item.id) === String(patientId));
  const patientJobs = workspace.jobs && workspacePatient
    ? workspace.jobs.filter((job) => job.raw && job.raw.patient === workspacePatient.id)
    : null;
  const fallbackPatient = {
    id: patientId || 1,
    title: '',
    first: 'Mária', last: 'Kováčová',
    birth: '8512151234', insurance: 'VšZP', age: 39,
    phone: '+421 911 222 333', email: 'kovacova@email.sk',
    address: 'Pribinova 24, 811 09 Bratislava',
    clinic: 'Klinika Bratislava', doctor: 'MUDr. Pavol Novák',
    note: 'Alergia na nikel. Preferuje obeč ranné termíny.',
    firstVisit: '14. 3. 2023', totalSpent: 4280.00,
  };
  const p = workspacePatient ? {
    id: workspacePatient.id,
    title: '',
    first: workspacePatient.first,
    last: workspacePatient.last,
    birth: workspacePatient.birth,
    insurance: '—',
    age: '',
    phone: workspacePatient.phone || '—',
    email: workspacePatient.email || '—',
    address: workspacePatient.raw.address || '—',
    clinic: patientJobs && patientJobs[0] ? patientJobs[0].clinic : '—',
    doctor: patientJobs && patientJobs[0] ? patientJobs[0].doctor : '—',
    note: 'Bez poznámky.',
    firstVisit: workspacePatient.raw.created_at ? new Date(workspacePatient.raw.created_at).toLocaleDateString('sk-SK') : '—',
    totalSpent: (patientJobs || []).reduce((sum, job) => sum + Number(job.raw.price || 0), 0),
  } : fallbackPatient;

  const fallbackJobs = [
    { id: 12, type: 'Mostík 3-členný zirkón', status: 'in_progress', statusLabel: 'V priebehu', received: '28. 4. 2025', due: '15. 5. 2025', total: 540.00 },
    { id: 5,  type: 'Korunka zirkónová',      status: 'completed',   statusLabel: 'Dokončená',  received: '12. 2. 2025', due: '5. 3. 2025',  total: 280.00 },
    { id: 2,  type: 'Inlay keramický',        status: 'completed',   statusLabel: 'Dokončená',  received: '20. 11. 2024',due: '8. 12. 2024', total: 210.00 },
    { id: 1,  type: 'Konzultácia + skenovanie',status: 'completed',  statusLabel: 'Dokončená',  received: '14. 3. 2023', due: '14. 3. 2023', total: 80.00 },
  ];
  const jobs = patientJobs && patientJobs.length
    ? patientJobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        statusLabel: job.status,
        received: job.raw.start_date ? new Date(job.raw.start_date).toLocaleDateString('sk-SK') : '—',
        due: job.due,
        total: Number(job.raw.price || 0),
      }))
    : fallbackJobs;

  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const initials = `${p.first[0]}${p.last[0]}`;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: `${p.first} ${p.last}`,
      subtitle: `Pacient · ${p.age} rokov · ${p.insurance}`,
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
          React.createElement(StatCard, { label: 'Práce celkom', value: String(jobs.length), icon: 'briefcase', tone: 'teal' }),
          React.createElement(StatCard, { label: 'Aktívne',       value: String(jobs.filter(j => j.status === 'in_progress').length), icon: 'activity', tone: 'amber' }),
          React.createElement(StatCard, { label: 'Tržby (celkom)',value: fmt(p.totalSpent), icon: 'euro', tone: 'green' }),
        ),

        React.createElement(Card, null,
          React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement(CardTitle, null, 'História prác'),
            React.createElement('span', { style: { fontSize: 11.5, color: '#8a9490' } }, jobs.length, ' záznamov od ', p.firstVisit)
          ),
          React.createElement(CardContent, { style: { paddingTop: 0 } },
            React.createElement(DataTable, {
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
