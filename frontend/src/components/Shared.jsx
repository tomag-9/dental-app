// Shared.jsx — Molaris UI Kit primitives (Option A: Deep Teal palette)

function Button({ children, variant = 'primary', size = 'md', className = '', disabled, onClick, type = 'button', title, style: extraStyle = {}, ariaLabel }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6, fontWeight: 600, fontFamily: 'Manrope,sans-serif',
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background .12s, color .12s, opacity .12s',
    gap: 6, opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap',
    boxShadow: 'none',
  };
  const variants = {
    primary:     { background: '#0d7c6b', color: 'white' },
    secondary:   { background: '#eeecea', color: '#1a2320' },
    outline:     { background: 'transparent', color: '#1a2320', border: '1px solid #e4ded4' },
    ghost:       { background: 'transparent', color: '#8a9490' },
    destructive: { background: '#fde8e6', color: '#c0392b', border: '1px solid #f5c0bb' },
  };
  const sizes = {
    sm:   { height: 28, padding: '0 10px', fontSize: 11, borderRadius: 5 },
    md:   { height: 36, padding: '0 14px', fontSize: 13 },
    lg:   { height: 42, padding: '0 20px', fontSize: 14 },
    icon: { width: 36, height: 36, padding: 0 },
  };
  const style = { ...base, ...(variants[variant] || {}), ...(sizes[size] || {}), ...extraStyle };
  return React.createElement('button', { style, disabled, onClick, type, title, className, 'aria-label': ariaLabel }, children);
}

function Card({ children, style = {} }) {
  return React.createElement('div', {
    style: { background: '#ffffff', border: '1px solid #e4ded4', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,.04)', ...style }
  }, children);
}
function CardHeader({ children, style = {} }) {
  return React.createElement('div', { style: { padding: '18px 20px 8px', ...style } }, children);
}
function CardTitle({ children, style = {} }) {
  return React.createElement('h3', {
    style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 15, fontWeight: 600, color: '#1a2320', letterSpacing: '-0.015em', margin: 0, ...style }
  }, children);
}
function CardContent({ children, style = {} }) {
  return React.createElement('div', { style: { padding: '0 20px 20px', ...style } }, children);
}

function Badge({ children, color }) {
  const presets = {
    new:      { background: '#fef9c3', color: '#713f12' },
    progress: { background: '#d4f0eb', color: '#085c4e' },
    done:     { background: '#dcfce7', color: '#14532d' },
    factured: { background: '#d1fae5', color: '#065f46' },
    cancelled:{ background: '#fee2e2', color: '#991b1b' },
    draft:    { background: '#f3f4f6', color: '#1f2937' },
    issued:   { background: '#d4f0eb', color: '#085c4e' },
    paid:     { background: '#dcfce7', color: '#14532d' },
    default:  { background: '#0d7c6b', color: 'white' },
    outline:  { background: 'transparent', color: '#1a2320', border: '1px solid #e4ded4' },
  };
  const s = presets[color] || presets.default;
  return React.createElement('span', {
    style: { display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600, fontFamily: 'Manrope,sans-serif', ...s }
  }, children);
}

function FormField({ label, name, value, onChange, type = 'text', placeholder = '', required, error, disabled, options, rows, helpText }) {
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
    border: `1px solid ${error ? '#c0392b' : '#e4ded4'}`, borderRadius: 7,
    background: '#ffffff', color: '#1a2320',
    fontFamily: 'Manrope,sans-serif', fontSize: 13, outline: 'none',
    opacity: disabled ? 0.6 : 1,
  };
  const labelEl = label && React.createElement('label', {
    style: { display: 'block', fontSize: 12, fontWeight: 500, color: '#1a2320', marginBottom: 4 }
  }, label, required && React.createElement('span', { style: { color: '#c0392b', marginLeft: 3 } }, '*'));

  let inputEl;
  if (type === 'textarea') {
    inputEl = React.createElement('textarea', { name, value, onChange, placeholder, required, disabled, rows: rows || 3, style: { ...inputStyle, resize: 'vertical', minHeight: 80 } });
  } else if (type === 'select') {
    inputEl = React.createElement('select', { name, value, onChange, required, disabled, style: inputStyle },
      React.createElement('option', { value: '' }, placeholder || 'Vybrať…'),
      (options || []).map(o => React.createElement('option', { key: o.value, value: o.value }, o.label))
    );
  } else {
    inputEl = React.createElement('input', { type, name, value, onChange, placeholder, required, disabled, style: inputStyle });
  }

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 0 } },
    labelEl, inputEl,
    error && React.createElement('p', { style: { fontSize: 11, color: '#c0392b', marginTop: 3 } }, error),
    helpText && React.createElement('p', { style: { fontSize: 11, color: '#8a9490', marginTop: 3 } }, helpText)
  );
}

function ConfirmDialog({ open, title, message, confirmText = 'Potvrdiť', cancelText = 'Zrušiť', destructive, onConfirm, onCancel }) {
  const dialogRef = React.useRef(null);
  const titleId = React.useId ? React.useId() : 'confirm-dialog-title';
  const messageId = React.useId ? React.useId() : 'confirm-dialog-message';
  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel && onCancel();
    };
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => {
      const firstButton = dialogRef.current && dialogRef.current.querySelector('button');
      if (firstButton) firstButton.focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous && previous.focus) previous.focus();
    };
  }, [open, onCancel]);
  if (!open) return null;
  return React.createElement('div', {
    style: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)' },
    onClick: onCancel
  },
    React.createElement('div', {
      ref: dialogRef,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      'aria-describedby': messageId,
      style: { background: 'white', borderRadius: 12, padding: 24, width: 340, boxShadow: '0 20px 60px rgba(0,0,0,.15)' },
      onClick: e => e.stopPropagation()
    },
      React.createElement('h3', { id: titleId, style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1a2320' } }, title),
      React.createElement('p', { id: messageId, style: { fontSize: 13, color: '#8a9490', marginBottom: 20, lineHeight: 1.5 } }, message),
      React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
        React.createElement(Button, { variant: 'outline', onClick: onCancel }, cancelText),
        React.createElement(Button, { variant: destructive ? 'destructive' : 'primary', onClick: onConfirm }, confirmText)
      )
    )
  );
}

function EmptyState({ title = 'Žiadne záznamy', description = 'Začnite vytvorením prvej položky.', action }) {
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', borderRadius: 10, border: '2px dashed #e4ded4', background: '#f7f6f2', gap: 8 }
  },
    React.createElement('div', { 'aria-hidden': 'true', style: { width: 44, height: 44, color: '#c8c0b4', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement(Icon, { name: 'inbox', size: 34 })
    ),
    React.createElement('h3', { style: { fontSize: 14, fontWeight: 600, color: '#1a2320', margin: 0 } }, title),
    React.createElement('p', { style: { fontSize: 12, color: '#8a9490', margin: 0, maxWidth: 240 } }, description),
    action
  );
}

function LoadingState({ message = 'Načítavam…' }) {
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 }
  },
    React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(13,124,107,.2)', borderTopColor: '#0d7c6b', animation: 'spin .7s linear infinite' } }),
    React.createElement('p', { style: { fontSize: 13, color: '#8a9490', margin: 0 } }, message)
  );
}

function ErrorState({ title = 'Chyba', message = 'Niečo sa pokazilo.', onRetry }) {
  return React.createElement('div', {
    role: 'alert',
    style: { background: '#fde8e6', border: '1px solid #f5c0bb', borderRadius: 10, padding: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }
  },
    React.createElement('span', { 'aria-hidden': 'true', style: { width: 24, height: 24, color: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement(Icon, { name: 'alertTriangle', size: 20 })
    ),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('p', { style: { fontWeight: 600, fontSize: 13, color: '#1a2320', margin: '0 0 4px' } }, title),
      React.createElement('p', { style: { fontSize: 12, color: '#8a9490', margin: 0 } }, message),
      onRetry && React.createElement('button', {
        onClick: onRetry,
        style: { marginTop: 10, padding: '4px 12px', borderRadius: 6, background: 'white', border: '1px solid #e4ded4', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope,sans-serif', color: '#1a2320' }
      }, 'Skúsiť znova')
    )
  );
}

function InfoCell({ label, value }) {
  return React.createElement('div', { style: { padding: '10px 12px', borderRadius: 8, background: '#fff', border: '1px solid #ece7dc' } },
    React.createElement('div', { style: { fontSize: 10.5, fontWeight: 600, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 } }, label),
    React.createElement('div', { style: { fontSize: 13, color: '#1a2320', fontWeight: 500 } }, value)
  );
}

function isPermissionDeniedError(error) {
  const text = String(error || '').toLowerCase();
  return text.includes('403') || text.includes('forbidden') || text.includes('permission') || text.includes('oprávnen');
}

function PermissionDeniedState({ message = 'Na zobrazenie tejto časti nemáte oprávnenie.' }) {
  return React.createElement('div', {
    role: 'alert',
    style: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }
  },
    React.createElement('span', { 'aria-hidden': 'true', style: { width: 24, height: 24, color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement(Icon, { name: 'shield', size: 20 })
    ),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('p', { style: { fontWeight: 600, fontSize: 13, color: '#1a2320', margin: '0 0 4px' } }, 'Prístup zamietnutý'),
      React.createElement('p', { style: { fontSize: 12, color: '#8a9490', margin: 0 } }, message)
    )
  );
}

function ScreenStatePanel({ state, message, title, description, error, onRetry }) {
  const content =
    state === 'loading' ? React.createElement(LoadingState, { message }) :
    state === 'permission' ? React.createElement(PermissionDeniedState, { message: description || message }) :
    state === 'error' ? React.createElement(ErrorState, { title, message: error || description || message, onRetry }) :
    React.createElement(EmptyState, { title, description });
  return React.createElement(Card, null,
    React.createElement(CardContent, { style: { paddingTop: 20 } }, content)
  );
}

// ─── Page header ───────────────────────────────────────────────
function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' } },
    React.createElement('div', null,
      breadcrumbs && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, color: '#8a9490' } },
        ...breadcrumbs.flatMap((b, i) => {
          const items = [];
          if (i > 0) items.push(React.createElement(Icon, { key: `s${i}`, name: 'chevronRight', size: 11, color: '#b0bdb9' }));
          items.push(b.onClick
            ? React.createElement('button', { key: `b${i}`, onClick: b.onClick, style: { background: 'none', border: 'none', padding: 0, color: '#8a9490', fontSize: 12, cursor: 'pointer', fontFamily: 'Manrope,sans-serif' } }, b.label)
            : React.createElement('span', { key: `b${i}`, style: { color: i === breadcrumbs.length - 1 ? '#1a2320' : '#8a9490', fontWeight: i === breadcrumbs.length - 1 ? 600 : 400 } }, b.label)
          );
          return items;
        })
      ),
      React.createElement('h1', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 26, fontWeight: 700, letterSpacing: '-0.015em', color: '#1a2320', margin: 0, lineHeight: 1.15 } }, title),
      subtitle && React.createElement('p', { style: { fontSize: 13, color: '#8a9490', marginTop: 4, marginBottom: 0 } }, subtitle)
    ),
    actions && React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } }, actions)
  );
}

// ─── Stat card ───────────────────────────────────────────────
function StatCard({ label, value, sub, delta, icon, tone = 'teal' }) {
  const tones = {
    teal:   { bg: '#d4f0eb', color: '#0d7c6b' },
    amber:  { bg: '#fef3c7', color: '#d97706' },
    green:  { bg: '#dcfce7', color: '#16a34a' },
    purple: { bg: '#f3e8ff', color: '#9333ea' },
    red:    { bg: '#fee2e2', color: '#c0392b' },
    blue:   { bg: '#dbeafe', color: '#2563eb' },
  };
  const t = tones[tone] || tones.teal;
  return React.createElement(Card, null,
    React.createElement(CardHeader, { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 } },
      React.createElement(CardTitle, { style: { fontSize: 12.5, fontWeight: 500, color: '#5a6b66' } }, label),
      icon && React.createElement('div', { style: { width: 30, height: 30, borderRadius: 7, background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        React.createElement(Icon, { name: icon, size: 15 })
      )
    ),
    React.createElement(CardContent, null,
      React.createElement('div', { style: { fontSize: 22, fontWeight: 700, fontFamily: 'Plus Jakarta Sans,sans-serif', color: '#1a2320', letterSpacing: '-0.015em' } }, value),
      (sub || delta) && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 } },
        delta && React.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: delta.startsWith('-') ? '#c0392b' : '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 2 } },
          React.createElement(Icon, { name: delta.startsWith('-') ? 'trendingDown' : 'trendingUp', size: 11 }), delta
        ),
        sub && React.createElement('span', { style: { fontSize: 11, color: '#8a9490' } }, sub)
      )
    )
  );
}

// ─── Tabs ───────────────────────────────────────────────
function Tabs({ value, onChange, tabs }) {
  return React.createElement('div', {
    style: { display: 'inline-flex', maxWidth: '100%', overflowX: 'auto', background: '#f0ede5', borderRadius: 8, padding: 3, gap: 2 }
  },
    ...tabs.map(t => {
      const active = value === t.value;
      return React.createElement('button', {
        key: t.value, onClick: () => onChange(t.value),
        style: {
          padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: active ? '#ffffff' : 'transparent',
          color: active ? '#0d7c6b' : '#5a6b66',
          fontWeight: active ? 600 : 500, fontSize: 12.5, fontFamily: 'Manrope,sans-serif',
          boxShadow: active ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
          transition: 'background .12s, color .12s', flexShrink: 0
        }
      }, t.label);
    })
  );
}

// ─── Search input ───────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder = 'Hľadať…', width }) {
  return React.createElement('div', { style: { position: 'relative', width: width || '100%' } },
    React.createElement('div', { style: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#b0bdb9', display: 'flex' } },
      React.createElement(Icon, { name: 'search', size: 14 })
    ),
    React.createElement('input', {
      value: value, onChange: e => onChange(e.target.value), placeholder,
      style: {
        width: '100%', boxSizing: 'border-box', paddingLeft: 32, paddingRight: 12,
        paddingTop: 8, paddingBottom: 8, border: '1px solid #e4ded4', borderRadius: 7,
        fontSize: 13, fontFamily: 'Manrope,sans-serif', outline: 'none',
        background: '#fbfaf6', color: '#1a2320'
      }
    })
  );
}

// ─── Icon button ───────────────────────────────────────────────
function IconButton({ name, title, onClick, destructive, size = 28 }) {
  return React.createElement('button', {
    onClick, title, 'aria-label': title || name,
    style: {
      width: size, height: size, borderRadius: 6, border: 'none',
      background: 'transparent', color: destructive ? '#c0392b' : '#5a6b66',
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background .1s, color .1s', padding: 0
    },
    onMouseEnter: e => { e.currentTarget.style.background = destructive ? '#fde8e6' : '#f0ede5'; e.currentTarget.style.color = destructive ? '#c0392b' : '#0d7c6b'; },
    onMouseLeave: e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = destructive ? '#c0392b' : '#5a6b66'; }
  },
    React.createElement(Icon, { name, size: Math.round(size * 0.55) })
  );
}

// ─── Data table ───────────────────────────────────────────────
function DataTable({ columns, data, onRowClick }) {
  return React.createElement('div', { style: { overflowX: 'auto', borderRadius: 8, border: '1px solid #ece7dc' } },
    React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: 'Manrope,sans-serif' } },
      React.createElement('thead', null,
        React.createElement('tr', { style: { background: '#f4f1ea' } },
          ...columns.map(c => React.createElement('th', {
            key: c.key,
            style: {
              padding: '9px 14px', textAlign: c.align || 'left', fontWeight: 600, color: '#5a6b66',
              fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
              width: c.width, whiteSpace: 'nowrap', borderBottom: '1px solid #e4ded4'
            }
          }, c.label))
        )
      ),
      React.createElement('tbody', null,
        ...data.map((row, i) => React.createElement('tr', {
          key: row.id || i,
          onClick: onRowClick ? () => onRowClick(row) : undefined,
          onKeyDown: onRowClick ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onRowClick(row);
            }
          } : undefined,
          tabIndex: onRowClick ? 0 : undefined,
          style: {
            borderTop: i === 0 ? 'none' : '1px solid #f0ede5',
            background: '#fff', cursor: onRowClick ? 'pointer' : 'default',
            transition: 'background .1s'
          },
          onMouseEnter: e => e.currentTarget.style.background = '#fbfaf6',
          onMouseLeave: e => e.currentTarget.style.background = '#fff',
        },
          ...columns.map(c => React.createElement('td', {
            key: c.key,
            style: { padding: '11px 14px', textAlign: c.align || 'left', color: '#1a2320', verticalAlign: 'middle' }
          }, c.render ? c.render(row) : row[c.key]))
        ))
      )
    )
  );
}

// ─── Drawer ───────────────────────────────────────────────
function Drawer({ open, onClose, title, subtitle, children, width = 480, footer }) {
  const drawerRef = React.useRef(null);
  const titleId = React.useId ? React.useId() : 'drawer-title';
  const subtitleId = React.useId ? React.useId() : 'drawer-subtitle';
  React.useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => {
      const firstControl = drawerRef.current && drawerRef.current.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (firstControl) firstControl.focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous && previous.focus) previous.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return React.createElement('div', {
    style: { position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(26,35,32,.35)', display: 'flex', justifyContent: 'flex-end' },
    onClick: onClose
  },
    React.createElement('div', {
      ref: drawerRef,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      'aria-describedby': subtitle ? subtitleId : undefined,
      onClick: e => e.stopPropagation(),
      style: {
        width, maxWidth: '100vw', height: '100%', background: '#fbfaf6',
        boxShadow: '-12px 0 40px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column',
        animation: 'slideInRight .25s ease-out'
      }
    },
      React.createElement('div', { style: { padding: '18px 24px', borderBottom: '1px solid #e4ded4', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0 } },
        React.createElement('div', null,
          React.createElement('h2', { id: titleId, style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 18, fontWeight: 700, color: '#1a2320', margin: 0, letterSpacing: '-0.015em' } }, title),
          subtitle && React.createElement('p', { id: subtitleId, style: { fontSize: 12.5, color: '#8a9490', margin: '3px 0 0' } }, subtitle)
        ),
        React.createElement(IconButton, { name: 'x', title: 'Zatvoriť', onClick: onClose })
      ),
      React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '20px 24px' } }, children),
      footer && React.createElement('div', { style: { padding: '14px 24px', borderTop: '1px solid #e4ded4', display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#f7f6f2', flexShrink: 0 } }, footer)
    )
  );
}

// ─── Section card with optional toolbar ───────────────────────────────────────────────
function Section({ title, action, children, padding = true }) {
  return React.createElement(Card, null,
    title && React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
      React.createElement(CardTitle, null, title),
      action
    ),
    React.createElement(CardContent, { style: { paddingTop: title ? 0 : 20, padding: padding ? undefined : 0 } }, children)
  );
}

// ─── Shared sk-SK formatting helpers ──────────────────────────────────────────
function fmtEur(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtDate(value, opts) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('sk-SK', opts || undefined);
}

Object.assign(window, {
  Button, Card, CardHeader, CardTitle, CardContent,
  Badge, FormField, ConfirmDialog,
  EmptyState, LoadingState, ErrorState, PermissionDeniedState, ScreenStatePanel, isPermissionDeniedError,
  PageHeader, StatCard, Tabs, SearchInput, IconButton, DataTable, Drawer, Section, InfoCell,
  fmtEur, fmtDate,
});
