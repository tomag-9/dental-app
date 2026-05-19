import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { printHtmlDocument } from '../lib/browserActions';
import { escapeHtml, normalizeListResponse } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Plus, Search, Loader2, Edit2, Trash2, Printer } from 'lucide-react';

export default function PriceList() {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [itemToDelete, setItemToDelete] = useState(null);

    const fetchPriceList = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/finance/price-list/');
            setItems(normalizeListResponse(response.data));
        } catch (err) {
            console.error('Failed to fetch price list:', err);
            setError('Nepodarilo sa načítať cenník.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPriceList();
    }, [fetchPriceList]);

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            await api.delete(`/finance/price-list/${itemToDelete}/`);
            await fetchPriceList();
        } catch (err) {
            console.error('Failed to delete item:', err);
            setError('Nepodarilo sa vymazať položku.');
        } finally {
            setItemToDelete(null);
        }
    };

    const handlePrint = () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Cenník</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 40px;
                        color: #333;
                    }
                    header {
                        display: flex;
                        align-items: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #1f2937;
                        padding-bottom: 15px;
                    }
                    h1 {
                        margin: 0;
                        font-size: 28px;
                    }
                    .date {
                        margin-top: 10px;
                        font-size: 12px;
                        color: #666;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th {
                        background: #f3f4f6;
                        color: #1f2937;
                        font-weight: 600;
                        padding: 12px 15px;
                        border: 1px solid #d1d5db;
                        text-align: left;
                    }
                    td {
                        padding: 12px 15px;
                        border: 1px solid #d1d5db;
                    }
                    tbody tr:nth-child(even) {
                        background-color: #f9fafb;
                    }
                    .price {
                        text-align: right;
                        font-weight: 500;
                    }
                    .expires {
                        font-size: 12px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <header>
                    <div>
                        <h1>Cenník</h1>
                        <div class="date">Vygenerované dňa ${new Date().toLocaleDateString('sk-SK', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}</div>
                    </div>
                </header>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%;">Kód</th>
                            <th style="width: 45%;">Popis</th>
                            <th style="width: 20%;">Cena</th>
                            <th style="width: 20%;">Platný do</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredItems.map(item => `
                            <tr>
                                <td><strong>${escapeHtml(item.code)}</strong></td>
                                <td>${escapeHtml(item.description)}</td>
                                <td class="price">€${parseFloat(item.price).toFixed(2)}</td>
                                <td class="expires">${escapeHtml(item.valid_to ? new Date(item.valid_to).toLocaleDateString('sk-SK', { year: 'numeric', month: 'short', day: 'numeric' }) : '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        try {
            printHtmlDocument(html);
        } catch {
            setError('Nepodarilo sa otvoriť náhľad tlače.');
        }
    };

    const filteredItems = items.filter(item =>
        item.code.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cenník</h1>
                    <p className="text-muted-foreground">Správa cien dentálnych výkonov.</p>
                </div>
                <div className="flex gap-2">
                    {items.length > 0 && (
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Tlačiť
                        </Button>
                    )}
                    <Link to="/price-list/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Pridať položku
                        </Button>
                    </Link>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                    {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Všetky položky</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                placeholder="Hľadať podľa kódu alebo popisu..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
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
                                ? 'Cenník je prázdny. Pridajte prvú položku.'
                                : 'Žiadne položky nevyhovujú vyhľadávaniu.'}
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-left">Kód</th>
                                        <th className="px-4 py-3 font-medium text-left">Popis</th>
                                        <th className="px-4 py-3 font-medium text-right">Cena</th>
                                        <th className="px-4 py-3 font-medium text-center">Platný do</th>
                                        <th className="px-4 py-3 font-medium text-right">Akcie</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((item) => (
                                        <tr key={item.id} className="border-t hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-primary">
                                                {item.code}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.description}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                €{parseFloat(item.price).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {item.valid_to ? (
                                                    <span className="inline-block px-2 py-1 bg-muted rounded text-xs">
                                                        {new Date(item.valid_to).toLocaleDateString('sk-SK', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                <Link to={`/price-list/${item.id}/edit`}>
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
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={!!itemToDelete}
                title="Zmazať položku cenníka"
                message="Naozaj chcete zmazať túto položku cenníka?"
                confirmText="Zmazať"
                cancelText="Zrušiť"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setItemToDelete(null)}
            />
        </div>
    );
}
