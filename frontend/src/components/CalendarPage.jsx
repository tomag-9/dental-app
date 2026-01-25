import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Clock, MapPin, User } from 'lucide-react';

export default function CalendarPage({ token, setError }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await api(token).get('/jobs/');
        setJobs(res.data);
      } catch { setError('Chyba načítania termínov'); }
      finally { setLoading(false); }
    };
    if (token) fetch();
  }, [token, setError]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthName = currentDate.toLocaleString('sk-SK', { month: 'long' });
  const year = currentDate.getFullYear();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <span className="font-black text-gray-300 uppercase tracking-widest text-sm">Načítavam kalendár termínov</span>
    </div>
  );

  return (
    <div className="space-y-12">
        <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
            <div className="space-y-1">
                <h2 className="text-5xl font-black text-gray-900 tracking-tighter italic">Kalendár<span className="text-primary">.</span></h2>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Prehľad deadlineov a plánovanie prác</p>
            </div>
            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                <button onClick={prevMonth} className="p-3 hover:bg-gray-50 rounded-xl transition-colors"><ChevronLeft size={20}/></button>
                <div className="px-6 text-sm font-black uppercase tracking-widest text-gray-900 italic">{monthName} {year}</div>
                <button onClick={nextMonth} className="p-3 hover:bg-gray-50 rounded-xl transition-colors"><ChevronRight size={20}/></button>
            </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            {['Pon', 'Ut', 'Str', 'Štv', 'Pia', 'Sob', 'Ned'].map(d => (
                <div key={d} className="bg-gray-50 p-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100">{d}</div>
            ))}
            {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white/50 min-h-[160px]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayJobs = jobs.filter(j => j.due_date === dStr);
                const isToday = new Date().toISOString().split('T')[0] === dStr;

                return (
                    <div key={day} className={`bg-white min-h-[160px] p-4 border-r border-b border-gray-50 hover:bg-gray-50/50 transition-colors group`}>
                        <div className={`text-sm font-black mb-3 w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isToday ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-gray-300 group-hover:text-gray-900'}`}>{day}</div>
                        <div className="space-y-2">
                            {dayJobs.map(j => (
                                <div key={j.id} className="p-2 rounded-lg bg-primary/5 border border-primary/10 text-[10px] leading-tight group/job">
                                    <div className="font-black text-primary uppercase truncate">{j.patient_name}</div>
                                    <div className="text-gray-400 font-bold truncate">{j.clinic_name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Dnešný program</h3>
                <div className="space-y-4">
                    {jobs.filter(j => j.due_date === new Date().toISOString().split('T')[0]).map(j => (
                        <div key={j.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-primary/5 text-primary rounded-2xl"><Clock size={24}/></div>
                                <div>
                                    <div className="font-black text-lg text-gray-900 tracking-tight italic">{j.patient_name}</div>
                                    <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                                        <span className="flex items-center gap-1"><MapPin size={12}/> {j.clinic_name}</span>
                                        <span className="flex items-center gap-1"><User size={12}/> {j.technician_name || 'Prideliť...'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-2 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">DEADLINE</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="space-y-6">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Štatistika mesiaca</h3>
                <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 text-white/5 -z-0">
                        <CalendarIcon size={120} strokeWidth={1} />
                    </div>
                    <div className="relative z-10 space-y-8">
                        <div>
                            <div className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Počet odovzdaných prác</div>
                            <div className="text-4xl font-black italic tracking-tighter">
                                {jobs.filter(j => j.due_date.startsWith(currentDate.toISOString().substring(0, 7))).length}
                            </div>
                        </div>
                        <div className="h-0.5 bg-white/10" />
                        <p className="text-xs text-white/40 leading-relaxed italic">"Plánovanie je základom efektívneho laboratória. Dodržiavanie termínov buduje dôveru lekárov."</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
