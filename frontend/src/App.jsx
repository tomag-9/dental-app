import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import Signup from './components/Signup';
import Patient from './components/Patient';
import Jobs from './components/Jobs';
import Doctors from './components/Doctors';
import Clinics from './components/Clinics';
import Technicians from './components/Technicians';
import PriceList from './components/PriceList';
import Invoices from './components/Invoices';
import FinanceOverview from './components/FinanceOverview';
import FinanceAnalytics from './components/FinanceAnalytics';
import LabDashboard from './components/LabDashboard';
import Users from './components/Users';
import EditProfile from './components/EditProfile';
import LabSettings from './components/LabSettings';
import JobDetails from './components/JobDetails';
import CalendarPage from './components/CalendarPage';
import SuperadminDashboard from './components/SuperadminDashboard';
import LabManagement from './components/LabManagement';
import UserManagement from './components/UserManagement';
import SubscriptionManagement from './components/SubscriptionManagement';
import StorageOverview from './components/StorageOverview';
import StorageItems from './components/StorageItems';
import { api } from './lib/api';
import './index.css';

const ProtectedRoute = ({ children, token, setToken, setIsLoggedIn, setUserRole }) => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      if (!token) {
        if (isMounted) {
          setIsChecking(false);
          navigate('/login');
        }
        return;
      }
      try {
        const res = await api(token).get('/users/me/');
        if (isMounted) {
            setUserRole(res.data.role);
            setIsChecking(false);
        }
      } catch (err) {
        if (isMounted) {
          if (err.response?.status === 401) {
            setToken('');
            localStorage.removeItem('token');
            setIsLoggedIn(false);
            navigate('/login');
          } else {
            setIsChecking(false);
          }
        }
      }
    };
    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [token, navigate, setToken, setIsLoggedIn, setUserRole]);

  if (isChecking) return <div className="flex items-center justify-center h-screen font-bold text-gray-400 animate-pulse">Overujem prístup...</div>;
  return token ? children : null;
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('role') || 'user');
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const wrapInLayout = (component) => (
    <ProtectedRoute
        token={token}
        setToken={setToken}
        setIsLoggedIn={() => {}}
        setUserRole={(role) => {
            setUserRole(role);
            localStorage.setItem('role', role);
        }}
    >
      <Layout handleLogout={handleLogout} userRole={userRole}>
        {component}
      </Layout>
    </ProtectedRoute>
  );

  return (
    <Routes>
      <Route path="/login" element={<Login setToken={setToken} setIsLoggedIn={() => {}} />} />
      <Route path="/signup" element={<Signup onLoginSuccess={(t) => setToken(t)} />} />
      <Route path="/" element={wrapInLayout(<LabDashboard token={token} />)} />
      <Route path="/calendar" element={wrapInLayout(<CalendarPage token={token} />)} />
      <Route path="/patients" element={wrapInLayout(<Patient token={token} />)} />
      <Route path="/jobs" element={wrapInLayout(<Jobs token={token} />)} />
      <Route path="/job-details/:id" element={wrapInLayout(<JobDetails token={token} />)} />
      <Route path="/doctors" element={wrapInLayout(<Doctors token={token} />)} />
      <Route path="/clinics" element={wrapInLayout(<Clinics token={token} />)} />
      <Route path="/technicians" element={wrapInLayout(<Technicians token={token} />)} />
      <Route path="/finance/price-list" element={wrapInLayout(<PriceList token={token} />)} />
      <Route path="/finance/invoices" element={wrapInLayout(<Invoices token={token} />)} />
      <Route path="/finance/analytics" element={wrapInLayout(<FinanceAnalytics token={token} />)} />
      <Route path="/finance/overview" element={wrapInLayout(<FinanceOverview token={token} />)} />
      <Route path="/settings/users" element={wrapInLayout(<Users token={token} />)} />
      <Route path="/settings/edit-profile" element={wrapInLayout(<EditProfile token={token} />)} />
      <Route path="/settings/lab" element={wrapInLayout(<LabSettings token={token} />)} />
      <Route path="/storage/overview" element={wrapInLayout(<StorageOverview token={token} />)} />
      <Route path="/storage/items" element={wrapInLayout(<StorageItems token={token} />)} />
      <Route path="/superadmin/dashboard" element={wrapInLayout(<SuperadminDashboard token={token} />)} />
      <Route path="/superadmin/labs" element={wrapInLayout(<LabManagement token={token} />)} />
      <Route path="/superadmin/users" element={wrapInLayout(<UserManagement token={token} />)} />
      <Route path="/superadmin/subscriptions" element={wrapInLayout(<SubscriptionManagement token={token} />)} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
