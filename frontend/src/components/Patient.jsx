import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Search, Loader2 } from 'lucide-react';
import AddPatientDialog from './AddPatientDialog';
import EditPatientDialog from './EditPatientDialog';
import PatientDetailsDialog from './PatientDetailsDialog';

export default function Patient({ token, setError }) {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(null);
  const [openDetails, setOpenDetails] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/patients/');
      setPatients(res.data);
    } catch { setError('Chyba'); } finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetchData(); }, [token]);

  const filtered = patients.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Pacienti</h2>
          <button onClick={() => setOpenAdd(true)} className="bg-primary text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg">+ Nový pacient</button>
      </div>
      <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
          <input type="text" placeholder="Hľadať pacienta..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-primary/20 outline-none" />
      </div>
      <div className="bg-white rounded-2xl shadow border border-gray-100 divide-y divide-gray-100">
        {filtered.map(p => (
            <div key={p.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <span className="font-bold text-gray-800">{p.first_name} {p.last_name}</span>
                <button onClick={() => setOpenDetails(p)} className="p-2 text-gray-400 hover:text-primary transition-all"><Search size={18} /></button>
            </div>
        ))}
      </div>
      <AddPatientDialog open={openAdd} onClose={() => setOpenAdd(false)} token={token} setError={setError} onSuccess={fetchData} />
      <EditPatientDialog open={!!openEdit} patient={openEdit} onClose={() => setOpenEdit(null)} token={token} onSuccess={fetchData} />
      <PatientDetailsDialog open={!!openDetails} patient={openDetails} onClose={() => setOpenDetails(null)} token={token} />
    </div>
  );
}
