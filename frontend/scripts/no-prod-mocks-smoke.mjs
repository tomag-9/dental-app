import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'public', 'design');
const checks = [
  {
    file: 'api-client.js',
    forbidden: [
      "request('/jobs/jobs/').catch(() => [])",
      "request('/crm/patients/').catch(() => [])",
      "request('/crm/clinics/').catch(() => [])",
      "request('/crm/doctors/').catch(() => [])",
      "request('/jobs/technicians/').catch(() => [])",
      "request('/finance/price-list/').catch(() => [])",
    ],
  },
  {
    file: 'PatientDetail.jsx',
    forbidden: ['fallbackPatient', 'fallbackJobs', 'Mária', 'Kováčová'],
  },
  {
    file: 'JobDetail.jsx',
    forbidden: ['fallbackJob', 'fallbackTimeline', 'Mostík 3-členný zirkónový'],
  },
  {
    file: 'Clinics.jsx',
    forbidden: ['fallbackClinics', 'Klinika Bratislava', 'ZubMed Košice'],
  },
  {
    file: 'Doctors.jsx',
    forbidden: ['fallbackDoctors', 'Pavol', 'Blaho'],
  },
  {
    file: 'Technicians.jsx',
    forbidden: ['fallbackTechs', 'Mrázová', 'Bartoš'],
  },
  {
    file: 'Calendar.jsx',
    forbidden: ['fallbackEvents', 'Synthetic events', 'Implantát — T. Varga'],
  },
  {
    file: 'Pricelist.jsx',
    forbidden: ['fallbackItems', 'KOR-ZIR', 'MOS-3Z'],
  },
  {
    file: 'NewJob.jsx',
    forbidden: ['fallbackCatalog', 'KOR-ZIR', 'kovacova', 'novak-j'],
  },
  {
    file: 'Settings.jsx',
    forbidden: ['fallbackMembers', 'jan.novak@dl.sk', 'anna.m@dl.sk'],
  },
  {
    file: 'Topbar.jsx',
    forbidden: [
      'fallbackNotifications',
      'Nová práca pridelená',
      'INV-2025-012',
      'Lucia Šimková',
    ],
  },
];

const failures = [];

for (const check of checks) {
  const content = readFileSync(resolve(root, check.file), 'utf8');
  for (const token of check.forbidden) {
    if (content.includes(token)) failures.push(`${check.file}: ${token}`);
  }
}

if (failures.length) {
  console.error('Production mock smoke failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('production mock smoke OK');
