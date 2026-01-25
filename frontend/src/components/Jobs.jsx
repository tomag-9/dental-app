import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Loader2 } from 'lucide-react';
import JobForm from './JobForm';
import JobList from './JobList';

export default function Jobs({ token, setError }) {
  const [jobs, setJobs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [j, p] = await Promise.all([api(token).get('/jobs/'), api(token).get('/patients/')]);
      setJobs(j.data); setPatients(p.data);
    } catch { setError('Chyba pri načítaní prác'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetchData(); }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Práce</h2><button onClick={() => setOpenForm(true)} className="bg-primary text-white px-4 py-2 rounded-xl font-bold shadow-lg">+ Nová práca</button></div>
      <JobList jobs={jobs} patients={patients} token={token} setError={setError} onEdit={(j) => { setSelectedJob(j); setOpenForm(true); }} onDelete={async (id) => { if (window.confirm('Zmazať?')) { await api(token).delete(`/jobs/${id}/`); fetchData(); } }} />
      <JobForm open={openForm} onClose={() => { setOpenForm(false); setSelectedJob(null); }} onSuccess={() => { setOpenForm(false); fetchData(); }} token={token} setError={setError} initialData={selectedJob} />
    </div>
  );
}
