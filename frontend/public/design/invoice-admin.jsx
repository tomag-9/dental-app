// invoice-admin.jsx — Molaris admin settings for invoices
// Configures skonto (early-payment discount), numbering, defaults.

function InvoiceAdminSettings({ value, onChange }) {
  const v = value;
  const set = (k, val) => onChange({ ...v, [k]: val });

  return React.createElement('div', {
    style: {
      width: 720,
      background: '#fff',
      border: '1px solid #e4ded4',
      borderRadius: 12,
      fontFamily: "'Manrope', sans-serif",
      color: '#1a2320',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,.04)',
    }
  },
    // Header strip
    React.createElement('div', {
      style: {
        padding: '20px 28px',
        borderBottom: '1px solid #ece7dc',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        background: '#fbfaf6',
      }
    },
      React.createElement('div', null,
        React.createElement('div', {
          style: { fontSize: 10.5, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }
        }, 'Nastavenia · Faktúry'),
        React.createElement('h2', {
          style: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }
        }, 'Pravidlá fakturácie'),
        React.createElement('div', { style: { fontSize: 12, color: '#5a6b66', marginTop: 4 } },
          'Tieto pravidlá sa použijú na všetky novovytvorené faktúry a predfaktúry.'),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', {
          style: btnStyleSecondary,
        }, 'Zrušiť'),
        React.createElement('button', {
          style: btnStylePrimary,
        }, 'Uložiť zmeny'),
      ),
    ),

    React.createElement('div', { style: { padding: '4px 0' } },
      // ─── Section: Skonto ────────────────────────────────────
      React.createElement(Section, {
        title: 'Skonto pri včasnej platbe',
        description: 'Zákazník dostane percentuálnu zľavu, ak uhradí faktúru do stanoveného počtu dní od dátumu vystavenia.',
      },
        React.createElement(ToggleRow, {
          label: 'Povoliť skonto na nových faktúrach',
          sub: 'Na faktúre sa zobrazí blok so skonto sumou a termínom pre včasnú úhradu.',
          checked: v.skontoEnabled,
          onChange: (b) => set('skontoEnabled', b),
        }),

        v.skontoEnabled && React.createElement('div', {
          style: {
            marginTop: 16,
            padding: 16,
            background: '#fef9ee',
            border: '1px solid #f6d77a',
            borderRadius: 8,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
          }
        },
          React.createElement(NumberField, {
            label: 'Výška skonta',
            suffix: '%',
            min: 0.5, max: 20, step: 0.5,
            value: v.skontoPercent,
            onChange: (x) => set('skontoPercent', x),
          }),
          React.createElement(NumberField, {
            label: 'Pri úhrade do',
            suffix: 'dní od vystavenia',
            min: 1, max: 60, step: 1,
            value: v.skontoDays,
            onChange: (x) => set('skontoDays', x),
          }),
          React.createElement('div', { style: { gridColumn: '1 / -1' } },
            React.createElement(SkontoPreview, {
              percent: v.skontoPercent,
              days: v.skontoDays,
              sampleTotal: 2520.00,
            })
          ),
        ),
      ),

      Divider(),

      // ─── Section: Číslovanie ────────────────────────────────
      React.createElement(Section, {
        title: 'Číslovanie dokladov',
        description: 'Formát čísla pre faktúry a predfaktúry. Premenné: {YYYY}, {MM}, {###} — sekvencia.',
      },
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } },
          React.createElement(TextField, {
            label: 'Formát čísla faktúry',
            value: v.invoicePrefix,
            onChange: (x) => set('invoicePrefix', x),
            preview: 'Príklad: ' + v.invoicePrefix.replace('{YYYY}', '2026').replace('{###}', '014'),
          }),
          React.createElement(TextField, {
            label: 'Formát čísla predfaktúry',
            value: v.proformaPrefix,
            onChange: (x) => set('proformaPrefix', x),
            preview: 'Príklad: ' + v.proformaPrefix.replace('{YYYY}', '2026').replace('{###}', '014'),
          }),
        ),
      ),

      Divider(),

      // ─── Section: Splatnosť & DPH ──────────────────────────
      React.createElement(Section, {
        title: 'Predvolená splatnosť a DPH',
      },
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } },
          React.createElement(NumberField, {
            label: 'Predvolená splatnosť',
            suffix: 'dní',
            min: 0, max: 90, step: 1,
            value: v.defaultDueDays,
            onChange: (x) => set('defaultDueDays', x),
          }),
          React.createElement(NumberField, {
            label: 'Sadzba DPH',
            suffix: '%',
            min: 0, max: 30, step: 1,
            value: v.vatRate,
            onChange: (x) => set('vatRate', x),
          }),
        ),
      ),

      Divider(),

      // ─── Section: Vzhľad ────────────────────────────────────
      React.createElement(Section, {
        title: 'Vzhľad PDF dokladov',
      },
        React.createElement(ToggleRow, {
          label: 'Zobrazovať logo laboratória v hornom ľavom rohu',
          sub: 'Ak vypnete, ľavý horný roh ostane prázdny. Logo Molaris v pravom rohu ostáva vždy.',
          checked: v.showLabLogo,
          onChange: (b) => set('showLabLogo', b),
        }),
        React.createElement(ToggleRow, {
          label: 'Zobrazovať QR kód PAY by square',
          sub: 'QR kód sa zobrazí v pätke pri platobných údajoch — slovenský bankový štandard.',
          checked: v.showQr,
          onChange: (b) => set('showQr', b),
        }),
        React.createElement(ToggleRow, {
          label: 'Zobrazovať kód úkonu v tabuľke položiek',
          sub: 'Pomáha klinikám párovať položky s ich internou evidenciou.',
          checked: v.showItemCode,
          onChange: (b) => set('showItemCode', b),
        }),
      ),

    )
  );
}

function Section({ title, description, children }) {
  return React.createElement('div', { style: { padding: '20px 28px' } },
    React.createElement('div', { style: { marginBottom: 14 } },
      React.createElement('h3', {
        style: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, margin: 0, color: '#1a2320', letterSpacing: '-0.01em' }
      }, title),
      description && React.createElement('div', {
        style: { fontSize: 11.5, color: '#5a6b66', marginTop: 4, lineHeight: 1.5, maxWidth: 580 }
      }, description)
    ),
    children,
  );
}

function Divider() {
  return React.createElement('div', { style: { height: 1, background: '#ece7dc', margin: '0 28px' } });
}

function ToggleRow({ label, sub, checked, onChange }) {
  return React.createElement('label', {
    style: {
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '10px 0', cursor: 'pointer',
    }
  },
    React.createElement(Toggle, { checked, onChange }),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', {
        style: { fontSize: 13, color: '#1a2320', fontWeight: 600 }
      }, label),
      sub && React.createElement('div', {
        style: { fontSize: 11.5, color: '#8a9490', marginTop: 2, lineHeight: 1.4 }
      }, sub),
    ),
  );
}

function Toggle({ checked, onChange }) {
  return React.createElement('button', {
    type: 'button',
    onClick: () => onChange(!checked),
    style: {
      flexShrink: 0,
      width: 36, height: 20,
      borderRadius: 999,
      background: checked ? '#0d7c6b' : '#d4d1c9',
      border: 'none',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background .15s',
      marginTop: 2,
    }
  },
    React.createElement('span', {
      style: {
        position: 'absolute',
        top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        transition: 'left .15s',
        boxShadow: '0 1px 2px rgba(0,0,0,.2)',
      }
    })
  );
}

function NumberField({ label, value, onChange, suffix, min, max, step }) {
  return React.createElement('div', null,
    React.createElement('div', {
      style: { fontSize: 11, color: '#5a6b66', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }
    }, label),
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center',
        border: '1px solid #d4d1c9', borderRadius: 8, background: '#fff',
        overflow: 'hidden',
      }
    },
      React.createElement('input', {
        type: 'number',
        value, min, max, step,
        onChange: (e) => onChange(Number(e.target.value)),
        style: {
          flex: 1,
          border: 'none', outline: 'none',
          padding: '10px 12px',
          fontSize: 15,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          color: '#1a2320',
          background: 'transparent',
          fontVariantNumeric: 'tabular-nums',
          width: '100%',
        }
      }),
      suffix && React.createElement('span', {
        style: { padding: '0 12px', color: '#8a9490', fontSize: 12, borderLeft: '1px solid #ece7dc', height: '100%', display: 'flex', alignItems: 'center', background: '#fbfaf6' }
      }, suffix),
    ),
  );
}

function TextField({ label, value, onChange, preview }) {
  return React.createElement('div', null,
    React.createElement('div', {
      style: { fontSize: 11, color: '#5a6b66', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }
    }, label),
    React.createElement('input', {
      type: 'text', value,
      onChange: (e) => onChange(e.target.value),
      style: {
        width: '100%',
        border: '1px solid #d4d1c9', borderRadius: 8, background: '#fff',
        padding: '10px 12px',
        fontSize: 14,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 600,
        color: '#1a2320',
        outline: 'none',
        boxSizing: 'border-box',
        letterSpacing: '0.02em',
      }
    }),
    preview && React.createElement('div', {
      style: { fontSize: 10.5, color: '#8a9490', marginTop: 5, fontStyle: 'italic' }
    }, preview),
  );
}

function SkontoPreview({ percent, days, sampleTotal }) {
  const discount = sampleTotal * (percent / 100);
  const payable = sampleTotal - discount;
  const fmt = (n) => n.toFixed(2).replace('.', ',') + ' €';
  return React.createElement('div', {
    style: {
      background: '#fff', border: '1px solid #f6d77a', borderRadius: 6,
      padding: '12px 14px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
    }
  },
    React.createElement('div', null,
      React.createElement('div', {
        style: { fontSize: 9.5, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 3 }
      }, 'Náhľad na faktúre'),
      React.createElement('div', {
        style: { fontSize: 12, color: '#5a6b66', lineHeight: 1.5 }
      },
        'Pri vzorovej faktúre ', React.createElement('strong', { style: { color: '#1a2320' } }, fmt(sampleTotal)),
        ' uhradenej do ', React.createElement('strong', { style: { color: '#1a2320' } }, days + ' dní'),
        ' získa klient zľavu ', React.createElement('strong', { style: { color: '#1a2320' } }, fmt(discount)), '.'
      ),
    ),
    React.createElement('div', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } },
      React.createElement('div', {
        style: { fontSize: 9, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }
      }, 'Suma so skontom'),
      React.createElement('div', {
        style: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 800, color: '#92400e', lineHeight: 1.1, marginTop: 2 }
      }, fmt(payable)),
    ),
  );
}

const btnStylePrimary = {
  padding: '8px 16px',
  background: '#0d7c6b',
  color: '#fff',
  fontFamily: "'Manrope', sans-serif",
  fontWeight: 600,
  fontSize: 12.5,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
};
const btnStyleSecondary = {
  padding: '8px 16px',
  background: '#fff',
  color: '#1a2320',
  fontFamily: "'Manrope', sans-serif",
  fontWeight: 600,
  fontSize: 12.5,
  border: '1px solid #d4d1c9',
  borderRadius: 8,
  cursor: 'pointer',
};

Object.assign(window, { InvoiceAdminSettings });
