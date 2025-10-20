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
  Alert,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import useNotifier from '../hooks/useNotifier.jsx';
import { api, withError } from '../lib/api';

const Clinics = ({ token, setError }) => {
  const [clinics, setClinics] = useState([]);
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
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const { notify, Toast } = useNotifier();

  useEffect(() => {
    const fetchClinics = async () => {
      setLoading(true);
      const [res] = await withError(api(token).get('/clinics/'), (m) => setError('Nepodarilo sa načítať kliniky: ' + m));
      setClinics(res?.data ?? []);
      setLoading(false);
    };
    fetchClinics();
  }, [token, setError]);

  const filteredClinics = useMemo(
    () =>
      clinics
        .filter((c) => c.name?.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clinics, searchTerm]
  );

  const handleOpen = (clinic = null) => {
    setEditClinic(clinic);
    setFormData(
      clinic
        ? {
            name: clinic.name || '',
            ico: clinic.ico || '',
            dic: clinic.dic || '',
            address: clinic.address || '',
            bank_details: clinic.bank_details || '',
            email: clinic.contact_info?.email || '',
            phone: clinic.contact_info?.phone || '',
          }
        : { name: '', ico: '', dic: '', address: '', bank_details: '', email: '', phone: '' }
    );
    setOpen(true);
  };
  
  const handleClose = () => {
    setOpen(false);
    setEditClinic(null);
  };
  
  const handleChange = (e) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!formData.name) return setError('Názov je povinný');
    const payload = {
      ...formData,
      contact_info: formData.email || formData.phone ? { email: formData.email, phone: formData.phone } : null,
    };
    if (editClinic) {
      const [, err] = await withError(api(token).put(`/clinics/${editClinic.id}`, payload));
      if (err) return setError('Nepodarilo sa uložiť kliniku: ' + err);
      notify('Klinika upravená', 'success');
    } else {
      const [, err] = await withError(api(token).post('/clinics/', payload));
      if (err) return setError('Nepodarilo sa uložiť kliniku: ' + err);
      notify('Klinika pridaná', 'success');
    }
    const [ref] = await withError(api(token).get('/clinics/'));
    if (ref) setClinics(ref.data);
    handleClose();
  };

  const handleDelete = async (id) => {
    const [, err] = await withError(api(token).delete(`/clinics/${id}`));
    if (err) return setError('Nepodarilo sa vymazať kliniku: ' + err);
    notify('Klinika vymazaná', 'success');
    const [ref] = await withError(api(token).get('/clinics/'));
    if (ref) setClinics(ref.data);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Kliniky
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
          size="large"
        >
          Nová klinika
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Hľadať kliniky"
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
      ) : filteredClinics.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" align="center">
              Žiadne kliniky
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Pridajte svoju prvú kliniku.
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
                    <TableCell sx={{ fontWeight: 'bold' }}>Názov</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>IČO</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>DIČ</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Adresa</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Bankové údaje</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Telefón</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Akcie</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredClinics.map((clinic) => (
                    <TableRow key={clinic.id} hover>
                      <TableCell sx={{ fontWeight: 'medium' }}>{clinic.name}</TableCell>
                      <TableCell>{clinic.ico || '-'}</TableCell>
                      <TableCell>{clinic.dic || '-'}</TableCell>
                      <TableCell>{clinic.address || '-'}</TableCell>
                      <TableCell>{clinic.bank_details || '-'}</TableCell>
                      <TableCell>{clinic.contact_info?.email || '-'}</TableCell>
                      <TableCell>{clinic.contact_info?.phone || '-'}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Tooltip title="Upraviť">
                            <IconButton onClick={() => handleOpen(clinic)} size="small">
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Vymazať">
                            <IconButton onClick={() => setConfirm({ open: true, id: clinic.id })} size="small" color="error">
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
        <DialogTitle>{editClinic ? 'Upraviť kliniku' : 'Pridať kliniku'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField autoFocus fullWidth label="Názov" value={formData.name} onChange={handleChange} name="name" required />
            <TextField fullWidth label="IČO" value={formData.ico} onChange={handleChange} name="ico" />
            <TextField fullWidth label="DIČ" value={formData.dic} onChange={handleChange} name="dic" />
            <TextField fullWidth label="Adresa" value={formData.address} onChange={handleChange} name="address" />
            <TextField fullWidth label="Bankové údaje" value={formData.bank_details} onChange={handleChange} name="bank_details" />
            <TextField fullWidth label="Email" value={formData.email} onChange={handleChange} name="email" />
            <TextField fullWidth label="Telefón" value={formData.phone} onChange={handleChange} name="phone" />
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
            Naozaj chcete vymazať túto kliniku? Túto akciu nie je možné vrátiť.
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

export default Clinics;
