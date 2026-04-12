import { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, MapPin, Mail, Phone, Globe } from 'lucide-react';
import api from '../lib/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export default function SuperadminLabs() {
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLabs();
  }, []);

  const fetchLabs = async () => {
    setLoading(true);
    setError(null);
    try {
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
    } catch (err) {
      setError('Failed to load labs: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const filteredLabs = labs.filter(lab =>
    (lab.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (lab.city?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (lab.email?.toLowerCase() || '').includes(search.toLowerCase())
  );

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
        <h1 className="text-4xl font-bold">Labs Management</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-4 py-2">
        <Search className="w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Hľadať podľa názvu, mesta alebo e-mailu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 outline-none bg-transparent placeholder:text-slate-500"
        />
      </div>

      {/* Labs Grid */}
      {filteredLabs.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No labs found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLabs.map(lab => (
            <Card key={lab.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                {/* Header */}
                <div className="border-b pb-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{lab.name}</h3>
                      <p className="text-sm text-gray-500">ID: {lab.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={getPlanColor(lab.subscription_plan)}>
                      {(lab.subscription_plan || 'free').toUpperCase()}
                    </Badge>
                    <Badge className={getStatusColor(lab.subscription_status)}>
                      {lab.subscription_status || 'inactive'}
                    </Badge>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 text-sm">
                  {lab.city && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>{lab.city}</span>
                    </div>
                  )}
                  
                  {lab.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <a href={`mailto:${lab.email}`} className="hover:text-blue-600">
                        {lab.email}
                      </a>
                    </div>
                  )}

                  {lab.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <a href={`tel:${lab.phone}`} className="hover:text-blue-600">
                        {lab.phone}
                      </a>
                    </div>
                  )}

                  {lab.website && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Globe className="w-4 h-4 flex-shrink-0" />
                      <a href={lab.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                        {lab.website}
                      </a>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-gray-500">Users</p>
                    <p className="text-lg font-bold text-gray-900">{lab.user_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium text-gray-900">
                      {lab.created_at ? new Date(lab.created_at).toLocaleDateString() : '-'}
                    </p>
                  </div>
                </div>

                {/* Tax & Banking Info */}
                {(lab.tax_id || lab.vat_id || lab.bank_account) && (
                  <div className="bg-gray-50 p-3 rounded-lg text-xs space-y-1">
                    {lab.tax_id && <div><span className="font-medium">Tax ID:</span> {lab.tax_id}</div>}
                    {lab.vat_id && <div><span className="font-medium">VAT ID:</span> {lab.vat_id}</div>}
                    {lab.bank_account && <div><span className="font-medium">Bank:</span> {lab.bank_account}</div>}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
