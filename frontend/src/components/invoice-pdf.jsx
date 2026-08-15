// invoice-pdf.jsx — Molaris PDF invoice layouts
// A4 portrait: 794 × 1123 px (at 96dpi). Minimal, paper-clean, brand-consistent.
// Exports: InvoicePDF, ProformaPDF

const PAPER_W = 794;
const PAPER_H = 1123;
const PAGE_PAD = 56;

const TEAL = '#0d7c6b';
const TEAL_DARK = '#085c4e';
const TEAL_SUBTLE = '#d4f0eb';
const INK = '#1a2320';
const INK_SOFT = '#5a6b66';
const INK_MUTED = '#8a9490';
const RULE = '#e4ded4';
const RULE_SOFT = '#f0ede5';
const PAPER = '#ffffff';
const TINT = '#fbfaf6';
const AMBER_BG = '#fef3c7';
const AMBER_TEXT = '#92400e';

const fmtEur = (n) => n.toFixed(2).replace('.', ',') + ' €';
const fmtEurPlain = (n) => n.toFixed(2).replace('.', ',');

// Default sample data
const DEFAULT_INVOICE = {
  number: '2025014',
  variableSymbol: '2025014',
  constantSymbol: '0308',
  type: 'Faktúra — daňový doklad',
  issuedAt: '12. 5. 2026',
  suppliedAt: '12. 5. 2026',
  dueAt: '26. 5. 2026',
  paymentMethod: 'Prevodom na účet',
  supplier: {
    name: 'Dentálne laboratórium MK, s. r. o.',
    address: 'Hlavná 28',
    city: '811 01 Bratislava',
    country: 'Slovensko',
    ico: '50 123 456',
    dic: '2120456789',
    icDph: 'SK2120456789',
    registration: 'OR OS Bratislava I, odd. Sro, vl. 123456/B',
    iban: 'SK89 1100 0000 0026 2700 5511',
    swift: 'TATRSKBX',
    bank: 'Tatra banka, a. s.',
    phone: '+421 905 123 456',
    email: 'fakturacia@mk-dentlab.sk',
    logoText: 'MK',
    logoLine: 'dentálne laboratórium',
  },
  customer: {
    name: 'Stomatologická klinika Bratislava, s. r. o.',
    address: 'Štefánikova 15',
    city: '811 05 Bratislava',
    country: 'Slovensko',
    ico: '47 998 311',
    dic: '2024188422',
    icDph: 'SK2024188422',
  },
  items: [
    { code: 'KOR-ZIR', name: 'Korunka zirkónová — celokeramická', qty: 4, unit: 'ks', unitPrice: 195.00, vat: 20 },
    { code: 'MOS-3',   name: 'Mostík 3-členný zirkónový',           qty: 1, unit: 'ks', unitPrice: 540.00, vat: 20 },
    { code: 'INL-KER', name: 'Inlay keramický',                     qty: 2, unit: 'ks', unitPrice: 210.00, vat: 20 },
    { code: 'ART-MOD', name: 'Artikulačný model (sadrový)',         qty: 3, unit: 'ks', unitPrice: 18.00,  vat: 20 },
    { code: 'NAV-LAB', name: 'Návšteva v ambulancii — modelácia',   qty: 1, unit: 'h',  unitPrice: 45.00,  vat: 20 },
  ],
  notes: 'Práce boli zhotovené podľa zaslaných odtlačkov a sprievodnej karty č. 2025/142. Pri reklamácii prosíme priložiť pôvodnú prácu a popis závady.',
  issuedBy: 'Martin Kováč',
  isVatPayer: true,
};

// Fake but plausible PAY-by-square QR — deterministic from seed.
function FakeQR({ size = 110, seed = 1, color = '#1a2320' }) {
  const n = 25; // 25x25 grid
  const cell = size / n;
  // simple xorshift-ish to seed pattern
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const cells = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // finder squares (top-left, top-right, bottom-left) — solid 7×7 outlined
      const inFinder = (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
      if (inFinder) {
        // ring frame
        const inFx = x < 7 ? x : (x - (n - 7));
        const inFy = y < 7 ? y : (y - (n - 7));
        const onEdge = inFx === 0 || inFx === 6 || inFy === 0 || inFy === 6;
        const center = inFx >= 2 && inFx <= 4 && inFy >= 2 && inFy <= 4;
        if (onEdge || center) {
          cells.push(React.createElement('rect', {
            key: x + '_' + y,
            x: x * cell, y: y * cell, width: cell, height: cell, fill: color,
          }));
        }
        continue;
      }
      if (rand() > 0.52) {
        cells.push(React.createElement('rect', {
          key: x + '_' + y,
          x: x * cell, y: y * cell, width: cell, height: cell, fill: color,
        }));
      }
    }
  }
  return React.createElement('svg', {
    width: size, height: size, viewBox: `0 0 ${size} ${size}`,
    style: { display: 'block', shapeRendering: 'crispEdges' },
  }, ...cells);
}

// ─── Reusable bits ─────────────────────────────────────────────────────

function PaperFrame({ children, watermark }) {
  return React.createElement('div', {
    className: 'molaris-paper-page',
    style: {
      width: PAPER_W,
      height: PAPER_H,
      background: PAPER,
      color: INK,
      fontFamily: "'Manrope', sans-serif",
      fontSize: 10.5,
      lineHeight: 1.45,
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
      padding: PAGE_PAD,
    }
  },
    watermark,
    React.createElement('div', { style: { position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' } }, children)
  );
}

function Watermark({ text = 'PREDFAKTÚRA' }) {
  return React.createElement('div', {
    style: {
      position: 'absolute',
      top: 96,
      left: 0,
      right: 0,
      pointerEvents: 'none',
      zIndex: 0,
      display: 'flex',
      justifyContent: 'center',
    }
  },
    React.createElement('span', {
      style: {
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 800,
        fontSize: 58,
        letterSpacing: '0.18em',
        color: TEAL,
        opacity: 0.08,
        whiteSpace: 'nowrap',
        border: `3px solid ${TEAL}`,
        borderRadius: 6,
        padding: '14px 36px',
        transform: 'rotate(-2deg)',
      }
    }, text)
  );
}

// Top header band — supplier logo (optional) left, Molaris top-right.
function HeaderBand({ supplier, showSupplierLogo = true }) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 28,
    }
  },
    // LEFT — supplier brand (optional)
    showSupplierLogo
      ? React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          React.createElement('div', {
            style: {
              width: 46, height: 46, borderRadius: 10,
              background: INK, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em',
            }
          }, supplier.logoText || 'L'),
          React.createElement('div', null,
            React.createElement('div', {
              style: {
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700, fontSize: 13, color: INK, lineHeight: 1.1,
              }
            }, supplier.name),
            React.createElement('div', {
              style: { fontSize: 9.5, color: INK_MUTED, marginTop: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }
            }, supplier.logoLine || '')
          )
        )
      : React.createElement('div', { style: { fontSize: 9.5, color: INK_MUTED, fontStyle: 'italic' } }, ''),

    // RIGHT — Molaris brand stamp
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }
    },
      React.createElement('div', { style: { transform: 'translateY(-2px)' } },
        React.createElement(Logo, { markSize: 22, wordmarkSize: 15 })
      ),
      React.createElement('div', {
        style: {
          fontSize: 8.5, color: INK_MUTED, letterSpacing: '0.06em',
          textTransform: 'uppercase', fontWeight: 600,
        }
      }, 'Vygenerované v Molaris')
    )
  );
}

// Title row — Big "FAKTÚRA / PREDFAKTÚRA" + invoice number
function TitleRow({ title, subtitle, number, accent = TEAL }) {
  return React.createElement('div', {
    style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      paddingBottom: 14, borderBottom: `2px solid ${accent}`, marginBottom: 22,
    }
  },
    React.createElement('div', null,
      React.createElement('h1', {
        style: {
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 800, fontSize: 30, color: INK, letterSpacing: '-0.02em',
          margin: 0, lineHeight: 1,
        }
      }, title),
      React.createElement('div', {
        style: { fontSize: 11, color: INK_SOFT, marginTop: 6, letterSpacing: '0.01em' }
      }, subtitle)
    ),
    React.createElement('div', { style: { textAlign: 'right' } },
      React.createElement('div', {
        style: { fontSize: 9.5, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }
      }, 'Číslo dokladu'),
      React.createElement('div', {
        style: {
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700, fontSize: 22, color: accent, marginTop: 2, letterSpacing: '0.01em',
        }
      }, number)
    )
  );
}

function PartyBlock({ label, party, withTax = true }) {
  return React.createElement('div', null,
    React.createElement('div', {
      style: {
        fontSize: 9, color: INK_MUTED, textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8,
      }
    }, label),
    React.createElement('div', {
      style: {
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontWeight: 700, fontSize: 13, color: INK, marginBottom: 4, lineHeight: 1.3,
      }
    }, party.name),
    React.createElement('div', { style: { color: INK_SOFT, fontSize: 10.5 } }, party.address),
    React.createElement('div', { style: { color: INK_SOFT, fontSize: 10.5, marginBottom: 8 } }, party.city + ', ' + party.country),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 10, rowGap: 2, fontSize: 10 } },
      React.createElement('span', { style: { color: INK_MUTED } }, 'IČO'),
      React.createElement('span', { style: { color: INK, fontVariantNumeric: 'tabular-nums' } }, party.ico),
      React.createElement('span', { style: { color: INK_MUTED } }, 'DIČ'),
      React.createElement('span', { style: { color: INK, fontVariantNumeric: 'tabular-nums' } }, party.dic),
      withTax && party.icDph && React.createElement(React.Fragment, null,
        React.createElement('span', { style: { color: INK_MUTED } }, 'IČ DPH'),
        React.createElement('span', { style: { color: INK, fontVariantNumeric: 'tabular-nums' } }, party.icDph)
      ),
    ),
    party.registration && React.createElement('div', {
      style: { fontSize: 9, color: INK_MUTED, marginTop: 8, fontStyle: 'italic' }
    }, party.registration)
  );
}

function MetaGrid({ invoice }) {
  const cells = [
    { label: 'Dátum vystavenia', value: invoice.issuedAt },
    { label: 'Dátum dodania',    value: invoice.suppliedAt },
    { label: 'Dátum splatnosti', value: invoice.dueAt, accent: true },
    { label: 'Spôsob úhrady',    value: invoice.paymentMethod },
    { label: 'Variabilný symbol', value: invoice.variableSymbol, mono: true },
    { label: 'Konštantný symbol', value: invoice.constantSymbol, mono: true },
  ];
  return React.createElement('div', {
    style: {
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      background: TINT, border: `1px solid ${RULE}`, borderRadius: 8,
      padding: '14px 16px', columnGap: 18, rowGap: 12, marginBottom: 18,
    }
  },
    ...cells.map((c, i) => React.createElement('div', { key: i },
      React.createElement('div', {
        style: { fontSize: 8.5, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 3 }
      }, c.label),
      React.createElement('div', {
        style: {
          fontFamily: c.mono ? "'Plus Jakarta Sans', sans-serif" : "'Manrope', sans-serif",
          fontWeight: c.accent ? 700 : 600,
          fontSize: 12,
          color: c.accent ? TEAL_DARK : INK,
          fontVariantNumeric: 'tabular-nums',
        }
      }, c.value)
    ))
  );
}

function ItemsTable({ items }) {
  return React.createElement('div', { style: { marginBottom: 14 } },
    // header
    React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '24px 1fr 60px 50px 90px 50px 100px',
        padding: '10px 10px',
        background: INK,
        color: '#fff',
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 700,
        borderRadius: '6px 6px 0 0',
      }
    },
      React.createElement('span', null, '#'),
      React.createElement('span', null, 'Popis úkonu'),
      React.createElement('span', { style: { textAlign: 'right' } }, 'Množ.'),
      React.createElement('span', { style: { textAlign: 'center' } }, 'MJ'),
      React.createElement('span', { style: { textAlign: 'right' } }, 'Cena/MJ'),
      React.createElement('span', { style: { textAlign: 'right' } }, 'DPH'),
      React.createElement('span', { style: { textAlign: 'right' } }, 'Spolu bez DPH'),
    ),
    // rows
    ...items.map((it, i) => React.createElement('div', {
      key: i,
      style: {
        display: 'grid',
        gridTemplateColumns: '24px 1fr 60px 50px 90px 50px 100px',
        padding: '10px 10px',
        borderBottom: `1px solid ${RULE_SOFT}`,
        background: i % 2 === 0 ? '#fff' : '#fbfaf6',
        fontSize: 10.5,
        alignItems: 'baseline',
        fontVariantNumeric: 'tabular-nums',
      }
    },
      React.createElement('span', { style: { color: INK_MUTED } }, i + 1),
      React.createElement('div', null,
        React.createElement('div', { style: { color: INK, fontWeight: 600 } }, it.name),
        React.createElement('div', { style: { color: INK_MUTED, fontSize: 9, marginTop: 1, letterSpacing: '0.04em' } }, 'Kód: ' + it.code)
      ),
      React.createElement('span', { style: { textAlign: 'right', color: INK } }, it.continuation ? '—' : it.qty),
      React.createElement('span', { style: { textAlign: 'center', color: INK_SOFT } }, it.continuation ? '—' : it.unit),
      React.createElement('span', { style: { textAlign: 'right', color: INK } }, it.continuation ? '—' : fmtEurPlain(it.unitPrice)),
      React.createElement('span', { style: { textAlign: 'right', color: INK_SOFT } }, it.continuation ? '—' : it.vat + ' %'),
      React.createElement('span', {
        style: { textAlign: 'right', color: INK, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }
      }, it.continuation ? '—' : fmtEurPlain(it.qty * it.unitPrice)),
    )),
  );
}

function TotalsBlock({ invoice }) {
  const calculatedSubtotal = invoice.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const subtotal = invoice.subtotalAmount == null ? calculatedSubtotal : invoice.subtotalAmount;
  const discountPercent = invoice.discountPercent || 0;
  const discountAmount = invoice.discountAmount == null
    ? subtotal * (discountPercent / 100)
    : invoice.discountAmount;
  const taxable = Number.isFinite(invoice.taxableAmount)
    ? invoice.taxableAmount
    : subtotal - discountAmount;
  const vatRate = invoice.vatRate == null
    ? ((invoice.items[0] && invoice.items[0].vat) || 0)
    : invoice.vatRate;
  const calculatedVat = taxable * (vatRate / 100);
  const vat = invoice.vatAmount == null ? calculatedVat : invoice.vatAmount;
  const total = invoice.totalAmount == null ? taxable + vat : invoice.totalAmount;

  return React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
    React.createElement('div', { style: { width: 320, fontVariantNumeric: 'tabular-nums' } },
      React.createElement(TotalRow, { label: 'Medzisúčet (bez DPH)', value: fmtEur(subtotal) }),
      discountPercent > 0 && React.createElement(TotalRow, { label: `Zľava ${discountPercent} %`, value: `−${fmtEur(discountAmount)}` }),
      React.createElement(TotalRow, { label: `DPH ${vatRate} %`, value: fmtEur(vat) }),
      React.createElement('div', { style: { height: 1, background: RULE, margin: '6px 0' } }),
      React.createElement('div', {
        style: {
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          padding: '10px 14px', background: TEAL, color: '#fff', borderRadius: 6,
        }
      },
        React.createElement('span', {
          style: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
          }
        }, 'Spolu na úhradu'),
        React.createElement('span', {
          style: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em',
          }
        }, fmtEur(total))
      ),
    )
  );
}

function TotalRow({ label, value }) {
  return React.createElement('div', {
    style: { display: 'flex', justifyContent: 'space-between', padding: '5px 14px', fontSize: 11 }
  },
    React.createElement('span', { style: { color: INK_SOFT } }, label),
    React.createElement('span', { style: { color: INK, fontWeight: 600 } }, value)
  );
}

function SkontoCallout({ skonto, items }) {
  if (!skonto || !skonto.enabled) return null;
  const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const vat = items.reduce((s, it) => s + it.qty * it.unitPrice * (it.vat / 100), 0);
  const total = subtotal + vat;
  const discount = total * (skonto.percent / 100);
  const payable = total - discount;

  return React.createElement('div', {
    style: {
      marginTop: 14,
      padding: '12px 14px',
      background: AMBER_BG,
      border: `1px solid #f6d77a`,
      borderLeft: `4px solid #d97706`,
      borderRadius: 6,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
    }
  },
    React.createElement('div', null,
      React.createElement('div', {
        style: {
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700, fontSize: 11.5, color: AMBER_TEXT,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
        }
      }, `Skonto ${skonto.percent} % pri platbe do ${skonto.days} dní`),
      React.createElement('div', { style: { fontSize: 10.5, color: '#78350f', maxWidth: 360, lineHeight: 1.45 } },
        `Pri úhrade celej sumy najneskôr ${skonto.byDate} získate zľavu ${fmtEur(discount)}. `
        + `Po tomto termíne platí pôvodná suma faktúry.`)
    ),
    React.createElement('div', { style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } },
      React.createElement('div', {
        style: { fontSize: 9, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }
      }, 'Suma so skontom'),
      React.createElement('div', {
        style: {
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 800, fontSize: 22, color: AMBER_TEXT, lineHeight: 1.1, marginTop: 2,
        }
      }, fmtEur(payable))
    )
  );
}

function PaymentBlock({ supplier, invoice, total }) {
  return React.createElement('div', {
    style: {
      marginTop: 24,
      display: 'grid',
      gridTemplateColumns: '1fr 130px',
      gap: 18,
      padding: '14px 16px',
      border: `1px solid ${RULE}`,
      borderRadius: 8,
      background: '#fff',
    }
  },
    React.createElement('div', null,
      React.createElement('div', {
        style: { fontSize: 9, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }
      }, 'Platobné údaje'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 4, fontSize: 10.5 } },
        React.createElement('span', { style: { color: INK_MUTED } }, 'IBAN'),
        React.createElement('span', {
          style: { color: INK, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em' }
        }, supplier.iban),
        React.createElement('span', { style: { color: INK_MUTED } }, 'SWIFT/BIC'),
        React.createElement('span', { style: { color: INK, fontVariantNumeric: 'tabular-nums' } }, supplier.swift),
        React.createElement('span', { style: { color: INK_MUTED } }, 'Banka'),
        React.createElement('span', { style: { color: INK } }, supplier.bank),
        React.createElement('span', { style: { color: INK_MUTED } }, 'Variabilný symbol'),
        React.createElement('span', { style: { color: INK, fontWeight: 700, fontVariantNumeric: 'tabular-nums' } }, invoice.variableSymbol),
        React.createElement('span', { style: { color: INK_MUTED } }, 'Suma'),
        React.createElement('span', { style: { color: TEAL_DARK, fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", fontVariantNumeric: 'tabular-nums' } }, fmtEur(total)),
      ),
    ),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 } },
      React.createElement('div', {
        style: { padding: 4, background: '#fff', border: `1px solid ${RULE}`, borderRadius: 4 }
      }, React.createElement(FakeQR, { size: 110, seed: parseInt(invoice.variableSymbol.slice(-4) || '1', 10) || 1 })),
      React.createElement('div', {
        style: { fontSize: 8, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }
      }, 'PAY by square'),
    )
  );
}

function FooterBlock({ invoice }) {
  return React.createElement('div', {
    style: {
      marginTop: 'auto',
      paddingTop: 18,
      borderTop: `1px solid ${RULE}`,
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 24,
      alignItems: 'flex-end',
    }
  },
    React.createElement('div', null,
      invoice.notes && React.createElement('div', null,
        React.createElement('div', {
          style: { fontSize: 9, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }
        }, 'Poznámka'),
        React.createElement('div', { style: { fontSize: 10, color: INK_SOFT, lineHeight: 1.5, maxWidth: 420 } }, invoice.notes),
      ),
      React.createElement('div', {
        style: { fontSize: 9, color: INK_MUTED, marginTop: 14, lineHeight: 1.5 }
      }, invoice.isVatPayer
        ? 'Dodávateľ je platiteľom DPH. Doklad je vystavený v zmysle zákona č. 222/2004 Z. z. o DPH.'
        : 'Dodávateľ nie je platiteľom DPH.')
    ),
    React.createElement('div', { style: { textAlign: 'right' } },
      React.createElement('div', {
        style: { width: 180, height: 38, borderBottom: `1px solid ${INK}`, marginBottom: 4 }
      }),
      React.createElement('div', {
        style: { fontSize: 9, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }
      }, 'Vystavil'),
      React.createElement('div', { style: { fontSize: 10.5, color: INK, fontWeight: 600, marginTop: 2 } }, invoice.issuedBy),
    )
  );
}

function chunkByWeight(entries, maxWeight) {
  const chunks = [];
  let current = [];
  let weight = 0;
  entries.forEach((entry) => {
    const entryWeight = Math.max(1, entry.weight || 1);
    if (current.length && weight + entryWeight > maxWeight) {
      chunks.push(current);
      current = [];
      weight = 0;
    }
    current.push(entry);
    weight += entryWeight;
  });
  if (current.length) chunks.push(current);
  return chunks;
}

function appendixEntries(rows) {
  const entries = [];
  rows.forEach((row, rowIndex) => {
    entries.push({
      type: 'procedure',
      key: `procedure-${rowIndex}`,
      row,
      weight: 1 + Math.ceil(`${row.patient} ${row.description}`.length / 90),
    });
    (row.recipes || []).forEach((recipe, recipeIndex) => {
      entries.push({
        type: 'recipe',
        key: `recipe-${rowIndex}-${recipeIndex}`,
        patient: row.patient,
        recipe,
        weight: 1 + Math.ceil(`${row.patient} ${recipe.name}`.length / 100),
      });
      const materials = recipe.materials || [];
      if (!materials.length) {
        entries.push({
          type: 'material-empty',
          key: `material-empty-${rowIndex}-${recipeIndex}`,
          weight: 1,
        });
      }
      materials.forEach((material, materialIndex) => {
        const text = [
          material.name,
          material.lot ? `LOT ${material.lot}` : '',
          material.manufacturer || '',
        ].filter(Boolean).join(' · ');
        entries.push({
          type: 'material',
          key: `material-${rowIndex}-${recipeIndex}-${materialIndex}`,
          material,
          text,
          weight: 1 + Math.ceil(text.length / 95),
        });
      });
    });
  });
  return entries;
}

function AppendixTableHeader() {
  return React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1.8fr 70px 110px',
      padding: '10px 10px',
      background: INK,
      color: '#fff',
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      fontWeight: 700,
      borderRadius: '6px 6px 0 0',
    }
  },
    React.createElement('span', null, 'Pacient'),
    React.createElement('span', null, 'Práca / recept / materiál'),
    React.createElement('span', { style: { textAlign: 'right' } }, 'Množ.'),
    React.createElement('span', { style: { textAlign: 'right' } }, 'Spolu')
  );
}

function AppendixEntry({ entry, index }) {
  if (entry.type === 'procedure') {
    const row = entry.row;
    return React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.2fr 1.8fr 70px 110px',
        padding: '9px 10px',
        fontSize: 10,
        alignItems: 'baseline',
        borderBottom: `1px solid ${RULE_SOFT}`,
        background: index % 2 === 0 ? '#fff' : '#fbfaf6',
      }
    },
      React.createElement('span', { style: { color: INK, fontWeight: 600 } }, row.patient),
      React.createElement('span', { style: { color: INK_SOFT, overflowWrap: 'anywhere' } }, row.description),
      React.createElement('span', { style: { textAlign: 'right', color: INK } }, row.qty),
      React.createElement('span', { style: { textAlign: 'right', color: INK, fontWeight: 700 } }, fmtEurPlain(row.total))
    );
  }

  if (entry.type === 'recipe') {
    const recipe = entry.recipe;
    const parsedDate = recipe.date ? new Date(recipe.date) : null;
    const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
      ? ` · ${parsedDate.toLocaleDateString('sk-SK')}`
      : (recipe.date ? ` · ${recipe.date}` : '');
    return React.createElement('div', {
      style: {
        margin: '5px 10px 2px',
        padding: '7px 9px',
        borderLeft: `3px solid ${TEAL}`,
        background: '#f3f8f6',
        color: INK,
        fontSize: 9.5,
        fontWeight: 700,
        overflowWrap: 'anywhere',
      }
    }, entry.patient, ' · Recept: ', recipe.name, dateLabel);
  }

  if (entry.type === 'material-empty') {
    return React.createElement('div', {
      style: { margin: '0 22px 5px', color: INK_MUTED, fontSize: 8.5 }
    }, 'Bez materiálových riadkov');
  }

  const material = entry.material;
  return React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 110px',
      gap: 12,
      margin: '0 22px',
      padding: '5px 0',
      borderBottom: `1px solid ${RULE_SOFT}`,
      color: INK_SOFT,
      fontSize: 8.5,
    }
  },
    React.createElement('span', { style: { overflowWrap: 'anywhere' } }, entry.text),
    React.createElement('span', { style: { textAlign: 'right', color: INK } }, `${material.quantity} ${material.unit}`)
  );
}

function PatientListAppendix({ invoice }) {
  const rows = invoice.patientRows || [];
  if (!rows.length) return null;
  const pages = chunkByWeight(appendixEntries(rows), 17);
  return React.createElement(React.Fragment, null,
    ...pages.map((entries, pageIndex) => React.createElement(PaperFrame, { key: `appendix-${pageIndex}` },
      React.createElement(HeaderBand, { supplier: invoice.supplier, showSupplierLogo: false }),
      React.createElement(TitleRow, {
        title: 'Príloha k faktúre',
        subtitle: `Rozpis pacientov, prác a receptov · strana ${pageIndex + 1}/${pages.length}`,
        number: invoice.number,
      }),
      React.createElement(AppendixTableHeader),
      ...entries.map((entry, index) => React.createElement(AppendixEntry, {
        key: entry.key,
        entry,
        index,
      }))
    ))
  );
}

// ─── Main components ──────────────────────────────────────────────────

function chunkItems(items, size = 5) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function splitItemDescriptions(items, maxLength = 280) {
  return items.flatMap((item) => {
    const text = String(item.name || '');
    if (text.length <= maxLength) return [item];
    const words = text.split(/\s+/);
    const parts = [];
    let part = '';
    words.forEach((word) => {
      if (part && `${part} ${word}`.length > maxLength) {
        parts.push(part);
        part = word;
      } else {
        part = part ? `${part} ${word}` : word;
      }
    });
    if (part) parts.push(part);
    return parts.map((name, index) => ({
      ...item,
      name,
      code: index === 0 ? item.code : `${item.code}-POK`,
      continuation: index > 0,
    }));
  });
}

function InvoicePDF({ invoice = DEFAULT_INVOICE, skonto = null, showSupplierLogo = true }) {
  const total = invoice.totalAmount == null
    ? invoice.items.reduce((s, it) => s + it.qty * it.unitPrice * (1 + it.vat / 100), 0)
    : invoice.totalAmount;

  const pages = chunkItems(splitItemDescriptions(invoice.items));
  return React.createElement(React.Fragment, null,
    ...pages.map((items, pageIndex) => {
      const lastPage = pageIndex === pages.length - 1;
      return React.createElement(PaperFrame, { key: `invoice-${pageIndex}` },
        React.createElement(HeaderBand, { supplier: invoice.supplier, showSupplierLogo }),
        React.createElement(TitleRow, {
          title: 'Faktúra',
          subtitle: pages.length > 1 ? `${invoice.type} · strana ${pageIndex + 1}/${pages.length}` : invoice.type,
          number: invoice.number,
        }),
        React.createElement('div', {
          style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 22 }
        },
          React.createElement(PartyBlock, { label: 'Dodávateľ', party: invoice.supplier }),
          React.createElement(PartyBlock, { label: 'Odberateľ', party: invoice.customer }),
        ),
        React.createElement(MetaGrid, { invoice }),
        React.createElement(ItemsTable, { items }),
        lastPage && React.createElement(TotalsBlock, { invoice }),
        lastPage && React.createElement(SkontoCallout, { skonto, items: invoice.items }),
        lastPage && React.createElement(PaymentBlock, { supplier: invoice.supplier, invoice, total }),
        lastPage && React.createElement(FooterBlock, { invoice })
      );
    }),
    React.createElement(PatientListAppendix, { invoice })
  );
}

function ProformaPDF({ invoice = DEFAULT_INVOICE, showSupplierLogo = true }) {
  // Proforma: usually not a tax doc, no DPH date, label = PREDFAKTÚRA
  const proformaInvoice = {
    ...invoice,
    number: 'P-' + invoice.number,
    variableSymbol: '9' + invoice.variableSymbol.slice(1),
    type: 'Predfaktúra — výzva na úhradu (nie je daňový doklad)',
  };
  const total = proformaInvoice.totalAmount == null
    ? proformaInvoice.items.reduce((s, it) => s + it.qty * it.unitPrice * (1 + it.vat / 100), 0)
    : proformaInvoice.totalAmount;

  const pages = chunkItems(splitItemDescriptions(proformaInvoice.items));
  return React.createElement(React.Fragment, null,
    ...pages.map((items, pageIndex) => {
      const lastPage = pageIndex === pages.length - 1;
      return React.createElement(PaperFrame, {
        key: `proforma-${pageIndex}`,
        watermark: React.createElement(Watermark, { text: 'PREDFAKTÚRA' })
      },
        React.createElement(HeaderBand, { supplier: proformaInvoice.supplier, showSupplierLogo }),
        React.createElement(TitleRow, {
          title: 'Predfaktúra',
          subtitle: pages.length > 1 ? `${proformaInvoice.type} · strana ${pageIndex + 1}/${pages.length}` : proformaInvoice.type,
          number: proformaInvoice.number,
          accent: TEAL,
        }),
        React.createElement('div', {
          style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 22 }
        },
          React.createElement(PartyBlock, { label: 'Dodávateľ', party: proformaInvoice.supplier }),
          React.createElement(PartyBlock, { label: 'Odberateľ', party: proformaInvoice.customer }),
        ),
        React.createElement(MetaGrid, { invoice: proformaInvoice }),
        React.createElement(ItemsTable, { items }),
        lastPage && React.createElement(TotalsBlock, { invoice: proformaInvoice }),
        lastPage && React.createElement(PaymentBlock, { supplier: proformaInvoice.supplier, invoice: proformaInvoice, total }),
        lastPage && React.createElement('div', {
          style: {
            marginTop: 18, padding: '10px 14px',
            background: TEAL_SUBTLE, border: `1px solid #b8e2d7`, borderRadius: 6,
            fontSize: 10, color: TEAL_DARK, lineHeight: 1.5,
          }
        },
          React.createElement('strong', {
            style: { fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '0.02em' }
          }, 'Upozornenie: '),
          'Tento doklad nie je daňový doklad. Po prijatí platby Vám zašleme riadnu faktúru — daňový doklad v zákonnej lehote.'
        ),
        lastPage && React.createElement(FooterBlock, { invoice: proformaInvoice })
      );
    }),
    React.createElement(PatientListAppendix, { invoice: proformaInvoice })
  );
}

Object.assign(window, { InvoicePDF, ProformaPDF, DEFAULT_INVOICE });
