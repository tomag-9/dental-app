// InvoiceSections.jsx — reusable invoice detail and action sections.

const INVOICE_LIFECYCLE = [
  { status: 'draft', label: 'Koncept', badge: 'draft', description: 'Interná príprava. Faktúra ešte nebola odoslaná klinike.' },
  { status: 'issued', label: 'Vystavená', badge: 'issued', description: 'Odoslaná klinike a čaká na úhradu.' },
  { status: 'paid', label: 'Zaplatená', badge: 'paid', description: 'Úhrada je zaevidovaná. Stav mení finančný prehľad.' },
  { status: 'cancelled', label: 'Zrušená', badge: 'cancelled', description: 'Faktúra sa už nemá uhrádzať ani započítavať do príjmov.' },
];

function useInvoiceFormData(invoice) {
  return React.useMemo(() => ({
    status: invoice.status,
    statusLabel: invoice.statusLabel,
    due: invoice.due || '—',
    amount: invoice.amount,
    items: invoice.items || ((invoice.lineItems && invoice.lineItems.length) || 0),
  }), [invoice]);
}

function useInvoiceLineItemsData(invoice) {
  return React.useMemo(() => {
    const lineItems = (invoice.lineItems && invoice.lineItems.length) ? invoice.lineItems : [];
    const subtotal = lineItems.reduce((sum, line) => sum + (line.total || 0), 0);
    const vatRate = (invoice.raw && invoice.raw.vat_rate != null) ? invoice.raw.vat_rate / 100 : 0.20;
    const vat = subtotal * vatRate;
    return { lineItems, subtotal, vatRate, vat, total: subtotal + vat };
  }, [invoice]);
}

function useInvoiceActionsData(invoice) {
  const status = invoice.status;
  return React.useMemo(() => ({
    canDownload: !!invoice.id,
    canIssue: !!invoice.id && status === 'draft',
    canMarkPaid: !!invoice.id && status === 'issued',
    canCancel: !!invoice.id && status !== 'paid' && status !== 'cancelled',
    canRollback: !!invoice.id && ['issued', 'cancelled'].includes(status),
    canDelete: !!invoice.id && status !== 'paid',
    pdfName: `${invoice.number}.pdf`,
  }), [invoice, status]);
}

function useInvoiceAuditTrailData(invoice) {
  return React.useMemo(() => {
    const raw = invoice.raw || {};
    const audit = raw.audit_log || raw.timeline || [];
    if (audit.length) {
      return audit.map((event, index) => ({
        key: event.id || `${event.event || event.action}-${index}`,
        title: event.label || event.event || event.action || 'Zmena faktúry',
        actor: event.actor_name || event.user_name || 'Systém',
        date: event.created_at ? new Date(event.created_at).toLocaleString('sk-SK') : '—',
        note: event.note || event.message,
      }));
    }

    const entries = [];
    const push = (key, title, date, note) => {
      if (!date && key !== 'current') return;
      entries.push({
        key,
        title,
        actor: 'Systém',
        date: date ? new Date(date).toLocaleString('sk-SK') : 'Teraz',
        note,
      });
    };
    push('created', 'Faktúra vytvorená', raw.created_at || raw.issue_date || invoice.issued, 'Záznam vznikol v module fakturácie.');
    if (['issued', 'paid'].includes(invoice.status)) {
      push('issued', 'Faktúra vystavená', raw.issued_at || raw.issue_date || invoice.issued, 'PDF a odoslanie klinike sú dostupné z detailu.');
    }
    if (invoice.status === 'paid') {
      push('paid', 'Faktúra označená ako zaplatená', raw.paid_at || raw.updated_at, 'Suma sa započítava do tržieb.');
    }
    if (invoice.status === 'cancelled') {
      push('cancelled', 'Faktúra zrušená', raw.cancelled_at || raw.updated_at, 'Zrušené faktúry sa nemajú ďalej vymáhať.');
    }
    if (entries.length === 0) {
      push('current', 'Aktuálny stav bez histórie', null, 'API zatiaľ neposlalo detailnú auditnú stopu.');
    }
    return entries;
  }, [invoice]);
}

function InvoiceStatusBadge({ invoice }) {
  return React.createElement(Badge, { color: invoice.status }, invoice.statusLabel);
}

function InvoiceLifecycleGuide({ invoice }) {
  return React.createElement(Card, null,
    React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Životný cyklus faktúry')),
    React.createElement(CardContent, { style: { display: 'grid', gap: 8 } },
      ...INVOICE_LIFECYCLE.map((state) => {
        const active = invoice && invoice.status === state.status;
        return React.createElement('div', {
          key: state.status,
          style: {
            display: 'grid',
            gridTemplateColumns: '110px 1fr',
            gap: 10,
            alignItems: 'start',
            padding: '9px 10px',
            borderRadius: 8,
            border: active ? '1px solid #0d7c6b' : '1px solid #ece7dc',
            background: active ? '#f0fdfa' : '#fff',
          }
        },
          React.createElement(Badge, { color: state.badge }, state.label),
          React.createElement('span', { style: { fontSize: 12, color: '#5a6b66', lineHeight: 1.45 } }, state.description)
        );
      })
    )
  );
}

function InvoiceAuditTrail({ invoice }) {
  const entries = useInvoiceAuditTrailData(invoice);
  return React.createElement(Card, null,
    React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Auditná stopa')),
    React.createElement(CardContent, { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      ...entries.map((entry) => React.createElement('div', {
        key: entry.key,
        style: { display: 'flex', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f0ede5' }
      },
        React.createElement('div', { style: { width: 26, height: 26, borderRadius: '50%', background: '#0d7c6b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
          React.createElement(Icon, { name: 'activity', size: 13 })
        ),
        React.createElement('div', { style: { minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: '#1a2320' } }, entry.title),
          React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 2 } }, entry.actor, ' · ', entry.date),
          entry.note && React.createElement('div', { style: { fontSize: 12, color: '#5a6b66', marginTop: 4, lineHeight: 1.45 } }, entry.note)
        )
      ))
    )
  );
}

function InvoiceForm({ invoice }) {
  const details = useInvoiceFormData(invoice);
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
    React.createElement(InfoCell, { label: 'Stav', value: React.createElement(InvoiceStatusBadge, { invoice }) }),
    React.createElement(InfoCell, { label: 'Splatnosť', value: details.due }),
    React.createElement(InfoCell, { label: 'Suma celkom', value: React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fontSize: 16 } }, fmtEur(details.amount)) }),
    React.createElement(InfoCell, { label: 'Položky', value: `${details.items}` })
  );
}

function InvoiceLineItems({ invoice }) {
  const { lineItems, subtotal, vatRate, vat, total } = useInvoiceLineItemsData(invoice);
  return React.createElement('div', null,
    React.createElement('h3', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320', margin: '0 0 8px', letterSpacing: '-0.01em' } }, 'Položky faktúry'),
    lineItems.length === 0
      ? React.createElement(EmptyState, { title: 'Žiadne položky' })
      : React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden', background: '#fff' } },
          ...lineItems.map((line, index) => React.createElement('div', {
            key: `${line.name}-${index}`,
            style: { display: 'grid', gridTemplateColumns: '1fr 50px 90px 90px', padding: '10px 14px', fontSize: 12.5, borderTop: index === 0 ? 'none' : '1px solid #f0ede5', alignItems: 'center' }
          },
            React.createElement('span', { style: { fontWeight: 500 } }, line.name),
            React.createElement('span', { style: { textAlign: 'center', color: '#8a9490' } }, (line.qty || 1) + '×'),
            React.createElement('span', { style: { textAlign: 'right', color: '#8a9490' } }, fmtEur(line.unit)),
            React.createElement('span', { style: { textAlign: 'right', fontWeight: 600, fontFamily: 'Plus Jakarta Sans,sans-serif' } }, fmtEur(line.total))
          )),
          React.createElement('div', { style: { padding: '10px 14px', background: '#fbfaf6', borderTop: '1px solid #f0ede5', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', color: '#5a6b66' } },
              React.createElement('span', null, 'Medzisúčet'),
              React.createElement('span', null, fmtEur(subtotal))
            ),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', color: '#5a6b66' } },
              React.createElement('span', null, `DPH ${Math.round(vatRate * 100)} %`),
              React.createElement('span', null, fmtEur(vat))
            ),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, color: '#1a2320', fontSize: 14, marginTop: 2 } },
              React.createElement('span', null, 'Celkom'),
              React.createElement('span', null, fmtEur(total))
            )
          )
        )
  );
}

function InvoiceActions({ invoice, compact = false, onView, onError, onClose }) {
  const actions = useInvoiceActionsData(invoice);
  const [confirmAction, setConfirmAction] = React.useState(null);
  const [printOpen, setPrintOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const openPrint = () => { if (actions.canDownload) setPrintOpen(true); };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      await confirmAction.run();
      setConfirmAction(null);
    } catch (err) {
      if (onError) onError((err && err.data && JSON.stringify(err.data)) || confirmAction.error);
    } finally {
      setBusy(false);
    }
  };

  const askStatus = (status, title, message, confirmText, error, destructive = false) => {
    setConfirmAction({
      title,
      message,
      confirmText,
      destructive,
      error,
      run: () => window.MolarisAPI.updateInvoiceStatus(invoice.id, status),
    });
  };

  const askDelete = () => {
    setConfirmAction({
      title: 'Zmazať faktúru',
      message: `Naozaj chcete zmazať faktúru ${invoice.number}? Táto akcia sa nedá vrátiť späť.`,
      confirmText: 'Zmazať',
      destructive: true,
      error: 'Faktúru sa nepodarilo zmazať.',
      run: async () => {
        await window.MolarisAPI.deleteInvoice(invoice.id);
        if (onClose) onClose();
      },
    });
  };

  const dialog = React.createElement(ConfirmDialog, {
    open: !!confirmAction,
    title: confirmAction && confirmAction.title,
    message: confirmAction && confirmAction.message,
    confirmText: busy ? 'Pracujem…' : confirmAction && confirmAction.confirmText,
    cancelText: 'Zrušiť',
    destructive: confirmAction && confirmAction.destructive,
    onConfirm: busy ? undefined : runConfirmedAction,
    onCancel: busy ? undefined : () => setConfirmAction(null),
  });

  if (compact) {
    const compactActions = [
      React.createElement(IconButton, { key: 'view', name: 'eye', title: 'Detail', onClick: () => onView && onView(invoice) }),
      React.createElement(IconButton, { key: 'pdf', name: 'download', title: 'Náhľad / PDF', onClick: openPrint }),
    ];
    if (actions.canIssue) compactActions.push(React.createElement(IconButton, {
      key: 'issue',
      name: 'send',
      title: 'Vystaviť',
      onClick: () => askStatus('issued', 'Vystaviť faktúru', `Faktúra ${invoice.number} bude označená ako vystavená a vstúpi do pohľadávok.`, 'Vystaviť', 'Faktúru sa nepodarilo vystaviť.'),
    }));
    if (actions.canMarkPaid) compactActions.push(React.createElement(IconButton, {
      key: 'paid',
      name: 'checkCircle',
      title: 'Označiť zaplatenú',
      onClick: () => askStatus('paid', 'Označiť ako zaplatenú', `Potvrďte úhradu faktúry ${invoice.number}. Suma sa započíta do tržieb.`, 'Označiť zaplatenú', 'Úhradu sa nepodarilo uložiť.'),
    }));
    if (actions.canCancel) compactActions.push(React.createElement(IconButton, {
      key: 'cancel',
      name: 'x',
      title: 'Zrušiť faktúru',
      destructive: true,
      onClick: () => askStatus('cancelled', 'Zrušiť faktúru', `Faktúra ${invoice.number} prestane byť aktívnou pohľadávkou.`, 'Zrušiť faktúru', 'Faktúru sa nepodarilo zrušiť.', true),
    }));
    if (actions.canDelete) compactActions.push(React.createElement(IconButton, {
      key: 'delete',
      name: 'trash',
      title: 'Zmazať faktúru',
      destructive: true,
      onClick: askDelete,
    }));

    return React.createElement(React.Fragment, null,
      React.createElement('div', { style: { display: 'flex', gap: 2, justifyContent: 'flex-end' }, onClick: event => event.stopPropagation() }, ...compactActions),
      dialog,
      printOpen && React.createElement(InvoicePrintOverlay, { invoiceId: invoice.id, invoiceNumber: invoice.number, onClose: () => setPrintOpen(false) })
    );
  }

  const footerActions = [
    React.createElement(Button, { key: 'c', variant: 'outline', onClick: onClose }, 'Zatvoriť'),
    React.createElement(Button, { key: 'p', variant: 'outline', onClick: openPrint, disabled: !actions.canDownload },
      React.createElement(Icon, { name: 'printer', size: 14 }),
      'Náhľad PDF'
    ),
    actions.canIssue && React.createElement(Button, {
      key: 'issue',
      onClick: () => askStatus('issued', 'Vystaviť faktúru', `Faktúra ${invoice.number} bude označená ako vystavená a vstúpi do pohľadávok.`, 'Vystaviť', 'Faktúru sa nepodarilo vystaviť.'),
    }, React.createElement(Icon, { name: 'send', size: 14 }), 'Vystaviť'),
    actions.canMarkPaid && React.createElement(Button, {
      key: 'paid',
      onClick: () => askStatus('paid', 'Označiť ako zaplatenú', `Potvrďte úhradu faktúry ${invoice.number}. Suma sa započíta do tržieb.`, 'Označiť zaplatenú', 'Úhradu sa nepodarilo uložiť.'),
    }, React.createElement(Icon, { name: 'checkCircle', size: 14 }), 'Zaplatená'),
    actions.canRollback && React.createElement(Button, {
      key: 'rollback',
      variant: 'outline',
      onClick: () => askStatus('draft', 'Vrátiť na koncept', `Faktúra ${invoice.number} sa vráti do konceptu. Tento návrat je finančná zmena a zostane v histórii.`, 'Vrátiť', 'Faktúru sa nepodarilo vrátiť na koncept.'),
    }, React.createElement(Icon, { name: 'rotateCcw', size: 14 }), 'Koncept'),
    actions.canCancel && React.createElement(Button, {
      key: 'cancel',
      variant: 'destructive',
      onClick: () => askStatus('cancelled', 'Zrušiť faktúru', `Faktúra ${invoice.number} prestane byť aktívnou pohľadávkou.`, 'Zrušiť faktúru', 'Faktúru sa nepodarilo zrušiť.', true),
    }, React.createElement(Icon, { name: 'x', size: 14 }), 'Zrušiť'),
    actions.canDelete && React.createElement(Button, { key: 'delete', variant: 'destructive', onClick: askDelete },
      React.createElement(Icon, { name: 'trash', size: 14 }),
      'Zmazať'
    ),
  ].filter(Boolean);

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', width: '100%' } }, ...footerActions),
    dialog,
    printOpen && React.createElement(InvoicePrintOverlay, { invoiceId: invoice.id, invoiceNumber: invoice.number, onClose: () => setPrintOpen(false) })
  );
}

Object.assign(window, {
  INVOICE_LIFECYCLE,
  InvoiceForm,
  InvoiceLineItems,
  InvoiceStatusBadge,
  InvoiceLifecycleGuide,
  InvoiceAuditTrail,
  InvoiceActions,
  useInvoiceFormData,
  useInvoiceLineItemsData,
  useInvoiceActionsData,
  useInvoiceAuditTrailData,
});
