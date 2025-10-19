import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, IconButton, Fab, Pagination, TableRow, TableCell } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Card from './ui/Card';
import Table from './ui/Table';
import Input from './ui/Input';
import Select from './ui/Select';
import Button from './ui/Button';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Spinner from './ui/Spinner';
import EmptyState from './ui/EmptyState';
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
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { notify, Toast } = useNotifier();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [doctorsRes, clinicsRes] = await Promise.all([
        withError(api(token).get('/doctors/'), (m) => setError('Nepodarilo sa načítať lekárov: ' + m)),
        withError(api(token).get('/clinics/'), (m) => setError('Nepodarilo sa načítať kliniky: ' + m)),
      ]);
      if (doctorsRes) setDoctors(doctorsRes.data);
      if (clinicsRes) setClinics(clinicsRes.data);
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

  const pagedDoctors = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDoctors.slice(start, start + pageSize);
  }, [filteredDoctors, page]);

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
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Lekári
        </Typography>
        <Fab color="primary" aria-label="add" onClick={() => handleOpen()} size="medium">
          <AddIcon />
        </Fab>
      </Box>

      <Card sx={{ mb: 2 }}>
        <Input label="Hľadať lekárov" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </Card>

      {loading ? (
        <Card>
          <Spinner />
        </Card>
      ) : filteredDoctors.length === 0 ? (
        <Card>
          <EmptyState title="Žiadni lekári" description="Pridajte svojho prvého lekára." />
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
              { label: 'Klinika' },
              { label: 'Akcie', align: 'right' },
            ]}
            rows={pagedDoctors}
            renderRow={(doctor) => (
              <TableRow key={doctor.id} hover>
                <TableCell>{doctor.first_name}</TableCell>
                <TableCell>{doctor.last_name}</TableCell>
                <TableCell>{doctor.title_before || '-'}</TableCell>
                <TableCell>{doctor.title_after || '-'}</TableCell>
                <TableCell>{doctor.contact_info?.email || '-'}</TableCell>
                <TableCell>{doctor.contact_info?.phone || '-'}</TableCell>
                <TableCell>{getClinicName(doctor.clinic_id)}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpen(doctor)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => setConfirm({ open: true, id: doctor.id })} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            )}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Pagination count={Math.ceil(filteredDoctors.length / pageSize)} page={page} onChange={(_, v) => setPage(v)} />
          </Box>
        </Card>
      )}

      <Modal
        open={open}
        onClose={handleClose}
        title={editDoctor ? 'Upraviť lekára' : 'Pridať lekára'}
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
        <Select
          label="Klinika"
          name="clinic_id"
          value={formData.clinic_id}
          onChange={handleChange}
          items={[
            { value: '', label: 'Žiadna klinika' },
            ...clinics.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </Modal>

      <ConfirmDialog
        open={confirm.open}
        onCancel={() => setConfirm({ open: false, id: null })}
        onConfirm={() => {
          handleDelete(confirm.id);
          setConfirm({ open: false, id: null });
        }}
        description="Naozaj chcete vymazať tohto lekára? Túto akciu nie je možné vrátiť."
        confirmText="Vymazať"
      />

      <Toast />
    </Box>
  );
};

export default Doctors;