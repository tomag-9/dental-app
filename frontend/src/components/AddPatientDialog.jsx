import React, { useState } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';

export default function AddPatientDialog({ open, onClose, token, setError, onSuccess }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', birth_number: '' });
  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await api(token).post('/patients/', form); onSuccess(); onClose(); }
    catch { setError('Chyba pri ukladaní'); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Nový pacient">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input placeholder="Meno" required value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="w-full border p-3 rounded-xl" />
        <input placeholder="Priezvisko" required value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="w-full border p-3 rounded-xl" />
        <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg uppercase tracking-widest">Uložiť pacienta</button>
      </form>
    </Modal>
  );
}
