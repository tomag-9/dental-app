import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { FileText, Plus, Download, Loader2 } from 'lucide-react';
export default function Invoices({ token, setError }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const f = async () => {
      try { setLoading(true); const res = await api(token).get('/invoices/'); setInvoices(res.data); }
      catch { setError('Chyba faktúr'); } finally { setLoading(false); }
    };
    if (token) f();
  }, [token, setError]);
  if (loading) return <div className="p-12"><Loader2 className="animate-spin mx-auto"/></div>;
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Faktúry</h2>
      <div className="bg-white rounded-2xl shadow border overflow-hidden">
        <table className="w-full text-left font-medium text-sm">
          <thead><tr className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400"><th>Číslo</th><th>Suma</th><th>Akcie</th></tr></thead>
          <tbody className="divide-y">
            {invoices.map(i => <tr key={i.id} className="hover:bg-gray-50"><td className="p-4">{i.number}</td><td className="p-4">{parseFloat(i.total_amount).toFixed(2)} €</td><td className="p-4 text-right"><button onClick={async () => { const res = await api(token).get(`/invoices/${i.id}/pdf/`, { responseType: 'blob' }); const url = window.URL.createObjectURL(new Blob([res.data])); const link = document.createElement('a'); link.href = url; link.setAttribute('download', `inv_${i.number}.pdf`); document.body.appendChild(link); link.click(); }} className="text-primary"><Download size={16}/></button></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
