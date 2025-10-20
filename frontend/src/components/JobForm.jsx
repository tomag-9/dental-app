import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Grid,
  TextField, MenuItem, Button, Autocomplete, Table, TableHead, TableBody,
  TableRow, TableCell, IconButton, Box, Stepper, Step, StepLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import ToothMap from './ToothMap';

const JobForm = ({ open, onClose, onSuccess, token, setError, initialData = null }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    patient_id: '',
    clinic_id: '',
    doctor_id: '',
    technician_id: '',
    procedure_codes: [],
    status: '',
    procedure_quantities: {},
    tooth_procedures: {},
  description: '',
  tooth_color: '',
    due_date: null,
    start_date: null,
    end_date: null,
    try_in: null
  });
  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [procedureOptions, setProcedureOptions] = useState([]);
  const [selectedProcedure, setSelectedProcedure] = useState(null);
  const [quantity, setQuantity] = useState(1);
  // const [jobs, setJobs] = useState([]); // For calendar data - unused

  const totalCost = useMemo(() => {
    return formData.procedure_codes.reduce((sum, code) => {
      const proc = procedureOptions.find(p => p.value === code);
      const qty = formData.procedure_quantities[code] || 1;
      const price = proc?.price || 0;
      return sum + qty * price;
    }, 0);
  }, [formData.procedure_codes, formData.procedure_quantities, procedureOptions]);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      try {
        const apiClient = api(token);
        const [patientsRes, clinicsRes, doctorsRes, techniciansRes, proceduresRes] = await Promise.all([
          apiClient.get('/patients/'),
          apiClient.get('/clinics/'),
          apiClient.get('/doctors/'),
          apiClient.get('/technicians/'),
          apiClient.get('/price_list/'),
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
            price: p.price
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
        procedure_codes: Object.keys(initialData.procedure_quantities || {}),
        tooth_procedures: initialData.tooth_procedures || {},
  description: initialData.description || '',
  tooth_color: initialData.tooth_color || '',
        due_date: initialData.due_date ? parseISO(initialData.due_date) : null,
        start_date: initialData.start_date ? parseISO(initialData.start_date) : null,
        end_date: initialData.end_date ? parseISO(initialData.end_date) : null,
        try_in: initialData.try_in ? parseISO(initialData.try_in) : null
      });
    } else {
      setFormData({
        patient_id: '',
        clinic_id: '',
        doctor_id: '',
        technician_id: '',
        procedure_codes: [],
        status: '',
        procedure_quantities: {},
        tooth_procedures: {},
  description: '',
  tooth_color: '',
        due_date: null,
        start_date: null,
        end_date: null,
        try_in: null
      });
    }
  }, [open, token, setError, initialData]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDateChange = (field) => (date) => {
    setFormData(prev => ({ ...prev, [field]: date }));
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
      const apiClient = api(token);
      const jobData = {
        ...formData,
        patient_id: parseInt(formData.patient_id) || null,
        clinic_id: parseInt(formData.clinic_id) || null,
        doctor_id: parseInt(formData.doctor_id) || null,
        technician_id: parseInt(formData.technician_id) || null,
        status: formData.status || 'in_progress',
        procedure_quantities: formData.procedure_quantities,
        tooth_procedures: formData.tooth_procedures,
  description: formData.description,
  tooth_color: formData.tooth_color || null,
        due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : null,
        start_date: formData.start_date ? format(formData.start_date, 'yyyy-MM-dd') : null,
        end_date: formData.end_date ? format(formData.end_date, 'yyyy-MM-dd') : null,
        try_in: formData.try_in ? format(formData.try_in, 'yyyy-MM-dd') : null
      };

      // Save the job
      if (initialData) {
        await apiClient.put(`/jobs/${initialData.id}`, jobData);
      } else {
        await apiClient.post('/jobs/', jobData);
      }

      // Update patient's cumulative tooth map if tooth_procedures were modified
      if (formData.tooth_procedures && Object.keys(formData.tooth_procedures).length > 0) {
        const patientId = parseInt(formData.patient_id);
        if (patientId) {
          try {
            // Fetch current patient data
            const patientRes = await apiClient.get(`/patients/${patientId}`);
            const currentToothProcedures = patientRes.data.tooth_procedures || {};
            // Merge with new tooth procedures (new ones override old ones for the same tooth)
            const updatedToothProcedures = { ...currentToothProcedures, ...formData.tooth_procedures };
            // Update patient with merged tooth map
            await apiClient.put(`/patients/${patientId}`, {
              ...patientRes.data,
              tooth_procedures: updatedToothProcedures
            });
          } catch (patientErr) {
            // Don't fail the whole operation if patient update fails
          }
        }
      }

      onSuccess();
    } catch (err) {
      setError('Nepodarilo sa pridať/upraviť prácu: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const steps = ['Základné údaje', 'Zubná mapa', 'Procedúry', 'Plánovanie'];

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
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
                  label="Odtieň zuba"
                  name="tooth_color"
                  value={formData.tooth_color}
                  onChange={handleChange}
                  variant="outlined"
                  sx={{ minWidth: 250, mt: 1, '& .MuiInputBase-root': { height: 45 } }}
                >
                  <MenuItem value="">Vyberte odtieň</MenuItem>
                  {['A','B','C','D'].flatMap(letter => [1,2,3,4].map(num => (
                    <MenuItem key={`${letter}${num}`} value={`${letter}${num}`}>{`${letter}${num}`}</MenuItem>
                  )))}
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
                  <MenuItem value="in_progress">V priebehu</MenuItem>
                  <MenuItem value="finished_unfactured">Dokončené - Nezafakturované</MenuItem>
                  <MenuItem value="finished_factured">Dokončené - Zafakturované</MenuItem>
                  <MenuItem value="closed">Zatvorené</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Grid>
        );
      case 1:
        // Tooth Map step for technicians
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Zubná mapa (pre technikov: implantát, korunka)
              </Typography>
                <ToothMap
                  editable
                  value={formData.tooth_procedures}
                  onChange={(newMap) => {
                    setFormData((prev) => ({ ...prev, tooth_procedures: newMap }));
                  }}
                  allowedProcedures={[{ code: 'I', label: 'Implantát' }, { code: 'K', label: 'Korunka' }]}
                />
            </Grid>
          </Grid>
        );
      case 2:
        return (
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: '1.4rem', mt: 2 }}>
              Procedúry
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={5}>
                <Autocomplete
                  options={procedureOptions}
                  value={selectedProcedure}
                  onChange={(e, value) => setSelectedProcedure(value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Vyhľadať procedúru (kód/názov)"
                      variant="outlined"
                      sx={{ minWidth: 350, mt: 1, '& .MuiInputBase-root': { height: 40 } }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={2}>
                <TextField
                  fullWidth
                  label="Počet"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  variant="outlined"
                  inputProps={{ min: 1 }}
                  sx={{ width: 100, '& .MuiInputBase-root': { height: 40 } }}
                />
              </Grid>
              <Grid item xs={2}>
                <Button variant="contained" size="large" onClick={handleAddProcedure} fullWidth>
                  Pridať
                </Button>
              </Grid>
            </Grid>
            <Box
              sx={{
                mt: 2,
                maxHeight: 210,
                overflowY: 'auto',
                border: '1px solid #ddd',
                borderRadius: 1,
                display: 'block',
              }}
            >
              <Table stickyHeader size="small">
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
            <Box
              sx={{
                position: 'absolute',
                top: 70,
                right: 5,
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
            <Box
              sx={{
                position: 'absolute',
                top: 70,
                right: 200,
                border: '1px solid #ddd',
                borderRadius: 1,
                p: 2,
                backgroundColor: '#f9f9f9',
                textAlign: 'center',
                zIndex: 10,
                maxHeight: 100,
                overflowY: 'auto',
              }}
            >
              <TextField
                fullWidth
                label="Popis (technické poznámky)"
                name="description"
                value={formData.description}
                onChange={handleChange}
                variant="outlined"
                multiline
                rows={3}
                sx={{ width: 300, mt: 2, '& .MuiInputBase-root': { height: 'auto' } }}
              />
            </Box>
          </Grid>
        );
      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom sx={{ fontSize: '1.4rem', mt: 2 }}>
                Plánovanie
              </Typography>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <DatePicker
                      label="Deadline"
                      value={formData.due_date}
                      onChange={handleDateChange('due_date')}
                      renderInput={(params) => <TextField {...params} fullWidth sx={{ mt: 1, '& .MuiInputBase-root': { height: 45 } }} />}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <DatePicker
                      label="Začiatok"
                      value={formData.start_date || new Date()}
                      onChange={handleDateChange('start_date')}
                      renderInput={(params) => <TextField {...params} fullWidth sx={{ mt: 1, '& .MuiInputBase-root': { height: 45 } }} />}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <DatePicker
                      label="Koniec"
                      value={formData.end_date}
                      onChange={handleDateChange('end_date')}
                      renderInput={(params) => <TextField {...params} fullWidth sx={{ mt: 1, '& .MuiInputBase-root': { height: 45 } }} />}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <DatePicker
                      label="Try-in"
                      value={formData.try_in}
                      onChange={handleDateChange('try_in')}
                      renderInput={(params) => <TextField {...params} fullWidth sx={{ mt: 1, '& .MuiInputBase-root': { height: 45 } }} />}
                    />
                  </Grid>
                </Grid>
              </LocalizationProvider>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="h6" gutterBottom sx={{ fontSize: '1.4rem', mt: 2 }}>
                Do tejto sekcie pribudne kalendárna časť...
              </Typography>
            </Grid>
          </Grid>
        );
      default:
        return null;
    }
  };

  // const getStatusDisplay = (status) => {
  //   switch (status) {
  //     case 'in_progress': return 'V priebehu';
  //     case 'finished_unfactured': return 'Dokončené - Nezafakturované';
  //     case 'finished_factured': return 'Dokončené - Zafakturované';
  //     case 'closed': return 'Zatvorené';
  //     default: return status;
  //   }
  // };

  const handleNext = () => {
    if (activeStep === 1 && formData.procedure_codes.length === 0) {
      setError('Prosím pridajte aspoň jednu procedúru.');
      return;
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleReset} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ fontSize: '1.8rem' }}>
        {initialData ? 'Upraviť prácu' : 'Pridať prácu'}
      </DialogTitle>
      <DialogContent sx={{ height: '600px', overflow: 'hidden', paddingRight: 0, position: 'relative' }}>
        <Stepper activeStep={activeStep} sx={{ pt: 2, pb: 2, mb: 2, '& .MuiStepLabel-root': { fontSize: '0.9rem' } }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {getStepContent(activeStep)}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', p: 3 }}>
        <Box>
          {activeStep === 0 ? (
            <Button onClick={handleReset} size="large">Zrušiť</Button>
          ) : (
            <Button onClick={handleBack} size="large" sx={{ mr: 1 }}>Späť</Button>
          )}
        </Box>
        <Box>
          {activeStep === steps.length - 1 ? (
            <Button onClick={handleSubmit} variant="contained" size="large">Uložiť</Button>
          ) : (
            <Button variant="contained" size="large" onClick={handleNext}>Ďalej</Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default JobForm;