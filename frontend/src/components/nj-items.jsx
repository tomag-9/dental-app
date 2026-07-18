// Production item editor for the "Nová práca" flow.
// It deliberately contains no demo patients, procedures, prices, or preselected teeth.

const NJ_SCOPE_LABELS = { A: 'Celý chrup', U: 'Horná čeľusť', L: 'Dolná čeľusť', Q1: 'Kvadrant 1', Q2: 'Kvadrant 2', Q3: 'Kvadrant 3', Q4: 'Kvadrant 4' };
const NJ_SCOPE_OPTIONS = [{ value: '', label: '—' }, ...Object.keys(NJ_SCOPE_LABELS).map(value => ({ value, label: NJ_SCOPE_LABELS[value] }))];

function NJItems({ catalog = [], items = [], onItemsChange }) {
  const [selectedTooth, setSelectedTooth] = React.useState('');
  const [selectedCode, setSelectedCode] = React.useState('');

  const normalizedCatalog = catalog.filter(item => item && item.code).map(item => ({
    code: String(item.code),
    name: item.name || String(item.code),
    price: Number(item.price) || 0,
    cat: item.cat || '',
  }));
  const catalogOptions = normalizedCatalog.map(item => ({ value: item.code, label: item.name, code: item.code, meta: fmtEur(item.price) }));
  const selectedProcedure = normalizedCatalog.find(item => item.code === selectedCode);
  const total = items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);

  const replaceItems = next => onItemsChange && onItemsChange(next);
  const addItem = () => {
    if (!selectedProcedure) return;
    replaceItems([...items, {
      id: globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()),
      code: selectedProcedure.code,
      name: selectedProcedure.name,
      price: selectedProcedure.price,
      cat: selectedProcedure.cat,
      tooth: selectedTooth,
      toothScope: '',
      qty: 1,
    }]);
    setSelectedCode('');
  };
  const updateItem = (index, patch) => replaceItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const removeItem = index => replaceItems(items.filter((_, itemIndex) => itemIndex !== index));
  const selectProcedureForRow = (index, code) => {
    const procedure = normalizedCatalog.find(item => item.code === code);
    if (!procedure) return;
    updateItem(index, { code: procedure.code, name: procedure.name, price: procedure.price, cat: procedure.cat });
  };

  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(360px, .8fr) minmax(520px, 1.2fr)', gap: 16, minWidth: 960 } },
    React.createElement('section', { style: { border: '1px solid #e4ded4', borderRadius: 12, background: '#fbfaf6', overflow: 'hidden' } },
      React.createElement('div', { style: { padding: '13px 16px', borderBottom: '1px solid #e4ded4', background: '#fff' } },
        React.createElement('h3', { style: { margin: 0, fontSize: 14, color: '#1a2320' } }, 'Zubný kríž'),
        React.createElement('p', { style: { margin: '3px 0 0', fontSize: 11.5, color: '#8a9490' } }, 'Zvoľte zub pre pridávanú položku. Zub je voliteľný.')
      ),
      React.createElement('div', { style: { padding: 16 } },
        React.createElement('button', {
          type: 'button', onClick: () => setSelectedTooth(''),
          style: njToothButtonStyle(selectedTooth === '', true)
        }, 'Bez určenia zuba'),
        React.createElement('div', { style: { marginTop: 16 } },
          React.createElement(NJToothRow, { teeth: FDI_UPPER, selectedTooth, setSelectedTooth }),
          React.createElement('div', { style: { height: 1, margin: '8px 0', background: '#d8d2c8' } }),
          React.createElement(NJToothRow, { teeth: FDI_LOWER, selectedTooth, setSelectedTooth })
        ),
        selectedTooth && React.createElement('div', { style: { marginTop: 14, padding: '9px 12px', borderRadius: 8, background: '#d4f0eb', color: '#085c4e', fontSize: 12.5, fontWeight: 700 } }, `Vybraný zub: ${selectedTooth}`)
      )
    ),
    React.createElement('section', { style: { border: '1px solid #e4ded4', borderRadius: 12, background: '#fff', overflow: 'hidden' } },
      React.createElement('div', { style: { padding: '13px 16px', borderBottom: '1px solid #e4ded4', background: '#fbfaf6' } },
        React.createElement('h3', { style: { margin: 0, fontSize: 14, color: '#1a2320' } }, 'Výkony z cenníka'),
        React.createElement('p', { style: { margin: '3px 0 0', fontSize: 11.5, color: '#8a9490' } }, 'Názov a cena sa načítavajú z cenníka laboratória.')
      ),
      normalizedCatalog.length === 0
        ? React.createElement('div', { style: { margin: 16, padding: 18, border: '1px dashed #d8d2c8', borderRadius: 9, color: '#8a9490', fontSize: 12.5, textAlign: 'center' } }, 'Cenník je prázdny. Najprv pridajte položky v časti Cenník.')
        : React.createElement(React.Fragment, null,
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: 14, borderBottom: '1px solid #ece7dc' } },
              React.createElement(Select, {
                value: selectedCode,
                onChange: option => setSelectedCode(option.value),
                options: catalogOptions,
                placeholder: 'Vybrať výkon z cenníka…',
                searchable: true,
              }),
              React.createElement(Button, { onClick: addItem, disabled: !selectedProcedure }, React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať')
            ),
            items.length === 0
              ? React.createElement('div', { style: { padding: 24, color: '#8a9490', fontSize: 12.5, textAlign: 'center' } }, 'Zatiaľ nie je pridaný žiadny výkon.')
              : React.createElement('div', { style: { overflowX: 'auto' } },
                  React.createElement('div', { style: { minWidth: 780 } },
                    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 60px 110px 64px 104px 32px', gap: 8, padding: '8px 12px', background: '#f0ede5', color: '#5a6b66', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' } },
                      React.createElement('span', null, 'Výkon'),
                      React.createElement('span', null, 'Zub'),
                      React.createElement('span', null, 'Rozsah'),
                      React.createElement('span', { style: { textAlign: 'center' } }, 'Ks'),
                      React.createElement('span', { style: { textAlign: 'right' } }, 'Cena'),
                      React.createElement('span', null)
                    ),
                    ...items.map((item, index) => {
                      const toothInvalid = Boolean(item.tooth) && !item.toothScope && !/^\d{2}$/.test(item.tooth);
                      return React.createElement('div', { key: item.id || `${item.code}-${index}`, style: { display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) 60px 110px 64px 104px 32px', gap: 8, alignItems: 'center', padding: '9px 12px', borderTop: index ? '1px solid #f0ede5' : 'none' } },
                      React.createElement(Select, {
                        size: 'sm', value: item.code,
                        onChange: option => selectProcedureForRow(index, option.value),
                        options: catalogOptions,
                        searchable: true,
                      }),
                      React.createElement('input', {
                        value: item.tooth || '',
                        disabled: Boolean(item.toothScope),
                        onChange: event => updateItem(index, { tooth: event.target.value.replace(/\D/g, '').slice(0, 2) }),
                        placeholder: '—', inputMode: 'numeric',
                        title: toothInvalid ? 'Zadajte 2-miestne číslo zuba (napr. 26), inak sa pri uložení neuloží.' : undefined,
                        style: { ...njItemInput, ...(toothInvalid ? { border: '1px solid #c0392b', background: '#fde8e6' } : {}) },
                      }),
                      React.createElement(Select, {
                        size: 'sm', value: item.toothScope || '',
                        onChange: option => updateItem(index, { toothScope: option.value, tooth: option.value ? '' : item.tooth }),
                        options: NJ_SCOPE_OPTIONS,
                      }),
                      React.createElement('input', { type: 'number', min: 1, step: 1, value: item.qty, onChange: event => updateItem(index, { qty: Math.max(1, Number(event.target.value) || 1) }), style: { ...njItemInput, textAlign: 'center' } }),
                      React.createElement('div', { style: { textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: '#1a2320' } }, fmtEur(item.price)),
                      React.createElement(IconButton, { name: 'trash', title: 'Odstrániť položku', destructive: true, size: 28, onClick: () => removeItem(index) })
                    );
                    })
                  )
                ),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderTop: '1px solid #e4ded4', background: '#fbfaf6' } },
              React.createElement('span', { style: { fontSize: 12, color: '#8a9490' } }, `${items.length} ${items.length === 1 ? 'položka' : items.length > 1 && items.length < 5 ? 'položky' : 'položiek'}`),
              React.createElement('strong', { style: { color: '#1a2320', fontSize: 14 } }, fmtEur(total))
            )
          )
    )
  );
}

function NJToothRow({ teeth, selectedTooth, setSelectedTooth }) {
  return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, minmax(30px, 1fr))', gap: 5 } },
    ...teeth.map(tooth => React.createElement('button', {
      key: tooth, type: 'button', onClick: () => setSelectedTooth(String(tooth)),
      style: njToothButtonStyle(selectedTooth === String(tooth), false),
    }, tooth))
  );
}

function njToothButtonStyle(active, wide) {
  return {
    width: '100%', minHeight: wide ? 34 : 38, padding: wide ? '7px 10px' : 4,
    borderRadius: 7, border: active ? '1px solid #0d7c6b' : '1px solid #d8d2c8',
    background: active ? '#d4f0eb' : '#fff', color: active ? '#085c4e' : '#4a5752',
    fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: wide ? 12 : 11, fontWeight: active ? 700 : 600,
    cursor: 'pointer',
  };
}

const njItemInput = {
  width: '100%', minWidth: 0, padding: '6px 7px', border: '1px solid #e4ded4',
  borderRadius: 6, background: '#fff', color: '#1a2320', fontFamily: 'Manrope,sans-serif', fontSize: 12,
};

Object.assign(window, { NJItems, NJ_SCOPE_LABELS });
