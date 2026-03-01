import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Search, Edit2, Phone, Mail } from 'lucide-react';
import api from '../lib/api';
import { Link } from 'react-router-dom';
import ResponsiveTable from '../components/table/ResponsiveTable';
import { LoadingState, ErrorState } from '../components/states';

export default function Patients() {
    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get('/crm/patients/');
            setPatients(response.data);
        } catch (err) {
            console.error('Failed to fetch patients:', err);
            setError('Nepodarilo sa načítať pacientov');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredPatients = patients.filter(patient =>
        patient.first_name.toLowerCase().includes(search.toLowerCase()) ||
        patient.last_name.toLowerCase().includes(search.toLowerCase()) ||
        (patient.birth_number && patient.birth_number.includes(search))
    );

    const columns = [
        { key: 'name', label: 'Meno' },
        { key: 'birth', label: 'Rodné číslo' },
        { key: 'phone', label: 'Telefón', className: 'hidden lg:table-cell' },
        { key: 'email', label: 'E-mail', className: 'hidden lg:table-cell' },
        { key: 'actions', label: 'Akcie', className: 'text-right' }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pacienti</h1>
                    <p className="text-muted-foreground">Správa kariet pacientov.</p>
                </div>
                <Link to="/patients/new">
                    <Button className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Pridať pacienta
                    </Button>
                </Link>
            </div>

            {error && (
                <ErrorState
                    title="Nepodarilo sa načítať pacientov"
                    message={error}
                    onRetry={fetchPatients}
                />
            )}

            <Card>
                <CardHeader className="space-y-4">
                    <CardTitle>Všetci pacienti ({filteredPatients.length})</CardTitle>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <input
                            placeholder="Hľadať podľa mena alebo rodného čísla..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <ResponsiveTable
                        columns={columns}
                        data={filteredPatients}
                        isLoading={isLoading}
                        isEmpty={filteredPatients.length === 0}
                        emptyTitle="Nenašli sa žiadni pacienti"
                        emptyDescription={search ? 'Skúste upraviť vyhľadávanie.' : 'Začnite vytvorením prvého pacienta.'}
                        renderMobileCard={(patient) => (
                            <>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-semibold text-gray-900">
                                            {patient.first_name} {patient.last_name}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Rodné číslo: {patient.birth_number || '-'}
                                        </p>
                                    </div>
                                    <Link to={`/patients/${patient.id}/edit`}>
                                        <Button variant="outline" size="sm">
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                                {patient.phone && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Phone className="h-4 w-4" />
                                        {patient.phone}
                                    </div>
                                )}
                                {patient.email && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Mail className="h-4 w-4" />
                                        {patient.email}
                                    </div>
                                )}
                            </>
                        )}
                        renderDesktopRow={(patient) => (
                            <>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                    {patient.first_name} {patient.last_name}
                                </td>
                                <td className="px-4 py-3 text-gray-600">{patient.birth_number}</td>
                                <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{patient.phone || '-'}</td>
                                <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{patient.email || '-'}</td>
                                <td className="px-4 py-3 text-right">
                                    <Link to={`/patients/${patient.id}/edit`}>
                                        <Button variant="outline" size="sm">
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </td>
                            </>
                        )}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
