import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import ToothMap from './ToothMap';
export default function JobForm({ open, onClose, onSuccess, token, setError, initialData }) {
  const [form, setForm] = useState({ patient: '', clinic: '', doctor: '', technician: '', status: 'in_progress' });
  const [patients, setPatients] = useState([]);
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api(token).get('/patients/'); setPatients(res.data);
        if (initialData) setForm(initialData);
      } catch { setError('Chyba'); }
    };
    if (open) fetch();
  }, [open, token, initialData, setError]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (initialData) await api(token).put(`/jobs/${initialData.id}/`, form);
      else await api(token).post('/jobs/', form);
      onSuccess();
    } catch { setError('Chyba'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Práca">
      <form onSubmit={handleSubmit} className="space-y-4">
        <select value={form.patient} onChange={e => setForm({...form, patient: e.target.value})} className="w-full border p-2 rounded">
          <option value="">Pacient</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
        </select>
        <button type="submit" className="w-full bg-primary text-white p-2 rounded font-bold">ULOŽIŤ PRÁCU</button>
      </form>
    </Modal>
  );
}
