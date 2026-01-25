import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../lib/api';

export default function PatientCreate() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        birth_number: '',
        email: '',
        phone: '',
        address: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/crm/patients/', formData);
            navigate('/patients');
        } catch (err) {
            console.error(err);
            alert('Failed to create patient');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/patients')}>
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">New Patient</h1>
                    <p className="text-muted-foreground">Add a new patient record.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">First Name</label>
                                <input name="first_name" value={formData.first_name} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Last Name</label>
                                <input name="last_name" value={formData.last_name} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Birth Number (RC)</label>
                            <input name="birth_number" value={formData.birth_number} onChange={handleChange} className="w-full p-2 border rounded-md" placeholder="e.g. 851212/1234" required />
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
                            <label className="block text-sm font-medium mb-1">Address</label>
                            <textarea name="address" value={formData.address} onChange={handleChange} className="w-full p-2 border rounded-md" rows={3} />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button onClick={handleSubmit} disabled={loading}>
                            <Save className="mr-2 h-4 w-4" />
                            {loading ? 'Saving...' : 'Save Patient'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
