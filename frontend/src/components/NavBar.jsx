import React from 'react';
import { Link } from 'react-router-dom';

const NavBar = ({ handleLogout, sidebarOpen, setSidebarOpen }) => {
  const tabs = ['Pacienti', 'Lekári', 'Technici', 'Kliniky', 'Práce', 'Cenník'];
  const routes = ['/patients', '/doctors', '/technicians', '/clinics', '/jobs', '/price-list'];

  return (
    <nav className="bg-black text-gray-200 shadow-xl border-b-2 border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-green-500">🦷</span>
            <span className="text-xl font-bold">DentalApp</span>
            <button
              className="md:hidden text-white p-2"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? '✕' : '☰'}
            </button>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            {tabs.map((tab, index) => (
              <Link
                key={tab}
                to={routes[index]}
                className="px-3 py-2 rounded-none font-semibold border-b-4 border-transparent hover:border-green-500 hover:text-green-300 transition"
              >
                {tab}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-red-600 hover:text-white transition font-semibold"
            >
              Odhlásiť sa
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;