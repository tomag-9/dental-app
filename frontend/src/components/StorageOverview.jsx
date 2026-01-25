import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Package, AlertTriangle, Loader2 } from 'lucide-react';

export default function StorageOverview({ token, setError }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);
                const res = await api(token).get('/warehouse/');
                setItems(res.data);
            } catch { setError('Chyba skladu'); }
            finally { setLoading(false); }
        };
        if (token) fetch();
    }, [token, setError]);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase">Prehľad skladu</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-3xl shadow border flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Package size={32}/></div>
                    <div><div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Celkom položiek</div><div className="text-3xl font-black">{items.length}</div></div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow border flex items-center gap-4 border-orange-100">
                    <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl"><AlertTriangle size={32}/></div>
                    <div><div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nízky stav</div><div className="text-3xl font-black text-orange-600">{items.filter(i => i.min_threshold && i.quantity <= i.min_threshold).length}</div></div>
                </div>
            </div>
        </div>
    );
}
