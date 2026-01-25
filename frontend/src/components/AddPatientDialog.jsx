import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';

const AddPatientDialog = ({ open, onClose, token, setError, onSuccess }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_number: '',
    birth_date: '',
    address: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (formData.birth_number.length >= 6) {
      const yy = parseInt(formData.birth_number.slice(0, 2), 10);
      let mm = parseInt(formData.birth_number.slice(2, 4), 10);
      const dd = parseInt(formData.birth_number.slice(4, 6), 10);

      let year = yy + (yy < 50 ? 2000 : 1900);
      if (mm > 50) mm -= 50;

      if (!isNaN(year) && !isNaN(mm) && !isNaN(dd)) {
        setFormData(prev => ({
          ...prev,
          birth_date: `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
        }));
      }
    }
  }, [formData.birth_number]);

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      setError('Meno a priezvisko sú povinné');
      return;
    }
    try {
      await api(token).post('/patients/', formData);
      onSuccess();
      onClose();
      setFormData({
        first_name: '',
        last_name: '',
        birth_number: '',
        birth_date: '',
        address: '',
        phone: '',
        email: '',
      });
    } catch {
      setError('Nepodarilo sa pridať pacienta.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Pridať pacienta" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4 font-medium">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Meno *</label>
                <input name="first_name" required value={formData.first_name} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Priezvisko *</label>
                <input name="last_name" required value={formData.last_name} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
        </div>
        <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rodné číslo</label>
            <input name="birth_number" value={formData.birth_number} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none" />
        </div>
        <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Dátum narodenia (automaticky)</label>
            <input name="birth_date" value={formData.birth_date} disabled className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3 text-gray-500" />
        </div>
        <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Adresa</label>
            <input name="address" value={formData.address} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Telefón</label>
                <input name="phone" value={formData.phone} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Email</label>
                <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
        </div>
        <div className="pt-6">
            <button type="submit" className="w-full bg-primary text-white py-4 rounded-xl font-black shadow-lg shadow-primary/20 hover:bg-opacity-90 transition-all uppercase tracking-widest text-sm">ULOŽIŤ PACIENTA</button>
        </div>
      </form>
    </Modal>
  );
};

export default AddPatientDialog;
