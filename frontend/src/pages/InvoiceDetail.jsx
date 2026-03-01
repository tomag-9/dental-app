import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { downloadBlobFile } from '../lib/browserActions';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Save, Loader2, Download, AlertCircle } from 'lucide-react';

export default function InvoiceDetail() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isCreating = !id;

    const [loading, setLoading] = useState(!!id);
    const [error, setError] = useState('');
    const [clinics, setClinics] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [invoice, setInvoice] = useState(null);
    const [formData, setFormData] = useState({
        clinic_id: '',
        job_ids: [],
    });
    const [selectedJobs, setSelectedJobs] = useState([]);

    const normalizeListResponse = (responseData) => {
        if (Array.isArray(responseData)) return responseData;
        if (Array.isArray(responseData?.results)) return responseData.results;
        return [];
    };

    const loadInvoice = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(`/invoices/${id}`);
            const inv = response.data;
            setInvoice(inv);
            setFormData({
                clinic_id: inv.clinic_id || '',
                job_ids: (inv.items || []).map(item => item.job_id),
            });
            setSelectedJobs((inv.items || []).map(item => item.job_id));
        } catch (err) {
            console.error('Failed to fetch invoice:', err);
            setError('Failed to load invoice');
        } finally {
            setLoading(false);
        }
    }, [id]);

    const loadJobsForClinic = useCallback(async () => {
        try {
            const response = await api.get('/jobs/jobs/');
            const allJobs = normalizeListResponse(response.data);
            const clinicJobs = allJobs.filter(
                (job) => Number(job?.clinic) === Number(formData.clinic_id)
            );
            setJobs(clinicJobs);
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            setJobs([]);
        }
    }, [formData.clinic_id]);

    useEffect(() => {
        loadClinics();
        if (!isCreating) {
            loadInvoice();
        }
    }, [id, isCreating, loadInvoice]);

    useEffect(() => {
        if (formData.clinic_id) {
            loadJobsForClinic();
        }
    }, [formData.clinic_id, loadJobsForClinic]);

    const loadClinics = async () => {
        try {
            const response = await api.get('/crm/clinics/');
            setClinics(response.data);
        } catch (err) {
            console.error('Failed to fetch clinics:', err);
        }
    };

    const handleJobToggle = (jobId) => {
        const newJobIds = selectedJobs.includes(jobId)
            ? selectedJobs.filter(id => id !== jobId)
            : [...selectedJobs, jobId];
        setSelectedJobs(newJobIds);
        setFormData(prev => ({ ...prev, job_ids: newJobIds }));
    };

    const handleStatusChange = async (newStatus) => {
        try {
            await api.put(`/invoices/${id}/status`, { status: newStatus });
            await loadInvoice();
        } catch (err) {
            console.error('Failed to update status:', err);
            setError('Failed to update invoice status');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.clinic_id) {
            setError('Please select a clinic');
            return;
        }

        if (formData.job_ids.length === 0) {
            setError('Please select at least one job');
            return;
        }

        setLoading(true);
        try {
            if (isCreating) {
                await api.post('/invoices/', {
                    clinic_id: parseInt(formData.clinic_id),
                    job_ids: formData.job_ids,
                });
            } else {
                // Note: Invoice updates may not be fully supported via API
                // This is a placeholder for potential updates
                setError('Invoice updates are not supported via API');
                return;
            }
            navigate('/invoices');
        } catch (err) {
            console.error('Failed to save invoice:', err);
            setError(err.response?.data?.detail || 'Failed to save invoice');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const response = await api.get(`/invoices/${id}/pdf`, {
                responseType: 'blob'
            });
            downloadBlobFile(response.data, `invoice-${id}.pdf`);
        } catch (err) {
            console.error('Failed to download PDF:', err);
            setError('Failed to download invoice');
        }
    };

    if (loading && !isCreating) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const selectedClinic = clinics.find(c => c.id === parseInt(formData.clinic_id));
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    const invoiceJobs = safeJobs.filter(job => formData.job_ids.includes(job.id));
    const totalAmount = invoiceJobs.reduce((sum, job) => {
        const amount = Number(job?.price ?? job?.estimated_cost ?? 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/invoices')}
                >
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isCreating ? 'Create Invoice' : `Invoice ${invoice?.number}`}
                    </h1>
                    <p className="text-muted-foreground">
                        {isCreating
                            ? 'Create a new invoice for a clinic.'
                            : `Status: ${invoice?.status}`}
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md flex gap-2 items-start">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {!isCreating && invoice && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="text-base">Invoice Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-2 flex-wrap">
                        {invoice.status !== 'issued' && (
                            <Button
                                variant="outline"
                                onClick={() => handleStatusChange('issued')}
                            >
                                Mark as Issued
                            </Button>
                        )}
                        {invoice.status === 'issued' && (
                            <Button
                                variant="outline"
                                onClick={() => handleStatusChange('paid')}
                            >
                                Mark as Paid
                            </Button>
                        )}
                        {invoice.status !== 'cancelled' && (
                            <Button
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleStatusChange('cancelled')}
                            >
                                Cancel Invoice
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={handleDownloadPDF}
                        >
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Invoice Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Clinic <span className="text-destructive">*</span>
                            </label>
                            <select
                                value={formData.clinic_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, clinic_id: e.target.value, job_ids: [] }))}
                                className="w-full px-3 py-2 border border-input rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            >
                                <option value="">Select a clinic</option>
                                {clinics.map(clinic => (
                                    <option key={clinic.id} value={clinic.id}>
                                        {clinic.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedClinic && (
                            <div className="p-3 bg-muted rounded-md text-sm">
                                <strong>Selected Clinic:</strong> {selectedClinic.name}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-3">
                                Jobs to Invoice <span className="text-destructive">*</span>
                            </label>
                            {safeJobs.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4">
                                    No jobs available for this clinic. Jobs must exist before creating an invoice.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-4">
                                    {safeJobs.map(job => (
                                        <label key={job.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
                                            <input
                                                type="checkbox"
                                                checked={selectedJobs.includes(job.id)}
                                                onChange={() => handleJobToggle(job.id)}
                                                className="w-4 h-4 rounded border-input"
                                            />
                                            <div className="flex-1">
                                                <div className="text-sm font-medium">
                                                    {job.description || `Job #${job.id}`}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    €{Number(job?.price ?? job?.estimated_cost ?? 0).toFixed(2)}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {invoiceJobs.length > 0 && (
                            <div className="bg-muted p-4 rounded-md">
                                <div className="text-sm space-y-2">
                                    <p><strong>Selected Jobs: {invoiceJobs.length}</strong></p>
                                    <p className="text-lg font-bold">
                                        Total: €{totalAmount.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        )}

                        {isCreating && (
                            <div className="mt-6 flex justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate('/invoices')}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4" />
                                            Create Invoice
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
