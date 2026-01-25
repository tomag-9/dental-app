import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Search, MapPin, Loader2 } from 'lucide-react'; // Changed Loader to Loader2
import api from '../lib/api';
import { Link } from 'react-router-dom';

export default function Clinics() {
    const [clinics, setClinics] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchClinics();
    }, []);

    const fetchClinics = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/crm/clinics/');
            setClinics(response.data);
        } catch (error) {
            console.error('Failed to fetch clinics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredClinics = clinics.filter(clinic =>
        clinic.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Clinics</h1>
                    <p className="text-muted-foreground">Manage dental clinics.</p>
                </div>
                <Link to="/clinics/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Clinic
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>All Clinics</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                placeholder="Search clinics..."
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
                                    <th className="px-4 py-3 font-medium">Name</th>
                                    <th className="px-4 py-3 font-medium">Contact</th>
                                    <th className="px-4 py-3 font-medium">Address</th>
                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                                        </td>
                                    </tr>
                                ) : filteredClinics.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                                            No clinics found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredClinics.map((clinic) => (
                                        <tr key={clinic.id} className="hover:bg-muted/50">
                                            <td className="px-4 py-3 font-medium">{clinic.name}</td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                <div className="flex flex-col">
                                                    <span>{clinic.email}</span>
                                                    <span>{clinic.phone}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <MapPin size={14} /> {clinic.street}, {clinic.city}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button variant="ghost" size="sm">Edit</Button>
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
