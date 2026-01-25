import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../lib/api';

export default function ClinicCreate() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        ico: '',
        dic: '',
        email: '',
        phone: '',
        street: '',
        city: '',
        zip_code: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/crm/clinics/', formData);
            navigate('/clinics');
        } catch (err) {
            console.error(err);
            alert('Failed to create clinic');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/clinics')}>
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">New Clinic</h1>
                    <p className="text-muted-foreground">Register a new partner clinic.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Clinic Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Clinic Name</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">ICO (ID)</label>
                                <input name="ico" value={formData.ico} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">DIC (Tax ID)</label>
                                <input name="dic" value={formData.dic} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Phone</label>
                                <input name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Street Address</label>
                            <input name="street" value={formData.street} onChange={handleChange} className="w-full p-2 border rounded-md" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">City</label>
                                <input name="city" value={formData.city} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">ZIP Code</label>
                                <input name="zip_code" value={formData.zip_code} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button onClick={handleSubmit} disabled={loading}>
                            <Save className="mr-2 h-4 w-4" />
                            {loading ? 'Saving...' : 'Save Clinic'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
