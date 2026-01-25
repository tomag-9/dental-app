import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import ToothMap from './ToothMap';
import { ChevronRight, ChevronLeft, Check, User, Map as MapIcon, ClipboardList, Calendar, Trash2, Info, Loader2, Euro, Activity, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function JobForm({ open, onClose, onSuccess, token, setError, initialData = null }) {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    patient: '', clinic: '', doctor: '', technician: '',
    procedure_codes: [], procedure_quantities: {}, tooth_procedures: {},
    description: '', tooth_color: '',
    due_date: '', start_date: new Date().toISOString().split('T')[0], end_date: '', try_in: '',
    status: 'in_progress'
  });

  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [procedureOptions, setProcedureOptions] = useState([]);
  const [selectedProc, setSelectedProc] = useState('');
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalCost = useMemo(() => {
    return formData.procedure_codes.reduce((sum, code) => {
      const p = procedureOptions.find(opt => opt.code === code);
      return sum + (formData.procedure_quantities[code] || 1) * (p?.price || 0);
    }, 0);
  }, [formData.procedure_codes, formData.procedure_quantities, procedureOptions]);

  useEffect(() => {
    if (!open) return;
    const fetch = async () => {
      try {
        setLoading(true);
        const a = api(token);
        const [p, c, d, t, pr] = await Promise.all([
          a.get('/patients/'), a.get('/clinics/'), a.get('/doctors/'), a.get('/technicians/'), a.get('/price_list/')
        ]);
        setPatients(p.data); setClinics(c.data); setDoctors(d.data); setTechnicians(t.data); setProcedureOptions(pr.data);
      } catch { setError('Chyba načítania dát'); }
      finally { setLoading(false); }
    };
    fetch();
    if (initialData) {
        setFormData(initialData);
        setActiveStep(0);
    } else {
        setFormData({
            patient: '', clinic: '', doctor: '', technician: '',
            procedure_codes: [], procedure_quantities: {}, tooth_procedures: {},
            description: '', tooth_color: '',
            due_date: '', start_date: new Date().toISOString().split('T')[0], end_date: '', try_in: '',
            status: 'in_progress'
        });
        setActiveStep(0);
    }
  }, [open, token, initialData, setError]);

  const steps = [
    { label: 'Základné údaje', icon: User },
    { label: 'Zubná mapa', icon: MapIcon },
    { label: 'Výkony', icon: ClipboardList },
    { label: 'Plánovanie', icon: Calendar },
  ];

  const handleAddProc = () => {
    if (!selectedProc) return;
    setFormData(prev => ({
      ...prev,
      procedure_codes: Array.from(new Set([...prev.procedure_codes, selectedProc])),
      procedure_quantities: { ...prev.procedure_quantities, [selectedProc]: qty }
    }));
    setSelectedProc(''); setQty(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, price: totalCost };
      if (initialData) await api(token).put(`/jobs/${initialData.id}/`, payload);
      else await api(token).post('/jobs/', payload);
      onSuccess();
    } catch { setError('Chyba uloženia'); }
  };

  if (loading) return <Modal open={open} onClose={onClose} title="Práca"><div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div></Modal>;

  return (
    <Modal open={open} onClose={onClose} title={initialData ? 'Upraviť prácu' : 'Nová objednávka'} maxWidth="max-w-5xl">
      <div className="flex flex-col gap-10">
        {/* Stepper */}
        <div className="flex justify-between relative px-4">
            <div className="absolute top-5 left-8 right-8 h-0.5 bg-gray-100 -z-10" />
            {steps.map((s, i) => (
                <div key={i} className="flex flex-col items-center bg-white px-4">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 shadow-sm",
                        activeStep === i ? "border-primary bg-primary text-white scale-110 shadow-primary/30" :
                        activeStep > i ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-300"
                    )}>
                        {activeStep > i ? <Check size={20} strokeWidth={3} /> : <s.icon size={20} />}
                    </div>
                    <span className={cn("text-[10px] font-black uppercase mt-3 tracking-widest transition-colors duration-300", activeStep >= i ? "text-gray-900" : "text-gray-300")}>{s.label}</span>
                </div>
            ))}
        </div>

        <div className="min-h-[400px] px-2 font-medium">
            {activeStep === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pacient *</label>
                            <select value={formData.patient} onChange={e => setFormData({...formData, patient: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all">
                                <option value="">Vyberte zo zoznamu...</option>
                                {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Klinika</label>
                            <select value={formData.clinic} onChange={e => setFormData({...formData, clinic: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all">
                                <option value="">Vyberte kliniku...</option>
                                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Lekár</label>
                            <select value={formData.doctor} onChange={e => setFormData({...formData, doctor: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all">
                                <option value="">Vyberte lekára...</option>
                                {doctors.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Technik</label>
                            <select value={formData.technician} onChange={e => setFormData({...formData, technician: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all">
                                <option value="">Vyberte technika...</option>
                                {technicians.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Odtieň zuba</label>
                            <select value={formData.tooth_color} onChange={e => setFormData({...formData, tooth_color: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all">
                                <option value="">Auto / Výber...</option>
                                {['A1','A2','A3','A4','B1','B2','B3','B4','C1','C2','C3','C4','D1','D2','D3','D4'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status práce</label>
                            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-primary">
                                <option value="in_progress">V procese</option>
                                <option value="finished_unfactured">Hotové - Nefakturované</option>
                                <option value="finished_factured">Hotové - Fakturované</option>
                                <option value="closed">Uzavreté</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {activeStep === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2rem] flex items-start gap-4">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Info size={20}/></div>
                        <p className="text-sm text-blue-700 leading-relaxed">
                            Označte zuby, na ktorých vykonávate konkrétne zákroky. Táto informácia sa uloží do trvalej karty pacienta.
                        </p>
                    </div>
                    <ToothMap editable value={formData.tooth_procedures} onChange={m => setFormData({...formData, tooth_procedures: m})} />
                </div>
            )}

            {activeStep === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-col sm:flex-row gap-4 items-end bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 shadow-inner">
                        <div className="flex-1 space-y-1 w-full">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Výber výkonu z cenníka</label>
                            <select value={selectedProc} onChange={e => setSelectedProc(e.target.value)} className="w-full border-none bg-white rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 outline-none shadow-sm transition-all font-bold text-gray-700">
                                <option value="">Vyberte výkon...</option>
                                {procedureOptions.map(p => <option key={p.code} value={p.code}>{p.code} - {p.description} ({parseFloat(p.price).toFixed(2)}€)</option>)}
                            </select>
                        </div>
                        <div className="w-full sm:w-32 space-y-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Množstvo</label>
                            <input type="number" min="1" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} className="w-full border-none bg-white rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 outline-none shadow-sm font-black text-center" />
                        </div>
                        <button onClick={handleAddProc} className="w-full sm:w-auto h-14 px-10 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-opacity-90 transition-all uppercase tracking-widest text-xs">PRIDAŤ</button>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-10 py-5">Kód</th>
                                    <th className="px-10 py-5 text-center">Množstvo</th>
                                    <th className="px-10 py-5 text-right">Spolu</th>
                                    <th className="px-10 py-5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {formData.procedure_codes.map(code => {
                                    const p = procedureOptions.find(opt => opt.code === code);
                                    const q = formData.procedure_quantities[code] || 1;
                                    return (
                                        <tr key={code} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-10 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-primary text-sm uppercase">{code}</span>
                                                    <span className="text-xs text-gray-400 font-bold">{p?.description}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-5 text-center font-black text-gray-900">{q}</td>
                                            <td className="px-10 py-5 text-right font-black text-gray-900 tracking-tight">{(q * (p?.price || 0)).toFixed(2)} €</td>
                                            <td className="px-10 py-5 text-right">
                                                <button onClick={() => setFormData({...formData, procedure_codes: formData.procedure_codes.filter(x => x !== code)})} className="p-2 text-gray-300 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {formData.procedure_codes.length === 0 && <tr><td colSpan="4" className="p-12 text-center text-gray-300 italic text-sm">Zatiaľ nie sú pridané žiadne výkony</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10">
                        <div className="flex items-center gap-3 text-primary">
                            <Euro size={24}/>
                            <span className="font-black text-xs uppercase tracking-[0.2em]">Predbežná celková suma</span>
                        </div>
                        <div className="text-4xl font-black text-primary tracking-tighter italic">{totalCost.toFixed(2)} €</div>
                    </div>
                </div>
            )}

            {activeStep === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 text-gray-900 mb-2">
                            <Clock size={20} className="text-primary"/>
                            <h3 className="font-black uppercase text-xs tracking-widest">Dôležité termíny</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Dátum začatia</label>
                                <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full border-2 border-gray-100 bg-white rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 outline-none font-bold" />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-primary uppercase tracking-widest italic">Deadline (Termín dodania) *</label>
                                <input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full border-2 border-primary/20 bg-primary/5 rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 outline-none font-black text-primary" />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Try-in (Skúška)</label>
                                <input type="date" value={formData.try_in} onChange={e => setFormData({...formData, try_in: e.target.value})} className="w-full border-2 border-gray-100 bg-white rounded-2xl p-4 focus:ring-4 focus:ring-primary/10 outline-none font-bold" />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 text-gray-900 mb-2">
                            <Activity size={20} className="text-primary"/>
                            <h3 className="font-black uppercase text-xs tracking-widest">Poznámky k práci</h3>
                        </div>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                            rows={8}
                            placeholder="Zadajte technické špecifikácie, pokyny od lekára alebo iné dôležité detaily..."
                            className="w-full border-2 border-gray-100 bg-gray-50 rounded-[2rem] p-6 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium text-sm leading-relaxed"
                        />
                    </div>
                </div>
            )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-between items-center border-t border-gray-50 pt-8 px-2">
            <button
                onClick={() => activeStep > 0 ? setActiveStep(activeStep - 1) : onClose()}
                className="group flex items-center gap-2 px-8 py-3 font-black text-gray-400 uppercase tracking-widest text-[10px] hover:text-gray-900 transition-colors"
            >
                <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                {activeStep === 0 ? 'ZRUŠIŤ' : 'SPÄŤ'}
            </button>
            <button
                onClick={() => activeStep < steps.length - 1 ? setActiveStep(activeStep + 1) : handleSubmit({preventDefault:()=>{}})}
                className="flex items-center gap-3 px-10 py-4 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/20 hover:bg-opacity-90 transition-all uppercase tracking-widest text-[10px]"
            >
                {activeStep === steps.length - 1 ? (
                    <>HOTOVO & ULOŽIŤ <Check size={18} strokeWidth={3} /></>
                ) : (
                    <>POKRAČOVAŤ <ChevronRight size={16} strokeWidth={3} /></>
                )}
            </button>
        </div>
      </div>
    </Modal>
  );
}
