import React, { useState, useEffect, Component } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import NavBar from './components/NavBar';
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
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg text-white">
            <h1 className="text-3xl font-bold mb-4">Niečo sa pokazilo</h1>
            <p className="text-red-400 mb-4">{this.state.errorMessage}</p>
            <p>Prosím, obnovte stránku alebo kontaktujte podporu.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md font-semibold"
            >
              Obnoviť stránku
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <div className="flex min-h-screen bg-gray-900">
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-gray-900/95 text-white p-4 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-50`}
      >
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <span className="text-green-500">🦷</span>
          <span className="ml-2">DentalApp</span>
        </h2>
        <ul className="space-y-2">
          {['Pacienti', 'Lekári', 'Technici', 'Kliniky', 'Práce', 'Cenník'].map((tab, index) => (
            <li key={tab}>
              <Link
                to={['/patients', '/doctors', '/technicians', '/clinics', '/jobs', '/price-list'][index]}
                className="text-white block p-3 hover:bg-gray-700 rounded transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                {tab}
              </Link>
            </li>
          ))}
        </ul>
        <button
          onClick={handleLogout}
          className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition duration-300"
        >
          Odhlásiť sa
        </button>
      </div>

      <div className="flex-1">
        <NavBar handleLogout={handleLogout} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="p-6 md:p-10 bg-gray-900">
          <ErrorBoundary>
            <Routes>
              <Route
                path="/patients"
                element={
                  <div className="max-w-4xl mx-auto space-y-6">
                    <h1 className="text-3xl font-bold text-white mb-6">Pacienti</h1>
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
                  </div>
                }
              />
              <Route
                path="/jobs"
                element={
                  <div className="max-w-4xl mx-auto space-y-6">
                    <h1 className="text-3xl font-bold text-white mb-6">Práce</h1>
                    <JobForm
                      jobFormData={jobFormData}
                      setJobFormData={setJobFormData}
                      token={token}
                      setError={setError}
                      error={error}
                    />
                    <JobList token={token} setError={setError} />
                  </div>
                }
              />
              <Route
                path="/jobs/:jobId"
                element={
                  <div className="max-w-4xl mx-auto space-y-6">
                    <h1 className="text-3xl font-bold text-white mb-6">Detail práce</h1>
                    <p className="text-gray-400">Táto sekcia bude čoskoro implementovaná</p>
                  </div>
                }
              />
              <Route
                path="/doctors"
                element={
                  <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-6">Lekári</h1>
                    <p className="text-gray-400">Táto sekcia bude čoskoro implementovaná</p>
                  </div>
                }
              />
              <Route
                path="/technicians"
                element={
                  <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-6">Technici</h1>
                    <p className="text-gray-400">Táto sekcia bude čoskoro implementovaná</p>
                  </div>
                }
              />
              <Route
                path="/clinics"
                element={
                  <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-6">Kliniky</h1>
                    <p className="text-gray-400">Táto sekcia bude čoskoro implementovaná</p>
                  </div>
                }
              />
              <Route
                path="/price-list"
                element={
                  <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-6">Cenník</h1>
                    <p className="text-gray-400">Táto sekcia bude čoskoro implementovaná</p>
                  </div>
                }
              />
              <Route
                path="/"
                element={
                  <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-white mb-6">Vitajte</h1>
                    <p className="text-gray-400">Vyberte sekciu zo sidebaru</p>
                  </div>
                }
              />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default App;