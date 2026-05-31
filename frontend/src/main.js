import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';

window.React = React;
window.ReactDOM = ReactDOM;
window.__API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8810/api';

const appModules = [
  () => import('./api/api-client.js'),
  () => import('./components/Icon.jsx'),
  () => import('./components/Logo.jsx'),
  () => import('./components/Shared.jsx'),
  () => import('./components/CreateDrawers.jsx'),
  () => import('./components/polozky-shared.jsx'),
  () => import('./components/variant-detail.jsx'),
  () => import('./pages/Dashboard.jsx'),
  () => import('./pages/Jobs.jsx'),
  () => import('./pages/JobDetail.jsx'),
  () => import('./pages/Patients.jsx'),
  () => import('./pages/PatientDetail.jsx'),
  () => import('./pages/Finance.jsx'),
  () => import('./pages/Invoices.jsx'),
  () => import('./pages/Pricelist.jsx'),
  () => import('./pages/Inventory.jsx'),
  () => import('./pages/Calendar.jsx'),
  () => import('./pages/Clinics.jsx'),
  () => import('./pages/Doctors.jsx'),
  () => import('./pages/Technicians.jsx'),
  () => import('./pages/Settings.jsx'),
  () => import('./pages/Permissions.jsx'),
  () => import('./pages/Superadmin.jsx'),
  () => import('./components/Sidebar.jsx'),
  () => import('./components/Topbar.jsx'),
  () => import('./components/NewJob.jsx'),
  () => import('./pages/Login.jsx'),
  () => import('./App.jsx'),
];

async function boot() {
  for (const loadModule of appModules) {
    await loadModule();
  }
}

boot().catch((error) => {
  const root = document.getElementById('root');
  root.innerHTML = `<pre style="padding:24px;color:#c0392b">${error.message}</pre>`;
});
