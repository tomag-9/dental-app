import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Users, Briefcase, Activity, DollarSign, TrendingUp } from 'lucide-react';
import { LoadingState, EmptyState, ErrorState } from '../components/states';
import api from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { format } from 'date-fns';

export default function Dashboard() {
    const [stats, setStats] = useState({
        totalPatients: 0,
        activeJobs: 0,
        revenue: 0,
        completedJobs: 0
    });
    const [recentJobs, setRecentJobs] = useState([]);
    const [recentInvoices, setRecentInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const normalizeListResponse = (responseData) => {
        if (Array.isArray(responseData)) return responseData;
        if (Array.isArray(responseData?.results)) return responseData.results;
        return [];
    };

    const formatAmount = (value) => {
        const amount = Number(value);
        return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [jobsRes, patientsRes, invoicesRes] = await Promise.all([
                api.get('/jobs/jobs/'),
                api.get('/crm/patients/'),
                api.get('/invoices/')
            ]);

            const jobs = normalizeListResponse(jobsRes.data);
            const patients = normalizeListResponse(patientsRes.data);
            const invoices = normalizeListResponse(invoicesRes.data);

            // Calculate stats
            const activeJobs = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length;
            const completedJobs = jobs.filter(j => j.status === 'completed').length;
            const totalRevenue = invoices.reduce((sum, inv) => {
                const amount = Number(inv?.total_amount ?? 0);
                return sum + (Number.isFinite(amount) ? amount : 0);
            }, 0);

            setStats({
                totalPatients: patients.length,
                activeJobs,
                revenue: totalRevenue,
                completedJobs
            });

            // Get recent jobs (last 5)
            setRecentJobs(jobs.slice(0, 5));

            // Get recent invoices (last 5)
            setRecentInvoices(invoices.slice(0, 5));
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
            setError('Nepodarilo sa načítať dáta nástenky. Skúste to znova.');
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { 
            title: 'Pacienti spolu', 
            value: stats.totalPatients.toLocaleString(), 
            icon: Users, 
            color: 'bg-blue-100 text-blue-600' 
        },
        { 
            title: 'Aktívne práce', 
            value: stats.activeJobs.toLocaleString(), 
            icon: Briefcase, 
            color: 'bg-amber-100 text-amber-600' 
        },
        { 
            title: 'Tržby', 
            value: `${formatAmount(stats.revenue)} €`, 
            icon: DollarSign, 
            color: 'bg-green-100 text-green-600' 
        },
        { 
            title: 'Dokončené práce', 
            value: stats.completedJobs.toLocaleString(), 
            icon: Activity, 
            color: 'bg-purple-100 text-purple-600' 
        },
    ];

    const getJobStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'in_progress':
                return 'bg-blue-100 text-blue-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getInvoiceStatusColor = (status) => {
        switch (status) {
            case 'paid':
                return 'bg-green-100 text-green-800';
            case 'issued':
                return 'bg-blue-100 text-blue-800';
            case 'draft':
                return 'bg-gray-100 text-gray-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return <LoadingState message="Načítavam nástenku..." />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Nástenka</h1>
                <p className="text-muted-foreground">Prehľad laboratória na jednom mieste.</p>
            </div>

            {/* Error State */}
            {error && (
                <ErrorState
                    title="Nepodarilo sa načítať nástenku"
                    message={error}
                    onRetry={fetchDashboardData}
                />
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.title}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {stat.title}
                                </CardTitle>
                                <div className={`p-2 rounded-lg ${stat.color}`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stat.value}</div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <div className="flex flex-wrap gap-3">
                <Link to="/jobs">
                    <Button variant="outline">Zobraziť práce</Button>
                </Link>
                <Link to="/invoices">
                    <Button variant="outline">Prejsť na faktúry</Button>
                </Link>
                <Link to="/inventory">
                    <Button variant="outline">Skontrolovať sklad</Button>
                </Link>
            </div>

            {/* Recent Activity Grid */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
                {/* Recent Jobs */}
                <Card className="lg:col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Posledné práce</CardTitle>
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {recentJobs.length === 0 ? (
                            <EmptyState
                                title="Zatiaľ žiadne práce"
                                description="Po vytvorení sa tu zobrazia posledné práce."
                            />
                        ) : (
                            <div className="space-y-4">
                                {recentJobs.map((job) => (
                                    <div key={job.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-medium text-gray-900 text-sm">Práca #{job.id}</p>
                                                <Badge className={getJobStatusColor(job.status)}>
                                                    {job.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-gray-600">
                                                {job.patient_details?.first_name} {job.patient_details?.last_name}
                                            </p>
                                            {job.due_date && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Termín: {format(new Date(job.due_date), 'd. M. yyyy')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Invoices */}
                <Card className="lg:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Posledné faktúry</CardTitle>
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {recentInvoices.length === 0 ? (
                            <EmptyState
                                title="Zatiaľ žiadne faktúry"
                                description="Po vytvorení sa tu zobrazia posledné faktúry."
                            />
                        ) : (
                            <div className="space-y-4">
                                {recentInvoices.map((invoice) => (
                                    <div key={invoice.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-medium text-gray-900 text-sm">
                                                    {invoice.number || `INV-${invoice.id}`}
                                                </p>
                                                <Badge className={getInvoiceStatusColor(invoice.status)}>
                                                    {invoice.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-gray-600">
                                                {invoice.clinic_name || 'Neznáma klinika'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-gray-900 text-sm">
                                                {formatAmount(invoice?.total_amount)} €
                                            </p>
                                            {invoice.created_at && (
                                                <p className="text-xs text-gray-500">
                                                    {format(new Date(invoice.created_at), 'MMM d')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
