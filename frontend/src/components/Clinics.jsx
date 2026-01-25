import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Building2, Loader2, Edit2, MapPin, Phone, Globe } from 'lucide-react';
import Modal from './Modal';

export default function Clinics({ token, setError }) {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', city: '', phone: '' });

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/clinics/');
      setClinics(res.data);
    } catch { setError('Chyba pri načítaní kliník'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetch(); }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        await api(token).post('/clinics/', formData);
        setOpenAdd(false);
        setFormData({ name: '', address: '', city: '', phone: '' });
        fetch();
    } catch { setError('Chyba pri ukladaní'); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <span className="font-black text-gray-300 uppercase tracking-widest text-sm">Načítavam zoznam kliník</span>
    </div>
  );

  return (
    <div className="space-y-12">
        <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
            <div className="space-y-1">
                <h2 className="text-5xl font-black text-gray-900 tracking-tighter italic">Kliniky<span className="text-primary">.</span></h2>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Partnerstvá a odberné miesta</p>
            </div>
            <button
                onClick={() => setOpenAdd(true)}
                className="group px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/30 hover:bg-opacity-90 transition-all flex items-center gap-3 text-sm tracking-widest"
            >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                PRIDAŤ KLINIKU
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {clinics.map(c => (
                <div key={c.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 text-gray-100 group-hover:text-primary/5 transition-colors -z-10">
                        <Building2 size={120} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-6 mb-8">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-primary/5 flex items-center justify-center text-primary shadow-inner">
                            <Building2 size={28} />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-gray-900 tracking-tight">{c.name}</h3>
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{c.city || 'Slovenská republika'}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3 text-sm font-bold text-gray-500">
                            <MapPin size={16} className="text-gray-300 mt-0.5 shrink-0" />
                            {c.address || 'Adresa neuvedená'}
                        </div>
                        {c.phone && (
                            <div className="flex items-center gap-3 text-sm font-bold text-gray-500">
                                <Phone size={16} className="text-gray-300" />
                                {c.phone}
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-50 flex justify-end">
                        <button className="p-2 text-gray-300 hover:text-primary transition-colors"><Edit2 size={18}/></button>
                    </div>
                </div>
            ))}
            {clinics.length === 0 && (
                <div className="col-span-full py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-4">
                    <Building2 size={48} className="text-gray-200" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs italic">Zatiaľ žiadne kliniky v databáze</p>
                </div>
            )}
        </div>

        <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Nová klinika / Ambulancia">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Názov kliniky</label>
                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ulica a číslo</label>
                    <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mesto</label>
                        <input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Telefón</label>
                        <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 outline-none" />
                    </div>
                </div>
                <div className="pt-4">
                    <button type="submit" className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-opacity-90 transition-all uppercase tracking-widest text-xs">ULOŽIŤ KLINIKU</button>
                </div>
            </form>
        </Modal>
    </div>
  );
}
