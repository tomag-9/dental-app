import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';
import { Save, Loader2 } from 'lucide-react';

export default function EditPatientDialog({ open, onClose, patient, token, onSuccess }) {
    const [formData, setFormData] = useState({ first_name: '', last_name: '', birth_number: '', address: '', phone: '', email: '' });
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (patient) setFormData({ first_name: patient.first_name || '', last_name: patient.last_name || '', birth_number: patient.birth_number || '', address: patient.address || '', phone: patient.phone || '', email: patient.email || '' });
    }, [patient]);
    const handleSubmit = async (e) => {
        e.preventDefault(); setSaving(true);
        try { await api(token).put(`/patients/${patient.id}/`, formData); onSuccess(); onClose(); }
        catch (err) { alert('Chyba pri ukladaní.'); }
        finally { setSaving(false); }
    };
    if (!patient) return null;
    return (
        <Modal open={open} onClose={onClose} title="Upraviť údaje pacienta" maxWidth="max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Meno</label><input type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2" required /></div>
                    <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Priezvisko</label><input type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2" required /></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Rodné číslo</label><input type="text" value={formData.birth_number} onChange={e => setFormData({...formData, birth_number: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2" /></div>
                <div className="pt-4 flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-bold text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100">Zrušiť</button>
                    <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-opacity-90 flex items-center justify-center gap-2">{saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Uložiť zmeny</button>
                </div>
            </form>
        </Modal>
    );
}
