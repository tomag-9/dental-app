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
            setError('Nepodarilo sa načítať technika');
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
            setError('Meno a priezvisko sú povinné');
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
            const apiError = err.response?.data;
            if (typeof apiError?.detail === 'string') {
                setError(apiError.detail);
            } else if (apiError && typeof apiError === 'object') {
                setError(
                    Object.entries(apiError)
                        .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
                        .join(' | ')
                );
            } else {
                setError('Nepodarilo sa uložiť technika');
            }
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
                        {isEditing ? 'Upraviť technika' : 'Nový technik'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isEditing
                            ? 'Úprava údajov technika.'
                            : 'Pridanie nového technika do laboratória.'}
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
                    <CardTitle>Osobné údaje</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Meno <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="first_name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Ján"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Priezvisko <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="last_name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Novák"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Titul pred menom
                                </label>
                                <input
                                    type="text"
                                    name="title_before"
                                    value={formData.title_before}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="MUDr., Ing."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Titul za menom
                                </label>
                                <input
                                    type="text"
                                    name="title_after"
                                    value={formData.title_after}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="PhD."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">E-mail</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Telefón</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
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
                                Zrušiť
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Ukladám...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Uložiť technika
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
