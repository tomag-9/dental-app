import React from 'react';

const PatientForm = ({ formData, handleChange, handleSubmit, error, isEditMode = false }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-md">
      <h2 className="text-lg font-semibold mb-3 text-white">{isEditMode ? 'Upraviť pacienta' : 'Pridať pacienta'}</h2>
      {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-300">Meno</label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300">Priezvisko</label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300">Rodné číslo</label>
          <input
            type="text"
            name="birth_number"
            value={formData.birth_number}
            onChange={handleChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300">Adresa</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300">Telefón</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md font-semibold text-sm"
          >
            {isEditMode ? 'Uložiť zmeny' : 'Pridať pacienta'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PatientForm;