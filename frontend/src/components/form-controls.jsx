// form-controls.jsx — Molaris styled form controls
// Custom Select (replaces unstyled native <select>) + PatientCombobox (search + fast-create).

// ── click-outside hook ─────────────────────────────────────────
function useClickOutside(onOut) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onOut(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOut]);
  return ref;
}

// ── viewport-anchored popover position (escapes scroll clipping, flips up near bottom) ──
function useAnchoredPosition(open, ref, { gap = 5, maxH = 260 } = {}) {
  const [pos, setPos] = React.useState(null);
  React.useLayoutEffect(() => {
    if (!open || !ref.current) { setPos(null); return; }
    const compute = () => {
      const r = ref.current.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const above = r.top;
      // Prefer opening DOWNWARD; only flip up when there is genuinely too little room below.
      const up = below < 180 && above > below;
      setPos({
        position: 'fixed', left: r.left, width: r.width, zIndex: 10000,
        ...(up ? { bottom: window.innerHeight - r.top + gap } : { top: r.bottom + gap }),
        maxHeight: Math.max(140, Math.min(maxH, (up ? above : below) - 12)),
      });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => { window.removeEventListener('scroll', compute, true); window.removeEventListener('resize', compute); };
  }, [open]);
  return pos;
}

// ── rodné číslo helpers ─────────────────────────────────────────
// Slovak birth number: YYMMDD/XXXX. Month +50 for female. 10-digit since 1954.
function fmtRC(rc) {
  const d = String(rc || '').replace(/\D/g, '');
  if (d.length <= 6) return d;
  return d.slice(0, 6) + '/' + d.slice(6);
}
function parseRC(rc) {
  const d = String(rc || '').replace(/\D/g, '');
  if (d.length < 6) return null;
  let yy = +d.slice(0, 2), mm = +d.slice(2, 4), dd = +d.slice(4, 6);
  const female = mm > 50;
  const month = female ? mm - 50 : mm;
  if (month < 1 || month > 12 || dd < 1 || dd > 31) return null;
  const year = yy <= 26 ? 2000 + yy : 1900 + yy;
  const months = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún', 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const today = new Date(2026, 6, 8);
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < dd)) age--;
  return {
    dob: `${dd}. ${month}. ${year}`,
    dobShort: `${dd}. ${months[month - 1]} ${year}`,
    sex: female ? 'žena' : 'muž',
    age,
  };
}

// ── Field wrapper (label + required + help/error) ──────────────
function Field({ label, required, help, error, children, style = {} }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', ...style } },
    label && React.createElement('label', { style: { display: 'block', fontSize: 12, fontWeight: 500, color: '#1a2320', marginBottom: 5 } },
      label, required && React.createElement('span', { style: { color: '#c0392b', marginLeft: 3 } }, '*')),
    children,
    error && React.createElement('p', { style: { fontSize: 11, color: '#c0392b', margin: '4px 0 0' } }, error),
    help && !error && React.createElement('p', { style: { fontSize: 11, color: '#8a9490', margin: '4px 0 0' } }, help)
  );
}

// ── Select (custom dropdown) ───────────────────────────────────
// options: [{ value, label, sub?, meta?, badge?, disabled? }]
function Select({ value, onChange, options = [], placeholder = 'Vybrať…', label, required, help, error, size = 'md', disabled, searchable }) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef(null);
  const ref = useClickOutside(() => { setOpen(false); setQuery(''); });
  const pos = useAnchoredPosition(open, ref);
  const selected = options.find(o => o.value === value) || null;
  const sm = size === 'sm';

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = norm(query.trim());
  const visible = (searchable && q)
    ? options.filter(o => norm(o.label).includes(q) || norm(o.code).includes(q) || norm(o.value).includes(q))
    : options;

  const pick = (o) => { if (o.disabled) return; onChange && onChange(o); setOpen(false); setQuery(''); };

  React.useEffect(() => { if (open && searchable && inputRef.current) inputRef.current.focus(); }, [open]);

  const onKey = (e) => {
    if (disabled) return;
    if (e.key === 'Escape') { setOpen(false); setQuery(''); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (!open) setOpen(true); else if (active >= 0 && visible[active]) pick(visible[active]); return; }
    if (e.key === ' ' && !searchable) { e.preventDefault(); if (!open) setOpen(true); else if (active >= 0) pick(visible[active]); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); setActive(a => Math.min((a < 0 ? -1 : a) + 1, visible.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max((a < 0 ? visible.length : a) - 1, 0)); }
  };

  const codeChip = (code, tone) => React.createElement('span', {
    style: {
      fontFamily: 'ui-monospace,monospace', fontSize: sm ? 10 : 10.5, fontWeight: 700,
      color: tone === 'sel' ? '#0d7c6b' : '#5a6b66', background: tone === 'sel' ? '#d4f0eb' : '#f0ede5',
      padding: '2px 6px', borderRadius: 5, flexShrink: 0, letterSpacing: '.01em',
    }
  }, code);

  const triggerInner = (searchable && open)
    ? React.createElement('input', {
        ref: inputRef, value: query, onChange: e => { setQuery(e.target.value); setActive(-1); },
        placeholder: selected ? selected.label : placeholder, autoComplete: 'off',
        style: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Manrope,sans-serif', fontSize: sm ? 12 : 13, color: '#1a2320' },
        onClick: e => e.stopPropagation(),
      })
    : React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' } },
        selected && selected.badge && React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: selected.badge, flexShrink: 0 } }),
        selected && selected.code && codeChip(selected.code, 'sel'),
        React.createElement('span', { title: selected ? selected.label : undefined, style: { fontWeight: selected ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, selected ? selected.label : placeholder),
        selected && selected.meta && React.createElement('span', { style: { fontSize: 11, color: '#8a9490', fontWeight: 500, whiteSpace: 'nowrap' } }, selected.meta)
      );

  const trigger = React.createElement('div', {
    tabIndex: disabled ? -1 : 0, onKeyDown: onKey,
    onClick: () => !disabled && setOpen(o => !o),
    style: {
      width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 8,
      padding: sm ? '5px 8px 5px 10px' : '0 10px 0 12px', minHeight: sm ? 30 : 38,
      border: `1px solid ${open ? '#0d7c6b' : error ? '#c0392b' : '#e4ded4'}`,
      boxShadow: open ? '0 0 0 3px rgba(13,124,107,.14)' : 'none',
      borderRadius: 7, background: disabled ? '#f4f1ea' : '#fff',
      cursor: disabled ? 'not-allowed' : (searchable ? 'text' : 'pointer'), outline: 'none',
      fontFamily: 'Manrope,sans-serif', fontSize: sm ? 12 : 13,
      color: selected ? '#1a2320' : '#8a9490', opacity: disabled ? 0.65 : 1,
      transition: 'border-color .12s, box-shadow .12s',
    }
  },
    triggerInner,
    React.createElement(Icon, { name: 'chevronDown', size: sm ? 13 : 15, color: '#8a9490', style: { transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 } })
  );

  const popover = open && React.createElement('div', {
    style: {
      background: '#fff', border: '1px solid #e4ded4', borderRadius: 10,
      boxShadow: '0 14px 36px rgba(26,35,32,.16)', padding: 4,
      overflowY: 'auto', animation: 'popIn .12s ease-out',
      ...(pos || { position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, zIndex: 60, maxHeight: 260 }),
    }
  },
    visible.length === 0
      ? React.createElement('div', { style: { padding: '10px 12px', fontSize: 12.5, color: '#8a9490' } }, 'Žiadne možnosti')
      : visible.map((o, i) => {
          const isSel = o.value === value;
          const isAct = i === active;
          return React.createElement('div', {
            key: o.value, onMouseEnter: () => setActive(i), onClick: () => pick(o),
            style: {
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 7, cursor: o.disabled ? 'not-allowed' : 'pointer',
              background: isSel ? '#eef7f4' : isAct ? '#f4f1ea' : 'transparent',
              opacity: o.disabled ? 0.5 : 1, transition: 'background .08s',
            }
          },
            o.badge && React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: o.badge, flexShrink: 0 } }),
            o.code && codeChip(o.code, isSel ? 'sel' : 'default'),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { title: o.label, style: { fontSize: 12.5, fontWeight: isSel ? 700 : 500, color: '#1a2320', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, o.label),
              o.sub && React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, o.sub)
            ),
            o.meta && React.createElement('span', { style: { fontSize: 11, color: isSel ? '#0d7c6b' : '#8a9490', fontWeight: 600, whiteSpace: 'nowrap' } }, o.meta),
            isSel && React.createElement(Icon, { name: 'check', size: 15, color: '#0d7c6b' })
          );
        })
  );

  const control = React.createElement('div', { ref, style: { position: 'relative' } }, trigger, popover);
  if (!label) return control;
  return React.createElement(Field, { label, required, help, error }, control);
}

// ── PatientCombobox (search by meno / priezvisko / rodné číslo + fast-create) ──
function PatientCombobox({ patients, value, onChange, onCreate, label = 'Pacient', required }) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const ref = useClickOutside(() => { setOpen(false); });
  const pos = useAnchoredPosition(open, ref, { maxH: 320 });

  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = norm(query.trim());
  const digits = query.replace(/\D/g, '');
  const filtered = patients.filter(p => {
    if (!q) return true;
    const hay = norm(`${p.last} ${p.first} ${p.first} ${p.last} ${p.email} ${p.phone}`);
    const rcMatch = digits.length >= 2 && p.birth.includes(digits);
    return hay.includes(q) || rcMatch;
  });

  const initials = p => `${(p.first[0] || '').toUpperCase()}${(p.last[0] || '').toUpperCase()}`;

  const selectPatient = (p) => { onChange && onChange(p); setOpen(false); setCreating(false); setQuery(''); };
  const clear = () => { onChange && onChange(null); setQuery(''); };

  // ── selected state: compact patient card ──
  if (value && !creating) {
    const info = parseRC(value.birth);
    return React.createElement(Field, { label, required },
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
          border: '1px solid #b0ddd5', background: '#eef7f4', borderRadius: 9,
        }
      },
        React.createElement('div', { style: { width: 40, height: 40, borderRadius: '50%', background: '#0d7c6b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 14, fontWeight: 700, flexShrink: 0 } }, initials(value)),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 14, fontWeight: 700, color: '#1a2320' } }, `${value.first} ${value.last}`),
            value.isNew && React.createElement('span', { style: { fontSize: 10, fontWeight: 700, color: '#0d7c6b', background: '#d4f0eb', padding: '1px 7px', borderRadius: 9999, textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Nový')
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 11.5, color: '#5a6b66', flexWrap: 'wrap' } },
            React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace' } }, fmtRC(value.birth)),
            info && React.createElement('span', null, `· ${info.dobShort} · ${info.sex}, ${info.age} r.`),
            value.phone && React.createElement('span', null, `· ${value.phone}`)
          )
        ),
        React.createElement(IconButton, { name: 'x', title: 'Zmeniť pacienta', onClick: clear })
      )
    );
  }

  // ── create panel ──
  if (creating) {
    return React.createElement(Field, { label, required },
      React.createElement(PatientCreateForm, {
        initialQuery: query,
        onCancel: () => { setCreating(false); setOpen(true); },
        onSave: (p) => { const np = onCreate ? onCreate(p) : p; selectPatient(np); }
      })
    );
  }

  // ── search state ──
  const searchBox = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', minHeight: 38,
      border: `1px solid ${open ? '#0d7c6b' : '#e4ded4'}`,
      boxShadow: open ? '0 0 0 3px rgba(13,124,107,.14)' : 'none',
      borderRadius: 7, background: '#fff', transition: 'border-color .12s, box-shadow .12s',
    }
  },
    React.createElement(Icon, { name: 'search', size: 15, color: '#b0bdb9' }),
    React.createElement('input', {
      value: query, autoComplete: 'off',
      onFocus: () => setOpen(true),
      onChange: e => { setQuery(e.target.value); setOpen(true); },
      placeholder: 'Hľadať podľa priezviska, mena alebo rodného čísla…',
      style: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'Manrope,sans-serif', fontSize: 13, color: '#1a2320', padding: '8px 0' }
    }),
    query && React.createElement(IconButton, { name: 'x', title: 'Vymazať', size: 24, onClick: () => setQuery('') })
  );

  const popover = open && React.createElement('div', {
    style: {
      background: '#fff', border: '1px solid #e4ded4', borderRadius: 10,
      boxShadow: '0 14px 36px rgba(26,35,32,.16)', overflow: 'hidden', animation: 'popIn .12s ease-out',
      ...(pos ? { position: pos.position, left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, zIndex: pos.zIndex } : { position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0, zIndex: 60 }),
    }
  },
    React.createElement('div', { style: { maxHeight: 240, overflowY: 'auto', padding: 4 } },
      filtered.length === 0
        ? React.createElement('div', { style: { padding: '14px 12px', textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: 12.5, color: '#8a9490' } }, 'Žiadny pacient nevyhovuje hľadaniu.'))
        : filtered.map(p => {
            const info = parseRC(p.birth);
            return React.createElement('div', {
              key: p.id, onClick: () => selectPatient(p),
              style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', transition: 'background .08s' },
              onMouseEnter: e => e.currentTarget.style.background = '#f4f1ea',
              onMouseLeave: e => e.currentTarget.style.background = 'transparent',
            },
              React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: '#d4f0eb', color: '#085c4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 11, fontWeight: 700, flexShrink: 0 } }, initials(p)),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, `${p.last} ${p.first}`),
                React.createElement('div', { style: { display: 'flex', gap: 8, fontSize: 11, color: '#8a9490', marginTop: 1 } },
                  React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace' } }, fmtRC(p.birth)),
                  info && React.createElement('span', null, `${info.sex}, ${info.age} r.`)
                )
              ),
              p.jobs != null && React.createElement('span', { style: { fontSize: 11, color: '#5a6b66', display: 'flex', alignItems: 'center', gap: 4 } },
                React.createElement(Icon, { name: 'briefcase', size: 12, color: '#b0bdb9' }), p.jobs)
            );
          })
    ),
    React.createElement('div', {
      onClick: () => { setCreating(true); setOpen(false); },
      style: { display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderTop: '1px solid #f0ede5', background: '#fbfaf6', cursor: 'pointer', color: '#0d7c6b', fontSize: 12.5, fontWeight: 700, fontFamily: 'Manrope,sans-serif' },
      onMouseEnter: e => e.currentTarget.style.background = '#f0ede5',
      onMouseLeave: e => e.currentTarget.style.background = '#fbfaf6',
    },
      React.createElement('div', { style: { width: 22, height: 22, borderRadius: 6, background: '#d4f0eb', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: 'plus', size: 13, color: '#0d7c6b' })),
      query.trim() ? `Vytvoriť pacienta „${query.trim()}"` : 'Vytvoriť nového pacienta'
    )
  );

  return React.createElement(Field, { label, required, help: 'Vyhľadajte existujúceho pacienta alebo vytvorte nového bez opustenia formulára.' },
    React.createElement('div', { ref, style: { position: 'relative' } }, searchBox, popover)
  );
}

// ── inline patient create form ─────────────────────────────────
function PatientCreateForm({ initialQuery = '', onSave, onCancel }) {
  // Prefill from query: digits → rodné číslo; words → priezvisko + meno.
  const seed = React.useMemo(() => {
    const d = initialQuery.replace(/\D/g, '');
    if (d.length >= 4) return { first: '', last: '', birth: d.slice(0, 10) };
    const parts = initialQuery.trim().split(/\s+/).filter(Boolean);
    return { last: parts[0] || '', first: parts.slice(1).join(' ') || '', birth: '' };
  }, [initialQuery]);

  const [f, setF] = React.useState({ first: seed.first, last: seed.last, birth: fmtRC(seed.birth), phone: '', email: '', insurer: '' });
  const [touched, setTouched] = React.useState(false);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));

  const rcDigits = f.birth.replace(/\D/g, '');
  const info = parseRC(rcDigits);
  const errs = {
    first: !f.first.trim() ? 'Povinné' : '',
    last: !f.last.trim() ? 'Povinné' : '',
    birth: rcDigits.length < 9 ? 'Neúplné rodné číslo' : (!info ? 'Neplatné rodné číslo' : ''),
  };
  const valid = !errs.first && !errs.last && !errs.birth;

  const inputStyle = (err) => ({
    width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '8px 12px',
    border: `1px solid ${touched && err ? '#c0392b' : '#e4ded4'}`, borderRadius: 7,
    background: '#fff', color: '#1a2320', fontFamily: 'Manrope,sans-serif', fontSize: 13, outline: 'none',
  });

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSave({ first: f.first.trim(), last: f.last.trim(), birth: rcDigits, phone: f.phone.trim(), email: f.email.trim(), insurer: f.insurer, isNew: true });
  };

  const insurers = [
    { value: '25', label: 'Všeobecná zdravotná poisťovňa', meta: '25' },
    { value: '24', label: 'Dôvera', meta: '24' },
    { value: '27', label: 'Union', meta: '27' },
  ];

  return React.createElement('div', {
    style: { border: '1px solid #b0ddd5', background: '#f7fcfb', borderRadius: 10, padding: 14 }
  },
    React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12, flexWrap: 'wrap' } },
      React.createElement(Icon, { name: 'user', size: 14, color: '#0d7c6b', style: { alignSelf: 'center' } }),
      React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320', whiteSpace: 'nowrap' } }, 'Nový pacient'),
      React.createElement('span', { style: { fontSize: 11, color: '#8a9490', whiteSpace: 'nowrap' } }, '· uloží sa do kartotéky')
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
      React.createElement(Field, { label: 'Priezvisko', required: true, error: touched && errs.last },
        React.createElement('input', { value: f.last, onChange: e => set('last', e.target.value), placeholder: 'Priezvisko', style: inputStyle(errs.last) })),
      React.createElement(Field, { label: 'Meno', required: true, error: touched && errs.first },
        React.createElement('input', { value: f.first, onChange: e => set('first', e.target.value), placeholder: 'Meno', style: inputStyle(errs.first) }))
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 } },
      React.createElement(Field, { label: 'Rodné číslo', required: true, error: touched && errs.birth, help: !errs.birth && info ? `${info.dobShort} · ${info.sex} · ${info.age} r.` : '' },
        React.createElement('input', {
          value: f.birth, inputMode: 'numeric',
          onChange: e => set('birth', fmtRC(e.target.value)),
          placeholder: '851215/1234',
          style: { ...inputStyle(errs.birth), fontFamily: 'ui-monospace, monospace' }
        })),
      React.createElement(Select, { label: 'Poisťovňa', value: f.insurer, onChange: o => set('insurer', o.value), options: insurers, placeholder: 'Vybrať poisťovňu…' })
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 } },
      React.createElement(Field, { label: 'Telefón' },
        React.createElement('input', { value: f.phone, onChange: e => set('phone', e.target.value), placeholder: '+421 900 000 000', style: inputStyle() })),
      React.createElement(Field, { label: 'E-mail' },
        React.createElement('input', { type: 'email', value: f.email, onChange: e => set('email', e.target.value), placeholder: 'meno@email.sk', style: inputStyle() }))
    ),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 } },
      React.createElement(Button, { variant: 'outline', size: 'sm', onClick: onCancel }, 'Späť na hľadanie'),
      React.createElement(Button, { size: 'sm', onClick: submit }, React.createElement(Icon, { name: 'check', size: 13 }), 'Uložiť a vybrať')
    )
  );
}

Object.assign(window, { Select, PatientCombobox, PatientCreateForm, Field, useClickOutside, fmtRC, parseRC });
