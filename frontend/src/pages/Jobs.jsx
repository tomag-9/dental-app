import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Loader2, Calendar } from 'lucide-react';
import api from '../lib/api';
import { Link } from 'react-router-dom';

export default function Jobs() {
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/jobs/jobs/');
            setJobs(response.data);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
                    <p className="text-muted-foreground">Track and manage dental jobs.</p>
                </div>
                <Link to="/jobs/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Job
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="col-span-full text-center text-muted-foreground p-8 bg-card rounded-lg border border-dashed">
                        No jobs found. Create one to get started.
                    </div>
                ) : (
                    jobs.map(job => (
                        <Card key={job.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg">Job #{job.id}</CardTitle>
                                    <span className="text-xs font-mono bg-secondary px-2 py-1 rounded">
                                        {job.status}
                                    </span>
                                </div>
                                <p className="text-sm font-medium text-primary">
                                    {job.patient_details?.first_name} {job.patient_details?.last_name}
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p className="flex items-center gap-1">
                                        <Calendar size={12} /> Due: {job.due_date || 'None'}
                                    </p>
                                    <p>Dr. {job.doctor_details?.last_name}</p>
                                    <p>{job.clinic_details?.name}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
