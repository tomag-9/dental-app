import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Edit2, Trash2, ChevronUp, ChevronDown, Search, Filter, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function JobList({ jobs, patients, token, setError, onEdit, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [openSections, setOpenSections] = useState({ in_progress: true, finished_unfactured: true, closed: false });

  const statusConfig = {
    in_progress: { label: 'V procese', color: 'bg-blue-50 text-blue-500 border-blue-100', icon: Clock },
    finished_unfactured: { label: 'Hotové / Nefakturované', color: 'bg-orange-50 text-orange-500 border-orange-100', icon: AlertCircle },
    finished_factured: { label: 'Hotové / Fakturované', color: 'bg-green-50 text-green-500 border-green-100', icon: CheckCircle2 },
    closed: { label: 'Uzavreté', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: CheckCircle2 },
  };

  const filtered = jobs.filter(j => {
    const p = patients.find(pat => pat.id === j.patient);
    const name = p ? `${p.first_name} ${p.last_name}` : '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || j.status.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const renderTable = (list) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left font-medium">
            <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                <tr>
                    <th className="px-10 py-6">Pacient</th>
                    <th className="px-10 py-6">Deadline</th>
                    <th className="px-10 py-6">Cena</th>
                    <th className="px-10 py-6 text-right">Akcie</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                {list.map(j => {
                    const p = patients.find(pat => pat.id === j.patient);
                    const config = statusConfig[j.status] || statusConfig.closed;
                    return (
                        <tr key={j.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="px-10 py-6">
                                <div className="flex flex-col">
                                    <span className="font-black text-gray-800 tracking-tight">{p ? `${p.first_name} ${p.last_name}` : `Práca #${j.id}`}</span>
                                    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase mt-1 self-start border", config.color)}>
                                        <config.icon size={10} />
                                        {config.label}
                                    </div>
                                </div>
                            </td>
                            <td className="px-10 py-6">
                                <span className="text-sm font-bold text-gray-400 uppercase">{j.due_date || '—'}</span>
                            </td>
                            <td className="px-10 py-6">
                                <span className="text-lg font-black text-gray-900 tracking-tighter">{parseFloat(j.price || 0).toFixed(2)} €</span>
                            </td>
                            <td className="px-10 py-6 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => onEdit(j)} className="p-2 bg-white text-gray-400 hover:text-primary rounded-xl border border-gray-100 shadow-sm transition-all"><Edit2 size={16} /></button>
                                    <button onClick={() => onDelete(j.id)} className="p-2 bg-white text-gray-400 hover:text-red-500 rounded-xl border border-gray-100 shadow-sm transition-all"><Trash2 size={16} /></button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
  );

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-500">
      <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input
                type="text"
                placeholder="Hľadať podľa pacienta alebo stavu..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none shadow-inner font-bold text-gray-700"
            />
        </div>
        <div className="flex gap-2">
            <div className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-primary cursor-pointer transition-colors shadow-sm"><Filter size={20}/></div>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {searchTerm ? (
            <div>
                <div className="px-10 py-4 bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 flex justify-between items-center">
                    Výsledky vyhľadávania
                    <span className="text-primary">{filtered.length} prác</span>
                </div>
                {filtered.length > 0 ? renderTable(filtered) : <div className="p-20 text-center text-gray-300 font-bold italic uppercase text-xs">Nenašli sa žiadne výsledky</div>}
            </div>
        ) : (
            ['in_progress', 'finished_unfactured', 'finished_factured', 'closed'].map(status => {
                const list = jobs.filter(j => j.status === status);
                if (list.length === 0 && (status === 'finished_factured' || status === 'closed')) return null;
                const config = statusConfig[status] || statusConfig.closed;
                const isOpen = openSections[status];

                return (
                    <div key={status}>
                        <button
                            onClick={() => setOpenSections(prev => ({...prev, [status]: !prev[status]}))}
                            className="w-full flex items-center justify-between px-10 py-6 hover:bg-gray-50/50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn("w-3 h-3 rounded-full border-2", config.color.replace('bg-', 'border-').replace('text-', 'bg-'))} />
                                <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">{config.label}</h3>
                                <span className="bg-gray-100 text-gray-400 text-[10px] font-black px-2 py-0.5 rounded-full">{list.length}</span>
                            </div>
                            {isOpen ? <ChevronUp size={20} className="text-gray-300"/> : <ChevronDown size={20} className="text-gray-300" />}
                        </button>
                        {isOpen && <div className="border-t border-gray-50 animate-in fade-in slide-in-from-top-2 duration-300">{renderTable(list)}</div>}
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
}
