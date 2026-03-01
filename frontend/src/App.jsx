import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientCreate from './pages/PatientCreate';
import Jobs from './pages/Jobs';
import JobCreate from './pages/JobCreate';
import JobDetail from './pages/JobDetail';
import Clinics from './pages/Clinics';
import ClinicCreate from './pages/ClinicCreate';
import Doctors from './pages/Doctors';
import DoctorCreate from './pages/DoctorCreate';
import Technicians from './pages/Technicians';
import TechnicianCreate from './pages/TechnicianCreate';
import Finance from './pages/Finance';
import PriceList from './pages/PriceList';
import PriceListCreate from './pages/PriceListCreate';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import InvoiceErrorBoundary from './components/InvoiceErrorBoundary';
import Inventory from './pages/Inventory';
import InventoryCreate from './pages/InventoryCreate';
import Settings from './pages/Settings';
import Calendar from './pages/Calendar';
import SuperadminDashboard from './pages/SuperadminDashboard';
import SuperadminUsers from './pages/SuperadminUsers';
import SuperadminLabs from './pages/SuperadminLabs';
import SuperadminSubscriptions from './pages/SuperadminSubscriptions';
import ProtectedRoute from './components/ProtectedRoute';
import useAuthStore from './store/auth';

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
    </BrowserRouter>
  );
}

export default App;
