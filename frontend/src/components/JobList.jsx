import React, { useState, useEffect } from 'react';
import axios from 'axios';

const JobList = ({ token, setError }) => {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await axios.get('http://localhost:8000/jobs/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setJobs(response.data);
      } catch (err) {
        setError('Nepodarilo sa načítať práce: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    if (token) fetchJobs();
  }, [token, setError]);

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-white">Zoznam prác</h2>
      {jobs.length === 0 ? (
        <p className="text-gray-400">Žiadne práce</p>
      ) : (
        <ul className="divide-y divide-gray-700">
          {jobs.map(job => (
            <li key={job.id} className="py-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-lg font-medium text-white">Práca #{job.id}</p>
                  <p className="text-sm text-gray-400">Pacient ID: {job.patient_id}</p>
                  <p className="text-sm text-gray-400">Klinika ID: {job.clinic_id}</p>
                  <p className="text-sm text-gray-400">Lekár ID: {job.doctor_id}</p>
                  <p className="text-sm text-gray-400">Technik ID: {job.technician_id}</p>
                  <p className="text-sm text-gray-400">Kódy procedúr: {job.procedure_codes?.join(', ') || 'Žiadne'}</p>
                  {job.due_date && <p className="text-sm text-gray-400">Dátum splatnosti: {new Date(job.due_date).toLocaleDateString('sk-SK')}</p>}
                  {job.status && <p className="text-sm text-gray-400">Stav: {job.status === 'pending' ? 'Čakajúce' : job.status === 'in_progress' ? 'V priebehu' : 'Dokončené'}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default JobList;