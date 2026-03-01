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
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import useNotifier from '../hooks/useNotifier.jsx';
import { api, withError } from '../lib/api';

const Technicians = ({ token, setError }) => {
  const [technicians, setTechnicians] = useState([]);
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
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, id: null });
  const { notify, Toast } = useNotifier();

  useEffect(() => {
    const fetchTechnicians = async () => {
      setLoading(true);
      const [res] = await withError(api(token).get('/technicians/'), (m) => setError('Nepodarilo sa načítať technikov: ' + m));
      setTechnicians(res?.data ?? []);
      setLoading(false);
    };
    fetchTechnicians();
  }, [token, setError]);

  const filteredTechnicians = useMemo(
    () =>
      technicians
        .filter((t) => {
          const fullName = `${t.first_name} ${t.last_name}`.toLowerCase();
          return fullName.includes(searchTerm.toLowerCase());
        })
        .sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [technicians, searchTerm]
  );

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
    if (!formData.first_name || !formData.last_name) return setError('Meno a priezvisko sú povinné');
    const payload = {
      ...formData,
      contact_info: formData.email || formData.phone ? { email: formData.email, phone: formData.phone } : null
    };
    if (editTechnician) {
      const [, err] = await withError(api(token).put(`/technicians/${editTechnician.id}`, payload));
      if (err) return setError('Nepodarilo sa uložiť technika: ' + err);
      notify('Technik upravený', 'success');
    } else {
      const [, err] = await withError(api(token).post('/technicians/', payload));
      if (err) return setError('Nepodarilo sa uložiť technika: ' + err);
      notify('Technik pridaný', 'success');
    }
    const [ref] = await withError(api(token).get('/technicians/'));
    if (ref) setTechnicians(ref.data);
    handleClose();
  };

  const handleDelete = async (id) => {
    const [, err] = await withError(api(token).delete(`/technicians/${id}`));
    if (err) return setError('Nepodarilo sa vymazať technika: ' + err);
    notify('Technik vymazaný', 'success');
    const [ref] = await withError(api(token).get('/technicians/'));
    if (ref) setTechnicians(ref.data);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Technici
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpen()}
          size="large"
        >
          Nový technik
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Hľadať technikov"
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
      ) : filteredTechnicians.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" color="text.secondary" align="center">
              Žiadni technici
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Pridajte svojho prvého technika.
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
                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Akcie</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTechnicians.map((technician) => (
                    <TableRow key={technician.id} hover>
                      <TableCell>{technician.first_name}</TableCell>
                      <TableCell sx={{ fontWeight: 'medium' }}>{technician.last_name}</TableCell>
                      <TableCell>{technician.title_before || '-'}</TableCell>
                      <TableCell>{technician.title_after || '-'}</TableCell>
                      <TableCell>{technician.contact_info?.email || '-'}</TableCell>
                      <TableCell>{technician.contact_info?.phone || '-'}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Tooltip title="Upraviť">
                            <IconButton onClick={() => handleOpen(technician)} size="small">
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Vymazať">
                            <IconButton onClick={() => setConfirm({ open: true, id: technician.id })} size="small" color="error">
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
        <DialogTitle>{editTechnician ? 'Upraviť technika' : 'Pridať technika'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField autoFocus fullWidth label="Meno *" value={formData.first_name} onChange={handleChange} name="first_name" required />
            <TextField fullWidth label="Priezvisko *" value={formData.last_name} onChange={handleChange} name="last_name" required />
            <TextField fullWidth label="Titul pred" value={formData.title_before} onChange={handleChange} name="title_before" />
            <TextField fullWidth label="Titul za" value={formData.title_after} onChange={handleChange} name="title_after" />
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
            Naozaj chcete vymazať tohto technika? Túto akciu nie je možné vrátiť.
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

export default Technicians;