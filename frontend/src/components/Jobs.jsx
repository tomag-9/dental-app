import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Fab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import JobForm from './JobForm';
import JobList from './JobList';

const Jobs = ({ token, setError }) => {
  const [jobs, setJobs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  const fetchJobs = async () => {
    try {
      const response = await axios.get('http://localhost:8000/jobs/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(response.data);
    } catch (err) {
      setError('Nepodarilo sa načítať práce: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await axios.get('http://localhost:8000/patients/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPatients(response.data);
    } catch (err) {
      setError('Nepodarilo sa načítať pacientov: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  useEffect(() => {
    if (token) {
      fetchJobs();
      fetchPatients();
    }
  }, [token]);

  const handleJobAdded = () => {
    fetchJobs();
    setOpenForm(false);
    setSelectedJob(null);
  };

  const handleEdit = (job) => {
    setSelectedJob(job);
    setOpenForm(true);
  };

  const handleDelete = async (jobId) => {
    try {
      await axios.delete(`http://localhost:8000/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchJobs();
    } catch (err) {
      setError('Nepodarilo sa vymazať prácu: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Práce
      </Typography>
      <JobList
        jobs={jobs}
        patients={patients}
        token={token}
        setError={setError}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setOpenForm(true)}
      >
        <AddIcon />
      </Fab>
      <JobForm
        open={openForm}
        onClose={() => { setOpenForm(false); setSelectedJob(null); }}
        onSuccess={handleJobAdded}
        token={token}
        setError={setError}
        initialData={selectedJob}
      />
    </Box>
  );
};

export default Jobs;