import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';

window.React = React;
window.ReactDOM = ReactDOM;
window.__API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8810/api';

const designScripts = [
  'api-client.js',
  'Icon.jsx',
  'Logo.jsx',
  'Shared.jsx',
  'CreateDrawers.jsx',
  'polozky-shared.jsx',
  'variant-detail.jsx',
  'Dashboard.jsx',
  'Jobs.jsx',
  'JobDetail.jsx',
  'Patients.jsx',
  'PatientDetail.jsx',
  'Finance.jsx',
  'Invoices.jsx',
  'Pricelist.jsx',
  'Inventory.jsx',
  'Calendar.jsx',
  'Clinics.jsx',
  'Doctors.jsx',
  'Technicians.jsx',
  'Settings.jsx',
  'Permissions.jsx',
  'Superadmin.jsx',
  'Sidebar.jsx',
  'Topbar.jsx',
  'NewJob.jsx',
  'Login.jsx',
  'App.jsx',
];

function loadScript(name) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `/design/${name}`;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${name}`));
    document.body.appendChild(script);
  });
}

async function boot() {
  for (const name of designScripts) {
    await loadScript(name);
  }
}

boot().catch((error) => {
  const root = document.getElementById('root');
  root.innerHTML = `<pre style="padding:24px;color:#c0392b">${error.message}</pre>`;
});
