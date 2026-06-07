// Dashboard.jsx — Molaris Dashboard (refreshed)

function Dashboard({ onNavigate, onOpenJob }) {
  const workspace = window.MolarisAPI.useWorkspace();
  const apiStats = workspace.stats;
  const savedUser = window.MolarisAPI.savedUser && window.MolarisAPI.savedUser();
  const role = (savedUser && savedUser.role) || 'admin';
  
  // Format monthly stats with deltas
  const formatMonthlyDelta = (current, previous) => {
    const delta = current - previous;
    return delta > 0 ? `+${delta}` : String(delta);
  };
  
  const stats = [
    { 
      label: 'Počet pacientov', 
      value: String(apiStats ? apiStats.total_patients : 142), 
      icon: 'users', 
      tone: 'teal', 
      sub: apiStats && apiStats.deltas ? formatMonthlyDelta(apiStats.monthly_totals.new_patients, apiStats.monthly_totals.new_patients - apiStats.deltas.new_patients) + ' tento mesiac' : '+8 tento mesiac' 
    },
    { 
      label: 'Aktívne práce',   
      value: String(apiStats ? apiStats.active_jobs : 23), 
      icon: 'briefcase', 
      tone: 'amber', 
      sub: apiStats && apiStats.today_schedule ? apiStats.today_schedule.length + ' v termíne dnes' : '5 v termíne dnes' 
    },
    { 
      label: 'Tržby',           
      value: apiStats ? fmtEur(apiStats.total_revenue || 0) : '8 420,00 €',
      icon: 'euro', 
      tone: 'green',
      delta: apiStats && apiStats.deltas ? apiStats.deltas.revenue + ' €' : '+12 %' 
    },
    { 
      label: 'Dokončené',       
      value: String(apiStats ? apiStats.completed_jobs : 89), 
      icon: 'checkCircle', 
      tone: 'purple', 
      sub: 'celkom' 
    },
  ];

  // Map status labels
  const statusMap = {
    new: { label: 'Nová', key: 'new' },
    in_progress: { label: 'V priebehu', key: 'progress' },
    completed: { label: 'Dokončená', key: 'done' },
    cancelled: { label: 'Zrušená', key: 'cancelled' },
    finished_factured: { label: 'Faktúrovaná', key: 'done' },
    finished_unfactured: { label: 'Čaká faktúru', key: 'done' },
    closed: { label: 'Uzavretá', key: 'done' },
  };

  // Recent jobs from backend stats
  const recentJobsFallback = [
    { id: 12, patient: 'Mária Kováčová', type: 'Mostík zirkón',     status: 'progress', statusLabel: 'V priebehu', due: '15. 5. 2025' },
    { id: 11, patient: 'Peter Horváth',  type: 'Korunka',           status: 'new',      statusLabel: 'Nová',       due: '12. 5. 2025' },
    { id: 10, patient: 'Jana Blahová',   type: 'Snímateľná prot.',  status: 'new',      statusLabel: 'Nová',       due: '8. 5. 2025'  },
    { id: 9,  patient: 'Tomáš Varga',    type: 'Implantát',         status: 'done',     statusLabel: 'Dokončená',  due: '3. 5. 2025'  },
  ];
  const visibleRecentJobs = (apiStats && apiStats.recent_jobs && apiStats.recent_jobs.length > 0)
    ? apiStats.recent_jobs.map(j => {
        const statusInfo = statusMap[j.status] || { label: j.status, key: j.status };
        const patientName = j.patient_details 
          ? `${j.patient_details.first_name} ${j.patient_details.last_name}`.trim() 
          : 'Neznámy pacient';
        const dueDate = j.due_date ? new Date(j.due_date).toLocaleDateString('sk-SK') : 'Bez dátumu';
        return {
          id: j.id,
          patient: patientName,
          type: j.description || 'Práca',
          status: statusInfo.key,
          statusLabel: statusInfo.label,
          due: dueDate,
        };
      })
    : recentJobsFallback;

  // Recent invoices from backend stats
  const invoiceFallback = [
    { number: 'INV-2025-014', clinic: 'Klinika Bratislava', status: 'issued', statusLabel: 'Vystavená', amount: '1 240,00 €', date: '2. máj' },
    { number: 'INV-2025-013', clinic: 'ZubMed Košice',      status: 'issued', statusLabel: 'Vystavená', amount: '890,00 €',   date: '30. apr' },
    { number: 'INV-2025-012', clinic: 'Klinika Bratislava', status: 'paid',   statusLabel: 'Zaplatená', amount: '1 240,00 €', date: '28. apr' },
  ];
  const invoiceStatusMap = {
    draft: 'Koncept',
    issued: 'Vystavená',
    paid: 'Zaplatená',
    overdue: 'Po splate',
  };
  const visibleRecentInvoices = (apiStats && apiStats.recent_invoices && apiStats.recent_invoices.length > 0)
    ? apiStats.recent_invoices.map(inv => {
        const createdDate = inv.created_at ? new Date(inv.created_at).toLocaleDateString('sk-SK') : 'N/A';
        return {
          number: inv.number,
          clinic: inv.clinic_name || 'Neznáma klinika',
          status: inv.status,
          statusLabel: invoiceStatusMap[inv.status] || inv.status,
          amount: fmtEur(inv.total_amount || 0),
          date: createdDate,
        };
      })
    : invoiceFallback;

  // Today's schedule from backend stats
  const todayScheduleFallback = [
    { time: '09:00', title: 'Frézovanie #12 — Kováčová',        type: 'job' },
    { time: '11:00', title: 'Konzultácia — Klinika BA',          type: 'meeting' },
    { time: '14:00', title: 'Modelovanie #11 — Horváth',         type: 'job' },
    { time: '16:30', title: 'Odber dojmu — kuriér',              type: 'pickup' },
  ];
  const visibleTodaySchedule = (apiStats && apiStats.today_schedule && apiStats.today_schedule.length > 0)
    ? apiStats.today_schedule.map(item => ({
        time: item.time || 'Dnes',
        title: item.title,
        type: item.type || 'job',
      }))
    : todayScheduleFallback;

  const typeDot = { job: '#0d7c6b', meeting: '#2563eb', pickup: '#d97706' };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Dobré ráno';
    if (hour >= 12 && hour < 18) return 'Dobrý deň';
    if (hour >= 18 && hour < 22) return 'Dobrý večer';
    return 'Dobrú noc';
  };
  const firstName = (savedUser && savedUser.name && savedUser.name.split(' ')[0]) || '';
  const greetingTitle = firstName ? `${getGreeting()}, ${firstName}` : getGreeting();
  const todaySubtitle = new Date().toLocaleDateString('sk-SK', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }) + ' · Prehľad vášho laboratória.';

  const workspaceJobs = workspace.jobs || [];
  const workspaceInvoices = workspace.invoices || [];
  const today = new Date();
  const openStatuses = ['new', 'in_progress'];
  const technicianName = (savedUser && savedUser.name || '').toLowerCase();
  const technicianUsername = (savedUser && savedUser.username || '').toLowerCase();
  const openTechnicianJobs = workspaceJobs.filter((job) => openStatuses.includes(job.status));
  const matchedTechnicianJobs = openTechnicianJobs.filter((job) => {
    const raw = job.raw || {};
    const tech = raw.technician_details;
    const assignedName = tech ? `${tech.first_name || ''} ${tech.last_name || ''}`.trim().toLowerCase() : '';
    const assignedUsername = tech && tech.user_details ? String(tech.user_details.username || '').toLowerCase() : '';
    const assignedUserId = tech && tech.user_details ? tech.user_details.id : tech && tech.user;
    return (
      (technicianName && assignedName && assignedName.includes(technicianName))
      || (technicianUsername && assignedUsername && assignedUsername === technicianUsername)
      || (savedUser && savedUser.id && assignedUserId && Number(assignedUserId) === Number(savedUser.id))
    );
  });
  const technicianJobs = matchedTechnicianJobs;
  const overdueInvoices = workspaceInvoices.filter((invoice) => {
    const due = invoice.raw && invoice.raw.due_date ? new Date(invoice.raw.due_date) : null;
    return invoice.status === 'issued' && due && due < today;
  });
  const labNames = new Set();
  workspaceJobs.forEach((job) => {
    const raw = job.raw || {};
    if (raw.lab_name) labNames.add(raw.lab_name);
    if (raw.lab_details && raw.lab_details.name) labNames.add(raw.lab_details.name);
  });
  workspaceInvoices.forEach((invoice) => {
    const raw = invoice.raw || {};
    if (raw.lab_name) labNames.add(raw.lab_name);
    if (raw.lab_details && raw.lab_details.name) labNames.add(raw.lab_details.name);
  });

  const roleFocus = () => {
    if (role === 'technician') {
      return React.createElement(Card, null,
        React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement(CardTitle, null, 'Moje otvorené práce'),
          React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: () => onNavigate('jobs') }, 'Práce', React.createElement(Icon, { name: 'arrowRight', size: 12 }))
        ),
        React.createElement(CardContent, { style: { paddingTop: 0 } },
          technicianJobs.length === 0
            ? React.createElement(EmptyState, { title: 'Žiadne otvorené práce', description: 'Nemáte priradené rozpracované zákazky.' })
            : React.createElement('div', { style: { display: 'grid', gap: 8 } },
                ...technicianJobs.slice(0, 5).map((job) => React.createElement('button', {
                  key: job.id,
                  onClick: () => onOpenJob && onOpenJob(job.id),
                  style: { textAlign: 'left', border: '1px solid #ece7dc', background: '#fff', borderRadius: 8, padding: 10, cursor: 'pointer', fontFamily: 'Manrope,sans-serif' }
                },
                  React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: '#1a2320' } }, `#${job.id} · ${job.patient}`),
                  React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 2 } }, job.type, ' · termín ', job.due)
                ))
              )
        )
      );
    }
    if (role === 'superadmin') {
      return React.createElement(Card, null,
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Prehľad naprieč laboratóriami')),
        React.createElement(CardContent, { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 } },
          React.createElement(InfoCell, { label: 'Laboratóriá', value: String(labNames.size || 1) }),
          React.createElement(InfoCell, { label: 'Práce', value: String(workspaceJobs.length) }),
          React.createElement(InfoCell, { label: 'Faktúry', value: String(workspaceInvoices.length) }),
          React.createElement(InfoCell, { label: 'Tržby', value: fmtEur(workspaceInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)) })
        )
      );
    }
    return React.createElement(Card, null,
      React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement(CardTitle, null, 'Finančný fokus administrátora'),
        React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: () => onNavigate('invoices') }, 'Faktúry', React.createElement(Icon, { name: 'arrowRight', size: 12 }))
      ),
      React.createElement(CardContent, { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 } },
        React.createElement(InfoCell, { label: 'Tržby', value: fmtEur(workspaceInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)) }),
        React.createElement(InfoCell, { label: 'Po splatnosti', value: `${overdueInvoices.length} faktúr` }),
        React.createElement(InfoCell, { label: 'Čaká na úhradu', value: fmtEur(workspaceInvoices.filter(i => i.status === 'issued').reduce((sum, i) => sum + i.amount, 0)) })
      )
    );
  };

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
    React.createElement(PageHeader, {
      title: greetingTitle,
      subtitle: todaySubtitle,
      actions: [
        React.createElement(Button, { key: 'r', variant: 'outline' }, React.createElement(Icon, { name: 'refreshCw', size: 13 }), 'Obnoviť'),
      ]
    }),

    React.createElement('div', { className: 'stat-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 } },
      ...stats.map(s => React.createElement(StatCard, { key: s.label, ...s }))
    ),

    roleFocus(),

    React.createElement('div', { className: 'content-grid', style: { display: 'grid', gridTemplateColumns: '5fr 4fr 3fr', gap: 16, alignItems: 'flex-start' } },
      // Recent jobs
      React.createElement(Card, null,
        React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement(CardTitle, null, 'Posledné práce'),
          React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: () => onNavigate('jobs') }, 'Všetky', React.createElement(Icon, { name: 'arrowRight', size: 12 }))
        ),
        React.createElement(CardContent, { style: { paddingTop: 0 } },
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
            ...visibleRecentJobs.map((j, i) => React.createElement('div', {
              key: j.id,
              onClick: () => onOpenJob && onOpenJob(j.id),
              style: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px', borderTop: i === 0 ? 'none' : '1px solid #f0ede5', cursor: 'pointer', transition: 'background .1s', borderRadius: 6 },
              onMouseEnter: e => e.currentTarget.style.background = '#fbfaf6',
              onMouseLeave: e => e.currentTarget.style.background = 'transparent',
            },
              React.createElement('span', { style: { fontFamily: 'ui-monospace, monospace', fontSize: 11.5, fontWeight: 700, color: '#0d7c6b', minWidth: 36 } }, `#${j.id}`),
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#1a2320' } }, j.patient),
                React.createElement('div', { style: { fontSize: 11.5, color: '#8a9490', marginTop: 1 } }, j.type, ' · termín ', j.due)
              ),
              React.createElement(Badge, { color: j.status }, j.statusLabel),
              React.createElement(Icon, { name: 'chevronRight', size: 14, color: '#b0bdb9' })
            ))
          )
        )
      ),

      // Recent invoices
      React.createElement(Card, null,
        React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement(CardTitle, null, 'Posledné faktúry'),
          React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: () => onNavigate('invoices') }, 'Všetky', React.createElement(Icon, { name: 'arrowRight', size: 12 }))
        ),
        React.createElement(CardContent, { style: { paddingTop: 0 } },
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
            ...visibleRecentInvoices.map((inv, i) => React.createElement('div', {
              key: inv.number,
              style: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 4px', borderTop: i === 0 ? 'none' : '1px solid #f0ede5' }
            },
              React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 11.5, fontFamily: 'ui-monospace, monospace', color: '#0d7c6b', fontWeight: 600 } }, inv.number),
                React.createElement('div', { style: { fontSize: 12, color: '#5a6b66', marginTop: 2 } }, inv.clinic, ' · ', inv.date)
              ),
              React.createElement('div', { style: { textAlign: 'right' } },
                React.createElement('div', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 13, fontWeight: 700, color: '#1a2320' } }, inv.amount),
                React.createElement('div', { style: { marginTop: 4 } }, React.createElement(Badge, { color: inv.status }, inv.statusLabel))
              )
            ))
          )
        )
      ),

      // Today
      React.createElement(Card, null,
        React.createElement(CardHeader, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement(CardTitle, null, 'Dnes'),
          React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: () => onNavigate('calendar') }, 'Kalendár', React.createElement(Icon, { name: 'arrowRight', size: 12 }))
        ),
        React.createElement(CardContent, { style: { paddingTop: 0 } },
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
            ...visibleTodaySchedule.map((t, i) => React.createElement('div', {
              key: i,
              style: { display: 'flex', gap: 10, padding: '10px 4px', borderTop: i === 0 ? 'none' : '1px solid #f0ede5' }
            },
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 44 } },
                React.createElement('span', { style: { fontFamily: 'Plus Jakarta Sans,sans-serif', fontSize: 12, fontWeight: 700, color: '#1a2320' } }, t.time),
              ),
              React.createElement('div', { style: { width: 6, height: 6, borderRadius: '50%', background: typeDot[t.type], marginTop: 7, flexShrink: 0 } }),
              React.createElement('div', { style: { flex: 1, fontSize: 12.5, color: '#1a2320', lineHeight: 1.4 } }, t.title)
            ))
          )
        )
      )
    )
  );
}

Object.assign(window, { Dashboard });
