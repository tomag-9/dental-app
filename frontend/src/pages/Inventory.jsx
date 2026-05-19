import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { downloadBlobFile } from '../lib/browserActions';
import { escapeCsvCell, normalizeListResponse } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Plus, Search, Loader2, Edit2, Trash2, AlertTriangle } from 'lucide-react';

export default function Inventory() {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const fileInputRef = useRef(null);

    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/warehouse/');
            setItems(normalizeListResponse(response.data));
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
            setError('Nepodarilo sa načítať skladové položky');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const getStockStatus = (item) => {
        if (item.quantity <= 0) return 'OUT';
        if (item.min_threshold && item.quantity <= item.min_threshold) return 'LOW';
        return 'OK';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'OUT': return 'border border-red-200 bg-[var(--color-status-cancelled-bg)] text-[var(--color-status-cancelled-text)]';
            case 'LOW': return 'border border-amber-200 bg-[var(--color-accent-amber-bg)] text-[var(--color-accent-amber-text)]';
            case 'OK': return 'border border-green-200 bg-[var(--color-status-paid-bg)] text-[var(--color-status-paid-text)]';
            default: return 'border border-[var(--color-card-border)] bg-white text-foreground';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'OUT': return 'Nie je skladom';
            case 'LOW': return 'Nízky stav';
            case 'OK': return 'Skladom';
            default: return status;
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await api.delete(`/warehouse/${itemToDelete}/`);
            await fetchItems();
        } catch (err) {
            console.error('Failed to delete item:', err);
            setError('Nepodarilo sa zmazať položku');
        } finally {
            setItemToDelete(null);
        }
    };

    const handleAdjustQuantity = async (id, delta) => {
        try {
            const item = items.find(i => i.id === id);
            if (!item) return;
            const currentQuantity = Number(item.quantity || 0);
            const safeDelta = Number(delta || 0);
            const newQuantity = Math.max(0, currentQuantity + safeDelta);
            await api.patch(`/warehouse/${id}/`, { quantity: newQuantity });
            await fetchItems();
        } catch (err) {
            console.error('Failed to adjust quantity:', err);
            setError('Nepodarilo sa upraviť množstvo');
        }
    };

    const handleExportCsv = () => {
        const headers = [
            'name',
            'sku',
            'quantity',
            'unit',
            'min_threshold',
            'category',
            'location',
            'cost_price',
            'notes',
        ];

        const rows = filteredItems.map((item) => [
            item.name,
            item.sku,
            item.quantity,
            item.unit,
            item.min_threshold,
            item.category,
            item.location,
            item.cost_price,
            item.notes,
        ]);

        const csv = [headers.join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))].join('\n');
        downloadBlobFile(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'sklad-export.csv');
    };

    const parseCsvLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let index = 0; index < line.length; index += 1) {
            const char = line[index];
            if (char === '"') {
                if (inQuotes && line[index + 1] === '"') {
                    current += '"';
                    index += 1;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    };

    const handleImportCsv = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setError('');

        try {
            const content = await file.text();
            const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
            if (lines.length < 2) {
                setError('CSV súbor neobsahuje žiadne dáta na import.');
                return;
            }

            const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
            const required = ['name', 'quantity', 'unit'];
            const missing = required.filter((column) => !headers.includes(column));
            if (missing.length > 0) {
                setError(`Chýbajú povinné stĺpce: ${missing.join(', ')}`);
                return;
            }

            const records = lines.slice(1).map((line) => {
                const values = parseCsvLine(line);
                const entry = {};
                headers.forEach((header, index) => {
                    entry[header] = (values[index] ?? '').trim();
                });
                return entry;
            });

            const items = records
                .filter((entry) => entry.name)
                .map((entry) => ({
                    name: entry.name,
                    sku: entry.sku || null,
                    quantity: Number(entry.quantity || 0),
                    unit: entry.unit || 'pcs',
                    min_threshold: entry.min_threshold ? Number(entry.min_threshold) : null,
                    category: entry.category || null,
                    location: entry.location || null,
                    cost_price: entry.cost_price ? Number(entry.cost_price) : null,
                    notes: entry.notes || null,
                }));

            await api.post('/warehouse/import/', items);
            await fetchItems();
        } catch (err) {
            console.error('Failed to import CSV:', err);
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Nepodarilo sa importovať CSV súbor.');
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };

    const categories = [...new Set(items.filter(i => i.category).map(i => i.category))];

    const filteredItems = items.filter(item => {
        const status = getStockStatus(item);
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
            (item.sku || '').toLowerCase().includes(search.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || status === statusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    const lowStockCount = items.filter(item => getStockStatus(item) === 'LOW').length;
    const outOfStockCount = items.filter(item => getStockStatus(item) === 'OUT').length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sklad</h1>
                    <p className="text-muted-foreground">Správa dentálnych materiálov a zásob.</p>
                </div>
                <div className="flex gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleImportCsv}
                        className="hidden"
                    />
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                    >
                        {isImporting ? 'Importujem…' : 'Importovať CSV'}
                    </Button>
                    <Button variant="outline" onClick={handleExportCsv}>Exportovať CSV</Button>
                    <Link to="/inventory/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Pridať položku
                        </Button>
                    </Link>
                </div>
            </div>

            {(lowStockCount > 0 || outOfStockCount > 0) && (
                <div className="grid gap-4 md:grid-cols-2">
                    {outOfStockCount > 0 && (
                        <Card className="border-red-200 bg-[var(--color-status-cancelled-bg)]">
                            <CardContent className="pt-6 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-foreground">{outOfStockCount} položiek nie je skladom</p>
                                    <p className="text-sm text-foreground/85">Vyžadujú okamžité doobjednanie</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {lowStockCount > 0 && (
                        <Card className="border-amber-200 bg-[var(--color-accent-amber-bg)]">
                            <CardContent className="pt-6 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-[var(--color-accent-amber-text)] flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-foreground">{lowStockCount} položiek má nízky stav</p>
                                    <p className="text-sm text-foreground/85">Pod minimálnym limitom</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <CardTitle>Všetky položky ({filteredItems.length})</CardTitle>
                        <div className="flex gap-4 flex-wrap">
                            {categories.length > 0 && (
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                >
                                    <option value="all">Všetky kategórie</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            )}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                                <option value="all">Všetky stavy</option>
                                <option value="OK">Skladom</option>
                                <option value="LOW">Nízky stav</option>
                                <option value="OUT">Nie je skladom</option>
                            </select>
                            <div className="relative w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                                <input
                                    placeholder="Hľadať položky..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-border bg-white px-3 py-2 pl-8 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {items.length === 0
                                ? 'Nenašli sa žiadne skladové položky. Pridajte prvú položku.'
                                : 'Žiadne položky nevyhovujú hľadaniu.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-md border border-[var(--color-table-border)] bg-card">
                            <table className="w-full text-sm">
                                <thead className="bg-[var(--color-table-header)] text-[var(--color-sidebar-text)]">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-left">Názov položky</th>
                                        <th className="px-4 py-3 font-medium text-left">SKU</th>
                                        <th className="px-4 py-3 font-medium text-center">Množstvo</th>
                                        <th className="px-4 py-3 font-medium text-left">Jednotka</th>
                                        <th className="px-4 py-3 font-medium text-center">Stav</th>
                                        <th className="px-4 py-3 font-medium text-left">Kategória</th>
                                        <th className="px-4 py-3 font-medium text-right">Akcie</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((item) => {
                                        const status = getStockStatus(item);
                                        return (
                                            <tr key={item.id} className="border-t border-[var(--color-table-border)] transition-colors hover:bg-[var(--color-table-hover)]">
                                                <td className="px-4 py-3 font-medium">
                                                    {item.name}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {item.sku || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() => handleAdjustQuantity(item.id, -1)}
                                                        >
                                                            −
                                                        </Button>
                                                        <span className="w-12 text-center font-medium">
                                                            {item.quantity}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0"
                                                            onClick={() => handleAdjustQuantity(item.id, 1)}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {item.unit}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${getStatusColor(status)}`}>
                                                        {getStatusLabel(status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {item.category || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                    <Link to={`/inventory/${item.id}/edit`}>
                                                        <Button variant="ghost" size="sm">
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setItemToDelete(item.id)}
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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
                open={!!itemToDelete}
                title="Zmazať položku"
                message="Naozaj chcete zmazať túto skladovú položku?"
                confirmText="Zmazať"
                cancelText="Zrušiť"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setItemToDelete(null)}
            />
        </div>
    );
}
