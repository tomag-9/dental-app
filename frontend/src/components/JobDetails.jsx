import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Hospital, Loader2, Euro } from 'lucide-react';
import ToothMap from './ToothMap';

export default function JobDetails({ token, setError }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await api(token).get(`/jobs/${id}/`);
        setJob(res.data);
      } catch { setError(`Nepodarilo sa načítať detaily.`); }
      finally { setLoading(false); }
    };
    if (id && token) fetch();
  }, [id, token, setError]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
  if (!job) return <div className="p-12 text-center text-gray-500 font-bold">Nenašlo sa.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow border">
          <h2 className="text-2xl font-black uppercase">Práca #{job.id}</h2>
          <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-black font-bold">SPÄŤ</button>
      </div>
      <div className="bg-white p-8 rounded-2xl shadow border space-y-4 font-medium text-gray-700">
          <div className="flex items-center gap-2"><User className="text-primary" size={16}/> Stav: <b>{job.status}</b></div>
          <div className="flex items-center gap-2 text-green-600 font-bold"><Euro size={16}/> Cena: {parseFloat(job.price).toFixed(2)} €</div>
          {job.tooth_procedures && <div className="pt-6 border-t"><h3 className="font-black mb-4 uppercase text-xs tracking-widest">Zubná mapa práce</h3><ToothMap value={job.tooth_procedures} editable={false} /></div>}
      </div>
    </div>
  );
}
