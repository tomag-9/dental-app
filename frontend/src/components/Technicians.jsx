import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { UserRound, Loader2 } from 'lucide-react';

export default function Technicians({ token, setError }) {
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await api(token).get('/technicians/');
        setTechs(res.data);
      } catch { setError('Chyba'); }
      finally { setLoading(false); }
    };
    if (token) fetch();
  }, [token, setError]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold">Technici</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {techs.map(t => (
                <div key={t.id} className="bg-white p-6 rounded-3xl shadow border text-center">
                    <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><UserRound size={32} /></div>
                    <div className="font-bold text-gray-900">{t.first_name} {t.last_name}</div>
                    <div className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">Zubný technik</div>
                </div>
            ))}
        </div>
    </div>
  );
}
