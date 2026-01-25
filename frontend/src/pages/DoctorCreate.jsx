import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../lib/api';

export default function DoctorCreate() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [clinics, setClinics] = useState([]);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        clinic: ''
    });

    useEffect(() => {
        // Fetch clinics for dropdown
        api.get('/crm/clinics/').then(res => setClinics(res.data)).catch(console.error);
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/crm/doctors/', formData);
            navigate('/doctors');
        } catch (err) {
            console.error(err);
            alert('Failed to create doctor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/doctors')}>
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">New Doctor</h1>
                    <p className="text-muted-foreground">Add a new doctor to the system.</p>
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
                            <label className="block text-sm font-medium mb-1">Clinic</label>
                            <select name="clinic" value={formData.clinic} onChange={handleChange} className="w-full p-2 border rounded-md">
                                <option value="">Select Clinic (Optional)</option>
                                {clinics.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
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
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button onClick={handleSubmit} disabled={loading}>
                            <Save className="mr-2 h-4 w-4" />
                            {loading ? 'Saving...' : 'Save Doctor'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
