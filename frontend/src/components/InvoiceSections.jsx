// InvoiceSections.jsx — reusable invoice detail and action sections.

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
  return React.useMemo(() => ({
    canDownload: !!invoice.id,
    canIssue: !!invoice.id,
    pdfName: `${invoice.number}.pdf`,
  }), [invoice]);
}

function InvoiceStatusBadge({ invoice }) {
  return React.createElement(Badge, { color: invoice.status }, invoice.statusLabel);
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
  const downloadPdf = async () => {
    try {
      if (actions.canDownload) await window.MolarisAPI.downloadInvoicePdf(invoice.id, actions.pdfName);
    } catch {
      if (onError) onError('PDF sa nepodarilo stiahnuť.');
    }
  };
  const issueInvoice = async () => {
    try {
      if (actions.canIssue) await window.MolarisAPI.updateInvoiceStatus(invoice.id, 'issued');
    } catch (err) {
      if (onError) onError((err && err.data && JSON.stringify(err.data)) || 'Faktúru sa nepodarilo označiť ako vystavenú.');
    }
  };

  if (compact) {
    return React.createElement('div', { style: { display: 'flex', gap: 2, justifyContent: 'flex-end' }, onClick: event => event.stopPropagation() },
      React.createElement(IconButton, { name: 'eye', title: 'Detail', onClick: () => onView && onView(invoice) }),
      React.createElement(IconButton, { name: 'download', title: 'Stiahnuť PDF', onClick: downloadPdf }),
      React.createElement(IconButton, { name: 'send', title: 'Odoslať', onClick: issueInvoice })
    );
  }

  return [
    React.createElement(Button, { key: 'c', variant: 'outline', onClick: onClose }, 'Zatvoriť'),
    React.createElement(Button, { key: 'p', variant: 'outline', onClick: downloadPdf, disabled: !actions.canDownload },
      React.createElement(Icon, { name: 'printer', size: 14 }),
      'Tlač'
    ),
    React.createElement(Button, { key: 's', onClick: issueInvoice, disabled: !actions.canIssue },
      React.createElement(Icon, { name: 'send', size: 14 }),
      'Odoslať klinike'
    ),
  ];
}

Object.assign(window, {
  InvoiceForm,
  InvoiceLineItems,
  InvoiceStatusBadge,
  InvoiceActions,
  useInvoiceFormData,
  useInvoiceLineItemsData,
  useInvoiceActionsData,
});
