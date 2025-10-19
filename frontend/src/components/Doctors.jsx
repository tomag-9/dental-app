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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  MenuItem,
  Select,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const Doctors = ({ token, setError }) => {
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [editDoctor, setEditDoctor] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    title_before: '',
    title_after: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [doctorsResponse, clinicsResponse] = await Promise.all([
          axios.get('http://localhost:8000/doctors/', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://localhost:8000/clinics/', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setDoctors(doctorsResponse.data);
        setFilteredDoctors(doctorsResponse.data);
        setClinics(clinicsResponse.data);
      } catch (err) {
        setError('Nepodarilo sa načítať dáta: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    fetchData();
  }, [token, setError]);

  useEffect(() => {
    const filtered = doctors.filter(doctor =>
      `${doctor.first_name} ${doctor.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredDoctors(filtered);
  }, [searchTerm, doctors]);

  const handleOpen = (doctor = null) => {
    setEditDoctor(doctor);
    setFormData(doctor ? {
      first_name: doctor.first_name || '',
      last_name: doctor.last_name || '',
      title_before: doctor.title_before || '',
      title_after: doctor.title_after || '',
      email: doctor.contact_info?.email || '',
      phone: doctor.contact_info?.phone || ''
    } : {
      first_name: '',
      last_name: '',
      title_before: '',
      title_after: '',
      email: '',
      phone: ''
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditDoctor(null);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name) {
      setError('Meno a priezvisko sú povinné');
      return;
    }
    const clinic = clinics.find(c => c.name === formData.clinic_name);
    const dataToSend = {
      ...formData,
      contact_info: formData.email || formData.phone ? { email: formData.email, phone: formData.phone } : null,
      clinic_id: clinic ? clinic.id : null
    };
    try {
      if (editDoctor) {
        await axios.put(`http://localhost:8000/doctors/${editDoctor.id}`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post('http://localhost:8000/doctors/', dataToSend, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      const response = await axios.get('http://localhost:8000/doctors/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDoctors(response.data);
      setFilteredDoctors(response.data);
      handleClose();
    } catch (err) {
      setError('Nepodarilo sa uložiť lekára: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/doctors/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const response = await axios.get('http://localhost:8000/doctors/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDoctors(response.data);
      setFilteredDoctors(response.data);
    } catch (err) {
      setError('Nepodarilo sa vymazať lekára: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Lekári
      </Typography>
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => handleOpen()}
      >
        <AddIcon />
      </Fab>
      <TextField
        fullWidth
        label="Hľadať lekárov"
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
              <TableCell>Titul pred</TableCell>
              <TableCell>Titul za</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Telefón</TableCell>
              <TableCell>Klinika</TableCell>
              <TableCell>Akcie</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredDoctors.map(doctor => (
              <TableRow key={doctor.id}>
                <TableCell>{doctor.first_name}</TableCell>
                <TableCell>{doctor.last_name}</TableCell>
                <TableCell>{doctor.title_before || '-'}</TableCell>
                <TableCell>{doctor.title_after || '-'}</TableCell>
                <TableCell>{doctor.contact_info?.email || '-'}</TableCell>
                <TableCell>{doctor.contact_info?.phone || '-'}</TableCell>
                <TableCell>{doctor.clinic_id ? clinics.find(c => c.id === doctor.clinic_id)?.name || '-' : '-'}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(doctor)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(doctor.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editDoctor ? 'Upraviť lekára' : 'Pridať lekára'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Meno"
            fullWidth
            value={formData.first_name}
            onChange={e => handleChange(e)}
            name="first_name"
            required
          />
          <TextField
            margin="dense"
            label="Priezvisko"
            fullWidth
            value={formData.last_name}
            onChange={e => handleChange(e)}
            name="last_name"
            required
          />
          <TextField
            margin="dense"
            label="Titul pred"
            fullWidth
            value={formData.title_before}
            onChange={e => handleChange(e)}
            name="title_before"
          />
          <TextField
            margin="dense"
            label="Titul za"
            fullWidth
            value={formData.title_after}
            onChange={e => handleChange(e)}
            name="title_after"
          />
          <TextField
            margin="dense"
            label="Email"
            fullWidth
            value={formData.email}
            onChange={e => handleChange(e)}
            name="email"
          />
          <TextField
            margin="dense"
            label="Telefón"
            fullWidth
            value={formData.phone}
            onChange={e => handleChange(e)}
            name="phone"
          />
          <Select
            margin="dense"
            label="Klinika"
            fullWidth
            value={formData.clinic_name || ''}
            onChange={e => handleChange(e)}
            name="clinic_name"
            displayEmpty
            renderValue={selected => selected || 'Vyberte kliniku'}
          >
            <MenuItem value="">
              <em>Vyberte kliniku</em>
            </MenuItem>
            {clinics.map(clinic => (
              <MenuItem key={clinic.id} value={clinic.name}>
                {clinic.name}
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Zrušiť</Button>
          <Button onClick={handleSave}>Uložiť</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Doctors;