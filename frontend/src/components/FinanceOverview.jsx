import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Wallet, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';

export default function FinanceOverview({ token, setError }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api(token).get('/invoices/');
        setInvoices(resp.data || []);
      } catch { setError?.('Chyba financií'); }
      finally { setLoading(false); }
    };
    if (token) fetchData();
  }, [token, setError]);

  const stats = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'paid');
    const unpaid = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled');
    const monthlyIncome = paid.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
    const outstanding = unpaid.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
    return { monthlyIncome, outstanding };
  }, [invoices]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-medium">
      <h2 className="text-2xl font-bold">Financie – Prehľad</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl shadow border">
            <div className="flex items-center gap-3 mb-2 text-green-600"><TrendingUp size={20} /><span className="text-xs font-bold uppercase tracking-widest">Prijaté platby</span></div>
            <div className="text-4xl font-black">{stats.monthlyIncome.toFixed(2)} €</div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow border">
            <div className="flex items-center gap-3 mb-2 text-orange-600"><AlertCircle size={20} /><span className="text-xs font-bold uppercase tracking-widest">Nevybavené faktúry</span></div>
            <div className="text-4xl font-black">{stats.outstanding.toFixed(2)} €</div>
        </div>
      </div>
    </div>
  );
}
