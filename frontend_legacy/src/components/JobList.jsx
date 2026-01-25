import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  IconButton,
  TextField,
  Collapse,
  Box,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { api } from '../lib/api';

const JobList = ({ jobs, patients, token, setError, onEdit, onDelete }) => {
  const [priceList, setPriceList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [openSections, setOpenSections] = useState({
    in_progress: true,
    finished_unfactured: true,
    finished_factured: true,
    closed: true,
  });

  useEffect(() => {
    const fetchPriceList = async () => {
      try {
        const apiClient = api(token);
        const response = await apiClient.get('/price_list/');
        setPriceList(response.data);
      } catch (err) {
        setError(
          'Nepodarilo sa načítať cenník: ' +
            (err.response?.data?.detail || 'Skontrolujte pripojenie')
        );
      }
    };
    fetchPriceList();
  }, [token, setError]);

  const calculatePrice = (job) => {
    if (!priceList.length || !job.procedure_codes) return 0;
    let total = 0;
    job.procedure_codes.forEach((code) => {
      const priceItem = priceList.find((p) => p.code === code);
      const quantity = job.procedure_quantities?.[code] || 1;
      total += (priceItem?.price || 0) * quantity;
    });
    return total.toFixed(2);
  };

  const filteredJobs = jobs.filter((job) => {
    const patient = patients.find((p) => p.id === job.patient_id);
    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : '';
    const searchLower = searchTerm.toLowerCase();
    return (
      patientName.toLowerCase().includes(searchLower) ||
      job.procedure_codes?.join(', ').toLowerCase().includes(searchLower) ||
      job.due_date?.toLowerCase().includes(searchLower) ||
      job.status.toLowerCase().includes(searchLower)
    );
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'in_progress':
        return 'V priebehu';
      case 'finished_unfactured':
        return 'Dokončené – Nevyfakturované';
      case 'finished_factured':
        return 'Dokončené – Vyfakturované';
      case 'closed':
        return 'Uzavreté';
      default:
        return status;
    }
  };

  const renderJobTable = (jobList) => (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow sx={{ backgroundColor: 'grey.50' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>Pacient</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Kódy</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Termín</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Stav</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Cena (€)</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Akcie</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobList.map((job) => {
            const patient = patients.find((p) => p.id === job.patient_id);
            return (
              <TableRow key={job.id} hover>
                <TableCell sx={{ fontWeight: 'medium' }}>
                  {patient ? `${patient.first_name} ${patient.last_name}` : job.patient_id}
                </TableCell>
                <TableCell>{job.procedure_codes?.join(', ') || 'Žiadne'}</TableCell>
                <TableCell>
                  {job.due_date
                    ? new Date(job.due_date).toLocaleDateString('sk-SK')
                    : '-'}
                </TableCell>
                <TableCell>{getStatusDisplay(job.status)}</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>€{calculatePrice(job)}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Upraviť">
                      <IconButton size="small" onClick={() => onEdit(job)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Vymazať">
                      <IconButton size="small" color="error" onClick={() => onDelete(job.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Hľadanie prác
        </Typography>
        <TextField
          fullWidth
          label="Hľadať podľa pacienta, kódu, dátumu alebo stavu"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          variant="outlined"
          sx={{ mb: 3 }}
        />

        {/* Search Mode */}
        {searchTerm ? (
          <>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              Výsledky vyhľadávania
            </Typography>
            {filteredJobs.length > 0 ? (
              renderJobTable(filteredJobs)
            ) : (
              <Typography color="text.secondary">Žiadne výsledky</Typography>
            )}
          </>
        ) : (
          <>
            {/* Grouped Mode */}
            <Box sx={{ mb: 3 }}>
              <Box
                onClick={() => toggleSection('in_progress')}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  mb: 2,
                  p: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'grey.50' },
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>V priebehu</Typography>
                {openSections.in_progress ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={openSections.in_progress} timeout="auto" unmountOnExit>
                {renderJobTable(jobs.filter((j) => j.status === 'in_progress'))}
              </Collapse>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Box
                onClick={() => toggleSection('finished_unfactured')}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  mb: 2,
                  p: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'grey.50' },
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Dokončené – Nevyfakturované</Typography>
                {openSections.finished_unfactured ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={openSections.finished_unfactured} timeout="auto" unmountOnExit>
                {renderJobTable(jobs.filter((j) => j.status === 'finished_unfactured'))}
              </Collapse>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Box
                onClick={() => toggleSection('finished_factured')}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  mb: 2,
                  p: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'grey.50' },
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Dokončené – Vyfakturované</Typography>
                {openSections.finished_factured ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={openSections.finished_factured} timeout="auto" unmountOnExit>
                {renderJobTable(jobs.filter((j) => j.status === 'finished_factured'))}
              </Collapse>
            </Box>

            <Box>
              <Box
                onClick={() => toggleSection('closed')}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  mb: 2,
                  p: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'grey.50' },
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Uzavreté</Typography>
                {openSections.closed ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={openSections.closed} timeout="auto" unmountOnExit>
                {renderJobTable(jobs.filter((j) => j.status === 'closed'))}
              </Collapse>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default JobList;
