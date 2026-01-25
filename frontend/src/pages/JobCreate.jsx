import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react';
import ToothMap from '../components/dental/ToothMap';
import api from '../lib/api';

export default function JobCreate() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Form Data
    const [patientId, setPatientId] = useState('');
    const [doctorId, setDoctorId] = useState('');
    const [clinicId, setClinicId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [toothData, setToothData] = useState({});

    // Dropdown Data
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [clinics, setClinics] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pRes, dRes, cRes] = await Promise.all([
                    api.get('/crm/patients/'),
                    api.get('/crm/doctors/'),
                    api.get('/crm/clinics/')
                ]);
                setPatients(pRes.data);
                setDoctors(dRes.data);
                setClinics(cRes.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/jobs/jobs/', {
                patient: patientId,
                doctor: doctorId,
                clinic: clinicId,
                due_date: dueDate,
                input_tooth_procedures: toothData,
                status: 'new'
            });
            navigate('/jobs');
        } catch (err) {
            console.error(err);
            alert('Failed to create job');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}>
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">New Job</h1>
                    <p className="text-muted-foreground">Create a new work order.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Form */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Job Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Patient</label>
                                <select
                                    className="w-full p-2 border rounded-md"
                                    value={patientId}
                                    onChange={e => setPatientId(e.target.value)}
                                >
                                    <option value="">Select Patient</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Clinic</label>
                                <select
                                    className="w-full p-2 border rounded-md"
                                    value={clinicId}
                                    onChange={e => setClinicId(e.target.value)}
                                >
                                    <option value="">Select Clinic</option>
                                    {clinics.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Doctor</label>
                                <select
                                    className="w-full p-2 border rounded-md"
                                    value={doctorId}
                                    onChange={e => setDoctorId(e.target.value)}
                                >
                                    <option value="">Select Doctor</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Due Date</label>
                                <input
                                    type="date"
                                    className="w-full p-2 border rounded-md"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Button className="w-full" size="lg" onClick={handleSubmit} disabled={loading}>
                        <Save className="mr-2 h-4 w-4" />
                        {loading ? 'Creating...' : 'Create Job'}
                    </Button>
                </div>

                {/* Right Column: Tooth Map */}
                <div className="lg:col-span-2">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Dental Cross / Procedures</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ToothMap
                                editable={true}
                                value={toothData}
                                onChange={setToothData}
                            />

                            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-semibold text-sm mb-2">Selected Procedures:</h4>
                                {Object.keys(toothData).length === 0 ? (
                                    <p className="text-xs text-muted-foreground">None selected</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(toothData).map(([tooth, code]) => (
                                            <div key={tooth} className="bg-white border rounded px-2 py-1 text-xs font-mono shadow-sm">
                                                <b>{tooth}</b>: {code}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
