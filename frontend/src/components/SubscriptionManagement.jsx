import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Loader2 } from 'lucide-react';

export default function SubscriptionManagement({ token, setError }) {
    const [subs, setSubs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);
                const res = await api(token).get('/subscriptions/');
                setSubs(res.data);
            } catch { setError('Chyba predplatného'); }
            finally { setLoading(false); }
        };
        if (token) fetch();
    }, [token, setError]);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold uppercase tracking-tight">Predplatné</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subs.map(sub => (
                    <div key={sub.id} className="bg-white p-6 rounded-2xl shadow border">
                        <div className="text-[10px] font-black text-gray-400 uppercase">Lab ID: {sub.lab}</div>
                        <h3 className="text-xl font-black uppercase">{sub.plan} Plan</h3>
                        <div className="mt-4 text-sm font-bold text-primary uppercase">{sub.status}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
