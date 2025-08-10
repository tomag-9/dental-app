import React, { useState, useEffect, Component } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Typography,
  Button,
  Toolbar, // Added Toolbar import
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import EngineeringIcon from '@mui/icons-material/Engineering';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import WorkIcon from '@mui/icons-material/Work';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import NavBar from './components/NavBar';
import Login from './components/Login';
import PatientForm from './components/PatientForm';
import JobForm from './components/JobForm';
import PatientList from './components/PatientList';
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
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_number: '',
    address: '',
    phone: '',
    email: ''
  });
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
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      fetchPatients();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const filtered = patients.filter(patient =>
      `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.birth_number.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPatients(filtered);
  }, [searchTerm, patients]);

  const fetchPatients = async () => {
    try {
      const response = await axios.get('http://localhost:8000/patients/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatients(response.data);
      setFilteredPatients(response.data);
    } catch (err) {
      setError('Nepodarilo sa načítať pacientov: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8000/patients/', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFormData({
        first_name: '',
        last_name: '',
        birth_number: '',
        address: '',
        phone: '',
        email: ''
      });
      fetchPatients();
      setError('');
    } catch (err) {
      setError('Nepodarilo sa pridať pacienta: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setPatients([]);
    setFilteredPatients([]);
    setFormData({
      first_name: '',
      last_name: '',
      birth_number: '',
      address: '',
      phone: '',
      email: ''
    });
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
        <Drawer
          variant="permanent"
          sx={{
            width: 240,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: 240,
              boxSizing: 'border-box',
              bgcolor: 'primary.main',
              color: 'white',
              display: { xs: sidebarOpen ? 'block' : 'none', sm: 'block' },
            },
          }}
        >
          <Toolbar sx={{ minHeight: 48 }} />
          <List>
            {[
              { text: 'Pacienti', icon: <PeopleIcon />, path: '/patients' },
              { text: 'Lekári', icon: <MedicalServicesIcon />, path: '/doctors' },
              { text: 'Technici', icon: <EngineeringIcon />, path: '/technicians' },
              { text: 'Kliniky', icon: <LocalHospitalIcon />, path: '/clinics' },
              { text: 'Práce', icon: <WorkIcon />, path: '/jobs' },
              { text: 'Cenník', icon: <AttachMoneyIcon />, path: '/price-list' },
            ].map(({ text, icon, path }) => (
              <ListItem
                key={text}
                component={Link}
                to={path}
                onClick={() => setSidebarOpen(false)}
                sx={{ '&:hover': { bgcolor: 'primary.dark' } }}
              >
                <ListItemIcon sx={{ color: 'white' }}>{icon}</ListItemIcon>
                <ListItemText primary={text} />
              </ListItem>
            ))}
          </List>
        </Drawer>
        <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 6, bgcolor: 'background.default' }}>
          <ErrorBoundary>
            <Routes>
              <Route
                path="/patients"
                element={
                  <Box sx={{ maxWidth: 960, mx: 'auto' }}>
                    <Typography variant="h4" sx={{ mb: 3 }}>
                      Pacienti
                    </Typography>
                    <PatientForm
                      formData={formData}
                      handleChange={handleChange}
                      handleSubmit={handleSubmit}
                      error={error}
                    />
                    <PatientList
                      filteredPatients={filteredPatients}
                      searchTerm={searchTerm}
                      handleSearchChange={(e) => setSearchTerm(e.target.value)}
                      token={token}
                      setError={setError}
                    />
                  </Box>
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
                      - Počet pacientov: {patients.length}<br />
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