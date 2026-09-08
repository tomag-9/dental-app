// JobDetail.jsx — Molaris Job Detail (full-page detail view)

function JobDetail({ jobId, onBack }) {
  const workspace = window.MolarisAPI.useWorkspace();
  const [actionError, setActionError] = React.useState('');
  const [changingStatus, setChangingStatus] = React.useState(false);
  const [pendingStatus, setPendingStatus] = React.useState(null);
  const [editMode, setEditMode] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [editFields, setEditFields] = React.useState({ description: '', due_date: '', priority: 'normal', technician: '' });
  const workspaceJob = workspace.jobs && workspace.jobs.find((item) => String(item.id) === String(jobId));
  const rawJob = workspaceJob && workspaceJob.raw;

  const detailHeader = (title, subtitle) => React.createElement(PageHeader, {
    title,
    subtitle,
    breadcrumbs: [{ label: 'Práce', onClick: onBack }, { label: title }],
    actions: [
      React.createElement(Button, { key: 'b', variant: 'outline', onClick: onBack },
        React.createElement(Icon, { name: 'arrowLeft', size: 14 }),
        'Späť na zoznam'
      ),
    ],
  });

  React.useEffect(() => {
    if (!rawJob) return;
    setEditFields({
      description: rawJob.description || '',
      due_date: rawJob.due_date || '',
      priority: rawJob.priority || 'normal',
      technician: rawJob.technician ? String(rawJob.technician) : '',
    });
  }, [rawJob && rawJob.id]);

  const pageShell = (header, statePanel) => React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    header,
    statePanel
  );

  if (workspace.loading && !rawJob) {
    return pageShell(
      detailHeader('Práca', 'Načítavam detail práce.'),
      React.createElement(ScreenStatePanel, { state: 'loading', message: 'Načítavam prácu…' })
    );
  }

  if (workspace.error && !rawJob) {
    const permissionDenied = isPermissionDeniedError(workspace.error);
    return pageShell(
      detailHeader('Práca', permissionDenied ? 'Na túto prácu nemáte oprávnenie.' : 'Detail práce sa nepodarilo načítať.'),
      React.createElement(ScreenStatePanel, {
        state: permissionDenied ? 'permission' : 'error',
        title: 'Nepodarilo sa načítať prácu',
        description: 'Na zobrazenie detailu práce nemáte oprávnenie.',
        error: workspace.error,
        onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
      })
    );
  }

  if (!rawJob) {
    return pageShell(
      detailHeader('Práca nenájdená', 'V API sa nenašla práca pre tento identifikátor.'),
      React.createElement(ScreenStatePanel, {
        state: 'empty',
        title: 'Práca nenájdená',
        description: 'Skontrolujte výber práce alebo sa vráťte na zoznam.',
      })
    );
  }

  const moveStatus = async (nextStatus) => {
    if (!nextStatus || !rawJob) return;
    setChangingStatus(true);
    setActionError('');
    try {
      await window.MolarisAPI.transitionJobStatus(rawJob.id, nextStatus, 'Stav bol zmenený z detailu práce.');
      setPendingStatus(null);
    } catch (err) {
      setActionError((err && err.data && JSON.stringify(err.data)) || 'Stav sa nepodarilo zmeniť.');
    } finally {
      setChangingStatus(false);
    }
  };
  const saveEdit = async () => {
    if (!rawJob) return;
    setSavingEdit(true);
    setActionError('');
    try {
      await window.MolarisAPI.updateJob(rawJob.id, {
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
      title: `Práca #${rawJob.id}`,
      subtitle: workspaceJob.type,
      breadcrumbs: [{ label: 'Práce', onClick: onBack }, { label: `#${rawJob.id}` }],
      actions: [
        React.createElement(Button, { key: 'b', variant: 'outline', onClick: onBack },
          React.createElement(Icon, { name: 'arrowLeft', size: 14 }),
          'Späť na zoznam'
        ),
        React.createElement(Button, { key: 'p', variant: 'outline' },
          React.createElement(Icon, { name: 'printer', size: 14 }),
          'Tlač pracovného listu'
        ),
        React.createElement(Button, {
          key: 't',
          variant: 'outline',
          onClick: () => window.dispatchEvent(new CustomEvent('open-tooth-detail', {
            detail: {
              patient: { name: workspaceJob.patient, workId: `#${rawJob.id}` },
              job: rawJob,
              // Editable here: saving PATCHes Job.output_tooth_procedures.
              readonly: false,
            },
          })),
        },
          React.createElement(Icon, { name: 'search', size: 14 }),
          'Zubný kríž'
        ),
        React.createElement(Button, { key: 'e', onClick: () => setEditMode((value) => !value), disabled: !rawJob },
          React.createElement(Icon, { name: 'edit', size: 14 }),
          editMode ? 'Zavrieť úpravy' : 'Upraviť'
        ),
      ],
    }),

    React.createElement(JobStatusActions, { rawJob, changingStatus, onMoveStatus: setPendingStatus }),
    actionError && React.createElement(ErrorState, { title: 'Akcia zlyhala', message: actionError }),

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'flex-start' } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
        React.createElement(JobHeader, {
          rawJob,
          workspaceJob,
          editMode,
          editFields,
          technicians: workspace.technicians,
          savingEdit,
          onFieldChange: setEdit,
          onCancel: () => setEditMode(false),
          onSave: saveEdit,
        }),
        React.createElement(JobItemsTable, { rawJob }),
        React.createElement(JobAttachments, { rawJob })
      ),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
        React.createElement(JobLifecycleGuide, { rawJob }),
        React.createElement(JobAuditLog, { rawJob })
      )
    ),
    React.createElement(ConfirmDialog, {
      open: !!pendingStatus,
      title: 'Zmeniť stav práce',
      message: pendingStatus
        ? `Potvrďte zmenu stavu práce #${rawJob.id} na „${JOB_STATUS_LABELS[pendingStatus] || pendingStatus}“.`
        : '',
      confirmText: changingStatus ? 'Mením stav…' : 'Zmeniť stav',
      cancelText: 'Zrušiť',
      onConfirm: changingStatus ? undefined : () => moveStatus(pendingStatus),
      onCancel: changingStatus ? undefined : () => setPendingStatus(null),
    })
  );
}

Object.assign(window, { JobDetail });
