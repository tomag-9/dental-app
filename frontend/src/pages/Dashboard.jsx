import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, CheckCircle, Euro, RefreshCw, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import api from '../lib/api';
import useAuthStore from '../store/auth';

const jobStatus = {
    new: { label: 'Nová', variant: 'new' },
    pending: { label: 'Čakajúca', variant: 'new' },
    in_progress: { label: 'V priebehu', variant: 'progress' },
    completed: { label: 'Dokončená', variant: 'done' },
    finished_factured: { label: 'Fakturovaná', variant: 'factured' },
    finished_unfactured: { label: 'Nefakturovaná', variant: 'done' },
    closed: { label: 'Uzavretá', variant: 'paid' },
    cancelled: { label: 'Zrušená', variant: 'cancelled' },
};

const invoiceStatus = {
    draft: { label: 'Koncept', variant: 'draft' },
    issued: { label: 'Vystavená', variant: 'issued' },
    paid: { label: 'Zaplatená', variant: 'paid' },
    cancelled: { label: 'Zrušená', variant: 'cancelled' },
};

function formatCurrency(value) {
    return new Intl.NumberFormat('sk-SK', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(Number(value || 0));
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(date);
}

function patientName(job) {
    return [job.patient_details?.first_name, job.patient_details?.last_name].filter(Boolean).join(' ') || 'Neznámy pacient';
}

function DashboardStat({ label, value, sub, icon, tone }) {
    const IconComponent = icon;
    const tones = {
        teal: 'bg-[var(--color-accent-teal-bg)] text-[var(--color-accent-teal-text)]',
        amber: 'bg-[var(--color-accent-amber-bg)] text-[var(--color-accent-amber-text)]',
        green: 'bg-[var(--color-accent-green-bg)] text-[var(--color-accent-green-text)]',
        purple: 'bg-[var(--color-accent-purple-bg)] text-[var(--color-accent-purple-text)]',
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-[var(--color-sidebar-text)]">{label}</CardTitle>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone] || tones.teal}`}>
                    <IconComponent className="h-4 w-4" />
                </span>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>{value}</div>
                {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
    const user = useAuthStore((state) => state.user);
    const [data, setData] = useState({
        total_patients: 0,
        active_jobs: 0,
        total_revenue: 0,
        completed_jobs: 0,
        recent_jobs: [],
        recent_invoices: [],
        today_schedule: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchDashboardData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/dashboard/stats/');
            setData({
                total_patients: response.data.total_patients || 0,
                active_jobs: response.data.active_jobs || 0,
                total_revenue: response.data.total_revenue || 0,
                completed_jobs: response.data.completed_jobs || 0,
                recent_jobs: response.data.recent_jobs || [],
                recent_invoices: response.data.recent_invoices || [],
                today_schedule: response.data.today_schedule || [],
            });
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
            setError('Nepodarilo sa načítať dáta nástenky. Skúste to znova.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const displayName = useMemo(() => {
        const firstName = user?.first_name || user?.username || '';
        return firstName ? `, ${firstName}` : '';
    }, [user]);

    if (loading) {
        return <LoadingState message="Načítavam nástenku..." />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dobré ráno{displayName}</h1>
                    <p className="text-muted-foreground">Prehľad vášho laboratória.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={fetchDashboardData}>
                        <RefreshCw className="h-4 w-4" />
                        Obnoviť
                    </Button>
                    <Link to="/jobs/new">
                        <Button>
                            <Briefcase className="h-4 w-4" />
                            Nová práca
                        </Button>
                    </Link>
                </div>
            </div>

            {error && (
                <ErrorState
                    title="Nepodarilo sa načítať nástenku"
                    message={error}
                    onRetry={fetchDashboardData}
                />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DashboardStat label="Počet pacientov" value={data.total_patients.toLocaleString('sk-SK')} icon={Users} tone="teal" />
                <DashboardStat label="Aktívne práce" value={data.active_jobs.toLocaleString('sk-SK')} icon={Briefcase} tone="amber" />
                <DashboardStat label="Tržby" value={formatCurrency(data.total_revenue)} icon={Euro} tone="green" sub="Zaplatené faktúry" />
                <DashboardStat label="Dokončené práce" value={data.completed_jobs.toLocaleString('sk-SK')} icon={CheckCircle} tone="purple" />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <Card className="xl:col-span-5">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Posledné práce</CardTitle>
                        <Link to="/jobs">
                            <Button variant="ghost" size="sm">
                                Všetky
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {data.recent_jobs.length === 0 ? (
                            <EmptyState title="Zatiaľ žiadne práce" description="Posledné práce sa zobrazia po ich vytvorení." />
                        ) : (
                            <div className="divide-y divide-[#f0ede5]">
                                {data.recent_jobs.map((job) => {
                                    const status = jobStatus[job.status] || { label: job.status || '-', variant: 'outline' };
                                    return (
                                        <Link
                                            key={job.id}
                                            to={`/jobs/${job.id}`}
                                            className="flex items-center gap-3 rounded-md px-1 py-3 transition-colors hover:bg-[#fbfaf6]"
                                        >
                                            <span className="min-w-10 font-mono text-xs font-bold text-primary">#{job.id}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-foreground">{patientName(job)}</span>
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                    {job.description || 'Práca'} · termín {formatDate(job.due_date)}
                                                </span>
                                            </span>
                                            <Badge variant={status.variant}>{status.label}</Badge>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="xl:col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Posledné faktúry</CardTitle>
                        <Link to="/invoices">
                            <Button variant="ghost" size="sm">
                                Všetky
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {data.recent_invoices.length === 0 ? (
                            <EmptyState title="Zatiaľ žiadne faktúry" description="Posledné faktúry sa zobrazia po ich vytvorení." />
                        ) : (
                            <div className="divide-y divide-[#f0ede5]">
                                {data.recent_invoices.map((invoice) => {
                                    const status = invoiceStatus[invoice.status] || { label: invoice.status || '-', variant: 'outline' };
                                    return (
                                        <Link
                                            key={invoice.id}
                                            to={`/invoices/${invoice.id}`}
                                            className="flex items-center gap-3 rounded-md px-1 py-3 transition-colors hover:bg-[#fbfaf6]"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-mono text-xs font-semibold text-primary">
                                                    {invoice.number || `INV-${invoice.id}`}
                                                </span>
                                                <span className="mt-1 block truncate text-xs text-muted-foreground">
                                                    {invoice.clinic_name || 'Klinika'} · {formatDate(invoice.issued_at || invoice.created_at)}
                                                </span>
                                            </span>
                                            <span className="text-right">
                                                <span className="block text-sm font-bold text-foreground">{formatCurrency(invoice.total_amount)}</span>
                                                <span className="mt-1 block"><Badge variant={status.variant}>{status.label}</Badge></span>
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="xl:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Dnes</CardTitle>
                        <Link to="/calendar">
                            <Button variant="ghost" size="sm">
                                Kalendár
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {data.today_schedule.length === 0 ? (
                            <EmptyState title="Žiadne termíny dnes" description="Dnešné termíny prác sa zobrazia tu." />
                        ) : (
                            <div className="divide-y divide-[#f0ede5]">
                                {data.today_schedule.map((item) => (
                                    <Link
                                        key={`${item.type}-${item.id}`}
                                        to={item.type === 'job' ? `/jobs/${item.id}` : '/calendar'}
                                        className="flex gap-3 rounded-md px-1 py-3 transition-colors hover:bg-[#fbfaf6]"
                                    >
                                        <span className="min-w-10 text-right text-xs font-bold text-foreground">{item.time || 'Dnes'}</span>
                                        <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.title}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
