import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';

const EditPatientDialog = ({ patient, onClose, token, setError, onSuccess }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_number: '',
    birth_date: '',
    nationality: 'SVK',
    insurance: '',
    address: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (patient) {
      setFormData({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        birth_number: patient.birth_number || '',
        birth_date: patient.birth_date || '',
        nationality: patient.nationality || 'SVK',
        insurance: patient.insurance || '',
        address: patient.address || '',
        phone: patient.phone || '',
        email: patient.email || '',
      });
    }
  }, [patient]);

  useEffect(() => {
    if (formData.birth_number.length >= 6) {
      const yy = parseInt(formData.birth_number.slice(0, 2), 10);
      let mm = parseInt(formData.birth_number.slice(2, 4), 10);
      const dd = parseInt(formData.birth_number.slice(4, 6), 10);

      let year = yy + (yy < 50 ? 2000 : 1900);
      if (mm > 50) mm -= 50;

      setFormData(prev => ({
        ...prev,
        birth_date: `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
      }));
    }
  }, [formData.birth_number]);

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      setError('Meno a priezvisko sú povinné');
      return;
    }
    try {
      await axios.put(
        `http://localhost:8000/patients/${patient.id}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError('Nepodarilo sa upraviť pacienta: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <Dialog open={!!patient} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upraviť pacienta</DialogTitle>
      <DialogContent>
        <TextField name="first_name" label="Meno" value={formData.first_name} onChange={handleChange} fullWidth required margin="dense" />
        <TextField name="last_name" label="Priezvisko" value={formData.last_name} onChange={handleChange} fullWidth required margin="dense" />
        <TextField name="birth_number" label="Rodné číslo" value={formData.birth_number} onChange={handleChange} fullWidth margin="dense" />
        <TextField name="birth_date" label="Dátum narodenia" value={formData.birth_date} fullWidth disabled margin="dense" />
        <TextField name="nationality" label="Národnosť" value={formData.nationality} onChange={handleChange} fullWidth margin="dense" />
        <TextField name="insurance" label="Poisťovňa" value={formData.insurance} onChange={handleChange} fullWidth margin="dense" />
        <TextField name="address" label="Bydlisko" value={formData.address} onChange={handleChange} fullWidth margin="dense" />
        <TextField name="phone" label="Telefónne číslo" value={formData.phone} onChange={handleChange} fullWidth margin="dense" />
        <TextField name="email" label="Email" value={formData.email} onChange={handleChange} fullWidth margin="dense" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušiť</Button>
        <Button onClick={handleSubmit} color="primary" variant="contained">
          Uložiť
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditPatientDialog;