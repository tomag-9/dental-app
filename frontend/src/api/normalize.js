/// <reference path="./globals.d.ts" />
/** @typedef {import('./types.ts').Schemas} Schemas */

const fmtDate = (/** @type {string | null | undefined} */ value) => value ? new Date(value).toLocaleDateString('sk-SK') : '—';
const number = (/** @type {unknown} */ value) => Number(value || 0);

/**
 * @param {Schemas['Job']} job
 */
export function normalizeJob(job) {
  const pd = job.patient_details;
  const patient = pd
    ? `${pd.first_name || ''} ${pd.last_name || ''}`.trim()
    : `Pacient #${job.patient}`;
  const clinic = job.clinic_details ? job.clinic_details.name : `Klinika #${job.clinic}`;
  const dd = job.doctor_details;
  const doctor = dd
    ? `${dd.title_before || ''} ${dd.first_name || ''} ${dd.last_name || ''}`.trim()
    : '';
  const codes = /** @type {string[] | undefined} */ (/** @type {unknown} */ (job.procedure_codes));
  return {
    id: job.id,
    patient,
    clinic,
    doctor: doctor || 'Bez lekára',
    type: job.description || (codes && codes.join(', ')) || 'Dentálna práca',
    due: job.due_date ? new Date(job.due_date).toLocaleDateString('sk-SK') : 'Bez termínu',
    status: job.status,
    raw: job,
  };
}

/**
 * @param {Schemas['Patient']} patient
 * @param {ReturnType<typeof normalizeJob>[]} [jobs]
 */
export function normalizePatient(patient, jobs = []) {
  return {
    id: patient.id,
    first: patient.first_name,
    last: patient.last_name,
    birth: patient.birth_number || '',
    phone: patient.phone || '',
    email: patient.email || '',
    jobs: jobs.filter((job) => job.raw && job.raw.patient === patient.id).length,
    raw: patient,
  };
}

/**
 * @param {Schemas['Clinic']} clinic
 * @param {ReturnType<typeof normalizeJob>[]} [jobs]
 */
export function normalizeClinic(clinic, jobs = []) {
  const revenue = jobs
    .filter((job) => job.raw && job.raw.clinic === clinic.id)
    .reduce((sum, job) => sum + number(job.raw.price), 0);
  return {
    id: clinic.id,
    name: clinic.name,
    address: clinic.address || [clinic.street, clinic.zip_code, clinic.city].filter(Boolean).join(', '),
    ico: clinic.ico || '',
    phone: clinic.phone || '',
    email: clinic.email || '',
    doctors: clinic.doctor_count || (clinic.doctors ? clinic.doctors.length : 0),
    activeJobs: jobs.filter((job) => job.raw && job.raw.clinic === clinic.id && ['new', 'in_progress'].includes(job.raw.status ?? '')).length,
    ytd: revenue,
    raw: clinic,
  };
}

/**
 * @param {Schemas['Doctor']} doctor
 * @param {ReturnType<typeof normalizeJob>[]} [jobs]
 */
export function normalizeDoctor(doctor, jobs = []) {
  const activeJobs = jobs.filter((job) => job.raw && job.raw.doctor === doctor.id && ['new', 'in_progress'].includes(job.raw.status ?? '')).length;
  const contact = /** @type {{ specialty?: string } | null} */ (doctor.contact_info ?? null);
  return {
    id: doctor.id,
    title: doctor.title_before || '',
    first: doctor.first_name,
    last: doctor.last_name,
    clinic: doctor.clinic_name || 'Bez kliniky',
    specialty: (contact && contact.specialty) || 'Všeobecná stomatológia',
    phone: doctor.phone || '',
    email: doctor.email || '',
    activeJobs,
    raw: doctor,
  };
}

/**
 * @param {Schemas['Technician']} technician
 * @param {ReturnType<typeof normalizeJob>[]} [jobs]
 */
export function normalizeTechnician(technician, jobs = []) {
  const assigned = jobs.filter((job) => job.raw && job.raw.technician === technician.id);
  const active = assigned.filter((job) => ['new', 'in_progress'].includes(job.raw.status ?? '')).length;
  const name = `${technician.first_name || ''} ${technician.last_name || ''}`.trim();
  const contact = /** @type {{ role?: string; specialty?: string; email?: string } | null} */ (technician.contact_info ?? null);
  return {
    id: technician.id,
    first: technician.first_name || name,
    last: technician.last_name || '',
    role: (contact && contact.role) || 'Technik',
    specialty: (contact && contact.specialty) || 'Dentálna technika',
    email: (contact && contact.email) || '',
    workload: Math.min(100, Math.round((active / 8) * 100)),
    jobsThisMonth: assigned.length,
    raw: technician,
  };
}

/**
 * @param {Schemas['Invoice']} invoice
 */
export function normalizeInvoice(invoice) {
  /** @type {Record<string, string>} */
  const statusLabels = { draft: 'Koncept', issued: 'Vystavená', paid: 'Zaplatená', cancelled: 'Zrušená' };
  return {
    id: invoice.id,
    number: invoice.number,
    clinic: invoice.clinic_name || `Klinika #${invoice.clinic}`,
    issued: fmtDate(invoice.issued_at || invoice.created_at),
    due: fmtDate(invoice.due_date),
    amount: number(invoice.total_amount),
    status: invoice.status,
    statusLabel: (invoice.status && statusLabels[invoice.status]) || invoice.status,
    items: invoice.items ? invoice.items.length : 0,
    lineItems: (invoice.items || []).map((item) => ({
      name: item.description,
      qty: item.quantity,
      unit: number(item.unit_price),
      total: number(item.line_total),
    })),
    raw: invoice,
  };
}

/**
 * @param {Schemas['PriceList']} item
 */
export function normalizePriceItem(item) {
  const category = ((item.description || '').split(' ')[0] || 'vykony').toLowerCase();
  return {
    id: item.id,
    code: item.code,
    name: item.description,
    category,
    unit: 'ks',
    price: number(item.price),
    vat: 20,
    raw: item,
  };
}

/**
 * @param {Schemas['WarehouseItem']} item
 */
export function normalizeWarehouseItem(item) {
  return {
    id: item.id,
    code: item.sku || `MAT-${String(item.id).padStart(3, '0')}`,
    name: item.name,
    category: item.category || 'Materiál',
    unit: item.unit || 'ks',
    stock: number(item.quantity),
    min: number(item.min_threshold),
    price: number(item.cost_price),
    supplier: item.location || '—',
    raw: item,
  };
}

/**
 * @param {ReturnType<typeof normalizeJob>} job
 * @param {number} index
 */
export function normalizeCalendarEvent(job, index) {
  const due = job.raw && job.raw.due_date ? new Date(job.raw.due_date) : null;
  return {
    day: due ? (due.getDay() + 6) % 7 : index % 5,
    start: 8 + (index % 7),
    duration: 1.5,
    title: `${job.type} — ${job.patient}`,
    type: ['completed', 'finished_factured', 'closed'].includes(job.status ?? '') ? 'deadline' : 'job',
    ref: `#${job.id}`,
    raw: job.raw,
  };
}
