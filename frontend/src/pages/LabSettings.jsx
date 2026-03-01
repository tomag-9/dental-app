import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Save, Loader2, AlertCircle } from 'lucide-react';

export default function LabSettings() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        city: '',
        postal_code: '',
        country: 'Slovakia',
        phone: '',
        email: '',
        website: '',
        tax_id: '',
        vat_id: '',
        bank_account: '',
        bank_bic: '',
    });

    useEffect(() => {
        fetchLabSettings();
    }, []);

    const fetchLabSettings = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/labs/');
            if (response.data && response.data.length > 0) {
                const lab = response.data[0]; // Get first (current) lab
                setFormData({
                    name: lab.name || '',
                    address: lab.address || '',
                    city: lab.city || '',
                    postal_code: lab.postal_code || '',
                    country: lab.country || 'Slovakia',
                    phone: lab.phone || '',
                    email: lab.email || '',
                    website: lab.website || '',
                    tax_id: lab.tax_id || '',
                    vat_id: lab.vat_id || '',
                    bank_account: lab.bank_account || '',
                    bank_bic: lab.bank_bic || '',
                });
            }
        } catch (err) {
            console.error('Failed to fetch lab settings:', err);
            setError('Failed to load lab settings');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.name.trim()) {
            setError('Lab name is required');
            return;
        }

        setLoading(true);
        try {
            // Update lab - would need lab ID
            // For now, this is a placeholder
            setSuccess('Lab settings would be updated here');
            setError('Lab update functionality not yet fully implemented');
        } catch (err) {
            console.error('Failed to update lab:', err);
            setError('Failed to update lab settings');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Lab Information</h2>
                <p className="text-muted-foreground">Configure your dental laboratory details.</p>
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
                    <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Lab Name <span className="text-destructive">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="DentalLab Inc."
                                required
                            />
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
                                    placeholder="lab@example.com"
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

                        <div>
                            <label className="block text-sm font-medium mb-2">Website</label>
                            <input
                                type="url"
                                name="website"
                                value={formData.website}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="https://example.com"
                            />
                        </div>

                        <div className="pt-4 border-t">
                            <h3 className="font-medium mb-4">Address</h3>
                            <div>
                                <label className="block text-sm font-medium mb-2">Address</label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="123 Main Street"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">City</label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Bratislava"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Postal Code</label>
                                    <input
                                        type="text"
                                        name="postal_code"
                                        value={formData.postal_code}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="81000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Country</label>
                                    <input
                                        type="text"
                                        name="country"
                                        value={formData.country}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Slovakia"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <h3 className="font-medium mb-4">Tax & Banking</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Tax ID (IČO)</label>
                                    <input
                                        type="text"
                                        name="tax_id"
                                        value={formData.tax_id}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="12345678"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">VAT ID (IČ DPH)</label>
                                    <input
                                        type="text"
                                        name="vat_id"
                                        value={formData.vat_id}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="SK12345678"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Bank Account (IBAN)</label>
                                    <input
                                        type="text"
                                        name="bank_account"
                                        value={formData.bank_account}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="SK12 1234 5678 9012 3456"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">BIC/SWIFT</label>
                                    <input
                                        type="text"
                                        name="bank_bic"
                                        value={formData.bank_bic}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="TATRSKBX"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Settings
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
