// JobLabelSection.jsx — protetický štítok section on the job detail (#100).
//
// Talks to the real backend endpoint (`apps/jobs/prosthetic_label.py` via
// `GET /jobs/jobs/<id>/prosthetic-label/`), never hardcoded label data:
//   - readiness comes from `Job.label_missing_fields` (already on every job
//     payload — see JobSerializer.get_label_missing_fields), so the panel is
//     accurate without an extra request;
//   - "Náhľad" fetches the `?format=json` variant of the very same endpoint
//     that renders the PDF, so the preview and the print output can never
//     drift apart;
//   - "Stiahnuť PDF" and "Tlačiť" hit the PDF variant directly.
//
// Where a missing field says "the fix is elsewhere" (lab settings, clinic,
// doctor, patient), the panel navigates there via the app-level `onNavigate` /
// `onOpenPatient` callbacks threaded down from App.jsx → JobDetail.

// `where` values are the exact Slovak strings emitted by
// `apps.jobs.prosthetic_label.REQUIRED_FIELDS` — kept in one map so a backend
// wording change is a one-line diff here instead of silently breaking navigation.
const LABEL_WHERE_TO_PAGE = {
  'Nastavenia laboratória': 'settings',
  'Detail ambulancie': 'clinics',
  'Detail lekára': 'doctors',
};

function useJobLabelReadiness(rawJob) {
  return React.useMemo(() => {
    const missing = (rawJob && rawJob.label_missing_fields) || [];
    return {
      missing,
      ready: missing.length === 0,
      labelNumber: (rawJob && rawJob.label_number) || '',
      issuedAt: rawJob && rawJob.label_issued_at
        ? new Date(rawJob.label_issued_at).toLocaleString('sk-SK')
        : '',
    };
  }, [rawJob]);
}

function labelMoney(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
}

function JobLabelMissingRow({ entry, rawJob, onNavigate, onOpenPatient }) {
  const targetPage = LABEL_WHERE_TO_PAGE[entry.where];
  const isPatientField = entry.where === 'Detail pacienta';
  const canNavigate = Boolean((targetPage && onNavigate) || (isPatientField && rawJob && rawJob.patient && onOpenPatient));
  const goFix = () => {
    if (isPatientField && rawJob && rawJob.patient && onOpenPatient) {
      onOpenPatient(rawJob.patient);
      return;
    }
    if (targetPage && onNavigate) onNavigate(targetPage);
  };
  return React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '8px 12px', borderRadius: 8, background: '#fde8e6', border: '1px solid #f5c0bb',
    }
  },
    React.createElement('div', { style: { minWidth: 0 } },
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, color: '#7a2119' } }, entry.label),
      React.createElement('div', { style: { fontSize: 11, color: '#a14840', marginTop: 1 } }, `Doplniť v: ${entry.where}`)
    ),
    canNavigate && React.createElement(Button, { variant: 'outline', size: 'sm', onClick: goFix },
      'Doplniť', React.createElement(Icon, { name: 'arrowRight', size: 12 }))
  );
}

function JobLabelPreview({ preview }) {
  if (!preview) return null;
  const { lab, patient, clinic, doctor, job, items, materials, totals, declaration, insurer } = preview;
  return React.createElement('div', {
    style: { border: '1px solid #ece7dc', borderRadius: 10, background: '#fff', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }
  },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' } },
      React.createElement('div', null,
        React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fontSize: 14, color: '#1a2320' } }, lab.name),
        React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 2 } }, lab.address),
        React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490' } }, `Garant: ${lab.garant_name || '—'} (${lab.garant_registration_number || '—'})`)
      ),
      React.createElement('div', { style: { textAlign: 'right' } },
        React.createElement('div', { style: { fontSize: 11, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.04em' } }, 'Číslo štítku'),
        React.createElement('div', { style: { fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 14, color: '#0d7c6b' } }, job.label_number || '—')
      )
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
      React.createElement(InfoCell, { label: 'Pacient', value: `${patient.identifier || '—'} · ${patient.birth_number || '—'}` }),
      React.createElement(InfoCell, { label: 'Poisťovňa', value: insurer ? `${insurer.short_name || insurer.name} (${insurer.code})` : '—' }),
      React.createElement(InfoCell, { label: 'Ambulancia', value: `${clinic.name || '—'} · PZS ${clinic.pzs_code || '—'}` }),
      React.createElement(InfoCell, { label: 'Lekár', value: `${doctor.name || '—'} · kód ${doctor.doctor_code || '—'}` }),
      React.createElement(InfoCell, { label: 'Diagnóza (MKCH-10)', value: job.diagnosis_code || '—' }),
      React.createElement(InfoCell, { label: 'Farba', value: job.tooth_color || '—' })
    ),
    job.health_note && React.createElement('div', { style: { padding: 10, background: '#fef9c3', borderLeft: '3px solid #d97706', borderRadius: 6, fontSize: 12, color: '#713f12' } }, job.health_note),
    React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 } }, 'Položky'),
      React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden' } },
        ...(items || []).map((item, index) => React.createElement('div', {
          key: index,
          style: { display: 'grid', gridTemplateColumns: '90px 1fr 70px 70px 70px', gap: 8, padding: '7px 10px', borderTop: index ? '1px solid #f0ede5' : 'none', fontSize: 11.5, alignItems: 'center' }
        },
          React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', color: '#0d7c6b', fontWeight: 700 } }, item.ipzp_code || '—'),
          React.createElement('span', null, item.description, item.location && React.createElement('span', { style: { color: '#8a9490' } }, ` · ${item.location}`)),
          React.createElement('span', { style: { textAlign: 'right' } }, labelMoney(item.total)),
          React.createElement('span', { style: { textAlign: 'right', color: '#5a6b66' } }, labelMoney(item.insurance_amount)),
          React.createElement('span', { style: { textAlign: 'right', color: '#5a6b66' } }, labelMoney(item.patient_amount))
        ))
      )
    ),
    materials && materials.length > 0 && React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 } }, 'Materiály (MDR)'),
      React.createElement('ul', { style: { margin: 0, paddingLeft: 18, fontSize: 11.5, color: '#1a2320', lineHeight: 1.6 } },
        ...materials.map((line, index) => React.createElement('li', { key: index }, line.text))
      )
    ),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#fbfaf6', borderRadius: 8, fontWeight: 700, fontSize: 12.5 } },
      React.createElement('span', null, 'Úhrada poisťovňa / doplatok / cena v ZT'),
      React.createElement('span', null, `${labelMoney(totals.insurance)} / ${labelMoney(totals.patient)} / ${labelMoney(totals.lab_price)}`)
    ),
    declaration && React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 } }, `MDR vyhlásenie — ${declaration.reference}`),
      React.createElement('div', { style: { fontSize: 11.5, color: '#5a6b66', lineHeight: 1.5 } }, declaration.text)
    )
  );
}

function JobLabelSection({ rawJob, onNavigate, onOpenPatient }) {
  const readiness = useJobLabelReadiness(rawJob);
  const [preview, setPreview] = React.useState(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(null); // 'preview' | 'pdf' | 'print' | null
  const [error, setError] = React.useState(null); // { detail, missing_fields } | string | null

  const runAction = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (err && err.status === 400 && err.data && err.data.missing_fields) {
        setError(err.data);
      } else {
        setError((err && err.data && err.data.detail) || (err && err.message) || 'Akcia zlyhala.');
      }
    } finally {
      setBusy(null);
    }
  };

  const loadPreview = () => runAction('preview', async () => {
    const data = await window.MolarisAPI.fetchProstheticLabelPreview(rawJob.id);
    setPreview(data);
    setPreviewOpen(true);
  });

  const downloadPdf = () => runAction('pdf', async () => {
    await window.MolarisAPI.downloadProstheticLabelPdf(rawJob.id, `protetický_štítok_${rawJob.id}.pdf`);
  });

  const printLabel = () => runAction('print', async () => {
    const url = await window.MolarisAPI.fetchProstheticLabelPdfUrl(rawJob.id);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      const tryPrint = () => { try { printWindow.focus(); printWindow.print(); } catch { /* best effort */ } };
      printWindow.addEventListener ? printWindow.addEventListener('load', tryPrint) : window.setTimeout(tryPrint, 700);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  });

  const displayedMissing = (error && error.missing_fields) || readiness.missing;

  return React.createElement(Card, null,
    React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
      React.createElement(CardTitle, null, 'Protetický štítok'),
      readiness.ready
        ? React.createElement(Badge, { color: 'done' }, 'Pripravené na vystavenie')
        : React.createElement(Badge, { color: 'cancelled' }, `Chýba ${displayedMissing.length} ${displayedMissing.length === 1 ? 'údaj' : 'údajov'}`)
    ),
    React.createElement(CardContent, { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement(InfoCell, { label: 'Číslo štítku', value: readiness.labelNumber || 'Zatiaľ nevygenerované' }),
        React.createElement(InfoCell, { label: 'Dátum vydania', value: readiness.issuedAt || '—' })
      ),

      displayedMissing.length > 0 && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        ...displayedMissing.map((entry, index) => React.createElement(JobLabelMissingRow, {
          key: entry.field || index, entry, rawJob, onNavigate, onOpenPatient,
        }))
      ),

      typeof error === 'string' && React.createElement(ErrorState, { title: 'Akcia zlyhala', message: error }),

      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        React.createElement(Button, { variant: 'outline', size: 'sm', onClick: loadPreview, disabled: busy === 'preview' },
          React.createElement(Icon, { name: 'search', size: 13 }), busy === 'preview' ? 'Načítavam náhľad…' : 'Náhľad'),
        React.createElement(Button, { variant: 'outline', size: 'sm', onClick: printLabel, disabled: busy === 'print' },
          React.createElement(Icon, { name: 'printer', size: 13 }), busy === 'print' ? 'Otváram…' : 'Tlačiť'),
        React.createElement(Button, { size: 'sm', onClick: downloadPdf, disabled: busy === 'pdf' },
          React.createElement(Icon, { name: 'download', size: 13 }), busy === 'pdf' ? 'Sťahujem…' : 'Stiahnuť PDF')
      ),

      previewOpen && preview && React.createElement(JobLabelPreview, { preview })
    )
  );
}

Object.assign(window, { JobLabelSection, useJobLabelReadiness, LABEL_WHERE_TO_PAGE });
