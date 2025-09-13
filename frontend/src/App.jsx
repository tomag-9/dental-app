import React, { useState, useEffect, Component } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Typography,
  Button,
} from '@mui/material';
import NavBar from './components/NavBar';
import DrawerComponent from './components/Drawer';
import Login from './components/Login';
import Patient from './components/Patient';
import Jobs from './components/Jobs';
import Doctors from './components/Doctors';
import Clinics from './components/Clinics';
import Technicians from './components/Technicians';
import PriceList from './components/PriceList';
import Invoices from './components/Invoices';
import './index.css';

class ErrorBoundary extends Component {
  state = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
          <Box sx={{ maxWidth: 400, bgcolor: 'background.paper', p: 4, borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Niečo sa pokazilo
            </Typography>
            <Typography color="error" sx={{ mb: 2 }}>
              {this.state.errorMessage}
            </Typography>
            <Typography sx={{ mb: 2 }}>
              Prosím, obnovte stránku alebo kontaktujte podporu.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => window.location.reload()}
            >
              Obnoviť stránku
            </Button>
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}

const theme = createTheme({
  palette: {
    primary: { main: '#45ac8b' }, // Doctors green
    secondary: { main: '#2e7d32' }, // Darker green
    background: { default: '#f5f5f5', paper: '#fff' },
  },
});

const ProtectedRoute = ({ children, token, setError }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        await axios.get('http://localhost:8000/jobs/', {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/login');
        } else {
          setError('Chyba pri overení autorizácie: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
        }
      }
    };
    checkAuth();
  }, [token, navigate, setError]);

  return token ? children : null;
};

function App() {
  const [loginData, setLoginData] = useState({
    username: '',
    password: ''
  });
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setLoginData({ username: '', password: '' });
    setError('');
    setSidebarOpen(false);
    setIsDrawerExpanded(false);
    navigate('/login');
  };

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <Login
          loginData={loginData}
          setLoginData={setLoginData}
          setToken={setToken}
          setIsLoggedIn={setIsLoggedIn}
          setError={setError}
          error={error}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <NavBar
          handleLogout={handleLogout}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <DrawerComponent
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          isDrawerExpanded={isDrawerExpanded}
          setIsDrawerExpanded={setIsDrawerExpanded}
        />
        <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 6, bgcolor: 'background.default' }}>
          <ErrorBoundary>
            <Routes>
              <Route
                path="/patients"
                element={
                  <ProtectedRoute token={token} setError={setError}>
                    <Patient token={token} setError={setError} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs"
                element={
                  <ProtectedRoute token={token} setError={setError}>
                    <Jobs token={token} setError={setError} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctors"
                element={
                  <ProtectedRoute token={token} setError={setError}>
                    <Doctors token={token} setError={setError} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clinics"
                element={
                  <ProtectedRoute token={token} setError={setError}>
                    <Clinics token={token} setError={setError} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/technicians"
                element={
                  <ProtectedRoute token={token} setError={setError}>
                    <Technicians token={token} setError={setError} />
                  </ProtectedRoute>
                }
              />
              <Route path="/finance/*" element={<ProtectedRoute token={token} setError={setError}>
                <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                  <Routes>
                    <Route
                      path="price-list"
                      element={<PriceList token={token} setError={setError} />}
                    />
                    <Route
                      path="invoices"
                      element={<Invoices token={token} setError={setError} />}
                    />
                    <Route
                      path="analytics"
                      element={
                        <Typography variant="h4">Analytika (placeholder)</Typography>
                      }
                    />
                    <Route
                      path="overview"
                      element={
                        <Typography variant="h4">Financie - Prehľad (placeholder)</Typography>
                      }
                    />
                    <Route
                      path="*"
                      element={<Navigate to="/finance/price-list" />}
                    />
                  </Routes>
                </Box>
              </ProtectedRoute>}
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute token={token} setError={setError}>
                    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                      <Typography variant="h4" sx={{ mb: 3 }}>
                        Vitajte v DentalApp
                      </Typography>
                      <Typography color="text.secondary" paragraph>
                        DentalApp je moderná aplikácia na správu zubných techník, ktorá vám umožňuje efektívne spravovať pacientov, lekárov, technikov, kliniky a práce.
                      </Typography>
                      <Typography color="text.secondary" paragraph>
                        <strong>Rýchle štatistiky:</strong>
                      </Typography>
                      <Typography color="text.secondary">
                        - Počet pacientov: Čoskoro dostupné<br />
                        - Aktívne práce: Čoskoro dostupné<br />
                        - Prihlásený používateľ: admin
                      </Typography>
                    </Box>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <Navigate to="/" />
                }
              />
            </Routes>
          </ErrorBoundary>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;