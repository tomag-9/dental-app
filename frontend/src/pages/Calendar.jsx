// Calendar.jsx — Molaris Calendar (Kalendár) — week view + agenda

function Calendar() {
  const [view, setView] = React.useState('week'); // 'week' | 'month'
  const [weekOffset, setWeekOffset] = React.useState(0);
  const workspace = window.MolarisAPI.useWorkspace();

  const events = workspace.calendarEvents || [];

  const eventStyles = {
    job:      { bg: '#d4f0eb', border: '#0d7c6b', text: '#085c4e' },
    meeting:  { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' },
    pickup:   { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
    deadline: { bg: '#fee2e2', border: '#c0392b', text: '#991b1b' },
  };

  const days = ['Pon', 'Uto', 'Str', 'Štv', 'Pia', 'Sob', 'Ned'];
  const hours = Array.from({ length: 11 }, (_, i) => 7 + i); // 7..17
  const todayDate = new Date();
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - ((todayDate.getDay() + 6) % 7) + weekOffset * 7);
  const weekDates = days.map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
  const dates = weekDates.map((date) => String(date.getDate()));
  const today = weekOffset === 0 ? (todayDate.getDay() + 6) % 7 : -1;
  const fmtDay = (date) => date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short' });
  const rangeTitle = `${fmtDay(weekDates[0])} – ${fmtDay(weekDates[6])}`;
  const upcoming = events
    .slice()
    .sort((a, b) => ((Number(a.day) || 0) - (Number(b.day) || 0)) || ((Number(a.start) || 0) - (Number(b.start) || 0)))
    .slice(0, 6)
    .map((event) => {
      const start = Number(event.start) || 8;
      const duration = Number(event.duration) || 1;
      const startHour = Math.floor(start);
      const startMinute = Math.round((start - startHour) * 60);
      const end = start + duration;
      const endHour = Math.floor(end);
      const endMinute = Math.round((end - endHour) * 60);
      const time = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')} – ${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
      return {
        date: fmtDay(weekDates[event.day] || weekDates[0]),
        day: days[event.day] || '',
        title: event.title,
        time,
        type: event.type || 'job',
      };
    });
  const pageHeader = React.createElement(PageHeader, {
    title: 'Kalendár',
    subtitle: 'Termíny prác, odovzdania a stretnutia.',
    actions: [
      React.createElement(Tabs, {
        key: 'view', value: view, onChange: setView,
        tabs: [{ value: 'week', label: 'Týždeň' }, { value: 'month', label: 'Mesiac' }]
      }),
      React.createElement(Button, { key: 'add', disabled: workspace.loading },
        React.createElement(Icon, { name: 'plus', size: 14 }), 'Pridať termín'),
    ]
  });

  if (workspace.loading) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, { state: 'loading', message: 'Načítavam kalendár…' })
    );
  }

  if (workspace.error) {
    const permissionDenied = isPermissionDeniedError(workspace.error);
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      pageHeader,
      React.createElement(ScreenStatePanel, {
        state: permissionDenied ? 'permission' : 'error',
        title: 'Nepodarilo sa načítať kalendár',
        description: 'Na zobrazenie kalendára nemáte oprávnenie.',
        error: workspace.error,
        onRetry: () => window.dispatchEvent(new Event('molaris-workspace-refresh')),
      })
    );
  }

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    pageHeader,

    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16, alignItems: 'flex-start' } },
      // Calendar grid
      React.createElement(Card, null,
        React.createElement(CardHeader, { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement(IconButton, { name: 'chevronLeft', onClick: () => setWeekOffset(weekOffset - 1) }),
            React.createElement(CardTitle, null, rangeTitle),
            React.createElement(IconButton, { name: 'chevronRight', onClick: () => setWeekOffset(weekOffset + 1) }),
          ),
          React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: () => setWeekOffset(0) }, 'Dnes')
        ),
        React.createElement(CardContent, { style: { paddingTop: 0 } },
          React.createElement('div', { style: { border: '1px solid #ece7dc', borderRadius: 8, overflow: 'hidden' } },
            // Header row
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid #e4ded4', background: '#f4f1ea' } },
              React.createElement('div', null),
              ...days.map((d, i) => React.createElement('div', {
                key: d,
                style: {
                  padding: '10px 8px', textAlign: 'center',
                  borderLeft: '1px solid #ece7dc',
                  background: i === today ? '#d4f0eb' : 'transparent'
                }
              },
                React.createElement('div', { style: { fontSize: 10.5, fontWeight: 600, color: i === today ? '#0d7c6b' : '#8a9490', textTransform: 'uppercase', letterSpacing: '0.04em' } }, d),
                React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 18, fontWeight: 700, color: i === today ? '#085c4e' : '#1a2320', marginTop: 2 } }, dates[i])
              ))
            ),
            // Time grid
            React.createElement('div', { style: { position: 'relative', display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)' } },
              // Hour labels
              React.createElement('div', { style: { borderRight: '1px solid #ece7dc' } },
                ...hours.map(h => React.createElement('div', {
                  key: h,
                  style: { height: 48, padding: '4px 8px', fontSize: 10.5, color: '#8a9490', textAlign: 'right', borderTop: h === 7 ? 'none' : '1px solid #f0ede5' }
                }, `${h}:00`))
              ),
              // Day columns
              ...days.map((_, dayIdx) => React.createElement('div', {
                key: dayIdx,
                style: {
                  position: 'relative',
                  borderLeft: dayIdx === 0 ? 'none' : '1px solid #ece7dc',
                  background: dayIdx === today ? 'rgba(212,240,235,.25)' : 'transparent'
                }
              },
                ...hours.map(h => React.createElement('div', {
                  key: h,
                  style: { height: 48, borderTop: h === 7 ? 'none' : '1px solid #f0ede5' }
                })),
                ...events.filter(e => e.day === dayIdx).map((e, i) => {
                  const s = eventStyles[e.type] || eventStyles.job;
                  const top = ((Number(e.start) || 8) - 7) * 48 + 2;
                  const height = (Number(e.duration) || 1) * 48 - 4;
                  return React.createElement('div', {
                    key: i,
                    style: {
                      position: 'absolute', top, left: 4, right: 4, height,
                      background: s.bg, borderLeft: `3px solid ${s.border}`,
                      borderRadius: 4, padding: '4px 6px', cursor: 'pointer',
                      overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2,
                      transition: 'box-shadow .1s'
                    },
                    onMouseEnter: ev => ev.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)',
                    onMouseLeave: ev => ev.currentTarget.style.boxShadow = 'none',
                  },
                    React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: s.text, lineHeight: 1.25, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: height > 30 ? 'normal' : 'nowrap' } }, e.title),
                    e.ref && height > 30 && React.createElement('div', { style: { fontSize: 9.5, color: s.text, opacity: 0.75, fontFamily: 'ui-monospace, monospace' } }, e.ref)
                  );
                })
              ))
            )
          ),
          // Legend
          React.createElement('div', { style: { display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' } },
            ...Object.entries({ job: 'Práca', meeting: 'Stretnutie', pickup: 'Odber/Doručenie', deadline: 'Termín odovzdania' }).map(([k, label]) => {
              const s = eventStyles[k];
              return React.createElement('div', { key: k, style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#5a6b66' } },
                React.createElement('div', { style: { width: 10, height: 10, borderRadius: 2, background: s.bg, borderLeft: `2px solid ${s.border}` } }),
                label
              );
            })
          )
        )
      ),

      // Sidebar
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Najbližšie termíny')),
          React.createElement(CardContent, null,
            upcoming.length === 0
              ? React.createElement(EmptyState, { title: 'Žiadne termíny', description: 'Kalendár zatiaľ neobsahuje žiadne práce ani udalosti.' })
              : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
              ...upcoming.map((u, i) => {
                const s = eventStyles[u.type] || eventStyles.job;
                return React.createElement('div', {
                  key: i,
                  style: { display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: '#fbfaf6', border: '1px solid #ece7dc' }
                },
                  React.createElement('div', {
                    style: { width: 4, alignSelf: 'stretch', borderRadius: 2, background: s.border, flexShrink: 0 }
                  }),
                  React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 } },
                      React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: '#0d7c6b', textTransform: 'uppercase', letterSpacing: '0.04em' } }, u.date),
                      React.createElement('span', { style: { fontSize: 10.5, color: '#8a9490' } }, u.day)
                    ),
                    React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, color: '#1a2320', lineHeight: 1.3 } }, u.title),
                    React.createElement('div', { style: { fontSize: 11, color: '#8a9490', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 } },
                      React.createElement(Icon, { name: 'clock', size: 11 }), u.time
                    )
                  )
                );
              })
            )
          )
        ),
        React.createElement(Card, null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Tento týždeň')),
          React.createElement(CardContent, null,
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              React.createElement(KVRow, { label: 'Práce v termíne', value: String(events.filter((event) => event.type === 'job').length) }),
              React.createElement(KVRow, { label: 'Po termíne', value: String(events.filter((event) => event.type === 'deadline').length), tone: events.some((event) => event.type === 'deadline') ? 'red' : undefined }),
              React.createElement(KVRow, { label: 'Stretnutia', value: String(events.filter((event) => event.type === 'meeting').length) }),
              React.createElement(KVRow, { label: 'Odber/Doručenie', value: String(events.filter((event) => event.type === 'pickup').length) }),
            )
          )
        )
      )
    )
  );
}

function KVRow({ label, value, tone }) {
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12.5 } },
    React.createElement('span', { style: { color: '#5a6b66' } }, label),
    React.createElement('span', { style: { fontWeight: 700, color: tone === 'red' ? '#c0392b' : '#1a2320', fontFamily: 'Plus Jakarta Sans,sans-serif' } }, value)
  );
}

Object.assign(window, { Calendar });
