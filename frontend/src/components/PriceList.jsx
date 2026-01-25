import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Edit2, Loader2 } from 'lucide-react';
import Modal from './Modal';

export default function PriceList({ token, setError }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', price: '' });

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/price_list/');
      setItems(res.data);
    } catch { setError('Chyba cenníka'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetch(); }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await api(token).post('/price_list/', form); setOpenAdd(false); fetch(); }
    catch { setError('Chyba uloženia'); }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Cenník</h2><button onClick={() => setOpenAdd(true)} className="bg-primary text-white px-4 py-2 rounded-xl font-bold">+ Nový výkon</button></div>
        <div className="bg-white rounded-2xl shadow border overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400"><tr><th className="p-4">Kód</th><th className="p-4">Popis</th><th className="p-4 text-right">Cena</th></tr></thead>
                <tbody className="divide-y">
                    {items.map(i => (
                        <tr key={i.id} className="hover:bg-gray-50"><td className="p-4 font-black text-primary">{i.code}</td><td className="p-4">{i.description}</td><td className="p-4 text-right font-bold">{parseFloat(i.price).toFixed(2)} €</td></tr>
                    ))}
                </tbody>
            </table>
        </div>
        <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Pridať výkon">
            <form onSubmit={handleSubmit} className="space-y-4">
                <input placeholder="Kód" required value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="w-full border p-3 rounded-xl" />
                <input placeholder="Popis" required value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full border p-3 rounded-xl" />
                <input type="number" step="0.01" placeholder="Cena" required value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="w-full border p-3 rounded-xl" />
                <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-bold uppercase">Uložiť</button>
            </form>
        </Modal>
    </div>
  );
}
