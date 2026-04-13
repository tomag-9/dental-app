import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function InventoryCreate() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        quantity: '0',
        unit: 'pcs',
        min_threshold: '',
        category: '',
        location: '',
        cost_price: '',
        notes: '',
    });

    const units = ['pcs', 'g', 'ml', 'kg', 'l'];

    const fetchItem = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(`/warehouse/${id}/`);
            const item = response.data;
            setFormData({
                name: item.name || '',
                sku: item.sku || '',
                quantity: item.quantity?.toString() || '0',
                unit: item.unit || 'pcs',
                min_threshold: item.min_threshold?.toString() || '',
                category: item.category || '',
                location: item.location || '',
                cost_price: item.cost_price?.toString() || '',
                notes: item.notes || '',
            });
        } catch (err) {
            console.error('Failed to fetch item:', err);
            setError('Nepodarilo sa načítať položku.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (isEditing) {
            fetchItem();
        }
    }, [isEditing, fetchItem]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim()) {
            setError('Názov položky je povinný.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                name: formData.name.trim(),
                sku: formData.sku.trim() || null,
                quantity: parseFloat(formData.quantity) || 0,
                unit: formData.unit,
                min_threshold: formData.min_threshold ? parseFloat(formData.min_threshold) : null,
                category: formData.category.trim() || null,
                location: formData.location.trim() || null,
                cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
                notes: formData.notes.trim() || null,
            };

            if (isEditing) {
                await api.put(`/warehouse/${id}/`, payload);
            } else {
                await api.post('/warehouse/', payload);
            }

            navigate('/inventory');
        } catch (err) {
            console.error('Failed to save item:', err);
            const errorMsg = err.response?.data?.detail;
            if (typeof errorMsg === 'string' && errorMsg.includes('SKU')) {
                setError('SKU musí byť jedinečné v rámci laboratória.');
            } else {
                setError(errorMsg || 'Nepodarilo sa uložiť položku.');
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
                    onClick={() => navigate('/inventory')}
                >
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isEditing ? 'Upraviť položku skladu' : 'Nová položka skladu'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isEditing
                            ? 'Úprava informácií o položke.'
                            : 'Pridanie nového materiálu alebo zásoby do skladu.'}
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
                    <CardTitle>Detaily položky</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Názov položky <span className="text-destructive">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Composite resin A2"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">SKU</label>
                                <input
                                    type="text"
                                    name="sku"
                                    value={formData.sku}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="CR-A2-001"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Unique stock keeping unit (optional)
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Kategória</label>
                                <input
                                    type="text"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Resins"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Množstvo <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="quantity"
                                    value={formData.quantity}
                                    onChange={handleChange}
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Jednotka</label>
                                <select
                                    name="unit"
                                    value={formData.unit}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {units.map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Min. zásoba</label>
                                <input
                                    type="number"
                                    name="min_threshold"
                                    value={formData.min_threshold}
                                    onChange={handleChange}
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="10"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Upozornenie na nízky stav
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Umiestnenie</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Shelf A3"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Nákupná cena (€)</label>
                                <input
                                    type="number"
                                    name="cost_price"
                                    value={formData.cost_price}
                                    onChange={handleChange}
                                    step="0.01"
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Poznámky</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Additional notes about this item..."
                                rows="3"
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/inventory')}
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
                                        Uložiť položku
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
