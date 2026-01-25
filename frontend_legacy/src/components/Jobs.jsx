import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Button,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
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
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Práce
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenForm(true)}
          size="large"
        >
          Nová práca
        </Button>
      </Box>
      <JobList
        jobs={jobs}
        patients={patients}
        token={token}
        setError={setError}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
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