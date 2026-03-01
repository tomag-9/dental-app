import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Search, Loader2, Edit2, Trash2, Printer } from 'lucide-react';

export default function PriceList() {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPriceList();
    }, []);

    const fetchPriceList = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/finance/pricelist/');
            setItems(response.data);
        } catch (err) {
            console.error('Failed to fetch price list:', err);
            setError('Failed to load price list');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this price list item?')) return;

        try {
            await api.delete(`/finance/pricelist/${id}/`);
            await fetchPriceList();
        } catch (err) {
            console.error('Failed to delete item:', err);
            setError('Failed to delete item');
        }
    };

    const handlePrint = () => {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Price List</title>
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
                        <h1>Price List</h1>
                        <div class="date">Generated on ${new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}</div>
                    </div>
                </header>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%;">Code</th>
                            <th style="width: 45%;">Description</th>
                            <th style="width: 20%;">Price</th>
                            <th style="width: 20%;">Valid Until</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredItems.map(item => `
                            <tr>
                                <td><strong>${item.code}</strong></td>
                                <td>${item.description}</td>
                                <td class="price">€${parseFloat(item.price).toFixed(2)}</td>
                                <td class="expires">${item.valid_to ? new Date(item.valid_to).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const filteredItems = items.filter(item =>
        item.code.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Price List</h1>
                    <p className="text-muted-foreground">Manage dental service pricing.</p>
                </div>
                <div className="flex gap-2">
                    {items.length > 0 && (
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                    )}
                    <Link to="/price-list/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Add Item
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
                        <CardTitle>All Items</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                placeholder="Search by code or description..."
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
                                ? 'No price list items found. Add your first item to get started.'
                                : 'No items match your search.'}
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-left">Code</th>
                                        <th className="px-4 py-3 font-medium text-left">Description</th>
                                        <th className="px-4 py-3 font-medium text-right">Price</th>
                                        <th className="px-4 py-3 font-medium text-center">Valid Until</th>
                                        <th className="px-4 py-3 font-medium text-right">Actions</th>
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
                                                        {new Date(item.valid_to).toLocaleDateString('en-US', {
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
                                                    onClick={() => handleDelete(item.id)}
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
        </div>
    );
}
