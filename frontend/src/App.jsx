import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientCreate from './pages/PatientCreate';
import Jobs from './pages/Jobs';
import JobCreate from './pages/JobCreate';
import Clinics from './pages/Clinics';
import ClinicCreate from './pages/ClinicCreate';
import Doctors from './pages/Doctors';
import DoctorCreate from './pages/DoctorCreate';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />

            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/new" element={<PatientCreate />} />

            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/new" element={<JobCreate />} />

            <Route path="/clinics" element={<Clinics />} />
            <Route path="/clinics/new" element={<ClinicCreate />} />

            <Route path="/doctors" element={<Doctors />} />
            <Route path="/doctors/new" element={<DoctorCreate />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
