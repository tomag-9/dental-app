import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, TextField, FormControlLabel, Checkbox, Stack, Select, MenuItem,
  FormControl, InputLabel, Alert, CircularProgress, Card, CardContent
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

const InvoiceCreate = ({ token, setError, onBack }) => {
  const [jobs, setJobs] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchJobs();
    fetchClinics();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:8000/jobs/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(response.data);
    } catch (err) {
      setError('Nepodarilo sa načítať práce: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setLoading(false);
    }
  };

  const fetchClinics = async () => {
    try {
      const response = await axios.get('http://localhost:8000/clinics/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinics(response.data);
      if (response.data.length > 0 && !selectedClinic) {
        setSelectedClinic(response.data[0].id);
      }
    } catch (err) {
      setError('Nepodarilo sa načítať kliniky: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const handleJobSelect = (jobId) => {
    setSelectedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const generateInvoice = async () => {
    if (selectedJobs.length === 0) {
      setError('Vyberte aspoň jednu prácu na fakturáciu.');
      return;
    }

    try {
      setGenerating(true);
      await axios.post('http://localhost:8000/invoices/', {
        clinic_id: selectedClinic,
        job_ids: selectedJobs,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setSuccessMsg('Faktúra bola vytvorená.');
      setSelectedJobs([]);
      await fetchJobs(); // Refresh jobs to update statuses
    } catch (err) {
      setError('Nepodarilo sa vytvoriť faktúru: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setGenerating(false);
    }
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'finished_unfactured': return 'Dokončené - Nezafakturované';
      case 'finished_factured': return 'Dokončené - Zafakturované';
      case 'closed': return 'Zatvorené';
      default: return status || '-';
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchTerm || 
      job.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.status?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || job.status === statusFilter;
    const matchesClinic = !selectedClinic || job.clinic_id === selectedClinic;
    return matchesSearch && matchesStatus && matchesClinic;
  });

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mr: 2 }}
        >
          Späť na históriu
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Vytvorenie novej faktúry
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Výber prác na fakturáciu
          </Typography>
          
          <Stack spacing={2} sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Hľadať práce (podľa pacienta, kódu, stavu)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            
            <Stack direction="row" spacing={2}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Klinika</InputLabel>
                <Select
                  value={selectedClinic}
                  onChange={(e) => setSelectedClinic(e.target.value)}
                  label="Klinika"
                >
                  {clinics.map(clinic => (
                    <MenuItem key={clinic.id} value={clinic.id}>
                      {clinic.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Stav práce</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Stav práce"
                >
                  <MenuItem value="">Všetky stavy</MenuItem>
                  <MenuItem value="finished_unfactured">Dokončené - Nezafakturované</MenuItem>
                  <MenuItem value="finished_factured">Dokončené - Zafakturované</MenuItem>
                  <MenuItem value="closed">Zatvorené</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Vybrať</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Popis</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Pacient</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Stav</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Cena</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Termín</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredJobs.map(job => (
                    <TableRow key={job.id} hover>
                      <TableCell>
                        <Checkbox
                          checked={selectedJobs.includes(job.id)}
                          onChange={() => handleJobSelect(job.id)}
                        />
                      </TableCell>
                      <TableCell>{job.description || '-'}</TableCell>
                      <TableCell>{job.patient_name || '-'}</TableCell>
                      <TableCell>{getStatusDisplay(job.status)}</TableCell>
                      <TableCell>€{job.price?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{job.due_date || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          
          <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button
              variant="contained"
              onClick={generateInvoice}
              disabled={selectedJobs.length === 0 || generating}
              startIcon={generating ? <CircularProgress size={20} /> : null}
              size="large"
            >
              Vygenerovať faktúru ({selectedJobs.length} vybraných)
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default InvoiceCreate;
