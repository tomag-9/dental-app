import { request } from './core.js';
import { normalizeJob, normalizePatient, normalizeClinic, normalizeDoctor, normalizeTechnician, normalizeInvoice, normalizePriceItem, normalizeWarehouseItem, normalizeCalendarEvent } from './normalize.js';
import { createUseWorkspace } from '../hooks/useWorkspace.js';

const userKey = 'molaris.user';

export async function loadWorkspace() {
  const [stats, jobsRaw, patientsRaw, clinicsRaw, doctors, technicians, invoices, priceList, warehouse] = await Promise.all([
    request('/dashboard/stats/'),
    request('/jobs/jobs/'),
    request('/crm/patients/'),
    request('/crm/clinics/'),
    request('/crm/doctors/'),
    request('/jobs/technicians/'),
    request('/invoices/'),
    request('/finance/price-list/'),
    request('/warehouse/'),
  ]);
  const jobs = jobsRaw.map(normalizeJob);
  const patients = patientsRaw.map((patient) => normalizePatient(patient, jobs));
  const clinics = clinicsRaw.map((clinic) => normalizeClinic(clinic, jobs));
  const normalizedDoctors = doctors.map((doctor) => normalizeDoctor(doctor, jobs));
  const normalizedTechnicians = technicians.map((technician) => normalizeTechnician(technician, jobs));
  const invoiceRows = Array.isArray(invoices) ? invoices : (invoices.results || []);
  const normalizedInvoices = invoiceRows.map(normalizeInvoice);
  const normalizedPriceList = priceList.map(normalizePriceItem);
  const normalizedWarehouse = warehouse.map(normalizeWarehouseItem);
  const calendarEvents = jobs.slice(0, 24).map(normalizeCalendarEvent);
  return {
    stats,
    jobs,
    patients,
    clinics,
    doctors: normalizedDoctors,
    technicians: normalizedTechnicians,
    invoices: normalizedInvoices,
    priceList: normalizedPriceList,
    warehouse: normalizedWarehouse,
    calendarEvents,
  };
}

export const useWorkspace = createUseWorkspace({ loadWorkspace, tokenKey: userKey });
