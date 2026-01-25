import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User, Lock, Save, Loader2 } from 'lucide-react';

export default function EditProfile({ token, setError }) {
  const [data, setData] = useState({ nickname: '', password: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await api(token).get('/users/me/');
        setData({ nickname: res.data.nickname || '', password: '' });
      } catch { setError('Chyba načítania profilu'); }
      finally { setLoading(false); }
    };
    if (token) fetch();
  }, [token, setError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api(token).put('/users/me/', data);
      alert('Uložené');
    } catch { setError('Chyba uloženia'); }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-black uppercase">Môj profil</h2>
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl shadow border space-y-4">
          <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Prezývka</label><input value={data.nickname} onChange={e => setData({...data, nickname: e.target.value})} className="w-full border rounded-xl p-3" /></div>
          <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nové heslo</label><input type="password" value={data.password} onChange={e => setData({...data, password: e.target.value})} className="w-full border rounded-xl p-3" placeholder="Zadajte len ak chcete zmeniť" /></div>
          <button type="submit" className="w-full bg-primary text-white py-4 rounded-xl font-black shadow-lg">ULOŽIŤ ZMENY</button>
      </form>
    </div>
  );
}
