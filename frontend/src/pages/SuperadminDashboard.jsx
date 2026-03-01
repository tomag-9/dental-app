import { useState, useEffect } from 'react';
import { Building2, Users, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

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
      setError('Failed to load dashboard data: ' + (err.response?.data?.detail || err.message));
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
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'basic':
        return 'bg-blue-100 text-blue-800';
      case 'premium':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Superadmin Dashboard</h1>
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
          title="Total Labs"
          value={stats.totalLabs}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={Users}
          title="Total Users"
          value={stats.totalUsers}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          icon={CheckCircle2}
          title="Active Subscriptions"
          value={stats.activeSubscriptions}
          color="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          icon={XCircle}
          title="Inactive Subscriptions"
          value={stats.inactiveSubscriptions}
          color="bg-red-100 text-red-600"
        />
      </div>

      {/* Labs Table */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Labs Overview</h2>

        {labs.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No labs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">City</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Users</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                </tr>
              </thead>
              <tbody>
                {labs.map(lab => (
                  <tr key={lab.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{lab.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{lab.name}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{lab.city || '-'}</td>
                    <td className="py-3 px-4 text-gray-600">{lab.email || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{lab.user_count || 0}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getPlanColor(lab.subscription_plan)}>
                        {(lab.subscription_plan || 'free').toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(lab.subscription_status)}>
                        {lab.subscription_status || 'inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
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
