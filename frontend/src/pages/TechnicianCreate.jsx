import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function TechnicianCreate() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        title_before: '',
        title_after: '',
        email: '',
        phone: '',
    });

    const fetchTechnician = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(`/jobs/technicians/${id}/`);
            const tech = response.data;
            setFormData({
                first_name: tech.first_name || '',
                last_name: tech.last_name || '',
                title_before: tech.title_before || '',
                title_after: tech.title_after || '',
                email: tech.contact_info?.email || '',
                phone: tech.contact_info?.phone || '',
            });
        } catch (err) {
            console.error('Failed to fetch technician:', err);
            setError('Failed to load technician');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (isEditing) {
            fetchTechnician();
        }
    }, [isEditing, fetchTechnician]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate required fields
        if (!formData.first_name.trim() || !formData.last_name.trim()) {
            setError('First name and last name are required');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                title_before: formData.title_before.trim() || null,
                title_after: formData.title_after.trim() || null,
                contact_info: {
                    email: formData.email.trim() || null,
                    phone: formData.phone.trim() || null,
                },
            };

            if (isEditing) {
                await api.put(`/jobs/technicians/${id}/`, payload);
            } else {
                await api.post('/jobs/technicians/', payload);
            }

            navigate('/technicians');
        } catch (err) {
            console.error('Failed to save technician:', err);
            setError(err.response?.data?.detail || 'Failed to save technician');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/technicians')}
                >
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isEditing ? 'Edit Technician' : 'New Technician'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isEditing
                            ? 'Update technician information.'
                            : 'Add a new technician to the lab.'}
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    First Name <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="John"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Last Name <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Smith"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Title Before
                                </label>
                                <input
                                    type="text"
                                    name="title_before"
                                    value={formData.title_before}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Dr., Prof., etc."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Title After
                                </label>
                                <input
                                    type="text"
                                    name="title_after"
                                    value={formData.title_after}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Jr., Sr., etc."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Phone</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="+421 123 456 789"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/technicians')}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Technician
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
