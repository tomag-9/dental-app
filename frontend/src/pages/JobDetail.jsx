import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Pencil, UserRound, Building2, Stethoscope, Wrench } from 'lucide-react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import ToothMap from '../components/dental/ToothMap';

const statusLabel = {
    new: 'Nová',
    in_progress: 'V priebehu',
    completed: 'Dokončená',
    finished_factured: 'Dokončená a fakturovaná',
    cancelled: 'Zrušená',
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
            {
                icon: <CalendarDays className="h-4 w-4" />,
                label: 'Termín',
                value: job.due_date ? new Date(job.due_date).toLocaleDateString('sk-SK') : '-',
            },
            {
                label: 'Stav',
                value: statusLabel[job.status] || job.status || '-',
            },
        ];
    }, [job]);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/jobs')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Detail práce #{id}</h1>
                        <p className="text-muted-foreground">Zobrazenie kompletnej karty práce.</p>
                    </div>
                </div>
                <Link to={`/jobs/${id}/edit`}>
                    <Button>
                        <Pencil className="mr-2 h-4 w-4" /> Upraviť
                    </Button>
                </Link>
            </div>

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
                    <Card>
                        <CardHeader>
                            <CardTitle>Základné informácie</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-hidden">
                                <table className="w-full text-sm">
                                    <tbody>
                                        {detailRows.map((row) => (
                                            <tr key={row.label} className="border-t first:border-t-0">
                                                <td className="px-4 py-3 font-medium w-52 bg-muted/30">
                                                    <div className="flex items-center gap-2">
                                                        {row.icon}
                                                        <span>{row.label}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">{row.value}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Popis práce</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{job.description || 'Bez popisu.'}</p>
                        </CardContent>
                    </Card>

                    <Card>
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
