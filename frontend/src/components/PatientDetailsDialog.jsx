import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import { User, Phone, Mail, MapPin, Loader2, Calendar } from 'lucide-react';
import ToothMap from './ToothMap';

export default function PatientDetailsDialog({ open, onClose, patient, token }) {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (open && patient) {
            const fetchJobs = async () => {
                setLoading(true);
                try {
                    const res = await api(token).get(`/jobs/?patient_id=${patient.id}`);
                    setJobs(res.data);
                } catch (e) { console.error(e); }
                finally { setLoading(false); }
            };
            fetchJobs();
        }
    }, [open, patient, token]);
    if (!patient) return null;
    return (
        <Modal open={open} onClose={onClose} title={`Pacient: ${patient.first_name} ${patient.last_name}`} maxWidth="max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
                        <div className="flex items-start gap-3"><User className="text-primary mt-1" size={20} /><div><span className="text-[10px] font-bold text-gray-400 uppercase">Rodné číslo</span><div className="font-bold text-gray-900">{patient.birth_number || '—'}</div></div></div>
                        <div className="flex items-start gap-3"><Phone className="text-primary mt-1" size={20} /><div><span className="text-[10px] font-bold text-gray-400 uppercase">Telefón</span><div className="font-bold text-gray-900">{patient.phone || '—'}</div></div></div>
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Calendar size={18} className="text-primary" /> História prác</h4>
                        {loading ? <Loader2 className="animate-spin text-primary mx-auto" /> : (
                            <div className="space-y-3">
                                {jobs.map(j => (
                                    <div key={j.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center"><div className="flex flex-col"><span className="text-xs font-bold text-gray-900">#{j.id}</span><span className="text-[10px] text-gray-500 font-medium">{j.due_date}</span></div><span className="text-[10px] font-bold uppercase bg-white px-2 py-0.5 rounded border">{j.status}</span></div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                    <h4 className="font-bold text-gray-900">Kumulatívna zubná mapa</h4>
                    <ToothMap value={patient.tooth_procedures || {}} editable={false} />
                </div>
            </div>
        </Modal>
    );
}
