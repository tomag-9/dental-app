import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Users, Briefcase, Calendar, Euro, ArrowRight, Loader2, Package, TrendingUp, Clock, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

const StatCard = ({ title, value, icon: Icon, color, description, trend }) => (
    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col gap-1 hover:shadow-xl transition-all duration-300 group cursor-default">
        <div className="flex items-center justify-between mb-6">
            <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 duration-300", color)}>
                <Icon size={24} />
            </div>
            {trend && (
                <div className="flex items-center gap-1 text-green-500 font-bold text-xs bg-green-50 px-2 py-1 rounded-full">
                    <TrendingUp size={12} /> {trend}
                </div>
            )}
        </div>
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{title}</div>
        <div className="text-4xl font-black text-gray-900 tracking-tighter">{value}</div>
        {description && <p className="text-[10px] text-gray-400 font-bold uppercase mt-4 tracking-widest flex items-center gap-1">
            <Activity size={10} className="text-primary" /> {description}
        </p>}
    </div>
);

export default function LabDashboard({ token, setError }) {
  const navigate = useNavigate();
  const [data, setData] = useState({ jobs: [], patients: [], invoices: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [j, p, i] = await Promise.all([
          api(token).get('/jobs/'),
          api(token).get('/patients/'),
          api(token).get('/invoices/')
        ]);
        setData({ jobs: j.data, patients: p.data, invoices: i.data });
      } catch {
        setError?.('Nepodarilo sa načítať údaje dashboardu.');
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
  }, [token, setError]);

  const stats = useMemo(() => {
    const activeJobs = data.jobs.filter(j => j.status === 'in_progress').length;
    const pendingInvoices = data.invoices.filter(i => i.status === 'issued').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    return {
      patients: data.patients.length,
      activeJobs,
      revenue: pendingInvoices
    };
  }, [data]);

  const recentJobs = useMemo(() => data.jobs.slice(0, 5), [data.jobs]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <span className="font-black text-gray-300 uppercase tracking-widest text-sm">Pripravujem váš prehľad</span>
    </div>
  );

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-5xl font-black text-gray-900 tracking-tighter italic">Prehľad<span className="text-primary">.</span></h2>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Aktuálny stav vášho laboratória</p>
        </div>
        <button
            onClick={() => navigate('/jobs')}
            className="group px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/30 hover:bg-opacity-90 transition-all flex items-center gap-3 text-sm tracking-widest"
        >
            <Briefcase size={18} className="group-hover:rotate-12 transition-transform" />
            PRIDAŤ NOVÚ PRÁCU
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard
            title="Pacienti"
            value={stats.patients}
            icon={Users}
            color="bg-blue-50 text-blue-500"
            description="Registrovaní v databáze"
            trend="+12%"
        />
        <StatCard
            title="Aktívne práce"
            value={stats.activeJobs}
            icon={Activity}
            color="bg-primary/10 text-primary"
            description="Momentálne v procese"
        />
        <StatCard
            title="Pohľadávky"
            value={`${stats.revenue.toFixed(2)} €`}
            icon={Euro}
            color="bg-orange-50 text-orange-500"
            description="Vystavené faktúry"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-xl transition-all duration-500">
          <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
            <h3 className="font-black text-gray-900 uppercase text-xs tracking-[0.2em] flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                Posledné aktivity
            </h3>
            <button onClick={() => navigate('/jobs')} className="text-[10px] font-black text-primary hover:underline flex items-center gap-2 uppercase tracking-widest">
                Všetky práce <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex-1 divide-y divide-gray-50">
            {recentJobs.length > 0 ? recentJobs.map(j => {
                const p = data.patients.find(pat => pat.id === j.patient);
                return (
                    <div
                        key={j.id}
                        className="px-10 py-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/job-details/${j.id}`)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-primary group-hover:text-white transition-all font-black text-xs">
                                #{j.id}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-black text-gray-800 tracking-tight group-hover:text-primary transition-colors">{p ? `${p.first_name} ${p.last_name}` : 'Neznámy pacient'}</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{j.status}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-black text-gray-900">{j.due_date || '—'}</div>
                            <div className="text-[10px] text-gray-300 font-bold uppercase tracking-tighter italic">Deadline</div>
                        </div>
                    </div>
                )
            }) : (
                <div className="p-20 text-center flex flex-col items-center gap-4">
                    <Briefcase size={48} className="text-gray-100" />
                    <p className="text-gray-300 font-black uppercase text-xs tracking-widest italic">Zatiaľ žiadne záznamy</p>
                </div>
            )}
          </div>
        </div>

        {/* Quick Links / Stats */}
        <div className="lg:col-span-2 space-y-8">
            <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/40 transition-all duration-700" />
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-8">Finančný progres</h3>
                <div className="space-y-6 relative z-10">
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tento mesiac</span>
                        <span className="text-2xl font-black text-primary">0.00 €</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-1/3 rounded-full" />
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium italic leading-relaxed">
                        Váš obrat rastie stabilným tempom. Pokračujte v skvelej práci!
                    </p>
                </div>
                <button
                    onClick={() => navigate('/finance/invoices')}
                    className="mt-10 w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black rounded-2xl transition-all flex items-center justify-between px-6 group/btn"
                >
                    <span className="text-xs tracking-widest">FAKTURÁCIA</span>
                    <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center gap-4">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-2">
                    <Package size={32} />
                </div>
                <h3 className="font-black text-gray-900 uppercase text-xs tracking-widest">Stav skladu</h3>
                <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-[200px]">
                    Všetky materiály sú momentálne v optimálnom množstve.
                </p>
                <button
                    onClick={() => navigate('/storage/items')}
                    className="mt-4 text-[10px] font-black text-primary hover:underline uppercase tracking-widest"
                >
                    SKONTROLOVAŤ SKLAD
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
