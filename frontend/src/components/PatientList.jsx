import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PatientForm from './PatientForm';
import { Link } from 'react-router-dom';

const PatientList = ({ filteredPatients, searchTerm, handleSearchChange, token, setError }) => {
  const [editPatient, setEditPatient] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPatientJobs, setSelectedPatientJobs] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  const handleEdit = (patient) => {
    setEditPatient(patient);
    setShowEditModal(true);
  };

  const handleUpdatePatient = async (updatedData) => {
    try {
      await axios.put(`http://localhost:8000/patients/${editPatient.id}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowEditModal(false);
      setEditPatient(null);
      setError('');
      // Refresh patients
      const response = await axios.get('http://localhost:8000/patients/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      filteredPatients(response.data);
    } catch (err) {
      setError('Nepodarilo sa upraviť pacienta: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const handleShowDetails = async (patientId) => {
    try {
      const response = await axios.get(`http://localhost:8000/jobs/?patient_id=${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedPatientJobs(response.data);
      setSelectedPatientId(patientId);
      setShowDetailsModal(true);
    } catch (err) {
      setError('Nepodarilo sa načítať práce: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-white">Zoznam pacientov</h2>
      <input
        type="text"
        value={searchTerm}
        onChange={handleSearchChange}
        placeholder="Zadajte meno, priezvisko alebo rodné číslo"
        className="mb-4 w-full p-2 rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
      />
      {filteredPatients.length === 0 ? (
        <p className="text-gray-400">Žiadni pacienti</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto bg-gray-700 rounded-md">
            <thead>
              <tr className="bg-gray-600 text-white">
                <th className="px-4 py-2 text-left">Meno</th>
                <th className="px-4 py-2 text-left">Priezvisko</th>
                <th className="px-4 py-2 text-left">Rodné číslo</th>
                <th className="px-4 py-2 text-left">Akcie</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map(patient => (
                <tr key={patient.id} className="border-b border-gray-600 hover:bg-gray-600">
                  <td className="px-4 py-2 text-white">{patient.first_name}</td>
                  <td className="px-4 py-2 text-white">{patient.last_name}</td>
                  <td className="px-4 py-2 text-white">{patient.birth_number}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleEdit(patient)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md mr-2 text-sm"
                    >
                      Upraviť
                    </button>
                    <button
                      onClick={() => handleShowDetails(patient.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg max-w-lg w-full">
            <h3 className="text-xl font-semibold mb-4 text-white">Upraviť pacienta</h3>
            <PatientForm
              formData={editPatient}
              handleChange={(e) =>
                setEditPatient({ ...editPatient, [e.target.name]: e.target.value })
              }
              handleSubmit={(e) => {
                e.preventDefault();
                handleUpdatePatient(editPatient);
              }}
              error={''}
              isEditMode={true}
            />
            <button
              onClick={() => setShowEditModal(false)}
              className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-md"
            >
              Zatvoriť
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg max-w-lg w-full">
            <h3 className="text-xl font-semibold mb-4 text-white">Práce pacienta</h3>
            {selectedPatientJobs.length === 0 ? (
              <p className="text-gray-400">Žiadne práce pre pacienta</p>
            ) : (
              <ul className="divide-y divide-gray-600">
                {selectedPatientJobs.map(job => (
                  <li key={job.id} className="py-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-white">Práca #{job.id}</p>
                        <p className="text-sm text-gray-400">
                          Kódy procedúr: {job.procedure_codes?.join(', ') || 'Žiadne'}
                        </p>
                        {job.due_date && (
                          <p className="text-sm text-gray-400">
                            Dátum splatnosti: {new Date(job.due_date).toLocaleDateString('sk-SK')}
                          </p>
                        )}
                        <p className="text-sm text-gray-400">
                          Stav: {job.status === 'pending' ? 'Čakajúce' : job.status === 'in_progress' ? 'V priebehu' : 'Dokončené'}
                        </p>
                      </div>
                      <Link
                        to={`/jobs/${job.id}`}
                        className="text-blue-400 hover:underline"
                        onClick={() => setShowDetailsModal(false)}
                      >
                        Zobraziť detaily
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setShowDetailsModal(false)}
              className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-md"
            >
              Zatvoriť
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientList;