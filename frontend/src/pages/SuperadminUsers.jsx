import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import api from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function SuperadminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState({
    nickname: '',
    email: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/users/');
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError('Nepodarilo sa načítať používateľov: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/users/', formData);
      setFormData({ nickname: '', email: '', password: '', role: 'user' });
      setShowCreateForm(false);
      await fetchUsers();
    } catch (err) {
      setError('Nepodarilo sa vytvoriť používateľa: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/users/${userToDelete}`);
      await fetchUsers();
    } catch (err) {
      setError('Nepodarilo sa odstrániť používateľa: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUserToDelete(null);
    }
  };

  const filteredUsers = users.filter(user =>
    (user.nickname?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const getRoleColor = (role) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-800';
      case 'admin':
        return 'bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)]';
      case 'user':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-[var(--color-status-draft-bg)] text-foreground';
    }
  };

  const formatRoleLabel = (role) => {
    switch (role) {
      case 'superadmin':
        return 'Superadmin';
      case 'admin':
        return 'Admin';
      case 'user':
        return 'Používateľ';
      default:
        return 'Používateľ';
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
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Správa používateľov</h1>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Pridať používateľa
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Vytvoriť nového používateľa</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-sidebar-text)] mb-1">
                  Prezývka
                </label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-sidebar-text)] mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-sidebar-text)] mb-1">
                  Heslo
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-sidebar-text)] mb-1">
                  Rola
                </label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="user">Používateľ</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setShowCreateForm(false)}
                variant="outline"
              >
                Zrušiť
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Vytvoriť používateľa
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-border rounded-lg px-4 py-2">
        <Search className="w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Hľadať podľa prezývky alebo e-mailu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-white outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Users Table */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Zoznam používateľov</h2>

        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Žiadni používatelia</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[var(--color-table-border)]">
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Prezývka</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">E-mail</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Rola</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Stav</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Vytvorené</th>
                  <th className="text-left py-3 px-4 font-semibold text-[var(--color-sidebar-text)]">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b border-[var(--color-table-border)] transition-colors hover:bg-[var(--color-table-hover)]">
                    <td className="py-3 px-4 text-foreground">{user.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{user.nickname || '-'}</div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                    <td className="py-3 px-4">
                      <Badge className={getRoleColor(user.role)}>
                        {formatRoleLabel(user.role)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {user.is_active ? 'Aktívny' : 'Neaktívny'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setUserToDelete(user.id)}
                        className="text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!userToDelete}
        title="Odstrániť používateľa"
        message="Naozaj chcete odstrániť tohto používateľa?"
        confirmText="Odstrániť"
        cancelText="Zrušiť"
        destructive
        onConfirm={handleDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
}
