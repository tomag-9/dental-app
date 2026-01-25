import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Loader2 } from 'lucide-react';

export default function LabManagement({ token, setError }) {
    const [labs, setLabs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);
                const res = await api(token).get('/labs/');
                setLabs(res.data);
            } catch { setError('Chyba laboratórií'); }
            finally { setLoading(false); }
        };
        if (token) fetch();
    }, [token, setError]);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold uppercase tracking-tight">Správa laboratórií</h2>
            <div className="bg-white rounded-2xl shadow border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest"><tr><th className="p-4">Názov</th><th className="p-4">Mesto</th></tr></thead>
                    <tbody className="divide-y">
                        {labs.map(lab => <tr key={lab.id} className="hover:bg-gray-50"><td className="p-4 font-bold">{lab.name}</td><td className="p-4">{lab.city || '-'}</td></tr>)}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
