import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Users, Briefcase, Calendar, Euro, Loader2, TrendingUp } from 'lucide-react';

export default function LabDashboard({ token, setError }) {
  const navigate = useNavigate();
  const [data, setData] = useState({ jobs: [], patients: [], invoices: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [j, p, i] = await Promise.all([api(token).get('/jobs/'), api(token).get('/patients/'), api(token).get('/invoices/')]);
        setData({ jobs: j.data, patients: p.data, invoices: i.data });
      } catch { setError?.('Chyba dashboardu'); }
      finally { setLoading(false); }
    };
    if (token) load();
  }, [token, setError]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-black">Prehľad laboratória</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow border"><h3 className="text-xs font-bold text-gray-400 uppercase">Pacienti</h3><div className="text-3xl font-black">{data.patients.length}</div></div>
          <div className="bg-white p-6 rounded-2xl shadow border border-primary/20"><h3 className="text-xs font-bold text-primary uppercase">Aktívne práce</h3><div className="text-3xl font-black text-primary">{data.jobs.length}</div></div>
          <div className="bg-white p-6 rounded-2xl shadow border"><h3 className="text-xs font-bold text-gray-400 uppercase">Pohľadávky</h3><div className="text-3xl font-black text-orange-600">{data.invoices.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0).toFixed(2)} €</div></div>
      </div>
      <button onClick={() => navigate('/jobs')} className="bg-primary text-white p-4 rounded-2xl font-bold w-full md:w-auto shadow-xl">SPRÁVA PRÁC</button>
    </div>
  );
}
