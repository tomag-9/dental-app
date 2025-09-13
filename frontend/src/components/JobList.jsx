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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';

const JobList = ({ jobs, patients, token, setError, onEdit, onDelete }) => {
  const [priceList, setPriceList] = useState([]);

  useEffect(() => {
    const fetchPriceList = async () => {
      try {
        const response = await axios.get('http://localhost:8000/price_list/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPriceList(response.data);
      } catch (err) {
        setError('Nepodarilo sa načítať cenník: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    fetchPriceList();
  }, [token, setError]);

  const calculatePrice = (job) => {
    if (!priceList.length || !job.procedure_codes) return 0;
    let total = 0;
    job.procedure_codes.forEach((code) => {
      const priceItem = priceList.find(p => p.code === code);
      const quantity = job.procedure_quantities?.[code] || 1;
      total += (priceItem?.price || 0) * quantity;
    });
    return total.toFixed(2);
  };

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
                <TableCell sx={{ fontWeight: 'bold' }}>Pacient</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Kódy procedúr</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Dátum splatnosti</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Stav</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Cena (€)</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Akcie</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => {
                const patient = patients.find(p => p.id === job.patient_id);
                return (
                  <TableRow key={job.id} sx={{ '&:hover': { bgcolor: '#f5f5f5' } }}>
                    <TableCell>{patient ? `${patient.first_name} ${patient.last_name}` : job.patient_id}</TableCell>
                    <TableCell>{job.procedure_codes?.join(', ') || 'Žiadne'}</TableCell>
                    <TableCell>{job.due_date ? new Date(job.due_date).toLocaleDateString('sk-SK') : '-'}</TableCell>
                    <TableCell>
                      {job.status === 'pending' ? 'Čakajúce' : job.status === 'in_progress' ? 'V priebehu' : 'Dokončené'}
                    </TableCell>
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
      )}
    </Paper>
  );
};

export default JobList;