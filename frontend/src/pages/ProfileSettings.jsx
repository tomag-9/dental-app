import { useState } from 'react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import useAuthStore from '../store/auth';

export default function ProfileSettings() {
    const user = useAuthStore(state => state.user);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        nickname: user?.nickname || '',
        email: user?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.currentPassword) {
            setError('Current password is required');
            return;
        }

        if (!formData.newPassword) {
            setError('New password is required');
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            // Note: Password change endpoint might need to be implemented
            setError('Password change functionality not yet implemented');
        } catch (err) {
            console.error('Failed to change password:', err);
            setError('Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        setLoading(true);
        try {
            // Update profile endpoint
            await api.put(`/users/${user?.id}`, {
                nickname: formData.nickname || null,
                email: formData.email || null,
            });
            setSuccess('Profile updated successfully');
        } catch (err) {
            console.error('Failed to update profile:', err);
            setError(err.response?.data?.detail || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Account Settings</h2>
                <p className="text-muted-foreground">Manage your personal account information.</p>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md flex gap-2 items-start">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="p-4 bg-green-100 text-green-800 rounded-md">
                    {success}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Display Name</label>
                                <input
                                    type="text"
                                    name="nickname"
                                    value={formData.nickname}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Your display name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="your@email.com"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Profile
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Current Password</label>
                            <input
                                type="password"
                                name="currentPassword"
                                value={formData.currentPassword}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">New Password</label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Update Password
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
