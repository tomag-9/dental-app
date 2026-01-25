import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Save, Loader2, Building } from 'lucide-react';

export default function LabSettings({ token, setError }) {
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/labs/');
      if (res.data.length > 0) setLab(res.data[0]);
    } catch { setError('Chyba nastavení'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetch(); }, [token]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api(token).put(`/labs/${lab.id}/`, lab);
      alert('Uložené');
    } catch { setError('Chyba uloženia'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;
  if (!lab) return <div className="p-12 text-center text-gray-400 font-bold">Laboratórium sa nenašlo.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-black uppercase flex items-center gap-2"><Building size={24}/> Nastavenia labu</h2>
      <div className="bg-white p-8 rounded-3xl shadow border space-y-4">
          <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Názov laboratória</label><input value={lab.name} onChange={e => setLab({...lab, name: e.target.value})} className="w-full border rounded-xl p-3" /></div>
          <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Adresa</label><input value={lab.address || ''} onChange={e => setLab({...lab, address: e.target.value})} className="w-full border rounded-xl p-3" /></div>
          <button onClick={handleSave} disabled={saving} className="w-full bg-primary text-white py-4 rounded-xl font-black shadow-lg flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin"/> : <Save size={18}/>} ULOŽIŤ NASTAVENIA</button>
      </div>
    </div>
  );
}
