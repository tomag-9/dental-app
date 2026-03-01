import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Search, Loader2, Edit2, Trash2, AlertTriangle } from 'lucide-react';

export default function Inventory() {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/warehouse/items');
            setItems(response.data);
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
            setError('Failed to load inventory items');
        } finally {
            setIsLoading(false);
        }
    };

    const getStockStatus = (item) => {
        if (item.quantity <= 0) return 'OUT';
        if (item.min_threshold && item.quantity <= item.min_threshold) return 'LOW';
        return 'OK';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'OUT': return 'bg-red-100 text-red-800';
            case 'LOW': return 'bg-yellow-100 text-yellow-800';
            case 'OK': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        try {
            await api.delete(`/warehouse/items/${id}`);
            await fetchItems();
        } catch (err) {
            console.error('Failed to delete item:', err);
            setError('Failed to delete item');
        }
    };

    const handleAdjustQuantity = async (id, delta) => {
        try {
            const item = items.find(i => i.id === id);
            const newQuantity = Math.max(0, item.quantity + delta);
            await api.put(`/warehouse/items/${id}`, { quantity: newQuantity });
            await fetchItems();
        } catch (err) {
            console.error('Failed to adjust quantity:', err);
            setError('Failed to adjust quantity');
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
                    <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
                    <p className="text-muted-foreground">Manage dental materials and supplies.</p>
                </div>
                <Link to="/inventory/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                </Link>
            </div>

            {(lowStockCount > 0 || outOfStockCount > 0) && (
                <div className="grid gap-4 md:grid-cols-2">
                    {outOfStockCount > 0 && (
                        <Card className="border-destructive/50 bg-destructive/5">
                            <CardContent className="pt-6 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">{outOfStockCount} items out of stock</p>
                                    <p className="text-sm text-muted-foreground">Require immediate reordering</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {lowStockCount > 0 && (
                        <Card className="border-yellow-500/50 bg-yellow-50">
                            <CardContent className="pt-6 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">{lowStockCount} items low in stock</p>
                                    <p className="text-sm text-muted-foreground">Below minimum threshold</p>
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
                        <CardTitle>All Items ({filteredItems.length})</CardTitle>
                        <div className="flex gap-4 flex-wrap">
                            {categories.length > 0 && (
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="px-3 py-2 border border-input rounded-md shadow-sm text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            )}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 border border-input rounded-md shadow-sm text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="all">All Status</option>
                                <option value="OK">In Stock</option>
                                <option value="LOW">Low Stock</option>
                                <option value="OUT">Out of Stock</option>
                            </select>
                            <div className="relative w-64">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    placeholder="Search items..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-8 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                                ? 'No inventory items found. Add your first item to get started.'
                                : 'No items match your search.'}
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-left">Item Name</th>
                                        <th className="px-4 py-3 font-medium text-left">SKU</th>
                                        <th className="px-4 py-3 font-medium text-center">Quantity</th>
                                        <th className="px-4 py-3 font-medium text-left">Unit</th>
                                        <th className="px-4 py-3 font-medium text-center">Status</th>
                                        <th className="px-4 py-3 font-medium text-left">Category</th>
                                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((item) => {
                                        const status = getStockStatus(item);
                                        return (
                                            <tr key={item.id} className="border-t hover:bg-muted/50 transition-colors">
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
                                                        {status}
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
                                                        onClick={() => handleDelete(item.id)}
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
        </div>
    );
}
