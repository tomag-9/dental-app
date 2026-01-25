import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Package, Plus, AlertTriangle, Search, Loader2, Trash2 } from 'lucide-react';
import Modal from './Modal';

export default function StorageItems({ token, setError }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openAdd, setOpenAdd] = useState(false);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({ name: '', quantity: 0, unit: 'pcs', min_threshold: 0 });

    const fetchItems = async () => {
        try {
            setLoading(true);
            const res = await api(token).get('/warehouse/');
            setItems(res.data);
        } catch { setError('Chyba pri načítaní skladu'); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (token) fetchItems(); }, [token]);

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await api(token).post('/warehouse/', formData);
            setOpenAdd(false);
            setFormData({ name: '', quantity: 0, unit: 'pcs', min_threshold: 0 });
            fetchItems();
        } catch { alert('Chyba pri ukladaní.'); }
    };

    const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={32} /></div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Package size={24} /></div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Skladové zásoby</h2>
                </div>
                <button onClick={() => setOpenAdd(true)} className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-all">
                    <Plus size={20} /> Pridať položku
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-50 bg-gray-50/30">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Hľadať v sklade..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                    </div>
                </div>

                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Názov položky</th>
                            <th className="px-6 py-4">Množstvo</th>
                            <th className="px-6 py-4">Stav</th>
                            <th className="px-6 py-4 text-right">Akcie</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredItems.map(item => {
                            const isLow = item.min_threshold && item.quantity <= item.min_threshold;
                            return (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 font-black text-gray-700">
                                            {item.quantity} <span className="text-xs font-medium text-gray-400">{item.unit}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isLow ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-100 uppercase"><AlertTriangle size={10} /> Nízky stav</span> : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold border border-green-100 uppercase">Skladom</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white transition-all"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Pridať do skladu" maxWidth="max-w-md">
                <form onSubmit={handleAdd} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Názov materiálu *</label>
                        <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Množstvo</label>
                            <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Jednotka</label>
                            <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2" />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg uppercase text-sm tracking-widest mt-4">Uložiť položku</button>
                </form>
            </Modal>
        </div>
    );
}
