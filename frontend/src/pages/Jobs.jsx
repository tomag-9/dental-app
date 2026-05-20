import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, CheckCircle, Edit2, Eye, Loader2, Plus, Search, Trash2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import api from '../lib/api';
import { normalizeListResponse } from '../lib/utils';

const statusMeta = {
    new: { label: 'Nové', badge: 'new', icon: Briefcase },
    in_progress: { label: 'V priebehu', badge: 'progress', icon: Loader2 },
    completed: { label: 'Dokončené', badge: 'done', icon: CheckCircle },
    finished_unfactured: { label: 'Dokončené', badge: 'done', icon: CheckCircle },
    finished_factured: { label: 'Fakturované', badge: 'factured', icon: CheckCircle },
    closed: { label: 'Uzavreté', badge: 'paid', icon: CheckCircle },
    cancelled: { label: 'Zrušené', badge: 'cancelled', icon: XCircle },
};

const tabs = [
    { value: 'all', label: 'Všetky' },
    { value: 'new', label: 'Nové' },
    { value: 'in_progress', label: 'V priebehu' },
    { value: 'completed', label: 'Dokončené' },
    { value: 'cancelled', label: 'Zrušené' },
];

function patientName(job) {
    return [job.patient_details?.first_name, job.patient_details?.last_name].filter(Boolean).join(' ') || '-';
}

function doctorName(job) {
    return [job.doctor_details?.first_name, job.doctor_details?.last_name].filter(Boolean).join(' ') || '-';
}

function jobType(job) {
    const firstItem = job.items?.[0];
    if (firstItem?.description) return firstItem.description;
    if (job.procedure_codes?.length) return job.procedure_codes.join(', ');
    return job.description || 'Práca';
}

function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('sk-SK').format(new Date(value));
}

function StatCard({ label, value, icon, tone }) {
    const IconComponent = icon;
    const tones = {
        amber: 'bg-[var(--color-accent-amber-bg)] text-[var(--color-accent-amber-text)]',
        teal: 'bg-[var(--color-accent-teal-bg)] text-[var(--color-accent-teal-text)]',
        green: 'bg-[var(--color-accent-green-bg)] text-[var(--color-accent-green-text)]',
        red: 'bg-[var(--color-status-cancelled-bg)] text-[var(--color-status-cancelled-text)]',
    };

    return (
        <Card>
            <CardContent className="flex items-center justify-between p-4">
                <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
                </div>
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
                    <IconComponent className="h-4 w-4" />
                </span>
            </CardContent>
        </Card>
    );
}

export default function Jobs() {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('all');
    const [error, setError] = useState('');
    const [jobToDelete, setJobToDelete] = useState(null);

    const fetchJobs = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/jobs/jobs/');
            setJobs(normalizeListResponse(response.data));
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            setError('Nepodarilo sa načítať práce');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const counts = useMemo(() => ({
        new: jobs.filter((job) => job.status === 'new').length,
        in_progress: jobs.filter((job) => job.status === 'in_progress').length,
        completed: jobs.filter((job) => ['completed', 'finished_unfactured', 'finished_factured', 'closed'].includes(job.status)).length,
        cancelled: jobs.filter((job) => job.status === 'cancelled').length,
    }), [jobs]);

    const filteredJobs = useMemo(() => {
        const q = search.trim().toLowerCase();
        return jobs.filter((job) => {
            const statusGroup = ['finished_unfactured', 'finished_factured', 'closed'].includes(job.status) ? 'completed' : job.status;
            if (tab !== 'all' && statusGroup !== tab) return false;
            if (!q) return true;
            return [
                job.id,
                patientName(job),
                job.clinic_details?.name,
                doctorName(job),
                jobType(job),
                job.status,
            ].some((value) => String(value || '').toLowerCase().includes(q));
        });
    }, [jobs, search, tab]);

    const confirmDelete = async () => {
        if (!jobToDelete) return;
        try {
            await api.delete(`/jobs/jobs/${jobToDelete}/`);
            await fetchJobs();
        } catch (err) {
            console.error('Failed to delete job:', err);
            setError('Prácu sa nepodarilo zmazať. Uzavreté alebo fakturované práce sú chránené.');
        } finally {
            setJobToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Práce</h1>
                    <p className="text-muted-foreground">Prehľad, správa a stav zákaziek.</p>
                </div>
                <Link to="/jobs/new">
                    <Button>
                        <Plus className="h-4 w-4" />
                        Nová práca
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Nové" value={counts.new} icon={Briefcase} tone="amber" />
                <StatCard label="V priebehu" value={counts.in_progress} icon={Loader2} tone="teal" />
                <StatCard label="Dokončené" value={counts.completed} icon={CheckCircle} tone="green" />
                <StatCard label="Zrušené" value={counts.cancelled} icon={XCircle} tone="red" />
            </div>

            {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

            <Card>
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setTab(item.value)}
                                className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                                    tab === item.value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-secondary text-[var(--color-sidebar-text)] hover:bg-[#e7e2d4]'
                                }`}
                            >
                                {item.label} ({item.value === 'all' ? jobs.length : counts[item.value]})
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full lg:w-80">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Pacient, lekár, ID..."
                            className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredJobs.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border bg-[#fbfaf6] p-8 text-center text-sm text-muted-foreground">
                            Žiadne práce. Skúste upraviť vyhľadávanie alebo filter.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-[var(--color-card-border)]">
                            <table className="w-full min-w-[880px] text-left text-sm">
                                <thead className="bg-secondary text-xs uppercase text-[var(--color-sidebar-text)]">
                                    <tr>
                                        <th className="px-4 py-3">ID</th>
                                        <th className="px-4 py-3">Pacient</th>
                                        <th className="px-4 py-3">Klinika</th>
                                        <th className="px-4 py-3">Lekár</th>
                                        <th className="px-4 py-3">Termín</th>
                                        <th className="px-4 py-3">Stav</th>
                                        <th className="px-4 py-3 text-right">Akcie</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0ede5] bg-white">
                                    {filteredJobs.map((job) => {
                                        const status = statusMeta[job.status] || { label: job.status || '-', badge: 'outline' };
                                        return (
                                            <tr
                                                key={job.id}
                                                onClick={() => navigate(`/jobs/${job.id}`)}
                                                className="cursor-pointer transition-colors hover:bg-[#fbfaf6]"
                                            >
                                                <td className="px-4 py-3 font-mono font-bold text-primary">#{job.id}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-foreground">{patientName(job)}</div>
                                                    <div className="mt-0.5 text-xs text-muted-foreground">{jobType(job)}</div>
                                                </td>
                                                <td className="px-4 py-3">{job.clinic_details?.name || '-'}</td>
                                                <td className="px-4 py-3">{doctorName(job)}</td>
                                                <td className="px-4 py-3">{formatDate(job.due_date)}</td>
                                                <td className="px-4 py-3"><Badge variant={status.badge}>{status.label}</Badge></td>
                                                <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                                                    <div className="inline-flex items-center gap-1">
                                                        <Link to={`/jobs/${job.id}`}>
                                                            <Button variant="ghost" size="sm" title="Detail">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        <Link to={`/jobs/${job.id}/edit`}>
                                                            <Button variant="ghost" size="sm" title="Upraviť">
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setJobToDelete(job.id)}
                                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            title="Zmazať"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!jobToDelete}
                title="Zmazať prácu"
                message="Naozaj chcete zmazať túto prácu? Táto akcia sa nedá vrátiť späť."
                confirmText="Zmazať"
                cancelText="Zrušiť"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setJobToDelete(null)}
            />
        </div>
    );
}
