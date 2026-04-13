import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../lib/api';

export default function DoctorCreate() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
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

    useEffect(() => {
        if (!isEditing) return;

        const fetchDoctor = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await api.get(`/crm/doctors/${id}/`);
                const doctor = response.data;
                setFormData({
                    first_name: doctor.first_name || '',
                    last_name: doctor.last_name || '',
                    email: doctor.email || '',
                    phone: doctor.phone || '',
                    clinic: doctor.clinic || '',
                });
            } catch (err) {
                console.error('Failed to fetch doctor:', err);
                setError('Nepodarilo sa načítať lekára');
            } finally {
                setLoading(false);
            }
        };

        fetchDoctor();
    }, [id, isEditing, navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (isEditing) {
                await api.put(`/crm/doctors/${id}/`, formData);
            } else {
                await api.post('/crm/doctors/', formData);
            }
            navigate('/doctors');
        } catch (err) {
            console.error(err);
            setError(`Nepodarilo sa ${isEditing ? 'upraviť' : 'vytvoriť'} lekára`);
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
                    <h1 className="text-3xl font-bold tracking-tight">{isEditing ? 'Upraviť lekára' : 'Nový lekár'}</h1>
                    <p className="text-muted-foreground">
                        {isEditing ? 'Úprava údajov lekára.' : 'Pridanie nového lekára do systému.'}
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
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Meno <span className="text-destructive">*</span></label>
                                <input name="first_name" value={formData.first_name} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Priezvisko <span className="text-destructive">*</span></label>
                                <input name="last_name" value={formData.last_name} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Klinika</label>
                            <select name="clinic" value={formData.clinic} onChange={handleChange} className="w-full p-2 border rounded-md">
                                <option value="">Vyberte kliniku (voliteľné)</option>
                                {clinics.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">E-mail</label>
                                <input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Telefón</label>
                                <input name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => navigate('/doctors')}>
                            Zrušiť
                        </Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            <Save className="mr-2 h-4 w-4" />
                            {loading ? 'Ukladám...' : isEditing ? 'Uložiť zmeny' : 'Uložiť lekára'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
