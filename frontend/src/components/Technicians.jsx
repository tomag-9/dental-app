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

const Technicians = ({ token, setError }) => {
  const [technicians, setTechnicians] = useState([]);
  const [filteredTechnicians, setFilteredTechnicians] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [editTechnician, setEditTechnician] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    title_before: '',
    title_after: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        const response = await axios.get('http://localhost:8000/technicians/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTechnicians(response.data);
        setFilteredTechnicians(response.data);
      } catch (err) {
        setError('Nepodarilo sa načítať technikov: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    fetchTechnicians();
  }, [token, setError]);

  useEffect(() => {
    const filtered = technicians.filter(technician =>
      `${technician.first_name} ${technician.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTechnicians(filtered);
  }, [searchTerm, technicians]);

  const handleOpen = (technician = null) => {
    setEditTechnician(technician);
    setFormData(technician ? {
      first_name: technician.first_name || '',
      last_name: technician.last_name || '',
      title_before: technician.title_before || '',
      title_after: technician.title_after || '',
      email: technician.contact_info?.email || '',
      phone: technician.contact_info?.phone || ''
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
    setEditTechnician(null);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name) {
      setError('Meno a priezvisko sú povinné');
      return;
    }
    const dataToSend = {
      ...formData,
      contact_info: formData.email || formData.phone ? { email: formData.email, phone: formData.phone } : null
    };
    try {
      if (editTechnician) {
        await axios.put(`http://localhost:8000/technicians/${editTechnician.id}`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post('http://localhost:8000/technicians/', dataToSend, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      const response = await axios.get('http://localhost:8000/technicians/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTechnicians(response.data);
      setFilteredTechnicians(response.data);
      handleClose();
    } catch (err) {
      setError('Nepodarilo sa uložiť technika: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/technicians/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const response = await axios.get('http://localhost:8000/technicians/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTechnicians(response.data);
      setFilteredTechnicians(response.data);
    } catch (err) {
      setError('Nepodarilo sa vymazať technika: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Technici
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
        label="Hľadať technikov"
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
              <TableCell>Akcie</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTechnicians.map(technician => (
              <TableRow key={technician.id}>
                <TableCell>{technician.first_name}</TableCell>
                <TableCell>{technician.last_name}</TableCell>
                <TableCell>{technician.title_before || '-'}</TableCell>
                <TableCell>{technician.title_after || '-'}</TableCell>
                <TableCell>{technician.contact_info?.email || '-'}</TableCell>
                <TableCell>{technician.contact_info?.phone || '-'}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(technician)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(technician.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editTechnician ? 'Upraviť technika' : 'Pridať technika'}</DialogTitle>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Zrušiť</Button>
          <Button onClick={handleSave}>Uložiť</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Technicians;