import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Pencil, UserRound, Building2, Stethoscope, Wrench, FileText, CircleDollarSign, Clock3, ClipboardList } from 'lucide-react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import ToothMap from '../components/dental/ToothMap';

const statusLabel = {
    new: 'Nová',
    in_progress: 'V priebehu',
    completed: 'Dokončená',
    finished_factured: 'Dokončená a fakturovaná',
    cancelled: 'Zrušená',
};

const statusTone = {
    new: 'bg-blue-500/20 text-blue-100 border-blue-400/40',
    in_progress: 'bg-sky-500/20 text-sky-100 border-sky-400/40',
    completed: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/40',
    finished_factured: 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40',
    cancelled: 'bg-rose-500/20 text-rose-100 border-rose-400/40',
};

export default function JobDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchJob = async () => {
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
        };

        fetchJob();
    }, [id]);

    const detailRows = useMemo(() => {
        if (!job) return [];
        return [
            {
                icon: <UserRound className="h-4 w-4" />,
                label: 'Pacient',
                value: `${job.patient_details?.first_name || ''} ${job.patient_details?.last_name || ''}`.trim() || '-',
            },
            {
                icon: <Building2 className="h-4 w-4" />,
                label: 'Klinika',
                value: job.clinic_details?.name || '-',
            },
            {
                icon: <Stethoscope className="h-4 w-4" />,
                label: 'Lekár',
                value: `${job.doctor_details?.first_name || ''} ${job.doctor_details?.last_name || ''}`.trim() || '-',
            },
            {
                icon: <Wrench className="h-4 w-4" />,
                label: 'Technik',
                value: job.technician_details ? `${job.technician_details.first_name || ''} ${job.technician_details.last_name || ''}`.trim() : '-',
            },
        ];
    }, [job]);

    const formatDate = (value) => (value ? new Date(value).toLocaleDateString('sk-SK') : '-');

    const formatPrice = (value) => {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return '-';
        return `${numberValue.toFixed(2)} €`;
    };

    const metaCards = useMemo(() => {
        if (!job) return [];
        return [
            {
                title: 'Stav',
                value: statusLabel[job.status] || job.status || '-',
                icon: <ClipboardList className="h-4 w-4" />,
                badge: true,
            },
            {
                title: 'Termín odovzdania',
                value: formatDate(job.due_date),
                icon: <Clock3 className="h-4 w-4" />,
            },
            {
                title: 'Skúška',
                value: formatDate(job.try_in_date),
                icon: <CalendarDays className="h-4 w-4" />,
            },
            {
                title: 'Cena',
                value: formatPrice(job.price),
                icon: <CircleDollarSign className="h-4 w-4" />,
            },
        ];
    }, [job]);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <Card className="border-primary/30 bg-gradient-to-br from-card/95 via-card/90 to-primary/10">
                <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')} className="mt-0.5 shrink-0">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">Detail práce #{id}</h1>
                                <p className="mt-1 text-sm md:text-base text-muted-foreground">Prehľad zákazky, termínov, ceny a zubnej mapy.</p>
                            </div>
                        </div>
                        <Link to={`/jobs/${id}/edit`} className="md:self-start">
                            <Button>
                                <Pencil className="mr-2 h-4 w-4" /> Upraviť prácu
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

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
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <Card className="border-primary/25 lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Základné informácie</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {detailRows.map((row) => (
                                        <div key={row.label} className="rounded-lg border border-border/80 bg-background/35 px-4 py-3">
                                            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                                                {row.icon}
                                                <span>{row.label}</span>
                                            </div>
                                            <p className="text-sm font-medium text-foreground">{row.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-primary/25">
                            <CardHeader>
                                <CardTitle>Stav a termíny</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-3">
                                {metaCards.map((item) => (
                                    <div key={item.title} className="rounded-lg border border-border/80 bg-background/35 px-4 py-3">
                                        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                                            {item.icon}
                                            <span>{item.title}</span>
                                        </div>
                                        {item.badge ? (
                                            <Badge className={statusTone[job.status] || 'bg-primary/20 text-primary-foreground border-primary/40'}>
                                                {item.value}
                                            </Badge>
                                        ) : (
                                            <p className="text-base font-semibold text-foreground">{item.value}</p>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-primary/25">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Popis práce
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border border-border/80 bg-background/35 p-4">
                                <p className="whitespace-pre-wrap text-sm text-foreground/95">{job.description || 'Bez popisu.'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/25">
                        <CardHeader>
                            <CardTitle>Zubná mapa</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ToothMap
                                editable={false}
                                value={job.input_tooth_procedures || {}}
                            />
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
