import React, { useState, useEffect } from 'react';
import axios from 'axios';

const JobForm = ({ jobFormData, setJobFormData, token, setError, error }) => {
  const [patients, setPatients] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [patientsRes, clinicsRes, doctorsRes, techniciansRes] = await Promise.all([
          axios.get('http://localhost:8000/patients/', { headers }),
          axios.get('http://localhost:8000/clinics/', { headers }),
          axios.get('http://localhost:8000/doctors/', { headers }),
          axios.get('http://localhost:8000/technicians/', { headers }),
        ]);
        setPatients(patientsRes.data);
        setClinics(clinicsRes.data);
        setDoctors(doctorsRes.data);
        setTechnicians(techniciansRes.data);
      } catch (err) {
        setError('Nepodarilo sa načítať údaje: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    if (token) fetchData();
  }, [token, setError]);

  const handleJobChange = (e) => {
    setJobFormData({ ...jobFormData, [e.target.name]: e.target.value });
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    try {
      const jobData = {
        ...jobFormData,
        patient_id: parseInt(jobFormData.patient_id) || null,
        clinic_id: parseInt(jobFormData.clinic_id) || null,
        doctor_id: parseInt(jobFormData.doctor_id) || null,
        technician_id: parseInt(jobFormData.technician_id) || null,
        procedure_codes: jobFormData.procedure_codes ? jobFormData.procedure_codes.split(',').map(code => code.trim()) : [],
        due_date: jobFormData.due_date || null,
        status: jobFormData.status || 'pending'
      };
      await axios.post('http://localhost:8000/jobs/', jobData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobFormData({
        patient_id: '',
        clinic_id: '',
        doctor_id: '',
        technician_id: '',
        procedure_codes: '',
        due_date: '',
        status: ''
      });
      setError('');
    } catch (err) {
      setError('Nepodarilo sa pridať prácu: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-white">Pridať prácu</h2>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      <form onSubmit={handleJobSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300">Pacient</label>
          <select
            name="patient_id"
            value={jobFormData.patient_id}
            onChange={handleJobChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
            required
          >
            <option value="">Vyberte pacienta</option>
            {patients.map(patient => (
              <option key={patient.id} value={patient.id}>
                {patient.first_name} {patient.last_name} ({patient.birth_number})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Klinika</label>
          <select
            name="clinic_id"
            value={jobFormData.clinic_id}
            onChange={handleJobChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
            required
          >
            <option value="">Vyberte kliniku</option>
            {clinics.map(clinic => (
              <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Lekár</label>
          <select
            name="doctor_id"
            value={jobFormData.doctor_id}
            onChange={handleJobChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
            required
          >
            <option value="">Vyberte lekára</option>
            {doctors.map(doctor => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.first_name} {doctor.last_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Technik</label>
          <select
            name="technician_id"
            value={jobFormData.technician_id}
            onChange={handleJobChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
            required
          >
            <option value="">Vyberte technika</option>
            {technicians.map(technician => (
              <option key={technician.id} value={technician.id}>
                {technician.first_name} {technician.last_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Kódy procedúr (oddelené čiarkou)</label>
          <input
            type="text"
            name="procedure_codes"
            value={jobFormData.procedure_codes}
            onChange={handleJobChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
            placeholder="P001, P002"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Dátum splatnosti</label>
          <input
            type="date"
            name="due_date"
            value={jobFormData.due_date}
            onChange={handleJobChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300">Stav</label>
          <select
            name="status"
            value={jobFormData.status}
            onChange={handleJobChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
          >
            <option value="">Vyberte stav</option>
            <option value="pending">Čakajúce</option>
            <option value="in_progress">V priebehu</option>
            <option value="completed">Dokončené</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md font-semibold w-full"
          >
            Pridať prácu
          </button>
        </div>
      </form>
    </div>
  );
};

export default JobForm;