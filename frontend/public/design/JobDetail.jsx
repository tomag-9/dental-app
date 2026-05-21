// JobDetail.jsx — Molaris Job Detail (full-page detail view)

function JobDetail({ jobId, onBack }) {
  const workspace = window.MolarisAPI.useWorkspace();
  const [actionError, setActionError] = React.useState('');
  const [changingStatus, setChangingStatus] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [editFields, setEditFields] = React.useState({ description: '', due_date: '', priority: 'normal', technician: '' });
  const workspaceJob = workspace.jobs && workspace.jobs.find((item) => String(item.id) === String(jobId));
  const rawJob = workspaceJob && workspaceJob.raw;
  const fallbackJob = {
    id: jobId || 12,
    patient: { name: 'Mária Kováčová', birth: '8512151234', phone: '+421 911 222 333' },
    clinic: 'Klinika Bratislava',
    doctor: 'MUDr. Pavol Novák',
    type: 'Mostík 3-členný zirkónový',
    status: 'in_progress',
    statusLabel: 'V priebehu',
    technician: 'Ján Novák',
    received: '28. 4. 2025',
    due: '15. 5. 2025',
    delivered: null,
    note: 'Pacientka má alergiu na nikel. Prosíme dodať čistý zirkón. Skúška hotového mostíka pred glazúrou.',
    items: [
      { name: 'Korunka zirkónová',  tooth: '14', price: 280.00 },
      { name: 'Mostík 3-členný',    tooth: '15-17', price: 540.00 },
      { name: 'Inlay keramický',    tooth: '46', price: 210.00 },
    ],
  };
  const statusLabels = {
    new: 'Nová',
    in_progress: 'V priebehu',
    completed: 'Dokončená',
    cancelled: 'Zrušená',
    finished_factured: 'Vyfakturovaná',
    finished_unfactured: 'Nevyfakturovaná',
    closed: 'Uzavretá',
  };
  const job = rawJob ? {
    id: rawJob.id,
    patient: {
      name: workspaceJob.patient,
      birth: rawJob.patient_details && rawJob.patient_details.birth_number,
      phone: rawJob.patient_details && rawJob.patient_details.phone,
    },
    clinic: workspaceJob.clinic,
    doctor: workspaceJob.doctor,
    type: workspaceJob.type,
    status: rawJob.status,
    statusLabel: statusLabels[rawJob.status] || rawJob.status,
    technician: rawJob.technician_details ? `${rawJob.technician_details.first_name} ${rawJob.technician_details.last_name}` : 'Nepridelený',
    received: rawJob.start_date ? new Date(rawJob.start_date).toLocaleDateString('sk-SK') : '—',
    due: rawJob.due_date ? new Date(rawJob.due_date).toLocaleDateString('sk-SK') : '—',
    delivered: rawJob.end_date,
    note: rawJob.description || 'Bez poznámky.',
    items: (rawJob.items || []).map((item) => ({
      name: item.description,
      tooth: item.tooth || '—',
      scope: item.tooth_scope || '',
      price: Number(item.total || item.unit_price || 0),
    })),
  } : fallbackJob;

  React.useEffect(() => {
    if (!rawJob) return;
    setEditFields({
      description: rawJob.description || '',
      due_date: rawJob.due_date || '',
      priority: rawJob.priority || 'normal',
      technician: rawJob.technician ? String(rawJob.technician) : '',
    });
  }, [rawJob && rawJob.id]);

  const fallbackTimeline = [
    { date: '28. 4. 2025 09:14', actor: 'Recepcia', event: 'Práca prijatá', note: 'Z odberu kuriéra. Zaevidovaná do systému.', icon: 'inbox', color: '#0d7c6b' },
    { date: '29. 4. 2025 14:30', actor: 'Ján Novák', event: 'Pridelená technikovi', note: 'Priradené k pracovnej fronte.', icon: 'user', color: '#0d7c6b' },
    { date: '2. 5. 2025 11:08',  actor: 'Ján Novák', event: 'Skenovanie dokončené', note: 'Digitálny model v archíve.', icon: 'check', color: '#16a34a' },
    { date: '5. 5. 2025 16:45',  actor: 'Anna Mrázová', event: 'Modelovanie ukončené', note: 'Pripravené na frézovanie.', icon: 'wrench', color: '#0d7c6b' },
    { date: '8. 5. 2025 10:22',  actor: 'Systém',    event: 'Frézovanie spustené', note: 'CAM stroj #2.', icon: 'activity', color: '#d97706' },
  ];
  const timeline = rawJob && rawJob.timeline && rawJob.timeline.length
    ? rawJob.timeline.map((event) => ({
        date: event.created_at ? new Date(event.created_at).toLocaleString('sk-SK') : '—',
        actor: event.actor_name || 'Systém',
        event: event.event,
        note: event.note,
        icon: event.event === 'status_changed' ? 'activity' : event.event === 'assigned' ? 'user' : 'check',
        color: event.event === 'status_changed' ? '#d97706' : '#0d7c6b',
      }))
    : fallbackTimeline;

  const fmt = n => n.toFixed(2).replace('.', ',') + ' €';
  const total = job.items.reduce((s, it) => s + it.price, 0);
  const nextStatus = {
    new: 'in_progress',
    in_progress: 'completed',
    completed: 'finished_unfactured',
    finished_unfactured: 'finished_factured',
    finished_factured: 'closed',
  }[job.status];
  const moveStatus = async () => {
    if (!nextStatus || !rawJob) return;
    setChangingStatus(true); setActionError('');
    try {
      await window.MolarisAPI.transitionJobStatus(job.id, nextStatus, 'Stav bol zmenený z detailu práce.');
    } catch (err) {
      setActionError((err && err.data && JSON.stringify(err.data)) || 'Stav sa nepodarilo zmeniť.');
    } finally {
      setChangingStatus(false);
    }
  };
  const saveEdit = async () => {
    if (!rawJob) return;
    setSavingEdit(true); setActionError('');
    try {
      await window.MolarisAPI.updateJob(job.id, {
        description: editFields.description || '',
        due_date: editFields.due_date || null,
        priority: editFields.priority || 'normal',
        technician: editFields.technician ? Number(editFields.technician) : null,
      });
      setEditMode(false);
    } catch (err) {
      setActionError((err && err.data && JSON.stringify(err.data)) || 'Prácu sa nepodarilo uložiť.');
    } finally {
      setSavingEdit(false);
    }
  };
  const setEdit = (key, value) => setEditFields((current) => ({ ...current, [key]: value }));

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: `Práca #${job.id}`,
      subtitle: job.type,
      breadcrumbs: [{ label: 'Práce', onClick: onBack }, { label: `#${job.id}` }],
      actions: [
        React.createElement(Button, { key: 'b', variant: 'outline', onClick: onBack },
          React.createElement(Icon, { name: 'arrowLeft', size: 14 }), 'Späť na zoznam'),
        React.createElement(Button, { key: 'p', variant: 'outline' },
          React.createElement(Icon, { name: 'printer', size: 14 }), 'Tlač pracovného listu'),
        React.createElement(Button, { key: 'e', onClick: () => setEditMode((value) => !value), disabled: !rawJob },
          React.createElement(Icon, { name: 'edit', size: 14 }), editMode ? 'Zavrieť úpravy' : 'Upraviť'),
      ]
    }),

    // Status banner
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px', borderRadius: 10,
        background: '#d4f0eb', border: '1px solid #b0ddd5'
      }
    },
      React.createElement('div', { style: { width: 38, height: 38, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d7c6b' } },
        React.createElement(Icon, { name: 'activity', size: 18 })
      ),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { fontSize: 13.5, fontWeight: 700, color: '#085c4e', fontFamily: 'Plus Jakarta Sans,sans-serif' } }, job.statusLabel)
        ),
        React.createElement('div', { style: { fontSize: 11.5, color: '#085c4e', opacity: 0.75, marginTop: 2 } }, `Termín odovzdania: ${job.due}`)
      ),
        React.createElement(Button, { variant: 'outline', size: 'sm', onClick: moveStatus, disabled: !nextStatus || changingStatus }, changingStatus ? 'Mením stav…' : 'Posunúť stav', React.createElement(Icon, { name: 'arrowRight', size: 13 }))
    ),
    actionError && React.createElement(ErrorState, { title: 'Akcia zlyhala', message: actionError }),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'flex-start' } },
      // Left column
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Základné údaje')),
          React.createElement(CardContent, null,
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 } },
              React.createElement(InfoCell, { label: 'Pacient', value: React.createElement('div', null,
                React.createElement('div', { style: { fontWeight: 600 } }, job.patient.name),
                React.createElement('div', { style: { fontSize: 11, color: '#8a9490', fontFamily: 'ui-monospace, monospace' } }, job.patient.birth)
              )}),
              React.createElement(InfoCell, { label: 'Klinika', value: job.clinic }),
              React.createElement(InfoCell, { label: 'Lekár', value: job.doctor }),
              React.createElement(InfoCell, { label: 'Technik', value: job.technician }),
              React.createElement(InfoCell, { label: 'Prijaté', value: job.received }),
              React.createElement(InfoCell, { label: 'Termín', value: React.createElement('span', { style: { color: '#0d7c6b', fontWeight: 600 } }, job.due) })
            )
          )
        ),

        editMode && React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Úprava práce')),
          React.createElement(CardContent, null,
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 } },
              React.createElement(FormField, { label: 'Termín', type: 'date', value: editFields.due_date, onChange: e => setEdit('due_date', e.target.value) }),
              React.createElement(FormField, {
                label: 'Priorita',
                type: 'select',
                value: editFields.priority,
                onChange: e => setEdit('priority', e.target.value),
                options: [
                  { value: 'low', label: 'Nízka' },
                  { value: 'normal', label: 'Normálna' },
                  { value: 'high', label: 'Vysoká' },
                  { value: 'urgent', label: 'Urgent' },
                ],
              }),
            ),
            React.createElement(FormField, {
              label: 'Technik',
              type: 'select',
              value: editFields.technician,
              onChange: e => setEdit('technician', e.target.value),
              options: [{ value: '', label: 'Nepridelený' }].concat((workspace.technicians || []).map((tech) => ({
                value: String(tech.id),
                label: `${tech.first} ${tech.last}`,
              }))),
            }),
            React.createElement('div', { style: { marginTop: 12 } },
              React.createElement(FormField, {
                label: 'Poznámka / popis',
                type: 'textarea',
                rows: 4,
                value: editFields.description,
                onChange: e => setEdit('description', e.target.value),
              })
            ),
            React.createElement('div', { style: { marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 } },
              React.createElement(Button, { variant: 'outline', onClick: () => setEditMode(false), disabled: savingEdit }, 'Zrušiť'),
              React.createElement(Button, { onClick: saveEdit, disabled: savingEdit }, React.createElement(Icon, { name: 'check', size: 14 }), savingEdit ? 'Ukladám...' : 'Uložiť')
            )
          )
        ),

        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Položky práce')),
          React.createElement(CardContent, null,
            React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden', background: '#fff' } },
              ...job.items.map((it, i) => React.createElement('div', {
                key: i,
                style: { display: 'grid', gridTemplateColumns: '40px 1fr 100px 110px', alignItems: 'center', padding: '12px 14px', borderTop: i === 0 ? 'none' : '1px solid #f0ede5', gap: 10 }
              },
                React.createElement('div', { style: { width: 30, height: 30, borderRadius: 6, background: '#fbfaf6', border: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d7c6b' } },
                  React.createElement(Icon, { name: 'toothPlaceholder', size: 16, strokeWidth: 1.5 })
                ),
                React.createElement('div', null,
                  React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, it.name),
                  React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 2 } }, it.scope ? `Oblasť: ${it.scope}` : `Zub: ${it.tooth}`)
                ),
                React.createElement('span', { style: { fontSize: 11.5, color: '#8a9490', textAlign: 'right' } }, '1×'),
                React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320', textAlign: 'right' } }, fmt(it.price))
              )),
              React.createElement('div', { style: { padding: '12px 14px', background: '#fbfaf6', borderTop: '1px solid #f0ede5', display: 'flex', justifyContent: 'space-between', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320' } },
                React.createElement('span', null, 'Spolu (bez DPH)'),
                React.createElement('span', null, fmt(total))
              )
            )
          )
        ),

        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Poznámka od lekára')),
          React.createElement(CardContent, null,
            React.createElement('p', {
              style: { padding: 14, background: '#fef9c3', borderLeft: '3px solid #d97706', borderRadius: 6, fontSize: 13, color: '#713f12', lineHeight: 1.5, margin: 0 }
            }, job.note)
          )
        )
      ),

      // Right column — Timeline
      React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'História')),
        React.createElement(CardContent, null,
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' } },
            ...timeline.map((t, i) => React.createElement('div', {
              key: i,
              style: { display: 'flex', gap: 12, paddingBottom: i === timeline.length - 1 ? 0 : 18, position: 'relative' }
            },
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 } },
                React.createElement('div', { style: { width: 26, height: 26, borderRadius: '50%', background: t.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 } },
                  React.createElement(Icon, { name: t.icon, size: 13 })
                ),
                i < timeline.length - 1 && React.createElement('div', { style: { width: 2, flex: 1, background: '#ece7dc', marginTop: 2 } })
              ),
              React.createElement('div', { style: { flex: 1, minWidth: 0, paddingTop: 1 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320', lineHeight: 1.3 } }, t.event),
                React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 2 } },
                  React.createElement('span', null, t.actor), ' · ', t.date
                ),
                t.note && React.createElement('div', { style: { fontSize: 12, color: '#5a6b66', marginTop: 5, padding: '6px 10px', background: '#fbfaf6', borderRadius: 6, border: '1px solid #f0ede5' } }, t.note)
              )
            ))
          ),
          React.createElement('div', { style: { marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0ede5' } },
            React.createElement(Button, { variant: 'outline', size: 'sm', style: { width: '100%' } },
              React.createElement(Icon, { name: 'plus', size: 13 }), 'Pridať poznámku'
            )
          )
        )
      )
    )
  );
}

Object.assign(window, { JobDetail });
