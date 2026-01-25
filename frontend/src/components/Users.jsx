import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Loader2, Edit2, Trash2 } from 'lucide-react';

export default function Users({ token, setError }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api(token).get('/users/');
      setUsers(response.data);
    } catch { setError('Chyba používateľov'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetchUsers(); }, [token]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold">Používatelia</h2>
        <div className="bg-white rounded-2xl shadow border overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400"><tr><th className="p-4">Email</th><th className="p-4">Rola</th></tr></thead>
                <tbody className="divide-y font-medium text-sm">
                    {users.map(u => <tr key={u.id} className="hover:bg-gray-50"><td className="p-4">{u.email}</td><td className="p-4 uppercase">{u.role}</td></tr>)}
                </tbody>
            </table>
        </div>
    </div>
  );
}
