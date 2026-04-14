import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../lib/api';

export default function ClinicCreate() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
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

    const fetchClinic = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get(`/crm/clinics/${id}/`);
            const clinic = response.data;
            setFormData({
                name: clinic.name || '',
                ico: clinic.ico || '',
                dic: clinic.dic || '',
                email: clinic.email || '',
                phone: clinic.phone || '',
                street: clinic.street || '',
                city: clinic.city || '',
                zip_code: clinic.zip_code || '',
            });
        } catch (err) {
            console.error('Failed to fetch clinic:', err);
            setError('Nepodarilo sa načítať kliniku');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (isEditing) {
            fetchClinic();
        }
    }, [isEditing, fetchClinic]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (isEditing) {
                await api.put(`/crm/clinics/${id}/`, formData);
            } else {
                await api.post('/crm/clinics/', formData);
            }
            navigate('/clinics');
        } catch (err) {
            console.error(err);
            setError(`Nepodarilo sa ${isEditing ? 'upraviť' : 'vytvoriť'} kliniku`);
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
                    <h1 className="text-3xl font-bold tracking-tight">{isEditing ? 'Upraviť kliniku' : 'Nová klinika'}</h1>
                    <p className="text-muted-foreground">
                        {isEditing ? 'Úprava údajov kliniky.' : 'Registrácia novej partnerskej kliniky.'}
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
                    <CardTitle>Údaje kliniky</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Názov kliniky <span className="text-destructive">*</span></label>
                            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-md" required />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">IČO</label>
                                <input name="ico" value={formData.ico} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">DIČ</label>
                                <input name="dic" value={formData.dic} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
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

                        <div>
                            <label className="block text-sm font-medium mb-1">Ulica a číslo</label>
                            <input name="street" value={formData.street} onChange={handleChange} className="w-full p-2 border rounded-md" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Mesto</label>
                                <input name="city" value={formData.city} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">PSČ</label>
                                <input name="zip_code" value={formData.zip_code} onChange={handleChange} className="w-full p-2 border rounded-md" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => navigate('/clinics')}>
                            Zrušiť
                        </Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            <Save className="mr-2 h-4 w-4" />
                            {loading ? 'Ukladám...' : isEditing ? 'Uložiť zmeny' : 'Uložiť kliniku'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
