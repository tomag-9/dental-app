import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Search, User, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { Link } from 'react-router-dom';

export default function Doctors() {
    const [doctors, setDoctors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchDoctors();
    }, []);

    const fetchDoctors = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/crm/doctors/');
            setDoctors(response.data);
        } catch (error) {
            console.error('Failed to fetch doctors:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredDoctors = doctors.filter(doc =>
        doc.first_name.toLowerCase().includes(search.toLowerCase()) ||
        doc.last_name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Lekári</h1>
                    <p className="text-muted-foreground">Správa lekárov.</p>
                </div>
                <Link to="/doctors/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Pridať lekára
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Všetci lekári</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                placeholder="Hľadať lekárov..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-8 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Meno</th>
                                    <th className="px-4 py-3 font-medium">Klinika</th>
                                    <th className="px-4 py-3 font-medium">Kontakt</th>
                                    <th className="px-4 py-3 font-medium text-right">Akcie</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                        </td>
                                    </tr>
                                ) : filteredDoctors.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                                            Nenašli sa žiadni lekári.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDoctors.map((doc) => (
                                        <tr key={doc.id} className="hover:bg-muted/50">
                                            <td className="px-4 py-3 font-medium flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <User size={14} />
                                                </div>
                                                {doc.first_name} {doc.last_name}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{doc.clinic_name || '-'}</td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                <div className="flex flex-col">
                                                    <span>{doc.email}</span>
                                                    <span>{doc.phone}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Link to={`/doctors/${doc.id}/edit`}>
                                                    <Button variant="ghost" size="sm">Upraviť</Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
