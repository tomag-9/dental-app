import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Plus, Search, Loader2, Trash2, Check, X } from 'lucide-react';

export default function UsersSettings() {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [userToDelete, setUserToDelete] = useState(null);
    const [showNewUserForm, setShowNewUserForm] = useState(false);
    const [formData, setFormData] = useState({
        nickname: '',
        email: '',
        password: '',
        role: 'user',
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/users/');
            setUsers(response.data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setError('Nepodarilo sa načítať používateľov.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.nickname && !formData.email) {
            setError('Zadajte prezývku alebo e-mail.');
            return;
        }

        try {
            await api.post('/users/', {
                nickname: formData.nickname || null,
                email: formData.email || null,
                password: formData.password,
                role: formData.role,
            });
            await fetchUsers();
            setFormData({ nickname: '', email: '', password: '', role: 'user' });
            setShowNewUserForm(false);
        } catch (err) {
            console.error('Failed to create user:', err);
            setError(err.response?.data?.detail || 'Nepodarilo sa vytvoriť používateľa.');
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;

        try {
            await api.delete(`/users/${userToDelete}/`);
            await fetchUsers();
        } catch (err) {
            console.error('Failed to delete user:', err);
            setError(err.response?.data?.detail || 'Nepodarilo sa odstrániť používateľa.');
        } finally {
            setUserToDelete(null);
        }
    };

    const filteredUsers = users.filter(user =>
        (user.nickname || '').toLowerCase().includes(search.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Členovia tímu</h2>
                    <p className="text-muted-foreground">Správa používateľov laboratória a ich rolí.</p>
                </div>
                <Button onClick={() => setShowNewUserForm(!showNewUserForm)}>
                    <Plus className="mr-2 h-4 w-4" /> Pridať používateľa
                </Button>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

            {showNewUserForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>Pridať nového používateľa</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Prezývka</label>
                                    <input
                                        type="text"
                                        value={formData.nickname}
                                        onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="john.smith"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">E-mail</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="john@example.com"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Heslo</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Rola</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="user">Používateľ</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button type="submit">Uložiť používateľa</Button>
                                <Button type="button" variant="outline" onClick={() => setShowNewUserForm(false)}>
                                    Zrušiť
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Všetci používatelia ({filteredUsers.length})</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                placeholder="Hľadať používateľov..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Žiadni používatelia sa nenašli.
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-left">Meno</th>
                                        <th className="px-4 py-3 font-medium text-left">E-mail</th>
                                        <th className="px-4 py-3 font-medium text-left">Rola</th>
                                        <th className="px-4 py-3 font-medium text-left">Stav</th>
                                        <th className="px-4 py-3 font-medium text-right">Akcie</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="border-t hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3 font-medium">
                                                {user.nickname || user.email?.split('@')[0] || `User #${user.id}`}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {user.email || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1">
                                                    {user.is_active ? (
                                                        <>
                                                            <Check className="h-4 w-4 text-green-600" />
                                                            <span className="text-green-700">Aktívny</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <X className="h-4 w-4 text-red-600" />
                                                            <span className="text-red-700">Neaktívny</span>
                                                        </>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setUserToDelete(user.id)}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
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
