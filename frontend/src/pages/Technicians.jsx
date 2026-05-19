import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Plus, Search, Loader2, Edit2, Trash2 } from 'lucide-react';

export default function Technicians() {
    const [technicians, setTechnicians] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [technicianToDelete, setTechnicianToDelete] = useState(null);

    useEffect(() => {
        fetchTechnicians();
    }, []);

    const fetchTechnicians = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/jobs/technicians/');
            setTechnicians(response.data);
        } catch (err) {
            console.error('Failed to fetch technicians:', err);
            setError('Nepodarilo sa načítať technikov');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!technicianToDelete) return;
        try {
            await api.delete(`/jobs/technicians/${technicianToDelete}/`);
            await fetchTechnicians();
        } catch (err) {
            console.error('Failed to delete technician:', err);
            setError('Nepodarilo sa zmazať technika');
        } finally {
            setTechnicianToDelete(null);
        }
    };

    const filteredTechnicians = technicians.filter(tech =>
        tech.first_name.toLowerCase().includes(search.toLowerCase()) ||
        tech.last_name.toLowerCase().includes(search.toLowerCase()) ||
        (tech.contact_info?.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (tech.contact_info?.phone || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Technici</h1>
                    <p className="text-muted-foreground">Správa laboratórnych technikov.</p>
                </div>
                <Link to="/technicians/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Pridať technika
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
                    <div className="flex items-center justify-between">
                        <CardTitle>Všetci technici</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                placeholder="Hľadať technikov..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 pl-8 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filteredTechnicians.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {technicians.length === 0
                                ? 'Nenašli sa žiadni technici. Pridajte prvého technika.'
                                : 'Žiadny technik nezodpovedá vyhľadávaniu.'}
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="bg-[var(--color-table-header)]">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-left">Meno</th>
                                        <th className="px-4 py-3 font-medium text-left">Titul</th>
                                        <th className="px-4 py-3 font-medium text-left">E-mail</th>
                                        <th className="px-4 py-3 font-medium text-left">Telefón</th>
                                        <th className="px-4 py-3 font-medium text-right">Akcie</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTechnicians.map((tech) => (
                                        <tr key={tech.id} className="border-t hover:bg-[var(--color-table-header)] transition-colors">
                                            <td className="px-4 py-3 font-medium">
                                                {tech.title_before && <span>{tech.title_before} </span>}
                                                {tech.first_name} {tech.last_name}
                                                {tech.title_after && <span> {tech.title_after}</span>}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {tech.title_before || tech.title_after ? (
                                                    <span>Áno</span>
                                                ) : (
                                                    <span>-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {tech.contact_info?.email || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {tech.contact_info?.phone || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                <Link to={`/technicians/${tech.id}/edit`}>
                                                    <Button variant="ghost" size="sm">
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setTechnicianToDelete(tech.id)}
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
                open={!!technicianToDelete}
                title="Zmazať technika"
                message="Naozaj chcete zmazať tohto technika?"
                confirmText="Zmazať"
                cancelText="Zrušiť"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setTechnicianToDelete(null)}
            />
        </div>
    );
}
