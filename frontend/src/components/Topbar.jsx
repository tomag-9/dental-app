// Topbar.jsx — Molaris global app header
// Sits above each main page: global search, notifications, quick-add, command palette

const ICON_BY_TYPE = {
  job: 'briefcase',
  patient: 'user',
  invoice: 'fileText',
  page: 'dashboard',
  action: 'plus',
  deadline: 'alertCircle',
  stock: 'package',
  team: 'user',
  system: 'bell',
};

const COLOR_BY_TYPE = {
  job: '#0d7c6b',
  invoice: '#16a34a',
  deadline: '#d97706',
  stock: '#c0392b',
  team: '#2563eb',
  system: '#6b7280',
};

function Topbar({ onNavigate, onOpenJob, onNewJob, onNewPatient, onNewInvoice, onCreateClinic, onCreateDoctor }) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [searchItems, setSearchItems] = React.useState([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [notifItems, setNotifItems] = React.useState([]);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [notifApiLoaded, setNotifApiLoaded] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isNarrow, setIsNarrow] = React.useState(() => typeof window !== 'undefined' && window.innerWidth <= 720);
  const canCreate = window.canCreateRecords ? window.canCreateRecords() : false;

  React.useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth <= 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close popovers on outside click
  React.useEffect(() => {
    const onDown = () => { setNotifOpen(false); setAddOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Keyboard shortcut ⌘K / Ctrl+K
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); setQ(''); }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setAddOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);



  const mapPathToNavigate = (url) => {
    if (!url) return null;
    const path = url.split('?')[0];
    if (path.startsWith('/jobs/')) {
      const id = parseInt(path.replace('/jobs/', '').replace('/', ''), 10);
      return Number.isFinite(id) ? { type: 'job', id } : { type: 'page', route: 'jobs' };
    }
    // Match both /patients/123 and bare /patients
    if (path.startsWith('/patients')) return { type: 'page', route: 'patients' };
    if (path.startsWith('/invoices')) return { type: 'page', route: 'invoices' };
    if (path.startsWith('/clinics')) return { type: 'page', route: 'clinics' };
    if (path.startsWith('/doctors')) return { type: 'page', route: 'doctors' };
    if (path.startsWith('/jobs')) return { type: 'page', route: 'jobs' };
    if (path.startsWith('/dashboard')) return { type: 'page', route: 'dashboard' };
    if (path.startsWith('/calendar')) return { type: 'page', route: 'calendar' };
    if (path.startsWith('/inventory')) return { type: 'page', route: 'inventory' };
    if (path.startsWith('/settings')) return { type: 'page', route: 'settings' };
    if (path.startsWith('/superadmin')) return { type: 'page', route: 'superadmin' };
    return null;
  };

  const handleSearchAction = (item, onClose) => {
    if (item.type === 'action') {
      if (!canCreate) {
        onClose();
        return;
      }
      if (item.id === 'action:new-job') onNewJob && onNewJob();
      if (item.id === 'action:new-patient') onNewPatient && onNewPatient();
      if (item.id === 'action:new-invoice') onNewInvoice && onNewInvoice();
      onClose();
      return;
    }
    // Direct job open
    if (item.type === 'job' && item.object_id && onOpenJob) {
      onOpenJob(item.object_id);
      onClose();
      return;
    }
    // Patient and invoice navigate to their list pages (no detail-level routing yet)
    if ((item.type === 'patient' || item.type === 'invoice') && onNavigate) {
      onNavigate(item.type === 'patient' ? 'patients' : 'invoices');
      onClose();
      return;
    }
    const target = mapPathToNavigate(item.url);
    if (target && target.type === 'job' && onOpenJob) {
      onOpenJob(target.id);
      onClose();
      return;
    }
    if (target && target.type === 'page' && onNavigate) {
      onNavigate(target.route);
      onClose();
      return;
    }
    onClose();
  };

  const formatDateLabel = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('sk-SK');
  };

  React.useEffect(() => {
    let alive = true;
    const loadCount = async () => {
      if (!window.MolarisAPI || !window.MolarisAPI.fetchUnreadCount) return;
      try {
        const result = await window.MolarisAPI.fetchUnreadCount();
        if (!alive) return;
        setUnreadCount(result.unread_count || 0);
      } catch {
        if (!alive) return;
        setUnreadCount(0);
      }
    };
    loadCount();
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    let alive = true;
    if (!notifOpen) return () => { alive = false; };
    const loadNotifications = async () => {
      if (!window.MolarisAPI || !window.MolarisAPI.fetchNotifications) {
        setNotifApiLoaded(false);
        return;
      }
      setNotifLoading(true);
      try {
        const data = await window.MolarisAPI.fetchNotifications();
        if (!alive) return;
        const mapped = (data || []).map((item) => ({
          id: item.id,
          type: item.type || 'system',
          icon: ICON_BY_TYPE[item.type] || 'bell',
          color: COLOR_BY_TYPE[item.type] || '#6b7280',
          title: item.title,
          desc: item.message || '',
          time: formatDateLabel(item.created_at),
          unread: !item.read_at,
          url: item.url,
          raw: item,
        }));
        setNotifItems(mapped);
        setNotifApiLoaded(true);
        setUnreadCount(mapped.filter((item) => item.unread).length);
      } catch {
        if (!alive) return;
        setNotifApiLoaded(false);
      } finally {
        if (!alive) return;
        setNotifLoading(false);
      }
    };
    loadNotifications();
    return () => { alive = false; };
  }, [notifOpen]);

  React.useEffect(() => {
    let alive = true;
    if (!searchOpen) return () => { alive = false; };
    const loadSearch = async () => {
      if (!window.MolarisAPI || !window.MolarisAPI.searchGlobal) {
        setSearchItems([]);
        return;
      }
      setSearchLoading(true);
      try {
        const data = await window.MolarisAPI.searchGlobal(q, 10);
        if (!alive) return;
        setSearchItems(data.results || []);
      } catch {
        if (!alive) return;
        setSearchItems([]);
      } finally {
        if (!alive) return;
        setSearchLoading(false);
      }
    };
    const handle = setTimeout(loadSearch, 180);
    return () => { alive = false; clearTimeout(handle); };
  }, [searchOpen, q]);

  const stop = e => e.stopPropagation();
  const stopAll = e => { e.stopPropagation(); if (e.nativeEvent) e.nativeEvent.stopPropagation(); };

  return React.createElement(React.Fragment, null,
    React.createElement('header', {
      className: 'molaris-topbar',
      style: {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 32px', height: 56,
        background: 'rgba(246,243,236,.85)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e4ded4', position: 'sticky', top: 0, zIndex: 50,
        flexShrink: 0
      }
    },
      // Global search trigger
      React.createElement('button', {
        onClick: () => { setSearchOpen(true); setQ(''); },
        'aria-label': 'Otvoriť globálne vyhľadávanie',
        style: {
          flex: 1, minWidth: 0, maxWidth: isNarrow ? 'none' : 420, display: 'flex', alignItems: 'center', gap: 10,
          height: 34, padding: '0 12px', borderRadius: 8,
          background: '#fff', border: '1px solid #e4ded4',
          cursor: 'pointer', fontFamily: 'Manrope,sans-serif',
          color: '#8a9490', fontSize: 12.5, textAlign: 'left',
          transition: 'border-color .12s, box-shadow .12s'
        },
        onMouseEnter: e => e.currentTarget.style.borderColor = '#b0ddd5',
        onMouseLeave: e => e.currentTarget.style.borderColor = '#e4ded4'
      },
        React.createElement(Icon, { name: 'search', size: 13, color: '#b0bdb9' }),
        React.createElement('span', { className: 'molaris-search-label', style: { flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, 'Hľadať pacientov, práce, faktúry…'),
        React.createElement('span', {
          className: 'molaris-search-shortcut',
          style: { padding: '1px 6px', borderRadius: 4, border: '1px solid #e4ded4', fontSize: 10.5, color: '#8a9490', fontFamily: 'ui-monospace, monospace', background: '#fbfaf6' }
        }, '⌘K')
      ),

      React.createElement('div', { style: { flex: 1 } }),

      // Quick add
      React.createElement('div', { style: { position: 'relative' }, onClick: stop, onMouseDown: stopAll },
        React.createElement('button', {
          onClick: () => {
            if (!canCreate) return;
            setAddOpen(!addOpen);
            setNotifOpen(false);
          },
          disabled: !canCreate,
          title: canCreate ? 'Rýchle pridanie' : 'Rýchle pridanie je dostupné iba administrátorovi laboratória.',
          'aria-haspopup': 'menu',
          'aria-expanded': addOpen,
          style: {
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 34,
            padding: isNarrow ? '0 10px' : '0 12px', borderRadius: 8, border: 'none',
            background: '#0d7c6b', color: 'white', fontWeight: 600, fontSize: 12.5,
            cursor: canCreate ? 'pointer' : 'not-allowed', fontFamily: 'Manrope,sans-serif',
            opacity: canCreate ? 1 : 0.45,
            transition: 'background .12s'
          },
          onMouseEnter: e => { if (canCreate) e.currentTarget.style.background = '#0fa589'; },
          onMouseLeave: e => e.currentTarget.style.background = '#0d7c6b'
        },
          React.createElement(Icon, { name: 'plus', size: 14 }),
          !isNarrow && 'Pridať',
          !isNarrow && React.createElement(Icon, { name: 'chevronDown', size: 12 })
        ),
        canCreate && addOpen && React.createElement(Popover, { role: 'menu', label: 'Rýchle pridanie' },
          React.createElement(PopoverItem, { icon: 'briefcase',  label: 'Nová práca',      sub: 'Vytvoriť dentálnu zákazku', onClick: () => { setAddOpen(false); onNewJob && onNewJob(); } }),
          React.createElement(PopoverItem, { icon: 'user',       label: 'Nový pacient',    sub: 'Pridať kartu pacienta',     onClick: () => { setAddOpen(false); onNewPatient && onNewPatient(); } }),
          React.createElement(PopoverItem, { icon: 'fileText',   label: 'Nová faktúra',    sub: 'Vystaviť faktúru klinike',  onClick: () => { setAddOpen(false); onNewInvoice && onNewInvoice(); } }),
        )
      ),

      // Notifications
      React.createElement('div', { style: { position: 'relative' }, onClick: stop, onMouseDown: stopAll },
        React.createElement('button', {
          onClick: () => { setNotifOpen(!notifOpen); setAddOpen(false); },
          'aria-label': unreadCount > 0 ? `Notifikácie, ${unreadCount} neprečítané` : 'Notifikácie',
          'aria-haspopup': 'menu',
          'aria-expanded': notifOpen,
          style: {
            width: 34, height: 34, borderRadius: 8, border: '1px solid #e4ded4',
            background: '#fff', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#5a6b66',
            position: 'relative', transition: 'border-color .12s, color .12s'
          },
          onMouseEnter: e => { e.currentTarget.style.borderColor = '#b0ddd5'; e.currentTarget.style.color = '#0d7c6b'; },
          onMouseLeave: e => { e.currentTarget.style.borderColor = '#e4ded4'; e.currentTarget.style.color = '#5a6b66'; }
        },
          React.createElement(Icon, { name: 'bell', size: 15 }),
          unreadCount > 0 && React.createElement('span', {
            style: {
              position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16,
              borderRadius: 8, background: '#c0392b', color: 'white',
              fontSize: 9.5, fontWeight: 700, fontFamily: 'Plus Jakarta Sans,sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px', boxShadow: '0 0 0 2px #f6f3ec'
            }
          }, unreadCount)
        ),
        notifOpen && React.createElement(Popover, { width: 380, role: 'menu', label: 'Notifikácie' },
          React.createElement('div', { style: { padding: '12px 14px', borderBottom: '1px solid #f0ede5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontWeight: 700, fontSize: 13, color: '#1a2320' } }, 'Notifikácie'),
            React.createElement('button', {
              onClick: async () => {
                if (!window.MolarisAPI || !window.MolarisAPI.markAllNotificationsRead) return;
                await window.MolarisAPI.markAllNotificationsRead();
                setNotifItems((current) => current.map((item) => ({ ...item, unread: false })));
                setUnreadCount(0);
              },
              style: { background: 'none', border: 'none', color: '#0d7c6b', fontSize: 11.5, cursor: 'pointer', fontWeight: 600, fontFamily: 'Manrope,sans-serif' }
            }, 'Označiť ako prečítané')
          ),
          React.createElement('div', { style: { maxHeight: 400, overflowY: 'auto' } },
            notifLoading && React.createElement('div', { style: { padding: '16px 14px', fontSize: 12, color: '#8a9490' } }, 'Načítavam notifikácie...'),
            !notifLoading && notifApiLoaded && notifItems.length === 0 && React.createElement('div', {
              style: { padding: '28px 14px', textAlign: 'center', color: '#8a9490', fontSize: 12.5 }
            }, React.createElement(Icon, { name: 'bell', size: 24, color: '#d4ded8' }),
              React.createElement('div', { style: { marginTop: 8 } }, 'Žiadne notifikácie')),
            !notifLoading && notifApiLoaded && notifItems.map((n, i) => React.createElement('button', {
              key: n.id,
              style: {
                display: 'flex', gap: 10, padding: '12px 14px', width: '100%', border: 'none', textAlign: 'left',
                borderTop: i === 0 ? 'none' : '1px solid #f0ede5',
                background: n.unread ? '#fbfaf6' : '#fff',
                cursor: 'pointer', transition: 'background .1s', fontFamily: 'Manrope,sans-serif',
              },
              onMouseEnter: e => e.currentTarget.style.background = '#f0ede5',
              onMouseLeave: e => e.currentTarget.style.background = n.unread ? '#fbfaf6' : '#fff',
              onClick: async () => {
                if (n.raw && window.MolarisAPI && window.MolarisAPI.markNotificationRead) {
                  await window.MolarisAPI.markNotificationRead(n.raw.id);
                  setNotifItems((current) => current.map((item) => item.id === n.id ? { ...item, unread: false } : item));
                  setUnreadCount((count) => Math.max(0, count - 1));
                }
                const target = mapPathToNavigate(n.url);
                if (target && target.type === 'job' && onOpenJob) onOpenJob(target.id);
                if (target && target.type === 'page' && onNavigate) onNavigate(target.route);
              }
            },
              React.createElement('div', { style: { width: 30, height: 30, borderRadius: 8, background: n.color + '22', color: n.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
                React.createElement(Icon, { name: n.icon, size: 14 })
              ),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 8 } },
                  React.createElement('span', { style: { fontSize: 12.5, fontWeight: 600, color: '#1a2320' } }, n.title),
                  n.unread && React.createElement('span', { style: { width: 6, height: 6, borderRadius: '50%', background: '#0d7c6b', marginTop: 6, flexShrink: 0 } })
                ),
                React.createElement('div', { style: { fontSize: 11.5, color: '#5a6b66', marginTop: 2, lineHeight: 1.4 } }, n.desc || '—'),
                React.createElement('div', { style: { fontSize: 10.5, color: '#8a9490', marginTop: 4 } }, n.time)
              )
            ))
          ),
          React.createElement('div', { style: { padding: '10px 14px', borderTop: '1px solid #f0ede5', textAlign: 'center', background: '#fbfaf6', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 } },
            React.createElement('button', {
              style: { background: 'none', border: 'none', color: '#0d7c6b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope,sans-serif' }
            }, 'Zobraziť všetky notifikácie')
          )
        )
      )
    ),

    // Command palette / global search overlay
    searchOpen && React.createElement(CommandPalette, {
      onClose: () => setSearchOpen(false),
      query: q, onQueryChange: setQ,
      onNavigate, onOpenJob, onNewJob, onNewPatient, onNewInvoice,
      items: searchItems,
      loading: searchLoading,
      onAction: handleSearchAction,
    })
  );
}

function Popover({ children, width = 260, role, label }) {
  return React.createElement('div', {
    role,
    'aria-label': label,
    style: {
      position: 'absolute', top: 'calc(100% + 6px)', right: 0, width,
      background: '#fff', borderRadius: 10, border: '1px solid #e4ded4',
      boxShadow: '0 12px 32px rgba(0,0,0,.10)',
      overflow: 'hidden', zIndex: 60,
      animation: 'popIn .12s ease-out'
    }
  }, children);
}

function PopoverItem({ icon, label, sub, onClick }) {
  return React.createElement('button', {
    onClick,
    role: 'menuitem',
    style: {
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
      width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
      textAlign: 'left', fontFamily: 'Manrope,sans-serif', transition: 'background .1s'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#f0ede5',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  },
    React.createElement('div', { style: { width: 26, height: 26, borderRadius: 6, background: '#d4f0eb', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
      React.createElement(Icon, { name: icon, size: 13 })
    ),
    React.createElement('div', { style: { minWidth: 0 } },
      React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, color: '#1a2320' } }, label),
      sub && React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 1 } }, sub)
    )
  );
}

function PopoverDivider() {
  return React.createElement('div', { style: { height: 1, background: '#f0ede5', margin: '4px 0' } });
}

// ─── Command palette ───────────────────────────────────────────────
function CommandPalette({ onClose, query, onQueryChange, onNavigate, onOpenJob, onNewJob, onNewPatient, onNewInvoice, items, loading, onAction }) {
  const inputRef = React.useRef(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const dialogId = React.useId ? React.useId() : 'command-palette';
  React.useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

  const normalizedItems = (items || []).map((item) => {
    const type = item.type || 'page';
    return {
      id: item.id,
      kind: type,
      label: item.label,
      sub: item.subtitle || '',
      icon: ICON_BY_TYPE[type] || 'search',
      action: () => onAction(item, onClose),
    };
  });

  const filtered = query
    ? normalizedItems.filter(i => `${i.label} ${i.sub}`.toLowerCase().includes(query.toLowerCase()))
    : normalizedItems;
  const groups = { job: 'Práce', patient: 'Pacienti', invoice: 'Faktúry', page: 'Stránky', action: 'Akcie' };
  const grouped = Object.keys(groups).map(k => ({ key: k, label: groups[k], items: filtered.filter(i => i.kind === k) })).filter(g => g.items.length);
  const orderedItems = grouped.flatMap((group) => group.items);
  React.useEffect(() => {
    setSelectedIndex((current) => Math.min(Math.max(current, 0), Math.max(orderedItems.length - 1, 0)));
  }, [orderedItems.length]);

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => orderedItems.length ? (current + 1) % orderedItems.length : 0);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => orderedItems.length ? (current - 1 + orderedItems.length) % orderedItems.length : 0);
    }
    if (event.key === 'Enter' && orderedItems[selectedIndex]) {
      event.preventDefault();
      orderedItems[selectedIndex].action();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };
  let optionIndex = -1;

  return React.createElement('div', {
    onClick: onClose,
    style: { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(26,35,32,.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }
  },
    React.createElement('div', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': `${dialogId}-input`,
      onKeyDown: handleKeyDown,
      onClick: e => e.stopPropagation(),
      style: { width: 560, maxWidth: '92vw', background: '#fff', borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,.22)', overflow: 'hidden', animation: 'popIn .18s ease-out' }
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #f0ede5' } },
        React.createElement(Icon, { name: 'search', size: 16, color: '#b0bdb9' }),
        React.createElement('input', {
          id: `${dialogId}-input`,
          ref: inputRef, value: query, onChange: e => onQueryChange(e.target.value),
          placeholder: 'Hľadať pacientov, práce, faktúry, stránky…',
          role: 'combobox',
          'aria-expanded': true,
          'aria-controls': `${dialogId}-results`,
          'aria-activedescendant': orderedItems[selectedIndex] ? `${dialogId}-option-${selectedIndex}` : undefined,
          style: { flex: 1, border: 'none', outline: 'none', fontSize: 14, fontFamily: 'Manrope,sans-serif', color: '#1a2320', background: 'transparent' }
        }),
        React.createElement('button', {
          onClick: onClose,
          style: { padding: '2px 6px', borderRadius: 4, border: '1px solid #e4ded4', fontSize: 10.5, color: '#8a9490', fontFamily: 'ui-monospace, monospace', background: '#fbfaf6', cursor: 'pointer' }
        }, 'esc')
      ),
      React.createElement('div', { id: `${dialogId}-results`, role: 'listbox', style: { maxHeight: '52vh', overflowY: 'auto' } },
        loading && React.createElement('div', { style: { padding: 24, textAlign: 'center', color: '#8a9490', fontSize: 12.5 } }, 'Načítavam výsledky...'),
        !loading && filtered.length === 0
          ? React.createElement('div', { style: { padding: 30, textAlign: 'center', color: '#8a9490', fontSize: 13 } }, 'Žiadne výsledky pre „', query, '".')
          : grouped.map(g => React.createElement('div', { key: g.key },
              React.createElement('div', { style: { padding: '10px 18px 4px', fontSize: 10.5, fontWeight: 700, color: '#8a9490', textTransform: 'uppercase', letterSpacing: '0.06em' } }, g.label),
              ...g.items.map(it => {
                optionIndex += 1;
                const active = optionIndex === selectedIndex;
                return React.createElement('button', {
                key: it.id, id: `${dialogId}-option-${optionIndex}`, onClick: it.action,
                role: 'option',
                'aria-selected': active,
                style: { display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', width: '100%', background: active ? '#f0ede5' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Manrope,sans-serif', transition: 'background .1s' },
                onMouseEnter: e => e.currentTarget.style.background = '#f0ede5',
                onMouseLeave: e => e.currentTarget.style.background = active ? '#f0ede5' : 'transparent',
              },
                React.createElement('div', { style: { width: 28, height: 28, borderRadius: 6, background: '#fbfaf6', border: '1px solid #ece7dc', color: '#0d7c6b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
                  React.createElement(Icon, { name: it.icon, size: 13 })
                ),
                React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                  React.createElement('div', { style: { fontSize: 13, fontWeight: 500, color: '#1a2320' } }, it.label),
                  React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 1 } }, it.sub)
                ),
                React.createElement(Icon, { name: 'arrowRight', size: 12, color: '#b0bdb9' })
              );
              })
            ))
      ),
      React.createElement('div', { style: { padding: '10px 18px', borderTop: '1px solid #f0ede5', background: '#fbfaf6', display: 'flex', gap: 16, fontSize: 11, color: '#8a9490' } },
        React.createElement('span', null, React.createElement('kbd', { style: kbdStyle }, '↑'), ' ', React.createElement('kbd', { style: kbdStyle }, '↓'), ' navigovať'),
        React.createElement('span', null, React.createElement('kbd', { style: kbdStyle }, '↵'), ' otvoriť'),
        React.createElement('span', null, React.createElement('kbd', { style: kbdStyle }, 'esc'), ' zavrieť')
      )
    )
  );
}

const kbdStyle = { padding: '1px 5px', borderRadius: 3, border: '1px solid #e4ded4', fontSize: 10, color: '#5a6b66', fontFamily: 'ui-monospace, monospace', background: '#fff' };

Object.assign(window, { Topbar });
