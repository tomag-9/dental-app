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
            setError('Nepodarilo sa načítať faktúry');
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
            setError('Nepodarilo sa zmazať faktúru');
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
            setError('Nepodarilo sa stiahnuť faktúru');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'draft': return 'bg-[var(--color-status-draft-bg)] text-foreground';
            case 'issued': return 'bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)]';
            case 'paid': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-[var(--color-status-draft-bg)] text-foreground';
        }
    };

    const getStatusLabel = (status) => {
        const labels = {
            draft: 'Koncept',
            issued: 'Vystavená',
            paid: 'Zaplatená',
            cancelled: 'Zrušená',
        };
        return labels[status] || status || '-';
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
                    <h1 className="text-3xl font-bold tracking-tight">Faktúry</h1>
                    <p className="text-muted-foreground">Správa faktúr a platieb.</p>
                </div>
                <Link to="/invoices/new" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Vytvoriť faktúru
                    </Button>
                </Link>
            </div>

            {error && (
                <ErrorState
                    title="Nepodarilo sa načítať faktúry"
                    message={error}
                    onRetry={fetchInvoices}
                />
            )}

            <Card>
                <CardHeader className="space-y-4">
                    <CardTitle>Všetky faktúry ({filteredInvoices.length})</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-border bg-white rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                        >
                            <option value="all">Všetky stavy</option>
                            <option value="draft">Koncept</option>
                            <option value="issued">Vystavená</option>
                            <option value="paid">Zaplatená</option>
                            <option value="cancelled">Zrušená</option>
                        </select>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                            <input
                                placeholder="Hľadať faktúry..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 pl-10 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <LoadingState message="Načítavam faktúry..." />
                    ) : filteredInvoices.length === 0 ? (
                        <EmptyState
                            title={invoices.length === 0 ? "Zatiaľ žiadne faktúry" : "Žiadne faktúry nevyhovujú filtru"}
                            description={invoices.length === 0 
                                ? "Vytvorte svoju prvú faktúru, aby sa zobrazila v zozname." 
                                : "Skúste upraviť hľadanie alebo filter."}
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-[var(--color-table-border)] bg-[var(--color-table-header)]">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-left text-[var(--color-sidebar-text)]">Číslo faktúry</th>
                                        <th className="px-4 py-3 font-medium text-left text-[var(--color-sidebar-text)] hidden md:table-cell">Klinika</th>
                                        <th className="px-4 py-3 font-medium text-left text-[var(--color-sidebar-text)] hidden lg:table-cell">Pacienti</th>
                                        <th className="px-4 py-3 font-medium text-right text-[var(--color-sidebar-text)]">Suma</th>
                                        <th className="px-4 py-3 font-medium text-center text-[var(--color-sidebar-text)]">Stav</th>
                                        <th className="px-4 py-3 font-medium text-right text-[var(--color-sidebar-text)]">Akcie</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-table-border)]">
                                    {filteredInvoices.map((invoice) => (
                                        <tr key={invoice.id} className="transition-colors hover:bg-[var(--color-table-hover)]">
                                            <td className="px-4 py-3 font-medium text-primary">
                                                {invoice.number}
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                {invoice.clinic_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                                                {(invoice.patient_names || []).join(', ') || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-foreground">
                                                {parseFloat(invoice.total_amount).toFixed(2)} €
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                                    {getStatusIcon(invoice.status)} {getStatusLabel(invoice.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link to={`/invoices/${invoice.id}`}>
                                                        <Button variant="outline" size="sm" title="Zobraziť">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDownloadPDF(invoice.id)}
                                                        title="Stiahnuť PDF"
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
                title="Zmazať faktúru"
                message="Naozaj chcete zmazať túto faktúru?"
                confirmText="Zmazať"
                cancelText="Zrušiť"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setInvoiceToDelete(null)}
            />
        </div>
    );
}
