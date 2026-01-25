import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Edit2 } from 'lucide-react';

export default function JobList({ jobs, patients, token, setError, onEdit }) {
  const [, setPriceList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const fetch = async () => {
      try { const res = await api(token).get('/price_list/'); setPriceList(res.data); }
      catch { setError('Chyba cenníka'); }
    };
    if (token) fetch();
  }, [token, setError]);
  const filtered = jobs.filter(j => {
    const p = patients.find(pat => pat.id === j.patient);
    const name = p ? `${p.first_name} ${p.last_name}` : '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });
  return (
    <div className="bg-white rounded-2xl shadow border overflow-hidden">
      <div className="p-4 border-b bg-gray-50/50"><input type="text" placeholder="Hľadať v prácach..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border rounded-xl p-2" /></div>
      <div className="divide-y">
        {['in_progress', 'finished_unfactured'].map(status => (
          <div key={status} className="p-4"><h3 className="font-bold uppercase text-xs text-gray-400 mb-2">{status}</h3>
            {filtered.filter(j => j.status === status).map(j => (
              <div key={j.id} className="flex justify-between items-center py-2 border-t first:border-0"><span className="font-bold text-gray-800">#{j.id}</span><button onClick={() => onEdit(j)} className="text-gray-400 hover:text-primary"><Edit2 size={14} /></button></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
