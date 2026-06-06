// JobDetailSections.jsx — extracted sections for the job detail screen.

const JOB_STATUS_LABELS = {
  new: 'Nová',
  in_progress: 'V priebehu',
  completed: 'Dokončená',
  cancelled: 'Zrušená',
  finished_factured: 'Vyfakturovaná',
  finished_unfactured: 'Nevyfakturovaná',
  closed: 'Uzavretá',
};

function useJobHeaderData(rawJob, workspaceJob) {
  return React.useMemo(() => ({
    id: rawJob.id,
    patient: {
      name: workspaceJob.patient,
      birth: rawJob.patient_details && rawJob.patient_details.birth_number,
      phone: rawJob.patient_details && rawJob.patient_details.phone,
    },
    clinic: workspaceJob.clinic,
    doctor: workspaceJob.doctor,
    type: workspaceJob.type,
    technician: rawJob.technician_details ? `${rawJob.technician_details.first_name} ${rawJob.technician_details.last_name}` : 'Nepridelený',
    received: rawJob.start_date ? new Date(rawJob.start_date).toLocaleDateString('sk-SK') : '—',
    due: rawJob.due_date ? new Date(rawJob.due_date).toLocaleDateString('sk-SK') : '—',
    note: rawJob.description || 'Bez poznámky.',
  }), [rawJob, workspaceJob]);
}

function useJobStatusActionsData(rawJob) {
  return React.useMemo(() => {
    const nextStatus = {
      new: 'in_progress',
      in_progress: 'completed',
      completed: 'finished_unfactured',
      finished_unfactured: 'finished_factured',
      finished_factured: 'closed',
    }[rawJob.status];
    return {
      status: rawJob.status,
      statusLabel: JOB_STATUS_LABELS[rawJob.status] || rawJob.status,
      due: rawJob.due_date ? new Date(rawJob.due_date).toLocaleDateString('sk-SK') : '—',
      nextStatus,
    };
  }, [rawJob]);
}

function useJobItemsData(rawJob) {
  return React.useMemo(() => {
    const items = (rawJob.items || []).map((item) => ({
      name: item.description,
      tooth: item.tooth || '—',
      scope: item.tooth_scope || '',
      price: Number(item.total || item.unit_price || 0),
    }));
    return { items, total: items.reduce((sum, item) => sum + item.price, 0) };
  }, [rawJob]);
}

function useJobAttachmentsData(rawJob) {
  return React.useMemo(() => rawJob.attachments || rawJob.files || [], [rawJob]);
}

function useJobAuditLogData(rawJob) {
  return React.useMemo(() => (rawJob.timeline || []).map((event) => ({
    date: event.created_at ? new Date(event.created_at).toLocaleString('sk-SK') : '—',
    actor: event.actor_name || 'Systém',
    event: event.event,
    note: event.note,
    icon: event.event === 'status_changed' ? 'activity' : event.event === 'assigned' ? 'user' : 'check',
    color: event.event === 'status_changed' ? '#d97706' : '#0d7c6b',
  })), [rawJob]);
}

function JobStatusActions({ rawJob, changingStatus, onMoveStatus }) {
  const status = useJobStatusActionsData(rawJob);
  return React.createElement('div', {
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
        React.createElement('span', { style: { fontSize: 13.5, fontWeight: 700, color: '#085c4e', fontFamily: 'Plus Jakarta Sans,sans-serif' } }, status.statusLabel)
      ),
      React.createElement('div', { style: { fontSize: 11.5, color: '#085c4e', opacity: 0.75, marginTop: 2 } }, `Termín odovzdania: ${status.due}`)
    ),
    React.createElement(Button, { variant: 'outline', size: 'sm', onClick: () => onMoveStatus(status.nextStatus), disabled: !status.nextStatus || changingStatus },
      changingStatus ? 'Mením stav…' : 'Posunúť stav',
      React.createElement(Icon, { name: 'arrowRight', size: 13 })
    )
  );
}

function JobHeader({ rawJob, workspaceJob, editMode, editFields, technicians, savingEdit, onFieldChange, onCancel, onSave }) {
  const job = useJobHeaderData(rawJob, workspaceJob);
  return React.createElement(React.Fragment, null,
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
          React.createElement(FormField, { label: 'Termín', type: 'date', value: editFields.due_date, onChange: e => onFieldChange('due_date', e.target.value) }),
          React.createElement(FormField, {
            label: 'Priorita',
            type: 'select',
            value: editFields.priority,
            onChange: e => onFieldChange('priority', e.target.value),
            options: [
              { value: 'low', label: 'Nízka' },
              { value: 'normal', label: 'Normálna' },
              { value: 'high', label: 'Vysoká' },
              { value: 'urgent', label: 'Urgentná' },
            ],
          })
        ),
        React.createElement(FormField, {
          label: 'Technik',
          type: 'select',
          value: editFields.technician,
          onChange: e => onFieldChange('technician', e.target.value),
          options: [{ value: '', label: 'Nepridelený' }].concat((technicians || []).map((tech) => ({
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
            onChange: e => onFieldChange('description', e.target.value),
          })
        ),
        React.createElement('div', { style: { marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 } },
          React.createElement(Button, { variant: 'outline', onClick: onCancel, disabled: savingEdit }, 'Zrušiť'),
          React.createElement(Button, { onClick: onSave, disabled: savingEdit }, React.createElement(Icon, { name: 'check', size: 14 }), savingEdit ? 'Ukladám...' : 'Uložiť')
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
  );
}

function JobItemsTable({ rawJob }) {
  const { items, total } = useJobItemsData(rawJob);
  return React.createElement(Card, null,
    React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Položky práce')),
    React.createElement(CardContent, null,
      React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden', background: '#fff' } },
        ...(items.length
          ? items.map((item, index) => React.createElement('div', {
              key: `${item.name}-${index}`,
              style: { display: 'grid', gridTemplateColumns: '40px 1fr 100px 110px', alignItems: 'center', padding: '12px 14px', borderTop: index === 0 ? 'none' : '1px solid #f0ede5', gap: 10 }
            },
              React.createElement('div', { style: { width: 30, height: 30, borderRadius: 6, background: '#fbfaf6', border: '1px solid #ece7dc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d7c6b' } },
                React.createElement(Icon, { name: 'toothPlaceholder', size: 16, strokeWidth: 1.5 })
              ),
              React.createElement('div', null,
                React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, item.name),
                React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 2 } }, item.scope ? `Oblasť: ${item.scope}` : `Zub: ${item.tooth}`)
              ),
              React.createElement('span', { style: { fontSize: 11.5, color: '#8a9490', textAlign: 'right' } }, '1×'),
              React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320', textAlign: 'right' } }, fmtEur(item.price))
            ))
          : [React.createElement(EmptyState, { key: 'empty-items', title: 'Žiadne položky', description: 'Táto práca zatiaľ nemá položky.' })]),
        React.createElement('div', { style: { padding: '12px 14px', background: '#fbfaf6', borderTop: '1px solid #f0ede5', display: 'flex', justifyContent: 'space-between', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320' } },
          React.createElement('span', null, 'Spolu (bez DPH)'),
          React.createElement('span', null, fmtEur(total))
        )
      )
    )
  );
}

function JobAttachments({ rawJob }) {
  const attachments = useJobAttachmentsData(rawJob);
  return React.createElement(Card, null,
    React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Prílohy')),
    React.createElement(CardContent, null,
      attachments.length === 0
        ? React.createElement(EmptyState, { title: 'Žiadne prílohy', description: 'K tejto práci zatiaľ nie sú pripojené súbory.' })
        : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            ...attachments.map((attachment, index) => React.createElement('div', {
              key: attachment.id || attachment.url || index,
              style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: '1px solid #ece7dc', borderRadius: 8, background: '#fbfaf6' }
            },
              React.createElement('span', { style: { fontSize: 12.5, fontWeight: 600, color: '#1a2320' } }, attachment.name || attachment.filename || `Príloha ${index + 1}`),
              attachment.url && React.createElement(Button, { variant: 'outline', size: 'sm', onClick: () => window.open(attachment.url, '_blank', 'noopener') },
                React.createElement(Icon, { name: 'download', size: 13 }),
                'Otvoriť'
              )
            ))
          )
    )
  );
}

function JobAuditLog({ rawJob }) {
  const timeline = useJobAuditLogData(rawJob);
  return React.createElement(Card, null,
    React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'História')),
    React.createElement(CardContent, null,
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' } },
        ...(timeline.length
          ? timeline.map((item, index) => React.createElement('div', {
              key: `${item.event}-${item.date}-${index}`,
              style: { display: 'flex', gap: 12, paddingBottom: index === timeline.length - 1 ? 0 : 18, position: 'relative' }
            },
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 } },
                React.createElement('div', { style: { width: 26, height: 26, borderRadius: '50%', background: item.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 } },
                  React.createElement(Icon, { name: item.icon, size: 13 })
                ),
                index < timeline.length - 1 && React.createElement('div', { style: { width: 2, flex: 1, background: '#ece7dc', marginTop: 2 } })
              ),
              React.createElement('div', { style: { flex: 1, minWidth: 0, paddingTop: 1 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320', lineHeight: 1.3 } }, item.event),
                React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 2 } },
                  React.createElement('span', null, item.actor), ' · ', item.date
                ),
                item.note && React.createElement('div', { style: { fontSize: 12, color: '#5a6b66', marginTop: 5, padding: '6px 10px', background: '#fbfaf6', borderRadius: 6, border: '1px solid #f0ede5' } }, item.note)
              )
            ))
          : [React.createElement(EmptyState, { key: 'empty-timeline', title: 'Žiadna história', description: 'Pre túto prácu zatiaľ nie je evidovaná časová os.' })])
      ),
      React.createElement('div', { style: { marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0ede5' } },
        React.createElement(Button, { variant: 'outline', size: 'sm', style: { width: '100%' } },
          React.createElement(Icon, { name: 'plus', size: 13 }),
          'Pridať poznámku'
        )
      )
    )
  );
}

Object.assign(window, {
  JOB_STATUS_LABELS,
  JobHeader,
  JobStatusActions,
  JobItemsTable,
  JobAttachments,
  JobAuditLog,
  useJobHeaderData,
  useJobStatusActionsData,
  useJobItemsData,
  useJobAttachmentsData,
  useJobAuditLogData,
});
