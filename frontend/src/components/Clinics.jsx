import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import { Plus, Edit2, Loader2 } from 'lucide-react';

export default function Clinics({ token, setError }) {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/clinics/');
      setClinics(res.data);
    } catch { setError('Chyba'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetch(); }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await api(token).post('/clinics/', form); setOpenAdd(false); fetch(); }
    catch { setError('Chyba'); }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Kliniky</h2><button onClick={() => setOpenAdd(true)} className="bg-primary text-white px-4 py-2 rounded-xl font-bold">+ Pridať</button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clinics.map(c => (
                <div key={c.id} className="bg-white p-6 rounded-2xl shadow border flex justify-between items-center">
                    <span className="font-bold">{c.name}</span>
                    <button className="text-gray-300 hover:text-primary"><Edit2 size={16}/></button>
                </div>
            ))}
        </div>
        <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Nová klinika">
            <form onSubmit={handleSubmit} className="space-y-4">
                <input placeholder="Názov" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-3 rounded-xl" />
                <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-bold uppercase">Uložiť</button>
            </form>
        </Modal>
    </div>
  );
}
