import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

const JobList = ({ token, setError }) => {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
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
    if (token) fetchJobs();
  }, [token, setError]);

  return (
    <Paper sx={{ p: 2, mt: 3, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Zoznam prác
      </Typography>
      {jobs.length === 0 ? (
        <Typography color="text.secondary">Žiadne práce</Typography>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Pacient</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Kódy procedúr</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Stav</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id} sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}>
                  <TableCell>{job.id}</TableCell>
                  <TableCell>{job.patient_id}</TableCell>
                  <TableCell>{job.procedure_codes?.join(', ') || 'Žiadne'}</TableCell>
                  <TableCell>
                    {job.status === 'pending' ? 'Čakajúce' : job.status === 'in_progress' ? 'V priebehu' : 'Dokončené'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default JobList;