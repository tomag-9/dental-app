import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Building2,
    CalendarDays,
    CheckCircle,
    CircleDollarSign,
    ClipboardList,
    Clock3,
    FileText,
    Pencil,
    Printer,
    Stethoscope,
    UserRound,
    Wrench,
} from 'lucide-react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import ToothMap from '../components/dental/ToothMap';

const statusMeta = {
    new: { label: 'Nová', badge: 'new', next: 'in_progress', nextLabel: 'Spustiť prácu' },
    in_progress: { label: 'V priebehu', badge: 'progress', next: 'completed', nextLabel: 'Dokončiť' },
    completed: { label: 'Dokončená', badge: 'done', next: 'finished_unfactured', nextLabel: 'Označiť ako nefakturovanú' },
    finished_unfactured: { label: 'Nefakturovaná', badge: 'done', next: 'finished_factured', nextLabel: 'Označiť ako fakturovanú' },
    finished_factured: { label: 'Fakturovaná', badge: 'factured', next: 'closed', nextLabel: 'Uzavrieť' },
    closed: { label: 'Uzavretá', badge: 'paid' },
    cancelled: { label: 'Zrušená', badge: 'cancelled' },
};

const priorityMeta = {
    low: 'Nízka',
    normal: 'Normálna',
    high: 'Vysoká',
    urgent: 'Urgent',
};

const eventLabel = {
    created: 'Práca vytvorená',
    updated: 'Práca upravená',
    status_changed: 'Zmena stavu',
    assigned: 'Priradenie technika',
};

function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('sk-SK').format(new Date(value));
}

function formatDateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('sk-SK', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

function formatPrice(value) {
    return new Intl.NumberFormat('sk-SK', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(Number(value || 0));
}

function personName(person) {
    return [person?.first_name, person?.last_name].filter(Boolean).join(' ') || '-';
}

function InfoCell({ icon, label, value }) {
    return (
        <div className="rounded-lg border border-border/80 bg-[#fbfaf6] px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                {icon}
                <span>{label}</span>
            </div>
            <div className="text-sm font-semibold text-foreground">{value}</div>
        </div>
    );
}

export default function JobDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [savingStatus, setSavingStatus] = useState(false);
    const [error, setError] = useState('');

    const fetchJob = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get(`/jobs/jobs/${id}/`);
            setJob(response.data);
        } catch (err) {
            console.error('Failed to fetch job detail:', err);
            setError('Nepodarilo sa načítať detail práce');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchJob();
    }, [fetchJob]);

    const total = useMemo(() => {
        if (!job?.items?.length) return Number(job?.price || 0);
        return job.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    }, [job]);

    const currentStatus = statusMeta[job?.status] || { label: job?.status || '-', badge: 'outline' };

    const transitionStatus = async () => {
        if (!job || !currentStatus.next) return;
        setSavingStatus(true);
        setError('');
        try {
            const response = await api.post(`/jobs/jobs/${job.id}/transition-status/`, {
                status: currentStatus.next,
                note: `Posun stavu: ${currentStatus.label} -> ${statusMeta[currentStatus.next]?.label || currentStatus.next}`,
            });
            setJob(response.data);
        } catch (err) {
            console.error('Failed to transition job status:', err);
            setError('Stav práce sa nepodarilo posunúť.');
        } finally {
            setSavingStatus(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')} className="mt-0.5 shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary">Práca #{id}</h1>
                        <p className="text-muted-foreground">Detail zákazky, položiek, termínov a histórie.</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />
                        Tlač pracovného listu
                    </Button>
                    <Link to={`/jobs/${id}/edit`}>
                        <Button>
                            <Pencil className="h-4 w-4" />
                            Upraviť
                        </Button>
                    </Link>
                </div>
            </div>

            {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

            {loading ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">Načítavam detail práce...</CardContent>
                </Card>
            ) : !job ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">Práca nebola nájdená.</CardContent>
                </Card>
            ) : (
                <>
                    <div className="flex flex-col gap-3 rounded-lg border border-[#b0ddd5] bg-[var(--color-accent-teal-bg)] p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary">
                                <ClipboardList className="h-5 w-5" />
                            </span>
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-[var(--color-accent-teal-text)]">{currentStatus.label}</span>
                                    <Badge variant={currentStatus.badge}>Priorita: {priorityMeta[job.priority] || job.priority}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-[var(--color-accent-teal-text)]/80">
                                    Termín odovzdania: {formatDate(job.due_date)}
                                </p>
                            </div>
                        </div>
                        {currentStatus.next && (
                            <Button variant="outline" onClick={transitionStatus} disabled={savingStatus}>
                                {savingStatus ? 'Ukladám...' : currentStatus.nextLabel}
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-base">Základné údaje</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <InfoCell icon={<UserRound className="h-4 w-4" />} label="Pacient" value={personName(job.patient_details)} />
                                <InfoCell icon={<Building2 className="h-4 w-4" />} label="Klinika" value={job.clinic_details?.name || '-'} />
                                <InfoCell icon={<Stethoscope className="h-4 w-4" />} label="Lekár" value={personName(job.doctor_details)} />
                                <InfoCell icon={<Wrench className="h-4 w-4" />} label="Technik" value={personName(job.technician_details)} />
                                <InfoCell icon={<CalendarDays className="h-4 w-4" />} label="Začiatok" value={formatDate(job.start_date)} />
                                <InfoCell icon={<Clock3 className="h-4 w-4" />} label="Skúška" value={formatDate(job.try_in_date)} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Súhrn</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <InfoCell icon={<CircleDollarSign className="h-4 w-4" />} label="Spolu bez DPH" value={formatPrice(total)} />
                                <InfoCell icon={<CheckCircle className="h-4 w-4" />} label="Status" value={<Badge variant={currentStatus.badge}>{currentStatus.label}</Badge>} />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="space-y-4 lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Položky práce</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {job.items?.length ? (
                                        <div className="overflow-hidden rounded-lg border border-[var(--color-card-border)]">
                                            {job.items.map((item) => (
                                                <div key={item.id} className="grid grid-cols-[1fr_70px_70px_110px] items-center gap-3 border-b border-[#f0ede5] px-4 py-3 last:border-0">
                                                    <div>
                                                        <div className="font-semibold text-foreground">{item.description}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">{item.price_list_code} · zub {item.tooth || '-'}</div>
                                                    </div>
                                                    <div className="text-center text-sm text-muted-foreground">{item.quantity}x</div>
                                                    <div className="text-right text-sm text-muted-foreground">{formatPrice(item.unit_price)}</div>
                                                    <div className="text-right font-bold text-foreground">{formatPrice(item.total)}</div>
                                                </div>
                                            ))}
                                            <div className="flex justify-between bg-[#fbfaf6] px-4 py-3 font-bold">
                                                <span>Spolu</span>
                                                <span>{formatPrice(total)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-border bg-[#fbfaf6] p-6 text-sm text-muted-foreground">Položky zatiaľ nie sú zadané.</div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <FileText className="h-4 w-4" />
                                        Poznámka
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="rounded-lg border-l-4 border-[var(--color-accent-amber-text)] bg-[var(--color-accent-amber-bg)] p-4 text-sm text-[var(--color-accent-amber-text)]">
                                        {job.description || 'Bez poznámky.'}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Zubná mapa</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ToothMap editable={false} value={job.input_tooth_procedures || {}} />
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">História</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {job.timeline?.length ? (
                                    <div className="space-y-0">
                                        {job.timeline.map((event, index) => (
                                            <div key={event.id} className="flex gap-3 pb-5 last:pb-0">
                                                <div className="flex flex-col items-center">
                                                    <span className="mt-0.5 h-6 w-6 rounded-full bg-primary" />
                                                    {index < job.timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-[#ece7dc]" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-foreground">{eventLabel[event.event] || event.event}</div>
                                                    <div className="mt-1 text-xs text-muted-foreground">{event.actor_name || 'Systém'} · {formatDateTime(event.created_at)}</div>
                                                    {event.note && <div className="mt-2 rounded-md bg-[#fbfaf6] p-2 text-xs text-[var(--color-sidebar-text)]">{event.note}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-border bg-[#fbfaf6] p-6 text-sm text-muted-foreground">História zatiaľ neobsahuje udalosti.</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
