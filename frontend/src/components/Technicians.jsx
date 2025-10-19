import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, IconButton, Fab, Pagination, TableRow, TableCell } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Card from './ui/Card';
import Table from './ui/Table';
import Input from './ui/Input';
import Button from './ui/Button';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';
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
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { notify, Toast } = useNotifier();

  useEffect(() => {
    const fetchTechnicians = async () => {
      setLoading(true);
      const [res] = await withError(api(token).get('/technicians/'), (m) => setError('Nepodarilo sa načítať technikov: ' + m));
      if (res) setTechnicians(res.data);
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

  const pagedTechnicians = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTechnicians.slice(start, start + pageSize);
  }, [filteredTechnicians, page]);

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
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Technici
        </Typography>
        <Fab color="primary" aria-label="add" onClick={() => handleOpen()} size="medium">
          <AddIcon />
        </Fab>
      </Box>

      <Card sx={{ mb: 2 }}>
        <Input label="Hľadať technikov" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </Card>

      {loading ? (
        <Card>
          <Spinner />
        </Card>
      ) : filteredTechnicians.length === 0 ? (
        <Card>
          <EmptyState title="Žiadni technici" description="Pridajte svojho prvého technika." />
        </Card>
      ) : (
        <Card>
          <Table
            columns={[
              { label: 'Meno' },
              { label: 'Priezvisko' },
              { label: 'Titul pred' },
              { label: 'Titul za' },
              { label: 'Email' },
              { label: 'Telefón' },
              { label: 'Akcie', align: 'right' },
            ]}
            rows={pagedTechnicians}
            renderRow={(technician) => (
              <TableRow key={technician.id} hover>
                <TableCell>{technician.first_name}</TableCell>
                <TableCell>{technician.last_name}</TableCell>
                <TableCell>{technician.title_before || '-'}</TableCell>
                <TableCell>{technician.title_after || '-'}</TableCell>
                <TableCell>{technician.contact_info?.email || '-'}</TableCell>
                <TableCell>{technician.contact_info?.phone || '-'}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpen(technician)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => setConfirm({ open: true, id: technician.id })} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            )}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Pagination count={Math.ceil(filteredTechnicians.length / pageSize)} page={page} onChange={(_, v) => setPage(v)} />
          </Box>
        </Card>
      )}

      <Modal
        open={open}
        onClose={handleClose}
        title={editTechnician ? 'Upraviť technika' : 'Pridať technika'}
        actions={[
          <Button key="cancel" onClick={handleClose}>
            Zrušiť
          </Button>,
          <Button key="save" onClick={handleSave} variant="contained">
            Uložiť
          </Button>,
        ]}
      >
        <Input autoFocus label="Meno *" value={formData.first_name} onChange={handleChange} name="first_name" required />
        <Input label="Priezvisko *" value={formData.last_name} onChange={handleChange} name="last_name" required />
        <Input label="Titul pred" value={formData.title_before} onChange={handleChange} name="title_before" />
        <Input label="Titul za" value={formData.title_after} onChange={handleChange} name="title_after" />
        <Input label="Email" value={formData.email} onChange={handleChange} name="email" />
        <Input label="Telefón" value={formData.phone} onChange={handleChange} name="phone" />
      </Modal>

      <ConfirmDialog
        open={confirm.open}
        onCancel={() => setConfirm({ open: false, id: null })}
        onConfirm={() => {
          handleDelete(confirm.id);
          setConfirm({ open: false, id: null });
        }}
        description="Naozaj chcete vymazať tohto technika? Túto akciu nie je možné vrátiť."
        confirmText="Vymazať"
      />

      <Toast />
    </Box>
  );
};

export default Technicians;