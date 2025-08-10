import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Paper,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
} from '@mui/material';

const JobForm = ({ jobFormData, setJobFormData, token, setError, error }) => {
  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [patientsRes, clinicsRes, doctorsRes, techniciansRes] = await Promise.all([
          axios.get('http://localhost:8000/patients/', { headers }),
          axios.get('http://localhost:8000/clinics/', { headers }),
          axios.get('http://localhost:8000/doctors/', { headers }),
          axios.get('http://localhost:8000/technicians/', { headers }),
        ]);
        setPatients(patientsRes.data);
        setClinics(clinicsRes.data);
        setDoctors(doctorsRes.data);
        setTechnicians(techniciansRes.data);
      } catch (err) {
        setError('Nepodarilo sa načítať údaje: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    if (token) fetchData();
  }, [token, setError]);

  const handleJobChange = (e) => {
    setJobFormData({ ...jobFormData, [e.target.name]: e.target.value });
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    try {
      const jobData = {
        ...jobFormData,
        patient_id: parseInt(jobFormData.patient_id) || null,
        clinic_id: parseInt(jobFormData.clinic_id) || null,
        doctor_id: parseInt(jobFormData.doctor_id) || null,
        technician_id: parseInt(jobFormData.technician_id) || null,
        procedure_codes: jobFormData.procedure_codes ? jobFormData.procedure_codes.split(',').map(code => code.trim()) : [],
        due_date: jobFormData.due_date || null,
        status: jobFormData.status || 'pending'
      };
      await axios.post('http://localhost:8000/jobs/', jobData, {
        headers: { Authorization: `Bearer ${token}` }
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
      setError('');
    } catch (err) {
      setError('Nepodarilo sa pridať prácu: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Pridať prácu
      </Typography>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      <form onSubmit={handleJobSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Pacient"
              name="patient_id"
              value={jobFormData.patient_id}
              onChange={handleJobChange}
              variant="outlined"
              size="small"
              required
            >
              <MenuItem value="">Vyberte pacienta</MenuItem>
              {patients.map(patient => (
                <MenuItem key={patient.id} value={patient.id}>
                  {patient.first_name} {patient.last_name} ({patient.birth_number})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Klinika"
              name="clinic_id"
              value={jobFormData.clinic_id}
              onChange={handleJobChange}
              variant="outlined"
              size="small"
              required
            >
              <MenuItem value="">Vyberte kliniku</MenuItem>
              {clinics.map(clinic => (
                <MenuItem key={clinic.id} value={clinic.id}>{clinic.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Lekár"
              name="doctor_id"
              value={jobFormData.doctor_id}
              onChange={handleJobChange}
              variant="outlined"
              size="small"
              required
            >
              <MenuItem value="">Vyberte lekára</MenuItem>
              {doctors.map(doctor => (
                <MenuItem key={doctor.id} value={doctor.id}>
                  {doctor.first_name} {doctor.last_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Technik"
              name="technician_id"
              value={jobFormData.technician_id}
              onChange={handleJobChange}
              variant="outlined"
              size="small"
              required
            >
              <MenuItem value="">Vyberte technika</MenuItem>
              {technicians.map(technician => (
                <MenuItem key={technician.id} value={technician.id}>
                  {technician.first_name} {technician.last_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Kódy procedúr (oddelené čiarkou)"
              name="procedure_codes"
              value={jobFormData.procedure_codes}
              onChange={handleJobChange}
              variant="outlined"
              size="small"
              placeholder="P001, P002"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Dátum splatnosti"
              name="due_date"
              type="date"
              value={jobFormData.due_date}
              onChange={handleJobChange}
              variant="outlined"
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Stav"
              name="status"
              value={jobFormData.status}
              onChange={handleJobChange}
              variant="outlined"
              size="small"
            >
              <MenuItem value="">Vyberte stav</MenuItem>
              <MenuItem value="pending">Čakajúce</MenuItem>
              <MenuItem value="in_progress">V priebehu</MenuItem>
              <MenuItem value="completed">Dokončené</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 2 }}
            >
              Pridať prácu
            </Button>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
};

export default JobForm;