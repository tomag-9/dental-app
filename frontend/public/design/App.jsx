// App.jsx — shared root component used by BOTH entry points:
//   · index.html       → admin layout
//   · superadmin.html  → platform-control layout
//
// The host HTML sets window.__INITIAL_ROLE ('admin' | 'superadmin') BEFORE this
// script loads. That decides which sidebar, landing page, and user identity the
// app starts with.

function App() {
  const initialRole = (typeof window !== 'undefined' && window.__INITIAL_ROLE) || 'admin';
  const initialPage = initialRole === 'superadmin' ? 'sa_overview' : 'dashboard';

  const [user, setUser] = React.useState(window.MolarisAPI.savedUser() || {
    name:     initialRole === 'superadmin' ? 'Admin Platform'    : 'Ján Novák',
    email:    initialRole === 'superadmin' ? 'admin@molaris.sk'   : 'jan.novak@molaris.sk',
    role:     initialRole,
    initials: initialRole === 'superadmin' ? 'AP' : 'JN',
  });
  const [page, setPage] = React.useState(initialPage);
  const [jobId, setJobId] = React.useState(null);
  const [patientId, setPatientId] = React.useState(null);
  const [newJobOpen, setNewJobOpen] = React.useState(false);
  const [createType, setCreateType] = React.useState(null);

  React.useEffect(() => {
    const onUserUpdate = (event) => {
      if (event && event.detail) setUser(event.detail);
    };
    window.addEventListener('molaris-user-updated', onUserUpdate);
    return () => window.removeEventListener('molaris-user-updated', onUserUpdate);
  }, []);

  // Safety: if the role somehow flips at runtime, land on a page the sidebar can show.
  React.useEffect(() => {
    const isSa = user && user.role === 'superadmin';
    if (isSa && !String(page).startsWith('sa_') && page !== 'settings') {
      setPage('sa_overview');
    }
    if (user && user.role !== 'superadmin' && String(page).startsWith('sa_')) {
      setPage('dashboard');
    }
  }, [user && user.role]);

  const navigate = (p) => { setJobId(null); setPatientId(null); setPage(p); };
  const openJob = (id) => { setJobId(id); setPage('job_detail'); };
  const openPatient = (id) => { setPatientId(id); setPage('patient_detail'); };

  if (!user) {
    return React.createElement(Login, {
      onLogin: (u) => setUser({ ...u, role: u.role || initialRole, initials: u.initials || (initialRole === 'superadmin' ? 'AP' : 'JN') })
    });
  }

  let pageEl;
  switch (page) {
    case 'dashboard':       pageEl = React.createElement(Dashboard,     { onNavigate: navigate, onOpenJob: openJob }); break;
    case 'jobs':            pageEl = React.createElement(Jobs,          { onNavigate: navigate, onOpenJob: openJob, onNewJob: () => setNewJobOpen(true) }); break;
    case 'job_detail':      pageEl = React.createElement(JobDetail,     { jobId, onBack: () => navigate('jobs') }); break;
    case 'patients':        pageEl = React.createElement(Patients,      { onNavigate: navigate, onOpenPatient: openPatient, onCreate: () => setCreateType('patient') }); break;
    case 'patient_detail':  pageEl = React.createElement(PatientDetail, { patientId, onBack: () => navigate('patients'), onOpenJob: openJob }); break;
    case 'finance':         pageEl = React.createElement(Finance,       { onNavigate: navigate }); break;
    case 'invoices':        pageEl = React.createElement(Invoices,      { onNavigate: navigate, onCreate: () => setCreateType('invoice') }); break;
    case 'pricelist':       pageEl = React.createElement(Pricelist,     { onNavigate: navigate, onCreate: () => setCreateType('price') }); break;
    case 'inventory':       pageEl = React.createElement(Inventory,     { onNavigate: navigate, onCreate: () => setCreateType('warehouse') }); break;
    case 'calendar':        pageEl = React.createElement(Calendar,      { onNavigate: navigate, onOpenJob: openJob }); break;
    case 'clinics':         pageEl = React.createElement(Clinics,       { onNavigate: navigate, onCreate: () => setCreateType('clinic') }); break;
    case 'doctors':         pageEl = React.createElement(Doctors,       { onNavigate: navigate, onCreate: () => setCreateType('doctor') }); break;
    case 'technicians':     pageEl = React.createElement(Technicians,   { onNavigate: navigate, onCreate: () => setCreateType('technician') }); break;
    case 'settings':        pageEl = React.createElement(Settings,      { onNavigate: navigate, user }); break;
    case 'permissions':     pageEl = React.createElement(Permissions,   { onNavigate: navigate }); break;
    // Superadmin pages — all resolve to <Superadmin currentPage=… />
    case 'sa_overview':
    case 'sa_tenants':
    case 'sa_users':
    case 'sa_audit':
    case 'sa_system':
    case 'sa_security':
    case 'sa_billing':
    case 'sa_integrations':
                            pageEl = React.createElement(Superadmin,    { onNavigate: navigate, currentPage: page }); break;
    case 'superadmin':      pageEl = React.createElement(Superadmin,    { onNavigate: navigate, currentPage: 'sa_overview' }); break;
    default:                pageEl = user.role === 'superadmin'
                              ? React.createElement(Superadmin, { onNavigate: navigate, currentPage: 'sa_overview' })
                              : React.createElement(Dashboard,  { onNavigate: navigate, onOpenJob: openJob });
  }

  const sidebarPage =
    page === 'job_detail' ? 'jobs' :
    page === 'patient_detail' ? 'patients' :
    page;

  return React.createElement('div', { style: { display: 'flex', height: '100vh', overflow: 'hidden', background: '#f6f3ec' } },
    React.createElement(Sidebar, {
      currentPage: sidebarPage,
      onNavigate: navigate,
      user,
      onLogout: () => { window.MolarisAPI.logout(); setUser(null); },
    }),
    React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 } },
      React.createElement(Topbar, {
        onNavigate: navigate,
        onOpenJob: openJob,
        onNewJob: () => setNewJobOpen(true),
        onNewPatient: () => setCreateType('patient'),
        onNewInvoice: () => setCreateType('invoice'),
        onCreateClinic: () => setCreateType('clinic'),
        onCreateDoctor: () => setCreateType('doctor'),
      }),
      React.createElement('main', {
        style: { flex: 1, overflowY: 'auto', padding: '28px 32px 60px', minWidth: 0 }
      }, pageEl)
    ),
    React.createElement(NewJob, { open: newJobOpen, onClose: () => setNewJobOpen(false) }),
    React.createElement(CreateEntityDrawer, { type: createType, open: !!createType, onClose: () => setCreateType(null) }),
    React.createElement(ToothDetailModal)
  );
}

// Mount once scripts have loaded.
const __molarisRoot = ReactDOM.createRoot(document.getElementById('root'));
__molarisRoot.render(React.createElement(App));
