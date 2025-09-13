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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const Clinics = ({ token, setError }) => {
  const [clinics, setClinics] = useState([]);
  const [filteredClinics, setFilteredClinics] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [editClinic, setEditClinic] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    ico: '',
    dic: '',
    address: '',
    bank_details: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const response = await axios.get('http://localhost:8000/clinics/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setClinics(response.data);
        setFilteredClinics(response.data);
      } catch (err) {
        setError('Nepodarilo sa načítať kliniky: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    fetchClinics();
  }, [token, setError]);

  useEffect(() => {
    const filtered = clinics.filter(clinic =>
      clinic.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredClinics(filtered);
  }, [searchTerm, clinics]);

  const handleOpen = (clinic = null) => {
    setEditClinic(clinic);
    setFormData(clinic ? {
      name: clinic.name || '',
      ico: clinic.ico || '',
      dic: clinic.dic || '',
      address: clinic.address || '',
      bank_details: clinic.bank_details || '',
      email: clinic.contact_info?.email || '',
      phone: clinic.contact_info?.phone || ''
    } : {
      name: '',
      ico: '',
      dic: '',
      address: '',
      bank_details: '',
      email: '',
      phone: ''
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditClinic(null);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      setError('Názov je povinný');
      return;
    }
    const dataToSend = {
      ...formData,
      contact_info: formData.email || formData.phone ? { email: formData.email, phone: formData.phone } : null
    };
    try {
      if (editClinic) {
        await axios.put(`http://localhost:8000/clinics/${editClinic.id}`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post('http://localhost:8000/clinics/', dataToSend, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      const response = await axios.get('http://localhost:8000/clinics/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinics(response.data);
      setFilteredClinics(response.data);
      handleClose();
    } catch (err) {
      setError('Nepodarilo sa uložiť kliniku: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/clinics/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const response = await axios.get('http://localhost:8000/clinics/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinics(response.data);
      setFilteredClinics(response.data);
    } catch (err) {
      setError('Nepodarilo sa vymazať kliniku: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Kliniky
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
        label="Hľadať kliniky"
        variant="outlined"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
      />
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Názov</TableCell>
              <TableCell>IČO</TableCell>
              <TableCell>DIČ</TableCell>
              <TableCell>Adresa</TableCell>
              <TableCell>Bankové údaje</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Telefón</TableCell>
              <TableCell>Akcie</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredClinics.map(clinic => (
              <TableRow key={clinic.id}>
                <TableCell>{clinic.name}</TableCell>
                <TableCell>{clinic.ico || '-'}</TableCell>
                <TableCell>{clinic.dic || '-'}</TableCell>
                <TableCell>{clinic.address || '-'}</TableCell>
                <TableCell>{clinic.bank_details || '-'}</TableCell>
                <TableCell>{clinic.contact_info?.email || '-'}</TableCell>
                <TableCell>{clinic.contact_info?.phone || '-'}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(clinic)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(clinic.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editClinic ? 'Upraviť kliniku' : 'Pridať kliniku'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Názov"
            fullWidth
            value={formData.name}
            onChange={e => handleChange(e)}
            name="name"
            required
          />
          <TextField
            margin="dense"
            label="IČO"
            fullWidth
            value={formData.ico}
            onChange={e => handleChange(e)}
            name="ico"
          />
          <TextField
            margin="dense"
            label="DIČ"
            fullWidth
            value={formData.dic}
            onChange={e => handleChange(e)}
            name="dic"
          />
          <TextField
            margin="dense"
            label="Adresa"
            fullWidth
            value={formData.address}
            onChange={e => handleChange(e)}
            name="address"
          />
          <TextField
            margin="dense"
            label="Bankové údaje"
            fullWidth
            value={formData.bank_details}
            onChange={e => handleChange(e)}
            name="bank_details"
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Zrušiť</Button>
          <Button onClick={handleSave}>Uložiť</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clinics;