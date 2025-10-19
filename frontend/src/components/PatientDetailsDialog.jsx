import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
  ListItemButton,
} from '@mui/material';
import ToothMap from './ToothMap';
import { useNavigate } from 'react-router-dom';

const PatientDetailsDialog = ({ patient, onClose, token, setError }) => {
  const [jobs, setJobs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (patient) {
      const fetchJobs = async () => {
        try {
          const response = await axios.get(`http://localhost:8000/jobs/?patient_id=${patient.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setJobs(response.data);
        } catch (err) {
          setError('Nepodarilo sa načítať práce: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
        }
      };
      fetchJobs();
    }
  }, [patient, token, setError]);

  const handleJobClick = (jobId) => {
    navigate(`/job-details/${jobId}`);
  };

  return (
    <Dialog open={!!patient} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Detaily pacienta: {patient?.first_name} {patient?.last_name}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Zubná mapa
            </Typography>
            <ToothMap patientId={patient?.id} token={token} setError={setError} />
          </Box>
          <Box sx={{ flex: 1, maxHeight: '400px', overflowY: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              História prác
            </Typography>
            <List>
              {jobs.map(job => (
                <ListItemButton key={job.id} onClick={() => handleJobClick(job.id)}>
                  <ListItemText
                    primary={`Dátum: ${new Date(job.due_date).toLocaleDateString('sk-SK')}`}
                    secondary={`Úkony: ${job.procedure_codes || '-'}, Stav: ${job.status || '-'}`}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zavrieť</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatientDetailsDialog;