import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Loader2, Save, Trash2, UserPlus } from 'lucide-react';
import api from '../lib/api';

export default function ClinicCreate() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;
    const [loading, setLoading] = useState(false);
    const [doctorsLoading, setDoctorsLoading] = useState(false);
    const [doctorSubmitting, setDoctorSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [doctorError, setDoctorError] = useState('');
    const [success, setSuccess] = useState('');
    const [doctors, setDoctors] = useState([]);
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
    const [doctorForm, setDoctorForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
    });

    const fetchDoctors = useCallback(async () => {
        if (!id) return;
        setDoctorsLoading(true);
        setDoctorError('');
        try {
            const response = await api.get(`/crm/doctors/?clinic=${id}`);
            setDoctors(response.data);
        } catch (err) {
            console.error('Failed to fetch doctors for clinic:', err);
            setDoctorError('Nepodarilo sa načítať lekárov kliniky.');
        } finally {
            setDoctorsLoading(false);
        }
    }, [id]);

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
            fetchDoctors();
        }
    }, [isEditing, fetchClinic, fetchDoctors]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleDoctorChange = (e) => {
        setDoctorForm({ ...doctorForm, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            if (isEditing) {
                await api.put(`/crm/clinics/${id}/`, formData);
                setSuccess('Klinika bola úspešne aktualizovaná.');
            } else {
                const response = await api.post('/crm/clinics/', formData);
                const createdId = response?.data?.id;
                if (createdId) {
                    navigate(`/clinics/${createdId}/edit`);
                    return;
                }
                setSuccess('Klinika bola úspešne vytvorená.');
            }
        } catch (err) {
            console.error(err);
            setError(`Nepodarilo sa ${isEditing ? 'upraviť' : 'vytvoriť'} kliniku`);
        } finally {
            setLoading(false);
        }
    };

    const handleDoctorSubmit = async (e) => {
        e.preventDefault();
        if (!id) return;
        setDoctorError('');
        if (!doctorForm.first_name.trim() || !doctorForm.last_name.trim()) {
            setDoctorError('Meno a priezvisko lekára sú povinné.');
            return;
        }

        setDoctorSubmitting(true);
        try {
            await api.post('/crm/doctors/', {
                ...doctorForm,
                clinic: Number(id),
            });
            setDoctorForm({ first_name: '', last_name: '', email: '', phone: '' });
            await fetchDoctors();
        } catch (err) {
            console.error('Failed to create doctor:', err);
            setDoctorError('Nepodarilo sa pridať lekára ku klinike.');
        } finally {
            setDoctorSubmitting(false);
        }
    };

    const handleDoctorDelete = async (doctorId) => {
        setDoctorError('');
        try {
            await api.delete(`/crm/doctors/${doctorId}/`);
            setDoctors((prev) => prev.filter((doctor) => doctor.id !== doctorId));
        } catch (err) {
            console.error('Failed to delete doctor:', err);
            setDoctorError('Nepodarilo sa odstrániť lekára z kliniky.');
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

            {success && (
                <div className="p-4 bg-green-100 text-green-800 rounded-md">
                    {success}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Údaje kliniky</CardTitle>
                    <p className="text-sm text-muted-foreground">Povinné polia sú označené symbolom *</p>
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

            {isEditing && (
                <Card>
                    <CardHeader>
                        <CardTitle>Lekári kliniky</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Lekárov môžete vytvárať a spravovať priamo v rámci tejto kliniky.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {doctorError && (
                            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                                {doctorError}
                            </div>
                        )}

                        <form onSubmit={handleDoctorSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input
                                    name="first_name"
                                    value={doctorForm.first_name}
                                    onChange={handleDoctorChange}
                                    placeholder="Meno *"
                                    className="w-full p-2 border rounded-md"
                                    required
                                />
                                <input
                                    name="last_name"
                                    value={doctorForm.last_name}
                                    onChange={handleDoctorChange}
                                    placeholder="Priezvisko *"
                                    className="w-full p-2 border rounded-md"
                                    required
                                />
                                <input
                                    name="email"
                                    type="email"
                                    value={doctorForm.email}
                                    onChange={handleDoctorChange}
                                    placeholder="E-mail"
                                    className="w-full p-2 border rounded-md"
                                />
                                <input
                                    name="phone"
                                    value={doctorForm.phone}
                                    onChange={handleDoctorChange}
                                    placeholder="Telefón"
                                    className="w-full p-2 border rounded-md"
                                />
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={doctorSubmitting}>
                                    {doctorSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Pridávam...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="mr-2 h-4 w-4" />
                                            Pridať lekára
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>

                        <div className="rounded-md border">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[var(--color-table-header)] text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Meno</th>
                                        <th className="px-4 py-3 font-medium">Kontakt</th>
                                        <th className="px-4 py-3 font-medium text-right">Akcie</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {doctorsLoading ? (
                                        <tr>
                                            <td colSpan={3} className="p-4 text-center">
                                                <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                                            </td>
                                        </tr>
                                    ) : doctors.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-4 text-center text-muted-foreground">
                                                Zatiaľ nie sú priradení žiadni lekári.
                                            </td>
                                        </tr>
                                    ) : (
                                        doctors.map((doctor) => (
                                            <tr key={doctor.id} className="hover:bg-[var(--color-table-header)]">
                                                <td className="px-4 py-3 font-medium">
                                                    {doctor.first_name} {doctor.last_name}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    <div className="flex flex-col">
                                                        <span>{doctor.email || '-'}</span>
                                                        <span>{doctor.phone || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDoctorDelete(doctor.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
