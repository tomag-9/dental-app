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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import axios from 'axios';

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
        const response = await axios.get('http://localhost:8000/price_list/', {
          headers: { Authorization: `Bearer ${token}` },
        });
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
    <TableContainer>
      <Table>
        <TableBody>
          {jobList.map((job) => {
            const patient = patients.find((p) => p.id === job.patient_id);
            return (
              <TableRow key={job.id} sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}>
                <TableCell>
                  {patient ? `${patient.first_name} ${patient.last_name}` : job.patient_id}
                </TableCell>
                <TableCell>{job.procedure_codes?.join(', ') || 'Žiadne'}</TableCell>
                <TableCell>
                  {job.due_date
                    ? new Date(job.due_date).toLocaleDateString('sk-SK')
                    : '-'}
                </TableCell>
                <TableCell>{getStatusDisplay(job.status)}</TableCell>
                <TableCell>{calculatePrice(job)}</TableCell>
                <TableCell>
                  <IconButton onClick={() => onEdit(job)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => onDelete(job.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Paper sx={{ p: 2, mt: 3, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Hľadanie prác
      </Typography>
      <TextField
        fullWidth
        label="Hľadať podľa pacienta, kódu, dátumu alebo stavu"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        variant="outlined"
        sx={{ mb: 2, '& .MuiInputBase-root': { height: 45 } }}
      />

      {/* Search Mode */}
      {searchTerm ? (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
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
          <Box>
            <Box
              onClick={() => toggleSection('in_progress')}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                mb: 1,
              }}
            >
              <Typography variant="h6">V priebehu</Typography>
              {openSections.in_progress ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
            <Collapse in={openSections.in_progress} timeout="auto" unmountOnExit>
              {renderJobTable(jobs.filter((j) => j.status === 'in_progress'))}
            </Collapse>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Box
              onClick={() => toggleSection('finished_unfactured')}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                mb: 1,
              }}
            >
              <Typography variant="h6">Dokončené – Nevyfakturované</Typography>
              {openSections.finished_unfactured ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
            <Collapse in={openSections.finished_unfactured} timeout="auto" unmountOnExit>
              {renderJobTable(jobs.filter((j) => j.status === 'finished_unfactured'))}
            </Collapse>
          </Box>

          <Box sx={{ mt: 3 }}>
            <Box
              onClick={() => toggleSection('finished_factured')}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                mb: 1,
              }}
            >
              <Typography variant="h6">Dokončené – Vyfakturované</Typography>
              {openSections.finished_factured ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
            <Collapse in={openSections.finished_factured} timeout="auto" unmountOnExit>
              {renderJobTable(jobs.filter((j) => j.status === 'finished_factured'))}
            </Collapse>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default JobList;
