import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Stethoscope, Loader2, Edit2 } from 'lucide-react';
import Modal from './Modal';

export default function Doctors({ token, setError }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/doctors/');
      setDoctors(res.data);
    } catch { setError('Chyba'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetch(); }, [token]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Lekári</h2><button onClick={() => setOpenAdd(true)} className="bg-primary text-white px-4 py-2 rounded-xl font-bold">+ Pridať</button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map(d => (
                <div key={d.id} className="bg-white p-6 rounded-2xl shadow border flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Stethoscope size={20}/></div>
                    <span className="font-bold">{d.first_name} {d.last_name}</span>
                </div>
            ))}
        </div>
        <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Nový lekár"><p className="text-gray-400 italic">Pripravujeme...</p></Modal>
    </div>
  );
}
