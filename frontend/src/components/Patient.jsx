import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Fab,
  styled,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import AddPatientDialog from './AddPatientDialog';
import EditPatientDialog from './EditPatientDialog';
import PatientDetailsDialog from './PatientDetailsDialog';

const BlinkingDot = styled('span')(({ theme }) => ({
  display: 'inline-block',
  width: '8px',
  height: '8px',
  backgroundColor: theme.palette.success.main,
  borderRadius: '50%',
  marginRight: '8px',
  animation: 'blink 1.5s infinite',
  '@keyframes blink': {
    '0%': { opacity: 1 },
    '50%': { opacity: 0.2 },
    '100%': { opacity: 1 },
  },
}));

const Patient = ({ token, setError }) => {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(null);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await axios.get('http://localhost:8000/patients/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPatients(response.data);
        setFilteredPatients(response.data);
      } catch (err) {
        setError('Nepodarilo sa načítať pacientov: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };

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

    fetchPatients();
    fetchJobs();
  }, [token, setError]);

  useEffect(() => {
    const filtered = patients.filter(patient => {
      const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
      const birthNum = patient.birth_number?.toLowerCase() || '';
      const searchLower = searchTerm.toLowerCase();

      // Extract year from birth_number (first 2 or 4 digits)
      let birthYear = '';
      if (birthNum.length >= 2) {
        birthYear = birthNum.substring(0, 2); // Two-digit year (e.g., "95")
        if (birthNum.length >= 4 && !isNaN(birthNum.substring(0, 4))) {
          birthYear = birthNum.substring(0, 4); // Four-digit year (e.g., "1995")
        }

        // Check if searchTerm is a year (2 or 4 digits)
        const isYearSearch = !isNaN(searchLower) && (searchLower.length === 2 || searchLower.length === 4);
        if (isYearSearch && birthYear.startsWith(searchLower)) {
          return true;
        }
      }

      // Fallback to existing name and birth number search
      return fullName.includes(searchLower) || birthNum.includes(searchLower);
    });
    setFilteredPatients(filtered);
  }, [searchTerm, patients]);

  const ongoingPatients = patients.filter(patient =>
    jobs.some(job => job.patient_id === patient.id && job.status !== 'finished')
  );

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Pacienti
      </Typography>
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setOpenAddDialog(true)}
      >
        <AddIcon />
      </Fab>
      <AddPatientDialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        token={token}
        setError={setError}
        onSuccess={() => {
          axios
            .get('http://localhost:8000/patients/', {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then(response => {
              setPatients(response.data);
              setFilteredPatients(response.data);
            });
        }}
      />
      <EditPatientDialog
        patient={openEditDialog}
        onClose={() => setOpenEditDialog(null)}
        token={token}
        setError={setError}
        onSuccess={() => {
          axios
            .get('http://localhost:8000/patients/', {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then(response => {
              setPatients(response.data);
              setFilteredPatients(response.data);
            });
        }}
      />
      <PatientDetailsDialog
        patient={openDetailsDialog}
        onClose={() => setOpenDetailsDialog(null)}
        token={token}
        setError={setError}
      />
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
          <BlinkingDot />
          Prebiehajúce práce
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Meno</TableCell>
                <TableCell>Priezvisko</TableCell>
                <TableCell>Rodné číslo</TableCell>
                <TableCell>Akcie</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ongoingPatients.map(patient => (
                <TableRow key={patient.id}>
                  <TableCell>{patient.first_name}</TableCell>
                  <TableCell>{patient.last_name}</TableCell>
                  <TableCell>{patient.birth_number || '-'}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => setOpenEditDialog(patient)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => setOpenDetailsDialog(patient)}>
                      <SearchIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Zoznam všetkých pacientov
        </Typography>
        <TextField
          fullWidth
          label="Hľadať pacientov (meno, rodné číslo, rok narodenia)"
          variant="outlined"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Meno</TableCell>
                <TableCell>Priezvisko</TableCell>
                <TableCell>Rodné číslo</TableCell>
                <TableCell>Akcie</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPatients.map(patient => (
                <TableRow key={patient.id}>
                  <TableCell>{patient.first_name}</TableCell>
                  <TableCell>{patient.last_name}</TableCell>
                  <TableCell>{patient.birth_number || '-'}</TableCell>
                  <TableCell>
                    <IconButton onClick={() => setOpenEditDialog(patient)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => setOpenDetailsDialog(patient)}>
                      <SearchIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default Patient;