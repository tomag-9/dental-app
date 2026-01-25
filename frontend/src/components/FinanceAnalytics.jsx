import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { BarChart3, Loader2 } from 'lucide-react';

export default function FinanceAnalytics({ token, setError }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api(token).get('/invoices/');
        setInvoices(resp.data || []);
      } catch { setError?.('Chyba analytiky'); }
      finally { setLoading(false); }
    };
    if (token) fetchData();
  }, [token, setError]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3"><BarChart3 size={24} className="text-primary"/><h2 className="text-2xl font-black uppercase tracking-tight">Analytika</h2></div>
      <div className="bg-white p-12 rounded-3xl shadow border border-dashed text-center text-gray-400 font-bold">Vizuálne grafy budú dostupné v ďalšej aktualizácii.</div>
    </div>
  );
}
