import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronsUpDown, Plus, Save, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
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
            if (!wrapperRef.current?.contains(event.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-semibold">{label}</label>
            <div className="relative" ref={wrapperRef}>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    placeholder={placeholder}
                    className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
                <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                {open && (
                    <div className="absolute z-40 mt-2 max-h-56 w-full overflow-auto rounded-md border border-border bg-white p-1 shadow-lg">
                        {allowEmpty && (
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    setValue('');
                                    setQuery('');
                                    setOpen(false);
                                }}
                                className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm hover:bg-secondary"
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
                                const selected = value === optionValue;
                                return (
                                    <button
                                        key={optionValue}
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            setValue(optionValue);
                                            setQuery(optionLabel);
                                            setOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-secondary"
                                    >
                                        <span className="truncate">{optionLabel}</span>
                                        {selected && <Check className="h-4 w-4 text-primary" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
            <p className="min-h-5 text-xs text-muted-foreground">{value && selectedLabel ? `Vybrané: ${selectedLabel}` : ' '}</p>
        </div>
    );
}

const steps = [
    { id: 1, label: 'Pacient' },
    { id: 2, label: 'Položky' },
    { id: 3, label: 'Termín' },
    { id: 4, label: 'Súhrn' },
];

const priorities = [
    { value: 'low', label: 'Nízka', desc: 'Štandardná fronta', badge: 'outline' },
    { value: 'normal', label: 'Normálna', desc: 'Štandardný termín', badge: 'new' },
    { value: 'high', label: 'Vysoká', desc: 'Prioritné spracovanie', badge: 'issued' },
    { value: 'urgent', label: 'Urgent', desc: 'Pacient v ordinácii', badge: 'cancelled' },
];

function normalizeText(value) {
    return String(value ?? '').toLowerCase();
}

function formatMoney(value) {
    return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

export default function JobCreate() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const toastTimeoutRef = useRef(null);

    const [currentStep, setCurrentStep] = useState(1);
    const [patientId, setPatientId] = useState('');
    const [doctorId, setDoctorId] = useState('');
    const [clinicId, setClinicId] = useState('');
    const [technicianId, setTechnicianId] = useState('');
    const [priority, setPriority] = useState('normal');
    const [status, setStatus] = useState('new');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [tryInDate, setTryInDate] = useState('');
    const [toothColor, setToothColor] = useState('');
    const [toothData, setToothData] = useState({});
    const [items, setItems] = useState([{ price_list_code: '', tooth: '', quantity: 1 }]);

    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [clinics, setClinics] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [priceList, setPriceList] = useState([]);
    const [patientQuery, setPatientQuery] = useState('');
    const [clinicQuery, setClinicQuery] = useState('');
    const [doctorQuery, setDoctorQuery] = useState('');
    const [technicianQuery, setTechnicianQuery] = useState('');

    const showToast = (message) => {
        setToastMessage(message);
        if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = window.setTimeout(() => setToastMessage(''), 3500);
    };

    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pRes, dRes, cRes, tRes, prRes] = await Promise.all([
                    api.get('/crm/patients/'),
                    api.get('/crm/doctors/'),
                    api.get('/crm/clinics/'),
                    api.get('/jobs/technicians/'),
                    api.get('/finance/price-list/'),
                ]);
                setPatients(normalizeListResponse(pRes.data));
                setDoctors(normalizeListResponse(dRes.data));
                setClinics(normalizeListResponse(cRes.data));
                setTechnicians(normalizeListResponse(tRes.data));
                setPriceList(normalizeListResponse(prRes.data));
            } catch (err) {
                console.error('Failed to fetch job form data:', err);
                setError('Nepodarilo sa načítať číselníky.');
            }
        };
        fetchData();
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
                setPriority(job.priority || 'normal');
                setStatus(job.status || 'new');
                setDueDate(job.due_date || '');
                setStartDate(job.start_date || '');
                setEndDate(job.end_date || '');
                setTryInDate(job.try_in_date || '');
                setDescription(job.description || '');
                setToothData(job.input_tooth_procedures || {});
                setToothColor(job.tooth_color || '');
                if (job.items?.length) {
                    setItems(job.items.map((item) => ({
                        price_list_code: item.price_list_code,
                        tooth: item.tooth || '',
                        quantity: item.quantity || 1,
                    })));
                } else if (job.procedure_codes?.length) {
                    setItems(job.procedure_codes.map((code) => ({
                        price_list_code: code,
                        tooth: '',
                        quantity: job.procedure_quantities?.[code] || 1,
                    })));
                }
            } catch (err) {
                console.error('Failed to fetch job:', err);
                setError('Nepodarilo sa načítať prácu.');
            } finally {
                setLoading(false);
            }
        };
        fetchJob();
    }, [id, isEditing]);

    const filteredPatients = useMemo(() => {
        const query = normalizeText(patientQuery).trim();
        if (!query) return patients;
        return patients.filter((patient) => [patient.id, patient.first_name, patient.last_name, patient.email, patient.birth_number].some((value) => normalizeText(value).includes(query)));
    }, [patients, patientQuery]);

    const filteredClinics = useMemo(() => {
        const query = normalizeText(clinicQuery).trim();
        if (!query) return clinics;
        return clinics.filter((clinic) => [clinic.id, clinic.name, clinic.ico].some((value) => normalizeText(value).includes(query)));
    }, [clinics, clinicQuery]);

    const filteredDoctors = useMemo(() => {
        const query = normalizeText(doctorQuery).trim();
        if (!query) return doctors;
        return doctors.filter((doctor) => [doctor.id, doctor.first_name, doctor.last_name, doctor.email].some((value) => normalizeText(value).includes(query)));
    }, [doctors, doctorQuery]);

    const filteredTechnicians = useMemo(() => {
        const query = normalizeText(technicianQuery).trim();
        if (!query) return technicians;
        return technicians.filter((technician) => [technician.id, technician.first_name, technician.last_name, technician.contact_info?.email].some((value) => normalizeText(value).includes(query)));
    }, [technicians, technicianQuery]);

    const selectedPatient = patients.find((item) => String(item.id) === String(patientId));
    const selectedClinic = clinics.find((item) => String(item.id) === String(clinicId));
    const selectedDoctor = doctors.find((item) => String(item.id) === String(doctorId));
    const selectedTechnician = technicians.find((item) => String(item.id) === String(technicianId));

    const patientLabel = (patient) => [`#${patient.id}`, `${patient.first_name || ''} ${patient.last_name || ''}`.trim(), patient.birth_number ? `RČ ${patient.birth_number}` : ''].filter(Boolean).join(' • ');
    const clinicLabel = (clinic) => [`#${clinic.id}`, clinic.name, clinic.ico ? `IČO ${clinic.ico}` : ''].filter(Boolean).join(' • ');
    const personLabel = (person) => [`#${person.id}`, `${person.first_name || ''} ${person.last_name || ''}`.trim()].filter(Boolean).join(' • ');

    useEffect(() => {
        if (selectedPatient && !patientQuery) setPatientQuery(patientLabel(selectedPatient));
    }, [selectedPatient, patientQuery]);
    useEffect(() => {
        if (selectedClinic && !clinicQuery) setClinicQuery(clinicLabel(selectedClinic));
    }, [selectedClinic, clinicQuery]);
    useEffect(() => {
        if (selectedDoctor && !doctorQuery) setDoctorQuery(personLabel(selectedDoctor));
    }, [selectedDoctor, doctorQuery]);
    useEffect(() => {
        if (selectedTechnician && !technicianQuery) setTechnicianQuery(personLabel(selectedTechnician));
    }, [selectedTechnician, technicianQuery]);

    const total = useMemo(() => items.reduce((sum, item) => {
        const priceItem = priceList.find((entry) => entry.code === item.price_list_code);
        return sum + Number(priceItem?.price || 0) * Math.max(1, Number(item.quantity) || 1);
    }, 0), [items, priceList]);

    const updateItem = (index, key, value) => {
        setItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
    };

    const addItem = () => setItems((prev) => [...prev, { price_list_code: '', tooth: '', quantity: 1 }]);
    const removeItem = (index) => setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

    const goToNextStep = () => {
        if (currentStep === 1 && (!patientId || !clinicId)) {
            showToast('Pacient a klinika sú povinné polia.');
            return;
        }
        if (currentStep === 2 && !items.some((item) => item.price_list_code)) {
            showToast('Pridajte aspoň jednu položku z cenníka.');
            return;
        }
        if (currentStep === 3 && !dueDate) {
            showToast('Termín odovzdania je povinný.');
            return;
        }
        setCurrentStep((prev) => Math.min(4, prev + 1));
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            const normalizedItems = items
                .filter((item) => item.price_list_code)
                .map((item) => ({
                    price_list_code: item.price_list_code,
                    tooth: item.tooth || null,
                    quantity: Math.max(1, Number(item.quantity) || 1),
                }));
            const payload = {
                patient: Number(patientId),
                doctor: doctorId ? Number(doctorId) : null,
                clinic: Number(clinicId),
                technician: technicianId ? Number(technicianId) : null,
                priority,
                status,
                due_date: dueDate || null,
                start_date: startDate || null,
                end_date: endDate || null,
                try_in_date: tryInDate || null,
                description: description || null,
                tooth_color: toothColor || null,
                input_tooth_procedures: toothData,
                items: normalizedItems,
            };
            if (isEditing) await api.put(`/jobs/jobs/${id}/`, payload);
            else await api.post('/jobs/jobs/', payload);
            navigate('/jobs');
        } catch (err) {
            console.error('Failed to save job:', err);
            setError(getApiErrorMessage(err, isEditing ? 'Nepodarilo sa upraviť prácu' : 'Nepodarilo sa vytvoriť prácu'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            {toastMessage && <div className="fixed right-4 top-4 z-50 max-w-md rounded-md bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">{toastMessage}</div>}

            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary">{isEditing ? 'Upraviť prácu' : 'Nová práca'}</h1>
                        <p className="text-muted-foreground">Krok {currentStep} zo 4 · {steps[currentStep - 1].label}</p>
                    </div>
                </div>
                <Link to="/patients/new">
                    <Button variant="outline">
                        <Plus className="h-4 w-4" />
                        Nový pacient
                    </Button>
                </Link>
            </div>

            {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

            <div className="flex items-center gap-2">
                {steps.map((step, index) => (
                    <div key={step.id} className="flex flex-1 items-center gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${currentStep > step.id ? 'bg-primary text-primary-foreground' : currentStep === step.id ? 'border-2 border-primary bg-[var(--color-accent-teal-bg)] text-primary' : 'bg-secondary text-muted-foreground'}`}>
                            {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                        </span>
                        <span className={`hidden text-sm font-semibold sm:inline ${currentStep === step.id ? 'text-primary' : 'text-muted-foreground'}`}>{step.label}</span>
                        {index < steps.length - 1 && <span className={`h-px flex-1 ${currentStep > step.id ? 'bg-primary' : 'bg-border'}`} />}
                    </div>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {currentStep === 1 && 'Pacient a odosielateľ'}
                        {currentStep === 2 && 'Položky z cenníka'}
                        {currentStep === 3 && 'Termín a priorita'}
                        {currentStep === 4 && 'Súhrn pred uložením'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {currentStep === 1 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <SearchableSelect label="Pacient" placeholder="Meno, rodné číslo, e-mail, ID" query={patientQuery} setQuery={setPatientQuery} value={patientId} setValue={setPatientId} options={filteredPatients} getOptionLabel={patientLabel} selectedLabel={selectedPatient ? patientLabel(selectedPatient) : ''} emptyText="Žiadny pacient nevyhovuje vyhľadávaniu." />
                                <SearchableSelect label="Klinika" placeholder="Názov kliniky, IČO, ID" query={clinicQuery} setQuery={setClinicQuery} value={clinicId} setValue={setClinicId} options={filteredClinics} getOptionLabel={clinicLabel} selectedLabel={selectedClinic ? clinicLabel(selectedClinic) : ''} emptyText="Žiadna klinika nevyhovuje vyhľadávaniu." />
                                <SearchableSelect label="Lekár" placeholder="Meno, priezvisko, ID" query={doctorQuery} setQuery={setDoctorQuery} value={doctorId} setValue={setDoctorId} options={filteredDoctors} getOptionLabel={personLabel} selectedLabel={selectedDoctor ? personLabel(selectedDoctor) : ''} emptyText="Žiadny lekár nevyhovuje vyhľadávaniu." allowEmpty emptyOptionLabel="Bez lekára" />
                                <SearchableSelect label="Technik" placeholder="Meno, priezvisko, ID" query={technicianQuery} setQuery={setTechnicianQuery} value={technicianId} setValue={setTechnicianId} options={filteredTechnicians} getOptionLabel={personLabel} selectedLabel={selectedTechnician ? personLabel(selectedTechnician) : ''} emptyText="Žiadny technik nevyhovuje vyhľadávaniu." allowEmpty emptyOptionLabel="Bez technika" />
                            </div>
                            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-[#fbfaf6] p-3">
                                <Link to="/patients/new"><Button type="button" variant="outline" size="sm"><Plus className="h-3.5 w-3.5" />Nový pacient</Button></Link>
                                <Link to="/clinics/new"><Button type="button" variant="outline" size="sm"><Plus className="h-3.5 w-3.5" />Nová klinika</Button></Link>
                                <Link to="/doctors/new"><Button type="button" variant="outline" size="sm"><Plus className="h-3.5 w-3.5" />Nový lekár</Button></Link>
                                <Link to="/technicians/new"><Button type="button" variant="outline" size="sm"><Plus className="h-3.5 w-3.5" />Nový technik</Button></Link>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-5">
                            <div className="overflow-hidden rounded-lg border border-[var(--color-card-border)]">
                                <div className="grid grid-cols-[1fr_90px_80px_110px_40px] gap-2 bg-secondary px-3 py-2 text-xs font-bold uppercase text-[var(--color-sidebar-text)]">
                                    <span>Výkon</span>
                                    <span>Zub</span>
                                    <span className="text-center">Ks</span>
                                    <span className="text-right">Cena/ks</span>
                                    <span />
                                </div>
                                {items.map((item, index) => {
                                    const priceItem = priceList.find((entry) => entry.code === item.price_list_code);
                                    return (
                                        <div key={`${index}-${item.price_list_code}`} className="grid grid-cols-[1fr_90px_80px_110px_40px] items-center gap-2 border-t border-[#f0ede5] px-3 py-2">
                                            <select value={item.price_list_code} onChange={(event) => updateItem(index, 'price_list_code', event.target.value)} className="h-9 min-w-0 rounded-md border border-border bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                                                <option value="">Vyberte výkon</option>
                                                {priceList.map((price) => <option key={price.id} value={price.code}>{price.code} - {price.description}</option>)}
                                            </select>
                                            <input value={item.tooth} onChange={(event) => updateItem(index, 'tooth', event.target.value)} placeholder="11" className="h-9 rounded-md border border-border bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                            <input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} className="h-9 rounded-md border border-border bg-white px-2 text-center text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                            <div className="text-right text-sm font-semibold text-foreground">{formatMoney(priceItem?.price)}</div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={items.length === 1} className="text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                })}
                                <button type="button" onClick={addItem} className="flex w-full items-center justify-center gap-2 border-t border-[#f0ede5] bg-[#fbfaf6] px-3 py-3 text-sm font-semibold text-primary hover:bg-secondary">
                                    <Plus className="h-4 w-4" />
                                    Pridať položku
                                </button>
                                <div className="flex justify-between border-t border-[#f0ede5] bg-[#fbfaf6] px-4 py-3 font-bold">
                                    <span>Spolu bez DPH</span>
                                    <span>{formatMoney(total)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Farba zuba</label>
                                    <select value={toothColor} onChange={(event) => setToothColor(event.target.value)} className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                                        <option value="">Bez farby</option>
                                        {['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'D4'].map((shade) => <option key={shade} value={shade}>{shade}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Poznámka pre technika</label>
                                    <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="w-full rounded-md border border-border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                </div>
                            </div>

                            <Card>
                                <CardHeader><CardTitle className="text-base">Zubná mapa</CardTitle></CardHeader>
                                <CardContent>
                                    <ToothMap editable value={toothData} onChange={setToothData} />
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <label className="space-y-1.5 text-sm font-semibold">Začiatok práce<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></label>
                                <label className="space-y-1.5 text-sm font-semibold">Termín odovzdania<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></label>
                                <label className="space-y-1.5 text-sm font-semibold">Skúška<input type="date" value={tryInDate} onChange={(event) => setTryInDate(event.target.value)} className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></label>
                                <label className="space-y-1.5 text-sm font-semibold">Ukončenie<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></label>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                {priorities.map((item) => (
                                    <button key={item.value} type="button" onClick={() => setPriority(item.value)} className={`rounded-lg border p-3 text-left transition-colors ${priority === item.value ? 'border-primary bg-[var(--color-accent-teal-bg)]' : 'border-border bg-white hover:bg-[#fbfaf6]'}`}>
                                        <Badge variant={item.badge}>{item.label}</Badge>
                                        <p className="mt-2 text-xs text-muted-foreground">{item.desc}</p>
                                    </button>
                                ))}
                            </div>
                            {isEditing && (
                                <div className="rounded-lg border border-border bg-[#fbfaf6] p-3 text-sm text-muted-foreground">
                                    Stav práce sa posúva v detaile práce cez auditovaný workflow.
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-4">
                            <div className="rounded-lg border border-[#b0ddd5] bg-[var(--color-accent-teal-bg)] p-4 text-sm text-[var(--color-accent-teal-text)]">Skontrolujte údaje pred uložením. Práca bude dostupná v zozname aj detaile s položkami a históriou.</div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {[
                                    ['Pacient', selectedPatient ? patientLabel(selectedPatient) : '-'],
                                    ['Klinika', selectedClinic ? clinicLabel(selectedClinic) : '-'],
                                    ['Lekár', selectedDoctor ? personLabel(selectedDoctor) : 'Bez lekára'],
                                    ['Technik', selectedTechnician ? personLabel(selectedTechnician) : 'Nepridelený'],
                                    ['Termín', dueDate || '-'],
                                    ['Priorita', priorities.find((item) => item.value === priority)?.label || priority],
                                    ['Položky', `${items.filter((item) => item.price_list_code).length}`],
                                    ['Spolu bez DPH', formatMoney(total)],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-lg border border-border bg-[#fbfaf6] p-3">
                                        <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>
                                        <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={() => navigate('/jobs')}>Zrušiť</Button>
                        <div className="flex gap-2">
                            {currentStep > 1 && <Button type="button" variant="outline" onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}>Späť</Button>}
                            {currentStep < 4 ? (
                                <Button type="button" onClick={goToNextStep}>Ďalej<ArrowRight className="h-4 w-4" /></Button>
                            ) : (
                                <Button type="button" onClick={handleSubmit} disabled={loading}>
                                    <Save className="h-4 w-4" />
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
