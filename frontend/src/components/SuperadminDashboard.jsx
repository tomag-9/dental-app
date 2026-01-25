import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ShieldCheck, Building2, Users, Loader2 } from 'lucide-react';

export default function SuperadminDashboard({ token, setError }) {
    const [stats, setStats] = useState({ labs: 0, users: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);
                const [labs, users] = await Promise.all([api(token).get('/labs/'), api(token).get('/users/')]);
                setStats({ labs: labs.data.length, users: users.data.length });
            } catch { setError('Chyba superadmina'); }
            finally { setLoading(false); }
        };
        if (token) fetch();
    }, [token, setError]);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-black uppercase flex items-center gap-2 text-red-600"><ShieldCheck size={32}/> Superadmin</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-3xl shadow border flex items-center gap-6">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Building2 size={32}/></div>
                    <div><div className="text-xs font-bold text-gray-400 uppercase">Laboratóriá</div><div className="text-4xl font-black">{stats.labs}</div></div>
                </div>
                <div className="bg-white p-8 rounded-3xl shadow border flex items-center gap-6">
                    <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl"><Users size={32}/></div>
                    <div><div className="text-xs font-bold text-gray-400 uppercase">Používatelia</div><div className="text-4xl font-black">{stats.users}</div></div>
                </div>
            </div>
        </div>
    );
}
