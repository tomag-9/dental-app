import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, UserPlus, Loader2, Shield, Mail, Trash2, Key } from 'lucide-react';
import Modal from './Modal';

export default function UserManagement({ token, setError }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', password: '', role: 'technician' });

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/users/');
      setUsers(res.data);
    } catch { setError('Chyba pri načítaní používateľov'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetch(); }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        await api(token).post('/users/', formData);
        setOpenAdd(false);
        setFormData({ first_name: '', last_name: '', email: '', password: '', role: 'technician' });
        fetch();
    } catch { setError('Chyba pri vytváraní používateľa'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Naozaj chcete odstrániť tohto používateľa?')) return;
    try {
        await api(token).delete(`/users/${id}/`);
        fetch();
    } catch { setError('Chyba pri odstraňovaní'); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <span className="font-black text-gray-300 uppercase tracking-widest text-sm">Načítavam zoznam používateľov</span>
    </div>
  );

  return (
    <div className="space-y-12">
        <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
            <div className="space-y-1">
                <h2 className="text-5xl font-black text-gray-900 tracking-tighter italic">Používatelia<span className="text-primary">.</span></h2>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Správa prístupov do systému</p>
            </div>
            <button
                onClick={() => setOpenAdd(true)}
                className="group px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/30 hover:bg-opacity-90 transition-all flex items-center gap-3 text-sm tracking-widest"
            >
                <UserPlus size={18} className="group-hover:scale-110 transition-transform duration-300" />
                PRIDAŤ POUŽÍVATEĽA
            </button>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        <tr>
                            <th className="px-10 py-6">Meno a Priezvisko</th>
                            <th className="px-10 py-6">Email</th>
                            <th className="px-10 py-6">Rola</th>
                            <th className="px-10 py-6 text-right">Akcie</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                                <td className="px-10 py-6">
                                    <div className="font-black text-gray-800">{u.first_name} {u.last_name}</div>
                                </td>
                                <td className="px-10 py-6">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Mail size={14} className="text-gray-300" />
                                        {u.email}
                                    </div>
                                </td>
                                <td className="px-10 py-6">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                        u.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                                    }`}>
                                        {u.role === 'admin' ? 'Administrátor' : 'Technik'}
                                    </span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 text-gray-300 hover:text-primary transition-colors"><Key size={18}/></button>
                                        <button onClick={() => handleDelete(u.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Pridať nového používateľa">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Meno</label>
                        <input required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-primary/10" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Priezvisko</label>
                        <input required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-primary/10" />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email (Login)</label>
                    <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-primary/10" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Heslo</label>
                    <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-primary/10" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rola v systéme</label>
                    <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border-2 border-gray-100 rounded-2xl p-4 outline-none focus:ring-4 focus:ring-primary/10 font-bold">
                        <option value="technician">Technik</option>
                        <option value="admin">Administrátor</option>
                    </select>
                </div>
                <div className="pt-4">
                    <button type="submit" className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-opacity-90 transition-all uppercase tracking-widest text-xs">VYTVORIŤ ÚČET</button>
                </div>
            </form>
        </Modal>
    </div>
  );
}
