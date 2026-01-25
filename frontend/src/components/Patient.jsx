import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Search, Loader2, User, MoreVertical, Edit2, ShieldAlert, ChevronRight } from 'lucide-react';
import AddPatientDialog from './AddPatientDialog';
import EditPatientDialog from './EditPatientDialog';
import PatientDetailsDialog from './PatientDetailsDialog';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function Patient({ token, setError }) {
  const [patients, setPatients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(null);
  const [openDetails, setOpenDetails] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pRes, jRes] = await Promise.all([
          api(token).get('/patients/'),
          api(token).get('/jobs/')
      ]);
      setPatients(pRes.data);
      setJobs(jRes.data);
    } catch {
      setError('Chyba pri načítaní pacientov.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.birth_number && p.birth_number.includes(searchTerm))
  );

  const ongoingPatients = patients.filter(p =>
    jobs.some(j => j.patient === p.id && !['closed', 'finished_factured'].includes(j.status))
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <span className="font-black text-gray-300 uppercase tracking-widest text-sm">Načítavam zoznam pacientov</span>
    </div>
  );

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-5xl font-black text-gray-900 tracking-tighter italic">Pacienti<span className="text-primary">.</span></h2>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Kompletná evidencia a zdravotné záznamy</p>
        </div>
        <button
            onClick={() => setOpenAdd(true)}
            className="group px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/30 hover:bg-opacity-90 transition-all flex items-center gap-3 text-sm tracking-widest"
        >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            PRIDAŤ NOVÉHO PACIENTA
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Quick Filter Sidebar */}
          <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm space-y-8">
                  <div>
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Vyhľadávanie</h3>
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                          <input
                            type="text"
                            placeholder="Meno alebo R.Č."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-gray-700"
                          />
                      </div>
                  </div>

                  <div>
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          Práve v liečbe
                      </h3>
                      <div className="space-y-2">
                          {ongoingPatients.length > 0 ? ongoingPatients.slice(0, 5).map(p => (
                              <button
                                key={p.id}
                                onClick={() => setOpenDetails(p)}
                                className="w-full text-left p-3 rounded-xl hover:bg-gray-50 flex items-center justify-between group transition-all"
                              >
                                  <span className="text-xs font-bold text-gray-600 group-hover:text-primary transition-colors">{p.last_name}</span>
                                  <ChevronRight size={12} className="text-gray-300 group-hover:translate-x-1 transition-all" />
                              </button>
                          )) : <p className="text-xs text-gray-300 italic px-3">Momentálne nikto</p>}
                      </div>
                  </div>
              </div>
          </div>

          {/* Patients Main Table */}
          <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-500">
              <div className="overflow-x-auto font-medium">
                  <table className="w-full text-left">
                      <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                          <tr>
                              <th className="px-10 py-6">Pacient</th>
                              <th className="px-10 py-6">Rodné číslo</th>
                              <th className="px-10 py-6 text-right">Záznam</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                          {filteredPatients.map(p => (
                              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                                  <td className="px-10 py-6">
                                      <div className="flex items-center gap-4">
                                          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-inner">
                                              <User size={20} />
                                          </div>
                                          <div className="flex flex-col">
                                              <span className="font-black text-gray-800 tracking-tight">{p.first_name} {p.last_name}</span>
                                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Aktívny profil</span>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-10 py-6">
                                      <span className="text-sm font-bold text-gray-600">{p.birth_number || '—'}</span>
                                  </td>
                                  <td className="px-10 py-6 text-right">
                                      <button
                                        onClick={() => setOpenDetails(p)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-primary hover:text-white transition-all shadow-sm"
                                      >
                                          Zobraziť kartu
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {filteredPatients.length === 0 && (
                              <tr>
                                  <td colSpan="3" className="px-10 py-20 text-center">
                                      <div className="flex flex-col items-center gap-4">
                                          <ShieldAlert size={48} className="text-gray-100" />
                                          <p className="text-gray-300 font-black uppercase text-xs tracking-widest italic">Nenašli sa žiadni pacienti</p>
                                      </div>
                                  </td>
                              </tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

      <AddPatientDialog open={openAdd} onClose={() => setOpenAdd(false)} token={token} setError={setError} onSuccess={fetchData} />
      <EditPatientDialog open={!!openEdit} patient={openEdit} onClose={() => setOpenEdit(null)} token={token} onSuccess={fetchData} />
      <PatientDetailsDialog open={!!openDetails} patient={openDetails} onClose={() => setOpenDetails(null)} token={token} />
    </div>
  );
};
