import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import ToothMap from './ToothMap';
import { ChevronRight, ChevronLeft, Check, User, Map as MapIcon, ClipboardList, Calendar, Trash2, Info } from 'lucide-react';
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
  const [procedureOptions, setProcedureOptions] = useState([]);
  const [selectedProc, setSelectedProc] = useState('');
  const [qty, setQty] = useState(1);

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
        const a = api(token);
        const [p, , , , pr] = await Promise.all([
          a.get('/patients/'), a.get('/clinics/'), a.get('/doctors/'), a.get('/technicians/'), a.get('/price_list/')
        ]);
        setPatients(p.data); setProcedureOptions(pr.data);
      } catch { setError('Chyba načítania dát'); }
    };
    fetch();
    if (initialData) setFormData(initialData);
    else setActiveStep(0);
  }, [open, token, initialData, setError]);

  const steps = [
    { label: 'Základné', icon: User },
    { label: 'Zubná mapa', icon: MapIcon },
    { label: 'Procedúry', icon: ClipboardList },
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

  return (
    <Modal open={open} onClose={onClose} title={initialData ? 'Upraviť prácu' : 'Nová práca'} maxWidth="max-w-4xl">
      <div className="flex flex-col gap-8">
        <div className="flex justify-between relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -z-10" />
            {steps.map((s, i) => (
                <div key={i} className="flex flex-col items-center bg-white px-2">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all", activeStep >= i ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-400")}>
                        {activeStep > i ? <Check size={18}/> : <s.icon size={18}/>}
                    </div>
                    <span className={cn("text-[10px] font-black uppercase mt-1", activeStep >= i ? "text-primary" : "text-gray-300")}>{s.label}</span>
                </div>
            ))}
        </div>

        <div className="min-h-[300px]">
            {activeStep === 0 && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Pacient</label>
                        <select value={formData.patient} onChange={e => setFormData({...formData, patient: e.target.value})} className="w-full border rounded-xl p-3">
                            <option value="">Vyberte...</option>
                            {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                        </select>
                    </div>
                    <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Stav</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full border rounded-xl p-3 uppercase font-bold text-xs">
                            <option value="in_progress">V procese</option>
                            <option value="finished_unfactured">Hotové - Nefakturované</option>
                            <option value="finished_factured">Hotové - Fakturované</option>
                            <option value="closed">Uzavreté</option>
                        </select>
                    </div>
                </div>
            )}
            {activeStep === 1 && <div className="animate-in fade-in"><ToothMap editable value={formData.tooth_procedures} onChange={m => setFormData({...formData, tooth_procedures: m})} /></div>}
            {activeStep === 2 && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex gap-2 items-end">
                        <div className="flex-1"><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Výkon</label>
                            <select value={selectedProc} onChange={e => setSelectedProc(e.target.value)} className="w-full border rounded-xl p-3">
                                <option value="">Vyberte výkon...</option>
                                {procedureOptions.map(p => <option key={p.code} value={p.code}>{p.code} - {p.description}</option>)}
                            </select>
                        </div>
                        <button onClick={handleAddProc} className="bg-primary text-white p-3 rounded-xl font-bold">PRIDAŤ</button>
                    </div>
                    <div className="border rounded-2xl overflow-hidden">
                        {formData.procedure_codes.map(c => (
                            <div key={c} className="p-4 flex justify-between items-center border-b last:border-0">
                                <span className="font-bold text-sm">{c}</span>
                                <button onClick={() => setFormData({...formData, procedure_codes: formData.procedure_codes.filter(x => x !== c)})} className="text-red-400"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                    <div className="text-right font-black text-xl text-primary">Spolu: {totalCost.toFixed(2)} €</div>
                </div>
            )}
            {activeStep === 3 && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Deadline</label><input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} className="w-full border rounded-xl p-3" /></div>
                </div>
            )}
        </div>

        <div className="flex justify-between border-t pt-6">
            <button onClick={() => activeStep > 0 ? setActiveStep(activeStep - 1) : onClose()} className="px-6 py-2 font-bold text-gray-400 uppercase tracking-widest text-xs">{activeStep === 0 ? 'Zrušiť' : 'Späť'}</button>
            <button onClick={() => activeStep < steps.length - 1 ? setActiveStep(activeStep + 1) : handleSubmit({preventDefault:()=>{}})} className="bg-primary text-white px-8 py-3 rounded-xl font-black shadow-lg uppercase tracking-widest text-sm">{activeStep === steps.length - 1 ? 'Uložiť' : 'Ďalej'}</button>
        </div>
      </div>
    </Modal>
  );
}
