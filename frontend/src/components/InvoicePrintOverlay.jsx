// InvoicePrintOverlay.jsx — fullscreen A4 invoice preview using InvoicePDF component

function mapApiInvoiceToInvoicePDF(invoiceRaw, lab, clinic) {
  const labName = (lab && lab.name) || 'Laboratórium';
  const labInitials = labName.replace(/[^A-ZÁÉÍÓÚÄÔÖÜÝČ]/gi, '').slice(0, 2).toUpperCase() || labName.slice(0, 2).toUpperCase();
  const fmt = (s) => (s || '').trim() || '—';

  const supplier = {
    name: labName,
    address: fmt(lab && (lab.address || lab.street)),
    city: fmt(lab && [lab.postal_code, lab.city].filter(Boolean).join(' ')),
    country: (lab && lab.country) || 'Slovensko',
    ico: fmt(lab && lab.tax_id),
    dic: '—',
    icDph: fmt(lab && lab.vat_id),
    registration: '',
    iban: fmt(lab && lab.bank_account),
    swift: fmt(lab && lab.bank_bic),
    bank: '—',
    phone: (lab && lab.phone) || '',
    email: (lab && lab.email) || '',
    logoText: labInitials || 'L',
    logoLine: 'dentálne laboratórium',
  };

  const customer = {
    name: (clinic && clinic.name) || invoiceRaw.clinic_name || '—',
    address: fmt(clinic && (clinic.address || clinic.street)),
    city: fmt(clinic && [clinic.zip_code, clinic.city].filter(Boolean).join(' ')),
    country: 'Slovensko',
    ico: fmt(clinic && clinic.ico),
    dic: fmt(clinic && clinic.dic),
    icDph: '—',
  };

  const vatRate = parseFloat(invoiceRaw.vat_rate || 0);

  const rawItems = invoiceRaw.items || [];
  const subtotal = rawItems.reduce((sum, item) => sum + (parseFloat(item.line_total || 0) || 0), 0);
  const items = invoiceRaw.description_mode === 'custom'
    ? [{
        code: 'PRACE',
        name: invoiceRaw.custom_description || 'Protetické práce',
        qty: 1,
        unit: 'ks',
        unitPrice: subtotal,
        vat: vatRate,
      }]
    : rawItems.map((item, i) => ({
    code: item.description
      ? item.description.replace(/\s+/g, '-').toUpperCase().slice(0, 10)
      : `IT-${String(i + 1).padStart(3, '0')}`,
    name: item.description || `Položka #${i + 1}`,
    qty: parseFloat(item.quantity || 1),
    unit: 'ks',
    unitPrice: parseFloat(item.unit_price || 0),
    vat: vatRate,
  }));

  const fmtSk = (isoDate) => {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    if (isNaN(d)) return isoDate;
    return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  };

  return {
    number: invoiceRaw.number || '—',
    variableSymbol: invoiceRaw.number || '—',
    constantSymbol: '0308',
    type: invoiceRaw.document_type === 'proforma' ? 'Predfaktúra — výzva na úhradu (nie je daňový doklad)' : 'Faktúra — daňový doklad',
    issuedAt: fmtSk(invoiceRaw.issued_at || invoiceRaw.created_at),
    suppliedAt: fmtSk(invoiceRaw.issued_at || invoiceRaw.created_at),
    dueAt: fmtSk(invoiceRaw.due_date),
    paymentMethod: 'Prevodom na účet',
    issuedBy: '',
    notes: invoiceRaw.description_mode === 'custom' && invoiceRaw.show_patient_list
      ? 'Podrobný rozpis prác a pacientov je v prílohe faktúry.'
      : (invoiceRaw.note || ''),
    supplier,
    customer,
    items,
  };
}

function InvoicePrintOverlay({ invoiceId, invoiceNumber, onClose }) {
  const [state, setState] = React.useState({ loading: true, error: null, data: null });

  React.useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    (async () => {
      try {
        const [invoiceRaw, lab, clinicsRaw] = await Promise.all([
          window.MolarisAPI.fetchInvoiceDetail(invoiceId),
          window.MolarisAPI.fetchCurrentLab().catch(() => null),
          window.MolarisAPI.request('/crm/clinics/').catch(() => []),
        ]);
        if (cancelled) return;
        const clinic = Array.isArray(clinicsRaw)
          ? clinicsRaw.find((c) => c.id === invoiceRaw.clinic || c.name === invoiceRaw.clinic_name) || null
          : null;
        const mapped = mapApiInvoiceToInvoicePDF(invoiceRaw, lab, clinic);
        setState({ loading: false, error: null, data: { mapped, invoiceRaw } });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: String(err && (err.message || err)), data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceId]);

  const isProforma = state.data && state.data.invoiceRaw.document_type === 'proforma';

  return React.createElement('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(26,35,32,0.72)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      backdropFilter: 'blur(2px)',
      overflowY: 'auto',
    },
    onClick: (e) => { if (e.target === e.currentTarget) onClose(); },
  },
    // Toolbar — fixed so it stays on top while scrolling
    React.createElement('div', {
      className: 'molaris-print-toolbar',
      style: {
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9001,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, padding: '10px 20px',
        background: '#1a2320',
        boxSizing: 'border-box',
      }
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement(LogoInverse, { markSize: 20, wordmarkSize: 14 }),
        React.createElement('span', {
          style: { fontSize: 13, color: '#8a9490', fontFamily: 'Manrope, sans-serif', fontWeight: 500 }
        }, invoiceNumber ? `Faktúra ${invoiceNumber}` : 'Náhľad faktúry'),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', {
          onClick: () => window.print(),
          style: {
            padding: '8px 18px', background: '#0d7c6b', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }
        },
          React.createElement(Icon, { name: 'printer', size: 14, color: '#fff' }),
          'Tlačiť / PDF'
        ),
        React.createElement('button', {
          onClick: onClose,
          style: {
            padding: '8px 14px', background: 'transparent', color: '#8a9490',
            border: '1px solid #3a4a44', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif', fontWeight: 600, fontSize: 13,
          }
        }, '✕ Zatvoriť'),
      ),
    ),

    // Content
    state.loading && React.createElement('div', {
      style: { marginTop: 60, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a9490', fontSize: 14, padding: 60 }
    }, 'Načítavam faktúru…'),

    state.error && React.createElement('div', {
      style: { marginTop: 60, padding: 40, color: '#c0392b', fontFamily: 'Manrope, sans-serif', fontSize: 14 }
    }, 'Chyba: ', state.error),

    state.data && React.createElement('div', {
      className: 'molaris-print-content',
      style: { padding: '76px 0 60px', display: 'flex', justifyContent: 'center' }
    },
      React.createElement('div', {
        style: {
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          borderRadius: 2,
          overflow: 'hidden',
        }
      },
        isProforma
          ? React.createElement(ProformaPDF, { invoice: state.data.mapped, showSupplierLogo: true })
          : React.createElement(InvoicePDF, { invoice: state.data.mapped, showSupplierLogo: true })
      )
    ),

    // Print CSS
    React.createElement('style', null, `
      @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body > *:not(#root) { display: none !important; }
        body { background: white !important; }
        .molaris-print-toolbar { display: none !important; }
        .molaris-print-content {
          position: fixed !important;
          inset: 0 !important;
          background: white !important;
          padding: 0 !important;
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
          overflow: visible !important;
        }
        .molaris-print-content > div {
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        @page { margin: 0; size: A4 portrait; }
      }
    `)
  );
}

Object.assign(window, { InvoicePrintOverlay, mapApiInvoiceToInvoicePDF });
