// JobForm.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Grid,
  TextField, MenuItem, Button, Autocomplete, Table, TableHead, TableBody,
  TableRow, TableCell, IconButton, Box
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const JobForm = ({ open, onClose, onSuccess, token, setError, initialData = null }) => {
  const [formData, setFormData] = useState({
    patient_id: '',
    clinic_id: '',
    doctor_id: '',
    technician_id: '',
    procedure_codes: [],
    due_date: '',
    status: '',
    procedure_quantities: {}
  });

  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [procedureOptions, setProcedureOptions] = useState([]);
  const [selectedProcedure, setSelectedProcedure] = useState(null);
  const [quantity, setQuantity] = useState(1);


const totalCost = useMemo(() => {
    return formData.procedure_codes.reduce((sum, code) => {
      const proc = procedureOptions.find(p => p.value === code);
      const qty = formData.procedure_quantities[code] || 1;
      const price = proc?.price || 0; // make sure `price` exists in procedureOptions
      return sum + qty * price;
    }, 0);
  }, [formData.procedure_codes, formData.procedure_quantities, procedureOptions]);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [patientsRes, clinicsRes, doctorsRes, techniciansRes, proceduresRes] = await Promise.all([
          axios.get('http://localhost:8000/patients/', { headers }),
          axios.get('http://localhost:8000/clinics/', { headers }),
          axios.get('http://localhost:8000/doctors/', { headers }),
          axios.get('http://localhost:8000/technicians/', { headers }),
          axios.get('http://localhost:8000/price_list/', { headers }),
        ]);

        setPatients(patientsRes.data);
        setClinics(clinicsRes.data);
        setDoctors(doctorsRes.data);
        setTechnicians(techniciansRes.data);
        setProcedureOptions(
          proceduresRes.data.map(p => ({
            value: p.code,
            label: `${p.code} - ${p.description}`,
            description: p.description,
            price: p.price  // ensure price is included
          }))
        );
      } catch (err) {
        setError('Nepodarilo sa načítať údaje: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };

    fetchData();

    if (initialData) {
      setFormData({
        ...initialData,
        procedure_quantities: initialData.procedure_quantities || {},
        procedure_codes: Object.keys(initialData.procedure_quantities || {})
      });
    } else {
      setFormData({
        patient_id: '',
        clinic_id: '',
        doctor_id: '',
        technician_id: '',
        procedure_codes: [],
        due_date: '',
        status: '',
        procedure_quantities: {}
      });
    }
  }, [open, token, setError, initialData]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddProcedure = () => {
    if (selectedProcedure && quantity > 0) {
      setFormData(prev => {
        const updatedCodes = new Set([...prev.procedure_codes, selectedProcedure.value]);
        return {
          ...prev,
          procedure_codes: Array.from(updatedCodes),
          procedure_quantities: { ...prev.procedure_quantities, [selectedProcedure.value]: quantity }
        };
      });
      setSelectedProcedure(null);
      setQuantity(1);
    }
  };

  const handleRemoveProcedure = (code) => {
    setFormData(prev => ({
      ...prev,
      procedure_codes: prev.procedure_codes.filter(c => c !== code),
      procedure_quantities: Object.fromEntries(
        Object.entries(prev.procedure_quantities).filter(([k]) => k !== code)
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const jobData = {
        ...formData,
        patient_id: parseInt(formData.patient_id) || null,
        clinic_id: parseInt(formData.clinic_id) || null,
        doctor_id: parseInt(formData.doctor_id) || null,
        technician_id: parseInt(formData.technician_id) || null,
        due_date: formData.due_date || null,
        status: formData.status || 'pending',
        procedure_quantities: formData.procedure_quantities
      };

      if (initialData) {
        await axios.put(`http://localhost:8000/jobs/${initialData.id}`, jobData, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post('http://localhost:8000/jobs/', jobData, { headers: { Authorization: `Bearer ${token}` } });
      }

      onSuccess();
    } catch (err) {
      setError('Nepodarilo sa pridať/upraviť prácu: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ fontSize: '1.8rem' }}>
        {initialData ? 'Upraviť prácu' : 'Pridať prácu'}
      </DialogTitle>

      {/* DialogContent without scroll */}
      <DialogContent sx={{ height: '550px', overflow: 'hidden', paddingRight: 0, position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 16,
            border: '1px solid #ddd',
            borderRadius: 1,
            p: 2,
            backgroundColor: '#f9f9f9',
            textAlign: 'center',
            zIndex: 10
          }}
        >
          <Typography variant="subtitle2">Celková cena</Typography>
          <Typography variant="h6">{totalCost.toFixed(2)} €</Typography>
        </Box>
        <Grid container spacing={3}>
          {/* First row */}
          <Grid container item spacing={3}>
            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                label="Pacient"
                name="patient_id"
                value={formData.patient_id}
                onChange={handleChange}
                variant="outlined"
                required
                sx={{ minWidth: 250, mt: 1, '& .MuiInputBase-root': { height: 45 } }}
              >
                <MenuItem value="">Vyberte pacienta</MenuItem>
                {patients.map(patient => (
                  <MenuItem key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name} ({patient.birth_number})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                label="Klinika"
                name="clinic_id"
                value={formData.clinic_id}
                onChange={handleChange}
                variant="outlined"
                required
                sx={{ minWidth: 250, mt: 1, '& .MuiInputBase-root': { height: 45 } }}
              >
                <MenuItem value="">Vyberte kliniku</MenuItem>
                {clinics.map(clinic => (
                  <MenuItem key={clinic.id} value={clinic.id}>{clinic.name}</MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                label="Lekár"
                name="doctor_id"
                value={formData.doctor_id}
                onChange={handleChange}
                variant="outlined"
                required
                sx={{ minWidth: 250, mt: 1, '& .MuiInputBase-root': { height: 45 } }}
              >
                <MenuItem value="">Vyberte lekára</MenuItem>
                {doctors.map(doctor => (
                  <MenuItem key={doctor.id} value={doctor.id}>
                    {doctor.first_name} {doctor.last_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          {/* Second row */}
          <Grid container item spacing={3}>
            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                label="Technik"
                name="technician_id"
                value={formData.technician_id}
                onChange={handleChange}
                variant="outlined"
                required
                sx={{ minWidth: 250, mt: 1, '& .MuiInputBase-root': { height: 45 } }}
              >
                <MenuItem value="">Vyberte technika</MenuItem>
                {technicians.map(technician => (
                  <MenuItem key={technician.id} value={technician.id}>
                    {technician.first_name} {technician.last_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={4}>
              <TextField
                select
                fullWidth
                label="Stav"
                name="status"
                value={formData.status}
                onChange={handleChange}
                variant="outlined"
                sx={{ minWidth: 250, mt: 1, '& .MuiInputBase-root': { height: 45 } }}
              >
                <MenuItem value="">Vyberte stav</MenuItem>
                <MenuItem value="pending">Čakajúce</MenuItem>
                <MenuItem value="in_progress">V priebehu</MenuItem>
                <MenuItem value="completed">Dokončené</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Dátum splatnosti"
                name="due_date"
                type="date"
                value={formData.due_date}
                onChange={handleChange}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 250, mt: 1, '& .MuiInputBase-root': { height: 45 } }}
              />
            </Grid>
          </Grid>

          {/* Third row: procedures */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1.4rem', mt: 2 }}>
              Procedúry
            </Typography>

            <Grid container spacing={2} alignItems="center">
              {/* Search bar much longer */}
              <Grid item xs={15}>
                <Autocomplete
                  options={procedureOptions}
                  value={selectedProcedure}
                  onChange={(e, value) => setSelectedProcedure(value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Vyhľadať procedúru (kód/názov)"
                      variant="outlined"
                      sx={{ minWidth: 350, mt: 1,'& .MuiInputBase-root': { height: 40 } }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={1}>
                <TextField
                  fullWidth
                  label="Počet"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  variant="outlined"
                  inputProps={{ min: 1 }}
                  sx={{width: 100,  '& .MuiInputBase-root': { height: 40 } }}
                />
              </Grid>

              <Grid item xs={1}>
                <Button variant="contained" size="large" onClick={handleAddProcedure} fullWidth>
                  Pridať
                </Button>
              </Grid>
            </Grid>

            {/* Scrollable procedure list only */}
              <Box
                sx={{
                  mt: 2,
                  maxHeight: 210,      // max height of table container
                  overflowY: 'auto',   // enable vertical scrolling
                  border: '1px solid #ddd',
                  borderRadius: 1,
                  display: 'block',    // ensure proper scroll
                }}
              >
                <Table stickyHeader size="small"> {/* stickyHeader helps table header stay visible */}
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Kód</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Názov</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Počet</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Akcia</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {formData.procedure_codes.map((code) => {
                      const proc = procedureOptions.find(p => p.value === code);
                      return (
                        <TableRow key={code} sx={{ height: 40 }}>
                          <TableCell>{code}</TableCell>
                          <TableCell>{proc?.description || ''}</TableCell>
                          <TableCell>{formData.procedure_quantities[code] || 1}</TableCell>
                          <TableCell>
                            <IconButton onClick={() => handleRemoveProcedure(code)} size="small">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>

          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'flex-end', p: 3 }}>
        <Button onClick={onClose} size="large" sx={{ mr: 1 }}>Zrušiť</Button>
        <Button onClick={handleSubmit} variant="contained" size="large">Uložiť</Button>
      </DialogActions>

    </Dialog>
  );
};

export default JobForm;
