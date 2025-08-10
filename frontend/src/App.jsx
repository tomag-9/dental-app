import React, { useState, useEffect, Component } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
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
import JobForm from './components/JobForm';
import JobList from './components/JobList';
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

function App() {
  const [jobFormData, setJobFormData] = useState({
    patient_id: '',
    clinic_id: '',
    doctor_id: '',
    technician_id: '',
    procedure_codes: '',
    due_date: '',
    status: ''
  });
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
    setJobFormData({
      patient_id: '',
      clinic_id: '',
      doctor_id: '',
      technician_id: '',
      procedure_codes: '',
      due_date: '',
      status: ''
    });
    setLoginData({ username: '', password: '' });
    setError('');
    setSidebarOpen(false);
    setIsDrawerExpanded(false);
    navigate('/');
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
                  <Patient token={token} setError={setError} />
                }
              />
              <Route
                path="/jobs"
                element={
                  <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                    <Typography variant="h4" sx={{ mb: 3 }}>
                      Práce
                    </Typography>
                    <JobForm
                      jobFormData={jobFormData}
                      setJobFormData={setJobFormData}
                      token={token}
                      setError={setError}
                      error={error}
                    />
                    <JobList token={token} setError={setError} />
                  </Box>
                }
              />
              <Route
                path="/jobs/:jobId"
                element={
                  <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                    <Typography variant="h4" sx={{ mb: 3 }}>
                      Detail práce
                    </Typography>
                    <Typography color="text.secondary">
                      Táto sekcia bude čoskoro implementovaná
                    </Typography>
                  </Box>
                }
              />
              <Route
                path="/doctors"
                element={
                  <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                    <Typography variant="h4" sx={{ mb: 3 }}>
                      Lekári
                    </Typography>
                    <Typography color="text.secondary">
                      Táto sekcia bude čoskoro implementovaná
                    </Typography>
                  </Box>
                }
              />
              <Route
                path="/technicians"
                element={
                  <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                    <Typography variant="h4" sx={{ mb: 3 }}>
                      Technici
                    </Typography>
                    <Typography color="text.secondary">
                      Táto sekcia bude čoskoro implementovaná
                    </Typography>
                  </Box>
                }
              />
              <Route
                path="/clinics"
                element={
                  <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                    <Typography variant="h4" sx={{ mb: 3 }}>
                      Kliniky
                    </Typography>
                    <Typography color="text.secondary">
                      Táto sekcia bude čoskoro implementovaná
                    </Typography>
                  </Box>
                }
              />
              <Route
                path="/price-list"
                element={
                  <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                    <Typography variant="h4" sx={{ mb: 3 }}>
                      Cenník
                    </Typography>
                    <Typography color="text.secondary">
                      Táto sekcia bude čoskoro implementovaná
                    </Typography>
                  </Box>
                }
              />
              <Route
                path="/"
                element={
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