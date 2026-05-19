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
        return 'bg-[var(--color-status-draft-bg)] text-foreground';
      case 'pro':
        return 'bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)]';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-[var(--color-status-draft-bg)] text-foreground';
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
        return 'bg-[var(--color-status-draft-bg)] text-foreground';
      default:
        return 'bg-[var(--color-status-draft-bg)] text-foreground';
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

  const formatPlanLabel = (plan) => {
    switch (plan) {
      case 'free':
        return 'ZDARMA';
      case 'pro':
        return 'PRO';
      case 'enterprise':
        return 'ENTERPRISE';
      default:
        return 'ZDARMA';
    }
  };

  const formatStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return 'AKTÍVNE';
      case 'inactive':
        return 'NEAKTÍVNE';
      case 'trial':
        return 'SKÚŠOBNÉ';
      case 'expired':
        return 'EXPIROVANÉ';
      case 'cancelled':
        return 'ZRUŠENÉ';
      default:
        return 'NEAKTÍVNE';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
      <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-4 py-2">
        <Search className="w-5 h-5 text-muted-foreground" />
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
          { label: 'Plán zdarma', value: subscriptions.filter(s => s.plan === 'free').length },
          { label: 'Plán Pro', value: subscriptions.filter(s => s.plan === 'pro').length },
          { label: 'Enterprise plán', value: subscriptions.filter(s => s.plan === 'enterprise').length }
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Subscriptions Table */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Zoznam predplatného</h2>

        {filteredSubscriptions.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Žiadne predplatné</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[var(--color-table-border)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Laboratórium</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Plán</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Cena</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Stav</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Vytvorené</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Aktualizované</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map(sub => (
                  <tr key={sub.id} className="border-b border-[var(--color-table-border)] hover:bg-[var(--color-table-hover)]">
                    <td className="py-3 px-4 text-foreground">{sub.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{sub.lab_name || '-'}</div>
                      {sub.lab_id && <div className="text-xs text-muted-foreground">ID laboratória: {sub.lab_id}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getPlanColor(sub.plan)}>
                        {formatPlanLabel(sub.plan)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {getPlanPrice(sub.plan)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(sub.status)}>
                        {formatStatusLabel(sub.status)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">
                      {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">
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
            <div className="font-medium text-foreground mb-2">Plán zdarma</div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Max. 1 používateľ</li>
              <li>• Základné funkcie</li>
              <li>• Uchovanie dát 30 dní</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-foreground mb-2">Pro plán (29,99 €/mes)</div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Max. 5 používateľov</li>
              <li>• Všetky základné funkcie</li>
              <li>• Podpora e-mailom</li>
              <li>• Neobmedzené uchovanie dát</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-foreground mb-2">Enterprise plán (99,99 €/mes)</div>
            <ul className="text-sm text-muted-foreground space-y-1">
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
