import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { FileText, Download, Loader2, CheckCircle, Clock, Search, Euro, Filter } from 'lucide-react';

export default function Invoices({ token, setError }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/invoices/');
      setInvoices(res.data);
    } catch { setError('Chyba načítania faktúr'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetch(); }, [token]);

  const handleDownload = async (id) => {
    try {
        const response = await api(token).get(`/invoices/${id}/pdf/`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `faktura_${id}.pdf`);
        document.body.appendChild(link);
        link.click();
    } catch { setError('Chyba sťahovania PDF'); }
  };

  const filteredInvoices = invoices.filter(i =>
    i.invoice_number.includes(searchTerm) || i.clinic_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <span className="font-black text-gray-300 uppercase tracking-widest text-sm">Načítavam zoznam faktúr</span>
    </div>
  );

  return (
    <div className="space-y-12">
        <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
            <div className="space-y-1">
                <h2 className="text-5xl font-black text-gray-900 tracking-tighter italic">Fakturácia<span className="text-primary">.</span></h2>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Prehľad vystavených dokladov a stav platieb</p>
            </div>
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input
                        placeholder="Číslo faktúry alebo klinika..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-12 pr-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-primary/10 outline-none font-bold text-sm w-64 transition-all"
                    />
                </div>
                <button className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors"><Filter size={20}/></button>
            </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        <tr>
                            <th className="px-10 py-6">Číslo faktúry</th>
                            <th className="px-10 py-6">Klinika</th>
                            <th className="px-10 py-6">Dátum vystavenia</th>
                            <th className="px-10 py-6 text-right">Suma (€)</th>
                            <th className="px-10 py-6 text-center">Stav</th>
                            <th className="px-10 py-6 text-right">Akcie</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium">
                        {filteredInvoices.map(inv => (
                            <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-10 py-6">
                                    <div className="flex items-center gap-3">
                                        <FileText size={18} className="text-primary/40" />
                                        <span className="font-black text-gray-900 tracking-tight italic">{inv.invoice_number}</span>
                                    </div>
                                </td>
                                <td className="px-10 py-6">
                                    <span className="font-bold text-gray-600">{inv.clinic_name}</span>
                                </td>
                                <td className="px-10 py-6">
                                    <span className="text-sm text-gray-400 font-bold">{new Date(inv.issue_date).toLocaleDateString('sk-SK')}</span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <span className="font-black text-gray-900 italic">{parseFloat(inv.total_amount).toFixed(2)} €</span>
                                </td>
                                <td className="px-10 py-6">
                                    <div className="flex justify-center">
                                        {inv.is_paid ? (
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest">
                                                <CheckCircle size={12} /> Uhradené
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest">
                                                <Clock size={12} /> Čaká na úhradu
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-10 py-6 text-right">
                                    <button
                                        onClick={() => handleDownload(inv.id)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-black hover:text-white transition-all shadow-sm"
                                    >
                                        <Download size={14} /> PDF
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-primary p-8 rounded-[2.5rem] shadow-2xl shadow-primary/20 flex flex-col justify-between h-48 relative overflow-hidden group">
                <div className="absolute -bottom-4 -right-4 text-white/10 group-hover:scale-110 transition-transform duration-700"><Euro size={120} /></div>
                <div className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">Spolu nefakturované práce</div>
                <div className="text-4xl font-black text-white italic tracking-tighter">1,248.50 €</div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between h-48">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pohľadávky po splatnosti</div>
                <div className="text-4xl font-black text-red-500 italic tracking-tighter">312.00 €</div>
            </div>
            <div className="bg-black p-8 rounded-[2.5rem] shadow-xl flex flex-col justify-between h-48">
                <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Priemerná splatnosť</div>
                <div className="text-4xl font-black text-white italic tracking-tighter">12 <span className="text-sm uppercase tracking-normal not-italic text-white/40 ml-1">dní</span></div>
            </div>
        </div>
    </div>
  );
}
