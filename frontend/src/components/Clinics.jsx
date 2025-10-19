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
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { notify, Toast } = useNotifier();

  useEffect(() => {
    const fetchClinics = async () => {
      setLoading(true);
      const [res] = await withError(api(token).get('/clinics/'), (m) => setError('Nepodarilo sa načítať kliniky: ' + m));
      if (res) setClinics(res.data);
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

  const pagedClinics = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClinics.slice(start, start + pageSize);
  }, [filteredClinics, page]);

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
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Kliniky
        </Typography>
        <Fab color="primary" aria-label="add" onClick={() => handleOpen()} size="medium">
          <AddIcon />
        </Fab>
      </Box>

      <Card sx={{ mb: 2 }}>
        <Input label="Hľadať kliniky" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </Card>

      {loading ? (
        <Card>
          <Spinner />
        </Card>
      ) : filteredClinics.length === 0 ? (
        <Card>
          <EmptyState title="Žiadne kliniky" description="Pridajte svoju prvú kliniku." />
        </Card>
      ) : (
        <Card>
          <Table
            columns={[
              { label: 'Názov' },
              { label: 'IČO' },
              { label: 'DIČ' },
              { label: 'Adresa' },
              { label: 'Bankové údaje' },
              { label: 'Email' },
              { label: 'Telefón' },
              { label: 'Akcie', align: 'right' },
            ]}
            rows={pagedClinics}
            renderRow={(clinic) => (
              <TableRow key={clinic.id} hover>
                <TableCell>{clinic.name}</TableCell>
                <TableCell>{clinic.ico || '-'}</TableCell>
                <TableCell>{clinic.dic || '-'}</TableCell>
                <TableCell>{clinic.address || '-'}</TableCell>
                <TableCell>{clinic.bank_details || '-'}</TableCell>
                <TableCell>{clinic.contact_info?.email || '-'}</TableCell>
                <TableCell>{clinic.contact_info?.phone || '-'}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpen(clinic)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => setConfirm({ open: true, id: clinic.id })} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            )}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Pagination count={Math.ceil(filteredClinics.length / pageSize)} page={page} onChange={(_, v) => setPage(v)} />
          </Box>
        </Card>
      )}

      <Modal
        open={open}
        onClose={handleClose}
        title={editClinic ? 'Upraviť kliniku' : 'Pridať kliniku'}
        actions={[
          <Button key="cancel" onClick={handleClose}>
            Zrušiť
          </Button>,
          <Button key="save" onClick={handleSave} variant="contained">
            Uložiť
          </Button>,
        ]}
      >
        <Input autoFocus label="Názov" value={formData.name} onChange={handleChange} name="name" required />
        <Input label="IČO" value={formData.ico} onChange={handleChange} name="ico" />
        <Input label="DIČ" value={formData.dic} onChange={handleChange} name="dic" />
        <Input label="Adresa" value={formData.address} onChange={handleChange} name="address" />
        <Input label="Bankové údaje" value={formData.bank_details} onChange={handleChange} name="bank_details" />
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
        description="Naozaj chcete vymazať túto kliniku? Túto akciu nie je možné vrátiť."
        confirmText="Vymazať"
      />

      <Toast />
    </Box>
  );
};

export default Clinics;
