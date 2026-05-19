import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import InvoiceErrorBoundary from './components/InvoiceErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import useAuthStore from './store/auth';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const PatientCreate = lazy(() => import('./pages/PatientCreate'));
const Jobs = lazy(() => import('./pages/Jobs'));
const JobCreate = lazy(() => import('./pages/JobCreate'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const Clinics = lazy(() => import('./pages/Clinics'));
const ClinicCreate = lazy(() => import('./pages/ClinicCreate'));
const Doctors = lazy(() => import('./pages/Doctors'));
const DoctorCreate = lazy(() => import('./pages/DoctorCreate'));
const Technicians = lazy(() => import('./pages/Technicians'));
const TechnicianCreate = lazy(() => import('./pages/TechnicianCreate'));
const Finance = lazy(() => import('./pages/Finance'));
const PriceList = lazy(() => import('./pages/PriceList'));
const PriceListCreate = lazy(() => import('./pages/PriceListCreate'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const Inventory = lazy(() => import('./pages/Inventory'));
const InventoryCreate = lazy(() => import('./pages/InventoryCreate'));
const Settings = lazy(() => import('./pages/Settings'));
const Calendar = lazy(() => import('./pages/Calendar'));
const SuperadminDashboard = lazy(() => import('./pages/SuperadminDashboard'));
const SuperadminUsers = lazy(() => import('./pages/SuperadminUsers'));
const SuperadminLabs = lazy(() => import('./pages/SuperadminLabs'));
const SuperadminSubscriptions = lazy(() => import('./pages/SuperadminSubscriptions'));

function HomeRoute() {
  const user = useAuthStore((state) => state.user);
  if (user?.role === 'superadmin') {
    return <Navigate to="/superadmin/dashboard" replace />;
  }
  return <Dashboard />;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Načítavam...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />

            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/new" element={<PatientCreate />} />
            <Route path="/patients/:id/edit" element={<PatientCreate />} />

            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/new" element={<JobCreate />} />
            <Route path="/jobs/:id/edit" element={<JobCreate />} />
            <Route path="/jobs/:id" element={<JobDetail />} />

            <Route element={<ProtectedRoute allowedRoles={["admin", "superadmin"]} />}>
              <Route path="/clinics" element={<Clinics />} />
              <Route path="/clinics/new" element={<ClinicCreate />} />
              <Route path="/clinics/:id/edit" element={<ClinicCreate />} />

              <Route path="/doctors" element={<Doctors />} />
              <Route path="/doctors/new" element={<DoctorCreate />} />
              <Route path="/doctors/:id/edit" element={<DoctorCreate />} />

              <Route path="/technicians" element={<Technicians />} />
              <Route path="/technicians/new" element={<TechnicianCreate />} />
              <Route path="/technicians/:id/edit" element={<TechnicianCreate />} />

              <Route path="/finance" element={<Finance />} />
              <Route path="/finance/overview" element={<Navigate to="/finance" replace />} />
              <Route path="/finance/price-list" element={<Navigate to="/price-list" replace />} />
              <Route path="/finance/invoices" element={<Navigate to="/invoices" replace />} />
              <Route path="/finance/analytics" element={<Navigate to="/finance" replace />} />

              <Route path="/price-list" element={<PriceList />} />
              <Route path="/price-list/new" element={<PriceListCreate />} />
              <Route path="/price-list/:id/edit" element={<PriceListCreate />} />

              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceErrorBoundary><InvoiceDetail /></InvoiceErrorBoundary>} />
              <Route path="/invoices/:id" element={<InvoiceErrorBoundary><InvoiceDetail /></InvoiceErrorBoundary>} />
            </Route>

            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/new" element={<InventoryCreate />} />
            <Route path="/inventory/:id/edit" element={<InventoryCreate />} />
            <Route path="/storage/overview" element={<Navigate to="/inventory" replace />} />
            <Route path="/storage/items" element={<Navigate to="/inventory" replace />} />

            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/:tab" element={<Settings />} />
            <Route path="/settings/edit-profile" element={<Navigate to="/settings/profile" replace />} />
            <Route path="/settings/permissions" element={<Navigate to="/settings/profile" replace />} />

            <Route path="/medics/list" element={<Navigate to="/doctors" replace />} />
            <Route path="/medics/schedule" element={<Navigate to="/doctors" replace />} />

            <Route path="/calendar" element={<Calendar />} />

            <Route element={<ProtectedRoute allowedRoles={["superadmin"]} />}>
              <Route path="/superadmin/dashboard" element={<SuperadminDashboard />} />
              <Route path="/superadmin/users" element={<SuperadminUsers />} />
              <Route path="/superadmin/labs" element={<SuperadminLabs />} />
              <Route path="/superadmin/subscriptions" element={<SuperadminSubscriptions />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
