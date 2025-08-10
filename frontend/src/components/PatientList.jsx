import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import PatientForm from './PatientForm';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

const PatientList = ({ filteredPatients, searchTerm, handleSearchChange, token, setError }) => {
  const [editPatient, setEditPatient] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPatientJobs, setSelectedPatientJobs] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  const handleEdit = (patient) => {
    setEditPatient(patient);
    setShowEditModal(true);
  };

  const handleUpdatePatient = async (updatedData) => {
    try {
      await axios.put(`http://localhost:8000/patients/${editPatient.id}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowEditModal(false);
      setEditPatient(null);
      setError('');
      const response = await axios.get('http://localhost:8000/patients/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      filteredPatients(response.data);
    } catch (err) {
      setError('Nepodarilo sa upraviť pacienta: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const handleShowDetails = async (patientId) => {
    try {
      const response = await axios.get(`http://localhost:8000/jobs/?patient_id=${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedPatientJobs(response.data);
      setSelectedPatientId(patientId);
      setShowDetailsModal(true);
    } catch (err) {
      setError('Nepodarilo sa načítať práce: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Zoznam pacientov</h2>
      <TextField
        fullWidth
        label="Zadajte meno, priezvisko alebo rodné číslo"
        value={searchTerm}
        onChange={handleSearchChange}
        variant="outlined"
        sx={{ mb: 2 }}
      />
      {filteredPatients.length === 0 ? (
        <p style={{ color: '#666' }}>Žiadni pacienti</p>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Meno</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Priezvisko</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Rodné číslo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Akcie</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPatients.map((patient) => (
                <TableRow key={patient.id} sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}>
                  <TableCell>{patient.first_name}</TableCell>
                  <TableCell>{patient.last_name}</TableCell>
                  <TableCell>{patient.birth_number}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      onClick={() => handleEdit(patient)}
                      sx={{ mr: 1 }}
                    >
                      Upraviť
                    </Button>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={() => handleShowDetails(patient.id)}
                    >
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Edit Modal */}
      <Dialog open={showEditModal} onClose={() => setShowEditModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upraviť pacienta</DialogTitle>
        <DialogContent>
          <PatientForm
            formData={editPatient}
            handleChange={(e) =>
              setEditPatient({ ...editPatient, [e.target.name]: e.target.value })
            }
            handleSubmit={(e) => {
              e.preventDefault();
              handleUpdatePatient(editPatient);
            }}
            error={''}
            isEditMode={true}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditModal(false)} color="error">
            Zatvoriť
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onClose={() => setShowDetailsModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Práce pacienta</DialogTitle>
        <DialogContent>
          {selectedPatientJobs.length === 0 ? (
            <p style={{ color: '#666' }}>Žiadne práce pre pacienta</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {selectedPatientJobs.map((job) => (
                <li key={job.id} style={{ padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p>Práca #{job.id}</p>
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>
                        Kódy procedúr: {job.procedure_codes?.join(', ') || 'Žiadne'}
                      </p>
                      {job.due_date && (
                        <p style={{ fontSize: '0.875rem', color: '#666' }}>
                          Dátum splatnosti: {new Date(job.due_date).toLocaleDateString('sk-SK')}
                        </p>
                      )}
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>
                        Stav: {job.status === 'pending' ? 'Čakajúce' : job.status === 'in_progress' ? 'V priebehu' : 'Dokončené'}
                      </p>
                    </div>
                    <Link
                      to={`/jobs/${job.id}`}
                      style={{ color: '#1976d2', textDecoration: 'none' }}
                      onClick={() => setShowDetailsModal(false)}
                    >
                      Zobraziť detaily
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetailsModal(false)} color="error">
            Zatvoriť
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default PatientList;