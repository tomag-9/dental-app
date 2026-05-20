import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function PriceListCreate() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        code: '',
        description: '',
        price: '',
        valid_from: '',
        valid_to: '',
        hasExpiry: false,
    });

    const fetchItem = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(`/finance/price-list/${id}/`);
            const item = response.data;
            setFormData({
                code: item.code || '',
                description: item.description || '',
                price: item.price || '',
                valid_from: item.valid_from || '',
                valid_to: item.valid_to || '',
                hasExpiry: !!item.valid_to,
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
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({
                ...prev,
                [name]: checked,
                // Clear valid_to if unchecking expiry checkbox
                ...(name === 'hasExpiry' && !checked && { valid_to: '' })
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate required fields
        if (!formData.code.trim()) {
            setError('Kód je povinný.');
            return;
        }
        if (!formData.description.trim()) {
            setError('Popis je povinný.');
            return;
        }
        if (!formData.price || parseFloat(formData.price) <= 0) {
            setError('Cena musí byť väčšia ako 0.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                code: formData.code.trim(),
                description: formData.description.trim(),
                price: parseFloat(formData.price),
                valid_from: formData.valid_from || null,
                valid_to: formData.hasExpiry && formData.valid_to ? formData.valid_to : null,
            };

            if (isEditing) {
                await api.put(`/finance/price-list/${id}/`, payload);
            } else {
                await api.post('/finance/price-list/', payload);
            }

            navigate('/price-list');
        } catch (err) {
            console.error('Failed to save item:', err);
            setError(err.response?.data?.detail || 'Nepodarilo sa uložiť položku.');
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
                    onClick={() => navigate('/price-list')}
                >
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isEditing ? 'Upraviť položku cenníka' : 'Nová položka cenníka'}
                    </h1>
                    <p className="text-muted-foreground">
                        {isEditing
                            ? 'Úprava cenovej položky.'
                            : 'Pridanie novej služby alebo výkonu do cenníka.'}
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
                    <CardTitle>Informácie o položke</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Kód <span className="text-destructive">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="CROWN_PREP"
                                    required
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Jedinečný kód pre túto službu
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Cena <span className="text-destructive">*</span>
                                </label>
                                <div className="flex items-center">
                                    <span className="text-muted-foreground mr-2">€</span>
                                    <input
                                        type="number"
                                        name="price"
                                        value={formData.price}
                                        onChange={handleChange}
                                        step="0.01"
                                        min="0"
                                        className="flex-1 px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="250.50"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Popis <span className="text-destructive">*</span>
                            </label>
                            <input
                                type="text"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Preparácia korunky"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Platný od
                                </label>
                                <input
                                    type="date"
                                    name="valid_from"
                                    value={formData.valid_from}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <div>
                                <div className="mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="hasExpiry"
                                            checked={formData.hasExpiry}
                                            onChange={handleChange}
                                            className="w-4 h-4 rounded border-input cursor-pointer"
                                        />
                                        <span className="text-sm font-medium">
                                            Má dátum platnosti
                                        </span>
                                    </label>
                                </div>
                                {formData.hasExpiry && (
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Platný do
                                        </label>
                                        <input
                                            type="date"
                                            name="valid_to"
                                            value={formData.valid_to}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/price-list')}
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

            <Card className="bg-[var(--color-table-header)]">
                <CardHeader>
                    <CardTitle className="text-base">Informácie</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    <ul className="list-disc list-inside space-y-1">
                        <li>Kód musí byť jedinečný v rámci cenníka</li>
                        <li>Cena sa zobrazuje s 2 desatinnými miestami</li>
                        <li>Dátumy platnosti sú voliteľné a môžu slúžiť na sledovanie sezónnych cien</li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
