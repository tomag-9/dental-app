import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import FormField from '../components/form/FormField';
import api from '../lib/api';

export default function PatientCreate() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        birth_number: '',
        email: '',
        phone: '',
        address: ''
    });

    useEffect(() => {
        if (!isEditing) return;
        const fetchPatient = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.get(`/crm/patients/${id}/`);
                const patient = response.data;
                setFormData({
                    first_name: patient.first_name || '',
                    last_name: patient.last_name || '',
                    birth_number: patient.birth_number || '',
                    email: patient.email || '',
                    phone: patient.phone || '',
                    address: patient.address || '',
                });
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.detail || 'Failed to load patient');
            } finally {
                setLoading(false);
            }
        };
        fetchPatient();
    }, [id, isEditing]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (isEditing) {
                await api.put(`/crm/patients/${id}/`, formData);
            } else {
                await api.post('/crm/patients/', formData);
            }
            navigate('/patients');
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || (isEditing ? 'Failed to update patient' : 'Failed to create patient'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => navigate('/patients')}
                    className="w-10 h-10"
                >
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{isEditing ? 'Edit Patient' : 'New Patient'}</h1>
                    <p className="text-muted-foreground">{isEditing ? 'Update patient record.' : 'Add a new patient record.'}</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name Fields */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <FormField
                                label="First Name"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                required
                            />
                            <FormField
                                label="Last Name"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* Birth Number */}
                        <FormField
                            label="Birth Number (RC)"
                            name="birth_number"
                            value={formData.birth_number}
                            onChange={handleChange}
                            placeholder="e.g. 851212/1234"
                            helpText="Patient's birth/identification number"
                            required
                        />

                        {/* Contact Fields */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <FormField
                                label="Email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                            />
                            <FormField
                                label="Phone"
                                name="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>

                        {/* Address */}
                        <FormField
                            label="Address"
                            name="address"
                            type="textarea"
                            value={formData.address}
                            onChange={handleChange}
                            rows={3}
                        />

                        {/* Actions */}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
                            <Button 
                                type="button"
                                variant="outline" 
                                onClick={() => navigate('/patients')}
                                className="w-full sm:w-auto"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit"
                                disabled={loading}
                                className="w-full sm:w-auto"
                            >
                                <Save className="mr-2 h-4 w-4" />
                                {loading ? 'Saving...' : isEditing ? 'Update Patient' : 'Save Patient'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
