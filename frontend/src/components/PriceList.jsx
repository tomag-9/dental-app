import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Tag, Loader2, Edit2, Trash2, Search, Euro } from 'lucide-react';
import Modal from './Modal';

export default function PriceList({ token, setError }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ code: '', description: '', price: '' });

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/price_list/');
      setItems(res.data);
    } catch { setError('Chyba pri načítaní cenníka'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetch(); }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        await api(token).post('/price_list/', formData);
        setOpenAdd(false);
        setFormData({ code: '', description: '', price: '' });
        fetch();
    } catch { setError('Chyba pri ukladaní'); }
  };

  const filteredItems = items.filter(i =>
    i.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <span className="font-black text-gray-300 uppercase tracking-widest text-sm">Načítavam cenník</span>
    </div>
  );

  return (
    <div className="space-y-12">
        <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
            <div className="space-y-1">
                <h2 className="text-5xl font-black text-gray-900 tracking-tighter italic">Cenník<span className="text-primary">.</span></h2>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Správa výkonov a materiálov</p>
            </div>
            <button
                onClick={() => setOpenAdd(true)}
                className="group px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/30 hover:bg-opacity-90 transition-all flex items-center gap-3 text-sm tracking-widest"
            >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                PRIDAŤ POLOŽKU
            </button>
        </div>

        <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input
                type="text"
                placeholder="Hľadať v cenníku podľa kódu alebo popisu..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-[1.5rem] shadow-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold text-gray-700"
            />
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        <tr>
                            <th className="px-10 py-6">Kód</th>
                            <th className="px-10 py-6">Popis výkonu / materiálu</th>
                            <th className="px-10 py-6 text-right">Cena (€)</th>
                            <th className="px-10 py-6 text-right">Akcie</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium">
                        {filteredItems.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-10 py-6">
                                    <span className="font-black text-primary text-sm tracking-tight">{item.code}</span>
                                </td>
                                <td className="px-10 py-6">
                                    <span className="text-gray-800 font-bold">{item.description}</span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <span className="font-black text-gray-900 italic">{parseFloat(item.price).toFixed(2)} €</span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 text-gray-300 hover:text-primary transition-colors"><Edit2 size={16}/></button>
                                        <button className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Pridať do cenníka">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Interný kód</label>
                    <input required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-primary/10 font-black text-primary" placeholder="napr. M001" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Popis výkonu</label>
                    <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-primary/10 min-h-[100px]" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Základná cena (€)</label>
                    <div className="relative">
                        <Euro className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                        <input type="number" step="0.01" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 pl-12 outline-none focus:ring-4 focus:ring-primary/10 font-black" />
                    </div>
                </div>
                <div className="pt-4">
                    <button type="submit" className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-opacity-90 transition-all uppercase tracking-widest text-xs">ULOŽIŤ DO CENNÍKA</button>
                </div>
            </form>
        </Modal>
    </div>
  );
}
