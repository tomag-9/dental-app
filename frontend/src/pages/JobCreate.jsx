import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save } from 'lucide-react';
import ToothMap from '../components/dental/ToothMap';
import api from '../lib/api';

export default function JobCreate() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('new');
    const [description, setDescription] = useState('');
    const [technicianId, setTechnicianId] = useState('');
    const [error, setError] = useState('');
    const [toothColor, setToothColor] = useState('');
    const [procedureQuantities, setProcedureQuantities] = useState({});
    const [selectedProcedureCode, setSelectedProcedureCode] = useState('');
    const [selectedProcedureQty, setSelectedProcedureQty] = useState(1);
    const [toastMessage, setToastMessage] = useState('');
    const toastTimeoutRef = useRef(null);

    // Form Data
    const [patientId, setPatientId] = useState('');
    const [doctorId, setDoctorId] = useState('');
    const [clinicId, setClinicId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [tryInDate, setTryInDate] = useState('');
    const [toothData, setToothData] = useState({});
    const [currentStep, setCurrentStep] = useState(1);

    // Dropdown Data
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [clinics, setClinics] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [priceList, setPriceList] = useState([]);
    const [patientQuery, setPatientQuery] = useState('');
    const [clinicQuery, setClinicQuery] = useState('');
    const [doctorQuery, setDoctorQuery] = useState('');
    const [technicianQuery, setTechnicianQuery] = useState('');

    const toothColorOptions = [
        'A1', 'A2', 'A3', 'A4',
        'B1', 'B2', 'B3', 'B4',
        'C1', 'C2', 'C3', 'C4',
        'D1', 'D2', 'D3', 'D4',
    ];

    const normalizeListResponse = (responseData) => {
        if (Array.isArray(responseData)) return responseData;
        if (Array.isArray(responseData?.results)) return responseData.results;
        return [];
    };

    const normalizeText = (value) => String(value ?? '').toLowerCase();

    const getPatientBirthYear = (patient) => {
        if (patient?.birth_year) return String(patient.birth_year);
        if (patient?.year_of_birth) return String(patient.year_of_birth);

        if (patient?.birth_date) {
            const date = new Date(patient.birth_date);
            if (!Number.isNaN(date.getTime())) {
                return String(date.getFullYear());
            }
        }

        const rawBirthNumber = String(patient?.birth_number ?? '').replace(/\D/g, '');
        if (rawBirthNumber.length >= 2) {
            const yy = Number(rawBirthNumber.slice(0, 2));
            if (Number.isFinite(yy)) {
                const currentYY = new Date().getFullYear() % 100;
                const fullYear = yy <= currentYY ? 2000 + yy : 1900 + yy;
                return String(fullYear);
            }
        }

        return '';
    };

    const showToast = (message) => {
        setToastMessage(message);
        if (toastTimeoutRef.current) {
            window.clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = window.setTimeout(() => {
            setToastMessage('');
            toastTimeoutRef.current = null;
        }, 3500);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pRes, dRes, cRes, tRes, prRes] = await Promise.all([
                    api.get('/crm/patients/'),
                    api.get('/crm/doctors/'),
                    api.get('/crm/clinics/'),
                    api.get('/jobs/technicians/'),
                    api.get('/finance/price-list/')
                ]);
                setPatients(normalizeListResponse(pRes.data));
                setDoctors(normalizeListResponse(dRes.data));
                setClinics(normalizeListResponse(cRes.data));
                setTechnicians(normalizeListResponse(tRes.data));
                setPriceList(normalizeListResponse(prRes.data));
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current) {
                window.clearTimeout(toastTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isEditing) return;
        const fetchJob = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await api.get(`/jobs/jobs/${id}/`);
                const job = response.data;
                setPatientId(job.patient ? String(job.patient) : '');
                setDoctorId(job.doctor ? String(job.doctor) : '');
                setClinicId(job.clinic ? String(job.clinic) : '');
                setTechnicianId(job.technician ? String(job.technician) : '');
                setDueDate(job.due_date || '');
                setStartDate(job.start_date || '');
                setEndDate(job.end_date || '');
                setTryInDate(job.try_in_date || '');
                setStatus(job.status || 'new');
                setDescription(job.description || '');
                setToothData(job.input_tooth_procedures || {});
                setToothColor(job.tooth_color || '');

                const sourceQuantities = job.procedure_quantities;
                if (sourceQuantities && typeof sourceQuantities === 'object') {
                    setProcedureQuantities(sourceQuantities);
                } else if (Array.isArray(job.procedure_codes)) {
                    const fallback = job.procedure_codes.reduce((acc, code) => {
                        acc[code] = 1;
                        return acc;
                    }, {});
                    setProcedureQuantities(fallback);
                } else {
                    setProcedureQuantities({});
                }
            } catch (err) {
                console.error(err);
                setError('Nepodarilo sa načítať prácu');
            } finally {
                setLoading(false);
            }
        };
        fetchJob();
    }, [id, isEditing, navigate]);

    const selectedProcedureCodes = useMemo(
        () => Object.keys(procedureQuantities),
        [procedureQuantities]
    );

    const availableProcedureOptions = useMemo(
        () => priceList.filter(item => !selectedProcedureCodes.includes(item.code)),
        [priceList, selectedProcedureCodes]
    );

    const totalProcedurePrice = useMemo(() => {
        return selectedProcedureCodes.reduce((sum, code) => {
            const item = priceList.find(p => p.code === code);
            const unitPrice = Number(item?.price || 0);
            const quantity = Number(procedureQuantities[code] || 0);
            return sum + (unitPrice * quantity);
        }, 0);
    }, [selectedProcedureCodes, procedureQuantities, priceList]);

    const filteredPatients = useMemo(() => {
        const query = normalizeText(patientQuery).trim();
        if (!query) return patients;

        return patients.filter((patient) => {
            const haystack = [
                patient?.id,
                patient?.first_name,
                patient?.last_name,
                patient?.email,
                patient?.birth_number,
                getPatientBirthYear(patient),
            ];

            return haystack.some((value) => normalizeText(value).includes(query));
        });
    }, [patients, patientQuery]);

    const filteredClinics = useMemo(() => {
        const query = normalizeText(clinicQuery).trim();
        if (!query) return clinics;

        return clinics.filter((clinic) => {
            const haystack = [clinic?.id, clinic?.name, clinic?.ico];
            return haystack.some((value) => normalizeText(value).includes(query));
        });
    }, [clinics, clinicQuery]);

    const filteredDoctors = useMemo(() => {
        const query = normalizeText(doctorQuery).trim();
        if (!query) return doctors;

        return doctors.filter((doctor) => {
            const haystack = [doctor?.id, doctor?.first_name, doctor?.last_name, doctor?.email];
            return haystack.some((value) => normalizeText(value).includes(query));
        });
    }, [doctors, doctorQuery]);

    const filteredTechnicians = useMemo(() => {
        const query = normalizeText(technicianQuery).trim();
        if (!query) return technicians;

        return technicians.filter((technician) => {
            const haystack = [
                technician?.id,
                technician?.first_name,
                technician?.last_name,
                technician?.contact_info?.email,
            ];
            return haystack.some((value) => normalizeText(value).includes(query));
        });
    }, [technicians, technicianQuery]);

    const getApiError = (err, fallbackMessage) => {
        const payload = err?.response?.data;
        if (typeof payload?.detail === 'string') return payload.detail;
        if (payload && typeof payload === 'object') {
            return Object.entries(payload)
                .map(([field, value]) => {
                    const text = Array.isArray(value) ? value.join(', ') : String(value);
                    return `${field}: ${text}`;
                })
                .join(' | ');
        }
        return fallbackMessage;
    };

    const addProcedure = () => {
        if (!selectedProcedureCode) return;
        const qty = Math.max(1, Number(selectedProcedureQty) || 1);
        setProcedureQuantities(prev => ({ ...prev, [selectedProcedureCode]: qty }));
        setSelectedProcedureCode('');
        setSelectedProcedureQty(1);
    };

    const removeProcedure = (code) => {
        setProcedureQuantities(prev => {
            const next = { ...prev };
            delete next[code];
            return next;
        });
    };

    const changeProcedureQty = (code, qty) => {
        const safeQty = Math.max(1, Number(qty) || 1);
        setProcedureQuantities(prev => ({ ...prev, [code]: safeQty }));
    };

    const handleSubmit = async (e) => {
        e?.preventDefault?.();
        setLoading(true);
        setError('');
        try {
            if (!patientId || !clinicId) {
                showToast('Pacient a klinika sú povinné polia.');
                setLoading(false);
                return;
            }

            const normalizedQuantities = Object.fromEntries(
                Object.entries(procedureQuantities).map(([code, qty]) => [code, Math.max(1, Number(qty) || 1)])
            );
            const procedureCodes = Object.keys(normalizedQuantities);

            const payload = {
                patient: Number(patientId),
                doctor: doctorId ? Number(doctorId) : null,
                clinic: Number(clinicId),
                technician: technicianId ? Number(technicianId) : null,
                due_date: dueDate || null,
                start_date: startDate || null,
                end_date: endDate || null,
                try_in_date: tryInDate || null,
                description: description || null,
                input_tooth_procedures: toothData,
                procedure_codes: procedureCodes.length ? procedureCodes : null,
                procedure_quantities: procedureCodes.length ? normalizedQuantities : null,
                tooth_color: toothColor || null,
                price: procedureCodes.length ? Number(totalProcedurePrice.toFixed(2)) : null,
                status,
            };

            if (isEditing) {
                await api.put(`/jobs/jobs/${id}/`, payload);
            } else {
                await api.post('/jobs/jobs/', payload);
            }
            navigate('/jobs');
        } catch (err) {
            console.error(err);
            setError(getApiError(err, isEditing ? 'Nepodarilo sa upraviť prácu' : 'Nepodarilo sa vytvoriť prácu'));
        } finally {
            setLoading(false);
        }
    };

    const goToNextStep = () => {
        if (currentStep === 1) {
            if (!patientId || !clinicId) {
                showToast('V 1. kroku sú povinné: pacient a klinika.');
                return;
            }
        }
        setError('');
        setCurrentStep((prev) => Math.min(3, prev + 1));
    };

    const goToPrevStep = () => {
        setError('');
        setCurrentStep((prev) => Math.max(1, prev - 1));
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {toastMessage && (
                <div className="fixed right-4 top-4 z-50 max-w-md rounded-md bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
                    {toastMessage}
                </div>
            )}

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}>
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{isEditing ? 'Upraviť prácu' : 'Nová práca'}</h1>
                    <p className="text-muted-foreground">{isEditing ? 'Úprava existujúcej zákazky.' : 'Vytvorenie novej zákazky.'}</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((step) => (
                    <div
                        key={step}
                        className={`px-3 py-1 rounded-full text-sm border ${currentStep === step ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}
                    >
                        {step === 1 && '1. Základné údaje'}
                        {step === 2 && '2. Úkony a popis'}
                        {step === 3 && '3. Dátumy'}
                    </div>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {currentStep === 1 && 'Krok 1: Základné údaje'}
                        {currentStep === 2 && 'Krok 2: Úkony a popis'}
                        {currentStep === 3 && 'Krok 3: Dátumy'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {currentStep === 1 && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Pacient</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded-md mb-2"
                                    placeholder="Hľadať: meno, priezvisko, rok narodenia, e-mail, rodné číslo, ID"
                                    value={patientQuery}
                                    onChange={e => setPatientQuery(e.target.value)}
                                />
                                <select className="w-full p-2 border rounded-md" value={patientId} onChange={e => setPatientId(e.target.value)}>
                                    <option value="">Vyberte pacienta</option>
                                    {filteredPatients.map(p => (
                                        <option key={p.id} value={p.id}>
                                            #{p.id} {p.first_name} {p.last_name} {p.birth_number ? `• ${p.birth_number}` : ''} {p.email ? `• ${p.email}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Klinika</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded-md mb-2"
                                    placeholder="Hľadať: názov kliniky, číslo (IČO), ID"
                                    value={clinicQuery}
                                    onChange={e => setClinicQuery(e.target.value)}
                                />
                                <select className="w-full p-2 border rounded-md" value={clinicId} onChange={e => setClinicId(e.target.value)}>
                                    <option value="">Vyberte kliniku</option>
                                    {filteredClinics.map(c => (
                                        <option key={c.id} value={c.id}>#{c.id} {c.name}{c.ico ? ` • IČO ${c.ico}` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Lekár (voliteľné)</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded-md mb-2"
                                    placeholder="Hľadať: meno, priezvisko, číslo, ID"
                                    value={doctorQuery}
                                    onChange={e => setDoctorQuery(e.target.value)}
                                />
                                <select className="w-full p-2 border rounded-md" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
                                    <option value="">Bez lekára</option>
                                    {filteredDoctors.map(d => (
                                        <option key={d.id} value={d.id}>#{d.id} {d.first_name} {d.last_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Technik</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded-md mb-2"
                                    placeholder="Hľadať: meno, priezvisko, číslo, ID"
                                    value={technicianQuery}
                                    onChange={e => setTechnicianQuery(e.target.value)}
                                />
                                <select className="w-full p-2 border rounded-md" value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
                                    <option value="">Vyberte technika</option>
                                    {filteredTechnicians.map(t => (
                                        <option key={t.id} value={t.id}>#{t.id} {t.first_name} {t.last_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Stav</label>
                                <select className="w-full p-2 border rounded-md" value={status} onChange={e => setStatus(e.target.value)}>
                                    <option value="new">Nová</option>
                                    <option value="in_progress">V priebehu</option>
                                    <option value="completed">Dokončená</option>
                                    <option value="cancelled">Zrušená</option>
                                </select>
                            </div>
                        </>
                    )}

                    {currentStep === 2 && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Popis</label>
                                <textarea className="w-full p-2 border rounded-md" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Farba zuba</label>
                                <select className="w-full p-2 border rounded-md" value={toothColor} onChange={e => setToothColor(e.target.value)}>
                                    <option value="">Bez farby</option>
                                    {toothColorOptions.map(shade => (
                                        <option key={shade} value={shade}>{shade}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3 border rounded-md p-3 bg-muted/20">
                                <label className="block text-sm font-medium">Cenníkové úkony</label>
                                <div className="flex gap-2">
                                    <select className="flex-1 p-2 border rounded-md" value={selectedProcedureCode} onChange={e => setSelectedProcedureCode(e.target.value)}>
                                        <option value="">Vyberte kód</option>
                                        {availableProcedureOptions.map(item => (
                                            <option key={item.id} value={item.code}>
                                                {item.code} - {item.description} (€{Number(item.price || 0).toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                    <input type="number" min="1" className="w-20 p-2 border rounded-md" value={selectedProcedureQty} onChange={e => setSelectedProcedureQty(e.target.value)} />
                                    <Button type="button" variant="outline" onClick={addProcedure}>Pridať</Button>
                                </div>

                                {selectedProcedureCodes.length > 0 && (
                                    <div className="space-y-2">
                                        {selectedProcedureCodes.map(code => {
                                            const item = priceList.find(p => p.code === code);
                                            const unitPrice = Number(item?.price || 0);
                                            const qty = Number(procedureQuantities[code] || 1);
                                            return (
                                                <div key={code} className="flex items-center gap-2 text-sm">
                                                    <div className="flex-1">
                                                        <span className="font-medium">{code}</span>
                                                        <span className="text-muted-foreground"> {item?.description || ''}</span>
                                                    </div>
                                                    <input type="number" min="1" className="w-20 p-1 border rounded" value={qty} onChange={e => changeProcedureQty(code, e.target.value)} />
                                                    <div className="w-24 text-right">€{(unitPrice * qty).toFixed(2)}</div>
                                                    <Button type="button" variant="ghost" onClick={() => removeProcedure(code)}>Odobrať</Button>
                                                </div>
                                            );
                                        })}
                                        <div className="pt-2 border-t text-right font-semibold">Odhad ceny: €{totalProcedurePrice.toFixed(2)}</div>
                                    </div>
                                )}
                            </div>

                            <Card className="h-full">
                                <CardHeader>
                                    <CardTitle>Zubný kríž / úkony</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ToothMap editable={true} value={toothData} onChange={setToothData} />
                                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                                        <h4 className="font-semibold text-sm mb-2">Vybrané úkony:</h4>
                                        {Object.keys(toothData).length === 0 ? (
                                            <p className="text-xs text-muted-foreground">Nič nie je vybrané</p>
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
                        </>
                    )}

                    {currentStep === 3 && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Termín odovzdania</label>
                                <input type="date" className="w-full p-2 border rounded-md" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Začiatok práce</label>
                                <input type="date" className="w-full p-2 border rounded-md" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Skúška</label>
                                <input type="date" className="w-full p-2 border rounded-md" value={tryInDate} onChange={e => setTryInDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Ukončenie práce</label>
                                <input type="date" className="w-full p-2 border rounded-md" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </>
                    )}

                    <div className="flex justify-between gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={() => navigate('/jobs')}>
                            Zrušiť
                        </Button>
                        <div className="flex gap-2">
                            {currentStep > 1 && (
                                <Button type="button" variant="outline" onClick={goToPrevStep}>
                                    Späť
                                </Button>
                            )}
                            {currentStep < 3 ? (
                                <Button type="button" onClick={goToNextStep}>
                                    Ďalej
                                </Button>
                            ) : (
                                <Button type="button" onClick={handleSubmit} disabled={loading}>
                                    <Save className="mr-2 h-4 w-4" />
                                    {loading ? 'Ukladám...' : isEditing ? 'Uložiť zmeny' : 'Vytvoriť prácu'}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
