import { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, Calendar, CreditCard } from 'lucide-react';
import api from '../lib/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export default function SuperadminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to fetch from subscriptions endpoint
      let subsData = [];
      try {
        const response = await api.get('/finance/subscriptions/');
        subsData = Array.isArray(response.data) ? response.data : [];
      } catch {
        // Fallback: get subscriptions from labs endpoint
        try {
          const response = await api.get('/labs/superadmin/all');
          const labsData = response.data;
          subsData = labsData.map((lab, idx) => ({
            id: idx + 1,
            lab_id: lab.id,
            lab_name: lab.name,
            plan: lab.subscription_plan || 'free',
            status: lab.subscription_status || 'inactive',
            created_at: lab.created_at,
            updated_at: lab.updated_at
          }));
        } catch {
          // Try alternative endpoint
          const response = await api.get('/labs/');
          const labsData = Array.isArray(response.data) ? response.data : [response.data];
          subsData = labsData.map((lab, idx) => ({
            id: idx + 1,
            lab_id: lab.id,
            lab_name: lab.name,
            plan: lab.subscription_plan || 'free',
            status: lab.subscription_status || 'inactive',
            created_at: lab.created_at,
            updated_at: lab.updated_at
          }));
        }
      }
      setSubscriptions(subsData);
    } catch (err) {
      setError('Nepodarilo sa načítať predplatné: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub =>
    (sub.lab_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (sub.plan?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'pro':
        return 'bg-blue-100 text-blue-800';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'trial':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-orange-100 text-orange-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanPrice = (plan) => {
    switch (plan) {
      case 'pro':
        return '29,99 €/mes';
      case 'enterprise':
        return '99,99 €/mes';
      case 'free':
        return 'Zadarmo';
      default:
        return '-';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Správa predplatného</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Hľadať podľa laboratória alebo plánu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 outline-none"
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Celkom predplatných', value: subscriptions.length },
          { label: 'Free plán', value: subscriptions.filter(s => s.plan === 'free').length },
          { label: 'Pro plán', value: subscriptions.filter(s => s.plan === 'pro').length },
          { label: 'Enterprise plán', value: subscriptions.filter(s => s.plan === 'enterprise').length }
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Subscriptions Table */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Zoznam predplatného</h2>

        {filteredSubscriptions.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Žiadne predplatné</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Laboratórium</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Plán</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Cena</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Stav</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Vytvorené</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Aktualizované</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map(sub => (
                  <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{sub.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{sub.lab_name || '-'}</div>
                      {sub.lab_id && <div className="text-xs text-gray-500">Lab ID: {sub.lab_id}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getPlanColor(sub.plan)}>
                        {(sub.plan || 'free').toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {getPlanPrice(sub.plan)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(sub.status)}>
                        {(sub.status || 'inactive').toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">
                      {sub.updated_at ? new Date(sub.updated_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Plan Details Legend */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Detaily plánov</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="font-medium text-gray-900 mb-2">Free plán</div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Max. 1 používateľ</li>
              <li>• Základné funkcie</li>
              <li>• Uchovanie dát 30 dní</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-gray-900 mb-2">Pro plán (29,99 €/mes)</div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Max. 5 používateľov</li>
              <li>• Všetky základné funkcie</li>
              <li>• Podpora e-mailom</li>
              <li>• Neobmedzené uchovanie dát</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-gray-900 mb-2">Enterprise plán (99,99 €/mes)</div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Neobmedzený počet používateľov</li>
              <li>• Všetky funkcie</li>
              <li>• Prioritná podpora</li>
              <li>• Prístup k API</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
