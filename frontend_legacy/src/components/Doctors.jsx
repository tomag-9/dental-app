import React, { useEffect, useMemo, useState } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Button, 
  TextField, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import useNotifier from '../hooks/useNotifier.jsx';
import { api, withError } from '../lib/api';

const Doctors = ({ token, setError }) => {
  const [doctors, setDoctors] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [editDoctor, setEditDoctor] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    title_before: '',
    title_after: '',
    email: '',
    phone: '',
    clinic_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const { notify, Toast } = useNotifier();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [doctorsRes, clinicsRes] = await Promise.all([
        withError(api(token).get('/doctors/'), (m) => setError('Nepodarilo sa načítať lekárov: ' + m)),
        withError(api(token).get('/clinics/'), (m) => setError('Nepodarilo sa načítať kliniky: ' + m)),
      ]);
      setDoctors(doctorsRes?.data ?? []);
      setClinics(clinicsRes?.data ?? []);
      setLoading(false);
    };
    fetchData();
  }, [token, setError]);

  const filteredDoctors = useMemo(
    () =>
      doctors
        .filter((d) => {
          const fullName = `${d.first_name} ${d.last_name}`.toLowerCase();
          return fullName.includes(searchTerm.toLowerCase());
        })
        .sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [doctors, searchTerm]
  );

  const handleOpen = (doctor = null) => {
    setEditDoctor(doctor);
    setFormData(doctor ? {
      first_name: doctor.first_name || '',
      last_name: doctor.last_name || '',
      title_before: doctor.title_before || '',
      title_after: doctor.title_after || '',
      email: doctor.contact_info?.email || '',
      phone: doctor.contact_info?.phone || '',
      clinic_id: doctor.clinic_id || '',
    } : {
      first_name: '',
      last_name: '',
      title_before: '',
      title_after: '',
      email: '',
      phone: '',
      clinic_id: '',
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
    if (!formData.first_name || !formData.last_name) return setError('Meno a priezvisko sú povinné');
    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      title_before: formData.title_before || null,
      title_after: formData.title_after || null,
      contact_info: formData.email || formData.phone ? { email: formData.email, phone: formData.phone } : null,
      clinic_id: formData.clinic_id || null,
    };
    if (editDoctor) {
      const [, err] = await withError(api(token).put(`/doctors/${editDoctor.id}`, payload));
      if (err) return setError('Nepodarilo sa uložiť lekára: ' + err);
      notify('Lekár upravený', 'success');
    } else {
      const [, err] = await withError(api(token).post('/doctors/', payload));
      if (err) return setError('Nepodarilo sa uložiť lekára: ' + err);
      notify('Lekár pridaný', 'success');
    }
    const [ref] = await withError(api(token).get('/doctors/'));
    if (ref) setDoctors(ref.data);
    handleClose();
  };

  const handleDelete = async (id) => {
    const [, err] = await withError(api(token).delete(`/doctors/${id}`));
    if (err) return setError('Nepodarilo sa vymazať lekára: ' + err);
    notify('Lekár vymazaný', 'success');
    const [ref] = await withError(api(token).get('/doctors/'));
    if (ref) setDoctors(ref.data);
  };

  const getClinicName = (clinicId) => {
    const clinic = clinics.find((c) => c.id === clinicId);
    return clinic?.name || '-';
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Lekári
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
          size="large"
        >
          Nový lekár
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Hľadať lekárov"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          </CardContent>
        </Card>
      ) : filteredDoctors.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" align="center">
              Žiadni lekári
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Pridajte svojho prvého lekára.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Meno</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Priezvisko</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Titul pred</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Titul za</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Telefón</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Klinika</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Akcie</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDoctors.map((doctor) => (
                    <TableRow key={doctor.id} hover>
                      <TableCell>{doctor.first_name}</TableCell>
                      <TableCell sx={{ fontWeight: 'medium' }}>{doctor.last_name}</TableCell>
                      <TableCell>{doctor.title_before || '-'}</TableCell>
                      <TableCell>{doctor.title_after || '-'}</TableCell>
                      <TableCell>{doctor.contact_info?.email || '-'}</TableCell>
                      <TableCell>{doctor.contact_info?.phone || '-'}</TableCell>
                      <TableCell>{getClinicName(doctor.clinic_id)}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Tooltip title="Upraviť">
                            <IconButton onClick={() => handleOpen(doctor)} size="small">
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Vymazať">
                            <IconButton onClick={() => setConfirm({ open: true, id: doctor.id })} size="small" color="error">
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editDoctor ? 'Upraviť lekára' : 'Pridať lekára'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField autoFocus fullWidth label="Meno *" value={formData.first_name} onChange={handleChange} name="first_name" required />
            <TextField fullWidth label="Priezvisko *" value={formData.last_name} onChange={handleChange} name="last_name" required />
            <TextField fullWidth label="Titul pred" value={formData.title_before} onChange={handleChange} name="title_before" />
            <TextField fullWidth label="Titul za" value={formData.title_after} onChange={handleChange} name="title_after" />
            <TextField fullWidth label="Email" value={formData.email} onChange={handleChange} name="email" />
            <TextField fullWidth label="Telefón" value={formData.phone} onChange={handleChange} name="phone" />
            <FormControl fullWidth>
              <InputLabel>Klinika</InputLabel>
              <Select
                label="Klinika"
                name="clinic_id"
                value={formData.clinic_id}
                onChange={handleChange}
              >
                <MenuItem value="">Žiadna klinika</MenuItem>
                {clinics.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Zrušiť</Button>
          <Button onClick={handleSave} variant="contained">Uložiť</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirm.open} onClose={() => setConfirm({ open: false, id: null })}>
        <DialogTitle>Potvrdiť vymazanie</DialogTitle>
        <DialogContent>
          <Typography>
            Naozaj chcete vymazať tohto lekára? Túto akciu nie je možné vrátiť.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm({ open: false, id: null })}>Zrušiť</Button>
          <Button 
            onClick={() => {
              handleDelete(confirm.id);
              setConfirm({ open: false, id: null });
            }} 
            variant="contained" 
            color="error"
          >
            Vymazať
          </Button>
        </DialogActions>
      </Dialog>

      <Toast />
    </Box>
  );
};

export default Doctors;
