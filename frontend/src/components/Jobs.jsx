import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { Plus, Loader2, Briefcase, Filter, Search, ChevronUp, ChevronDown, Edit2, Trash2 } from 'lucide-react';
import JobForm from './JobForm';
import JobList from './JobList';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

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

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <span className="font-black text-gray-300 uppercase tracking-widest text-sm">Načítavam zoznam prác</span>
    </div>
  );

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
        <div className="space-y-1">
          <h2 className="text-5xl font-black text-gray-900 tracking-tighter italic">Práce<span className="text-primary">.</span></h2>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Aktuálne laboratórne objednávky a termíny</p>
        </div>
        <button
            onClick={() => setOpenForm(true)}
            className="group px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/30 hover:bg-opacity-90 transition-all flex items-center gap-3 text-sm tracking-widest"
        >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            VYTVORIŤ NOVÚ PRÁCU
        </button>
      </div>

      <JobList
        jobs={jobs}
        patients={patients}
        token={token}
        setError={setError}
        onEdit={(j) => { setSelectedJob(j); setOpenForm(true); }}
        onDelete={async (id) => { if (window.confirm('Naozaj vymazať túto prácu?')) { try { await api(token).delete(`/jobs/${id}/`); fetchData(); } catch { setError('Mazanie zlyhalo'); } } }}
      />

      <JobForm
        open={openForm}
        onClose={() => { setOpenForm(false); setSelectedJob(null); }}
        onSuccess={() => { setOpenForm(false); fetchData(); }}
        token={token}
        setError={setError}
        initialData={selectedJob}
      />
    </div>
  );
}
