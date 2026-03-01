import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Plus, Loader2, Search, Edit2, Eye, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';
import { Link } from 'react-router-dom';

const statusLabel = {
    new: 'Nové',
    in_progress: 'V priebehu',
    completed: 'Dokončené',
    cancelled: 'Zrušené',
};

const sectionOrder = ['new', 'in_progress', 'completed', 'cancelled'];

export default function Jobs() {
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [jobToDelete, setJobToDelete] = useState(null);
    const [openSections, setOpenSections] = useState({
        new: true,
        in_progress: true,
        completed: true,
        cancelled: true,
    });

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/jobs/jobs/');
            setJobs(response.data);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            setError('Nepodarilo sa načítať práce');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!jobToDelete) return;
        try {
            await api.delete(`/jobs/jobs/${jobToDelete}/`);
            await fetchJobs();
        } catch (err) {
            console.error('Failed to delete job:', err);
            setError('Nepodarilo sa zmazať prácu');
        } finally {
            setJobToDelete(null);
        }
    };

    const normalize = (value) => (value || '').toString().toLowerCase();
    const filteredJobs = jobs.filter((job) => {
        const patientName = `${job.patient_details?.first_name || ''} ${job.patient_details?.last_name || ''}`;
        const haystack = [
            patientName,
            job.status,
            job.description,
            job.clinic_details?.name,
            job.doctor_details?.last_name,
            job.id,
        ]
            .map(normalize)
            .join(' ');
        return haystack.includes(normalize(search));
    });

    const grouped = sectionOrder.reduce((acc, status) => {
        acc[status] = filteredJobs.filter((job) => job.status === status);
        return acc;
    }, {});

    const toggleSection = (status) => {
        setOpenSections((prev) => ({ ...prev, [status]: !prev[status] }));
    };

    const renderTable = (items) => {
        if (items.length === 0) {
            return <div className="p-4 text-sm text-muted-foreground">Žiadne práce v tejto sekcii.</div>;
        }

        return (
            <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 font-medium">ID</th>
                            <th className="px-4 py-3 font-medium">Pacient</th>
                            <th className="px-4 py-3 font-medium">Klinika</th>
                            <th className="px-4 py-3 font-medium">Lekár</th>
                            <th className="px-4 py-3 font-medium">Termín</th>
                            <th className="px-4 py-3 font-medium">Stav</th>
                            <th className="px-4 py-3 font-medium text-right">Akcie</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {items.map((job) => (
                            <tr key={job.id} className="hover:bg-muted/50">
                                <td className="px-4 py-3 font-medium">#{job.id}</td>
                                <td className="px-4 py-3">
                                    {job.patient_details?.first_name} {job.patient_details?.last_name}
                                </td>
                                <td className="px-4 py-3">{job.clinic_details?.name || '-'}</td>
                                <td className="px-4 py-3">
                                    {job.doctor_details?.first_name} {job.doctor_details?.last_name}
                                </td>
                                <td className="px-4 py-3">{job.due_date ? new Date(job.due_date).toLocaleDateString('sk-SK') : '-'}</td>
                                <td className="px-4 py-3">{statusLabel[job.status] || job.status}</td>
                                <td className="px-4 py-3 text-right">
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
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            title="Zmazať"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Práce</h1>
                    <p className="text-muted-foreground">Prehľad, správa a stav zákaziek.</p>
                </div>
                <Link to="/jobs/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Nová práca
                    </Button>
                </Link>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Vyhľadávanie</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative max-w-md">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            placeholder="Pacient, lekár, klinika, stav, ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredJobs.length === 0 ? (
                <div className="text-center text-muted-foreground p-8 bg-card rounded-lg border border-dashed">
                    Žiadne práce.
                </div>
            ) : (
                <div className="space-y-4">
                    {sectionOrder.map((status) => (
                        <Card key={status}>
                            <CardHeader className="pb-3">
                                <button
                                    type="button"
                                    onClick={() => toggleSection(status)}
                                    className="w-full flex items-center justify-between"
                                >
                                    <CardTitle>
                                        {statusLabel[status]} ({grouped[status].length})
                                    </CardTitle>
                                    {openSections[status] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                            </CardHeader>
                            {openSections[status] && <CardContent>{renderTable(grouped[status])}</CardContent>}
                        </Card>
                    ))}
                </div>
            )}

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
