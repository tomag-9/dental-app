import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { downloadBlobFile } from '../lib/browserActions';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Plus, Search, Loader2, Eye, Download, Trash2, Badge } from 'lucide-react';
import { LoadingState, ErrorState, EmptyState } from '../components/states';

export default function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [invoiceToDelete, setInvoiceToDelete] = useState(null);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/invoices/');
            setInvoices(response.data);
        } catch (err) {
            console.error('Failed to fetch invoices:', err);
            setError('Failed to load invoices');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!invoiceToDelete) return;
        try {
            await api.delete(`/invoices/${invoiceToDelete}`);
            await fetchInvoices();
        } catch (err) {
            console.error('Failed to delete invoice:', err);
            setError('Failed to delete invoice');
        } finally {
            setInvoiceToDelete(null);
        }
    };

    const handleDownloadPDF = async (id) => {
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

    const getStatusColor = (status) => {
        switch (status) {
            case 'draft': return 'bg-gray-100 text-gray-800';
            case 'issued': return 'bg-blue-100 text-blue-800';
            case 'paid': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'draft': return '📝';
            case 'issued': return '📤';
            case 'paid': return '✅';
            case 'cancelled': return '❌';
            default: return '📋';
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = inv.number.toLowerCase().includes(search.toLowerCase()) ||
            (inv.clinic_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (inv.patient_names || []).some(name => name.toLowerCase().includes(search.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
                    <p className="text-muted-foreground">Manage customer invoices and payments.</p>
                </div>
                <Link to="/invoices/new" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Create Invoice
                    </Button>
                </Link>
            </div>

            {error && (
                <ErrorState
                    title="Failed to Load Invoices"
                    message={error}
                    onRetry={fetchInvoices}
                />
            )}

            <Card>
                <CardHeader className="space-y-4">
                    <CardTitle>All Invoices ({filteredInvoices.length})</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                            <option value="all">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="issued">Issued</option>
                            <option value="paid">Paid</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <input
                                placeholder="Search invoices..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-gray-300 bg-background px-3 py-2 pl-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <LoadingState message="Loading invoices..." />
                    ) : filteredInvoices.length === 0 ? (
                        <EmptyState
                            title={invoices.length === 0 ? "No invoices yet" : "No invoices match"}
                            description={invoices.length === 0 
                                ? "Create your first invoice to get started." 
                                : "Try adjusting your search or filter."}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b-2 border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-left text-gray-700">Invoice #</th>
                                        <th className="px-4 py-3 font-medium text-left text-gray-700 hidden md:table-cell">Clinic</th>
                                        <th className="px-4 py-3 font-medium text-left text-gray-700 hidden lg:table-cell">Patients</th>
                                        <th className="px-4 py-3 font-medium text-right text-gray-700">Amount</th>
                                        <th className="px-4 py-3 font-medium text-center text-gray-700">Status</th>
                                        <th className="px-4 py-3 font-medium text-right text-gray-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredInvoices.map((invoice) => (
                                        <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-blue-600">
                                                {invoice.number}
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                {invoice.clinic_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                                                {(invoice.patient_names || []).join(', ') || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                                                €{parseFloat(invoice.total_amount).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                                    {getStatusIcon(invoice.status)} {invoice.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link to={`/invoices/${invoice.id}`}>
                                                        <Button variant="outline" size="sm" title="View">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDownloadPDF(invoice.id)}
                                                        title="Download"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setInvoiceToDelete(invoice.id)}
                                                        className="text-red-600 hover:text-red-700"
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
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!invoiceToDelete}
                title="Delete invoice"
                message="Are you sure you want to delete this invoice?"
                confirmText="Delete"
                cancelText="Cancel"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setInvoiceToDelete(null)}
            />
        </div>
    );
}
