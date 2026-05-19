import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save, Search, Check, ChevronsUpDown } from 'lucide-react';
import ToothMap from '../components/dental/ToothMap';
import api from '../lib/api';
import { getApiErrorMessage, normalizeListResponse } from '../lib/utils';

function SearchableSelect({
    label,
    placeholder,
    query,
    setQuery,
    value,
    setValue,
    options,
    getOptionLabel,
    selectedLabel,
    emptyText,
    allowEmpty = false,
    emptyOptionLabel = 'Bez výberu',
}) {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!wrapperRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-medium">{label}</label>
            <div className="relative" ref={wrapperRef}>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    placeholder={placeholder}
                    className="h-10 w-full rounded-md border border-sky-200 bg-sky-50 pl-9 pr-10 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                />
                <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                {open && (
                    <div className="absolute z-40 mt-2 max-h-56 w-full overflow-auto rounded-md border border-sky-200 bg-sky-50 p-1 shadow-md">
                        {allowEmpty && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    setValue('');
                                    setQuery('');
                                    setOpen(false);
                                }}
                                className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm hover:bg-sky-100"
                            >
                                <span>{emptyOptionLabel}</span>
                                {!value && <Check className="h-4 w-4 text-primary" />}
                            </button>
                        )}

                        {options.length === 0 ? (
                            <div className="px-2 py-2 text-sm text-muted-foreground">{emptyText}</div>
                        ) : (
                            options.map((option) => {
                                const optionValue = String(option.id);
                                const optionLabel = getOptionLabel(option);
                                const isSelected = value === optionValue;

                                return (
                                    <button
                                        key={optionValue}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            setValue(optionValue);
                                            setQuery(optionLabel);
                                            setOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm hover:bg-sky-100"
                                    >
                                        <span className="truncate">{optionLabel}</span>
                                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
            <p className="min-h-5 text-xs text-muted-foreground">
                {value && selectedLabel ? `Vybrané: ${selectedLabel}` : ' '}
            </p>
        </div>
    );
}

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

    const getPatientOptionLabel = (patient) => [
        `#${patient?.id}`,
        `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
        patient?.birth_number ? `RČ ${patient.birth_number}` : '',
        patient?.email || '',
    ].filter(Boolean).join(' • ');

    const getClinicOptionLabel = (clinic) => [
        `#${clinic?.id}`,
        clinic?.name || '',
        clinic?.ico ? `IČO ${clinic.ico}` : '',
    ].filter(Boolean).join(' • ');

    const getDoctorOptionLabel = (doctor) => [
        `#${doctor?.id}`,
        `${doctor?.first_name || ''} ${doctor?.last_name || ''}`.trim(),
    ].filter(Boolean).join(' • ');

    const getTechnicianOptionLabel = (technician) => [
        `#${technician?.id}`,
        `${technician?.first_name || ''} ${technician?.last_name || ''}`.trim(),
    ].filter(Boolean).join(' • ');

    const selectedPatient = useMemo(
        () => patients.find((item) => String(item.id) === String(patientId)),
        [patients, patientId]
    );
    const selectedClinic = useMemo(
        () => clinics.find((item) => String(item.id) === String(clinicId)),
        [clinics, clinicId]
    );
    const selectedDoctor = useMemo(
        () => doctors.find((item) => String(item.id) === String(doctorId)),
        [doctors, doctorId]
    );
    const selectedTechnician = useMemo(
        () => technicians.find((item) => String(item.id) === String(technicianId)),
        [technicians, technicianId]
    );

    useEffect(() => {
        if (selectedPatient && !patientQuery) {
            setPatientQuery(getPatientOptionLabel(selectedPatient));
        }
    }, [selectedPatient, patientQuery]);

    useEffect(() => {
        if (selectedClinic && !clinicQuery) {
            setClinicQuery(getClinicOptionLabel(selectedClinic));
        }
    }, [selectedClinic, clinicQuery]);

    useEffect(() => {
        if (selectedDoctor && !doctorQuery) {
            setDoctorQuery(getDoctorOptionLabel(selectedDoctor));
        }
    }, [selectedDoctor, doctorQuery]);

    useEffect(() => {
        if (selectedTechnician && !technicianQuery) {
            setTechnicianQuery(getTechnicianOptionLabel(selectedTechnician));
        }
    }, [selectedTechnician, technicianQuery]);

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
            setError(getApiErrorMessage(err, isEditing ? 'Nepodarilo sa upraviť prácu' : 'Nepodarilo sa vytvoriť prácu'));
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
                                        className={`px-3 py-1 rounded-full text-sm border ${currentStep === step ? 'bg-blue-600 text-white border-blue-600' : 'bg-sky-50 border-sky-200 text-slate-600'}`}
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
                        <div className="space-y-4 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <SearchableSelect
                                    label="Pacient"
                                    placeholder="Meno, priezvisko, rok narodenia, e-mail, rodné číslo, ID"
                                    query={patientQuery}
                                    setQuery={setPatientQuery}
                                    value={patientId}
                                    setValue={setPatientId}
                                    options={filteredPatients}
                                    getOptionLabel={getPatientOptionLabel}
                                    selectedLabel={selectedPatient ? getPatientOptionLabel(selectedPatient) : ''}
                                    emptyText="Žiadny pacient nevyhovuje vyhľadávaniu."
                                />

                                <SearchableSelect
                                    label="Klinika"
                                    placeholder="Názov kliniky, IČO, ID"
                                    query={clinicQuery}
                                    setQuery={setClinicQuery}
                                    value={clinicId}
                                    setValue={setClinicId}
                                    options={filteredClinics}
                                    getOptionLabel={getClinicOptionLabel}
                                    selectedLabel={selectedClinic ? getClinicOptionLabel(selectedClinic) : ''}
                                    emptyText="Žiadna klinika nevyhovuje vyhľadávaniu."
                                />

                                <SearchableSelect
                                    label="Lekár (voliteľné)"
                                    placeholder="Meno, priezvisko, ID"
                                    query={doctorQuery}
                                    setQuery={setDoctorQuery}
                                    value={doctorId}
                                    setValue={setDoctorId}
                                    options={filteredDoctors}
                                    getOptionLabel={getDoctorOptionLabel}
                                    selectedLabel={selectedDoctor ? getDoctorOptionLabel(selectedDoctor) : ''}
                                    emptyText="Žiadny lekár nevyhovuje vyhľadávaniu."
                                    allowEmpty
                                    emptyOptionLabel="Bez lekára"
                                />

                                <SearchableSelect
                                    label="Technik"
                                    placeholder="Meno, priezvisko, ID"
                                    query={technicianQuery}
                                    setQuery={setTechnicianQuery}
                                    value={technicianId}
                                    setValue={setTechnicianId}
                                    options={filteredTechnicians}
                                    getOptionLabel={getTechnicianOptionLabel}
                                    selectedLabel={selectedTechnician ? getTechnicianOptionLabel(selectedTechnician) : ''}
                                    emptyText="Žiadny technik nevyhovuje vyhľadávaniu."
                                    allowEmpty
                                    emptyOptionLabel="Bez technika"
                                />
                            </div>

                            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 sm:p-4">
                                <label className="mb-1 block text-sm font-medium">Stav</label>
                                <select
                                    className="h-10 w-full rounded-md border border-sky-200 bg-sky-50 px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
                                    value={status}
                                    onChange={e => setStatus(e.target.value)}
                                >
                                    <option value="new">Nová</option>
                                    <option value="in_progress">V priebehu</option>
                                    <option value="completed">Dokončená</option>
                                    <option value="finished_factured">Dokončená a fakturovaná</option>
                                    <option value="cancelled">Zrušená</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Popis</label>
                                <textarea className="w-full p-2 border rounded-md" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Farba zuba</label>
                                <select className="w-full p-2 border border-sky-200 bg-sky-50 rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none" value={toothColor} onChange={e => setToothColor(e.target.value)}>
                                    <option value="">Bez farby</option>
                                    {toothColorOptions.map(shade => (
                                        <option key={shade} value={shade}>{shade}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3 border border-sky-200 rounded-md p-3 bg-sky-50">
                                <label className="block text-sm font-medium">Cenníkové úkony</label>
                                <div className="flex gap-2">
                                    <select className="flex-1 p-2 border border-sky-200 bg-sky-50 rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none" value={selectedProcedureCode} onChange={e => setSelectedProcedureCode(e.target.value)}>
                                        <option value="">Vyberte kód</option>
                                        {availableProcedureOptions.map(item => (
                                            <option key={item.id} value={item.code}>
                                                {item.code} - {item.description} (€{Number(item.price || 0).toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                    <input type="number" min="1" className="w-20 p-2 border border-sky-200 bg-sky-50 rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none" value={selectedProcedureQty} onChange={e => setSelectedProcedureQty(e.target.value)} />
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
                                                    <input type="number" min="1" className="w-20 p-1 border border-sky-200 bg-sky-50 rounded focus:ring-1 focus:ring-blue-400 focus:outline-none" value={qty} onChange={e => changeProcedureQty(code, e.target.value)} />
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
                                    <div className="mt-4 p-4 bg-sky-50 rounded-lg border border-sky-200">
                                        <h4 className="font-semibold text-sm mb-2">Vybrané úkony:</h4>
                                        {Object.keys(toothData).length === 0 ? (
                                            <p className="text-xs text-muted-foreground">Nič nie je vybrané</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(toothData).map(([tooth, code]) => (
                                                    <div key={tooth} className="bg-sky-100 border border-sky-200 rounded px-2 py-1 text-xs font-mono shadow-sm">
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
                                <input type="date" className="w-full p-2 border border-sky-200 bg-sky-50 rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Začiatok práce</label>
                                <input type="date" className="w-full p-2 border border-sky-200 bg-sky-50 rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Skúška</label>
                                <input type="date" className="w-full p-2 border border-sky-200 bg-sky-50 rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none" value={tryInDate} onChange={e => setTryInDate(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Ukončenie práce</label>
                                <input type="date" className="w-full p-2 border border-sky-200 bg-sky-50 rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
