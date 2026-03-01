import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
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
  const [cumulativeToothMap, setCumulativeToothMap] = useState({});
  const [freshPatient, setFreshPatient] = useState(patient);
  const navigate = useNavigate();

  // Always fetch fresh patient data and cumulative tooth map when dialog is opened or patient changes
  useEffect(() => {
    if (patient && patient.id) {
      const apiClient = api(token);
      const fetchPatient = async () => {
        try {
          const response = await apiClient.get(`/patients/${patient.id}`);
          setFreshPatient(response.data);
        } catch (err) {
          setError('Nepodarilo sa načítať pacienta: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
        }
      };
      const fetchCumulativeToothMap = async () => {
        try {
          const response = await apiClient.get(`/patients/${patient.id}/cumulative_tooth_map`);
          setCumulativeToothMap(response.data);
        } catch (err) {
          setError('Nepodarilo sa načítať sumarizovanú zubnú mapu: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
        }
      };
      fetchPatient();
      fetchCumulativeToothMap();
    }
  }, [patient, token, setError]);

  useEffect(() => {
    if (patient && patient.id) {
      const apiClient = api(token);
      const fetchJobs = async () => {
        try {
          const response = await apiClient.get(`/jobs/?patient_id=${patient.id}`);
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
      <DialogTitle>Detaily pacienta: {freshPatient?.first_name} {freshPatient?.last_name}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Zubná mapa (kumulatívny stav)
            </Typography>
            <ToothMap 
              editable={false} 
              value={cumulativeToothMap} 
            />
          </Box>
          <Box sx={{ flex: 1, maxHeight: '400px', overflowY: 'auto' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              História prác
            </Typography>
            {/* Status translation map */}
            {(() => {
              const statusTranslations = {
                'pending': 'Čaká na spracovanie',
                'in_progress': 'Prebieha',
                'completed': 'Ukončená',
                'closed': 'Uzavretá',
                'cancelled': 'Zrušená',
                'draft': 'Návrh',
                '': '-',
                null: '-',
                undefined: '-',
              };
              return (
                <List>
                  {jobs.map(job => (
                    <ListItemButton key={job.id} onClick={() => handleJobClick(job.id)} sx={{ borderRadius: 2, mb: 1, '&:hover': { bgcolor: 'grey.100' } }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{new Date(job.due_date).toLocaleDateString('sk-SK')}</span>
                            <span style={{ fontWeight: 500, color: '#1976d2' }}>{statusTranslations[job.status] || job.status || '-'}</span>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <span style={{ color: '#666' }}>Úkony: {job.procedure_codes || '-'}</span>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              );
            })()}

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