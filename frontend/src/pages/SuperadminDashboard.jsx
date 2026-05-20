import { useState, useEffect } from 'react';
import { Building2, Users, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export default function SuperadminDashboard() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalLabs: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    inactiveSubscriptions: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to fetch from superadmin endpoint first
      let labsData = [];
      try {
        const response = await api.get('/labs/superadmin/all');
        labsData = response.data;
      } catch {
        // Fallback to regular labs endpoint
        const response = await api.get('/labs/');
        labsData = Array.isArray(response.data) ? response.data : [response.data];
      }

      setLabs(labsData);

      // Calculate stats
      const totalUsers = labsData.reduce((sum, lab) => sum + (lab.user_count || 0), 0);
      const active = labsData.filter(lab => lab.subscription_status === 'active').length;
      const inactive = labsData.length - active;

      setStats({
        totalLabs: labsData.length,
        totalUsers: totalUsers,
        activeSubscriptions: active,
        inactiveSubscriptions: inactive
      });
    } catch (err) {
      setError('Nepodarilo sa načítať dáta: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
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
      default:
        return 'bg-[var(--color-status-draft-bg)] text-foreground';
    }
  };

  const formatStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return 'Aktívne';
      case 'inactive':
        return 'Neaktívne';
      case 'trial':
        return 'Skúšobné';
      default:
        return 'Neaktívne';
    }
  };

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'free':
        return 'bg-[var(--color-status-draft-bg)] text-foreground';
      case 'basic':
        return 'bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)]';
      case 'premium':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-[var(--color-status-draft-bg)] text-foreground';
    }
  };

  const formatPlanLabel = (plan) => {
    switch (plan) {
      case 'free':
        return 'ZDARMA';
      case 'basic':
        return 'ZÁKLAD';
      case 'premium':
        return 'PREMIUM';
      default:
        return 'ZDARMA';
    }
  };

  const StatCard = ({ icon: iconComponent, title, value, color }) => {
    const IconComponent = iconComponent;
    
    return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <IconComponent className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
      </div>
    </Card>
  );
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
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Administrátorský panel</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Building2}
          title="Celkom laboratórií"
          value={stats.totalLabs}
          color="bg-[var(--color-primary-subtle)] text-primary"
        />
        <StatCard
          icon={Users}
          title="Celkom používateľov"
          value={stats.totalUsers}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          icon={CheckCircle2}
          title="Aktívne predplatné"
          value={stats.activeSubscriptions}
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          icon={XCircle}
          title="Neaktívne predplatné"
          value={stats.inactiveSubscriptions}
          color="bg-red-100 text-red-600"
        />
      </div>

      {/* Labs Table */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Prehľad laboratórií</h2>

        {labs.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Žiadne laboratóriá</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[var(--color-table-border)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Názov</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Mesto</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">E-mail</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Použ.</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Plán</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Stav</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Vytvorené</th>
                </tr>
              </thead>
              <tbody>
                {labs.map(lab => (
                  <tr key={lab.id} className="border-b border-[var(--color-table-border)] hover:bg-[var(--color-table-hover)]">
                    <td className="py-3 px-4 text-foreground">{lab.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{lab.name}</div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{lab.city || '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{lab.email || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{lab.user_count || 0}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getPlanColor(lab.subscription_plan)}>
                        {formatPlanLabel(lab.subscription_plan)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(lab.subscription_status)}>
                        {formatStatusLabel(lab.subscription_status)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {lab.created_at ? new Date(lab.created_at).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
