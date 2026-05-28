(function () {
  const rawBase = window.__API_BASE_URL && !window.__API_BASE_URL.includes('%')
    ? window.__API_BASE_URL
    : 'http://localhost:8810/api';
  const API_BASE = rawBase.replace(/\/$/, '').endsWith('/api')
    ? rawBase.replace(/\/$/, '')
    : `${rawBase.replace(/\/$/, '')}/api`;

  const tokenKey = 'molaris.access';
  const refreshKey = 'molaris.refresh';
  const userKey = 'molaris.user';

  const readJson = async (response) => {
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  };

  async function request(path, options = {}) {
    const access = localStorage.getItem(tokenKey);
    const headers = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(options.headers || {}),
    };
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await readJson(response);
    if (!response.ok) {
      if (response.status === 401) {
        logout();
        window.dispatchEvent(new CustomEvent('molaris-auth-expired'));
      }
      const error = new Error(data && data.detail ? data.detail : 'API request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function isTotpRequiredError(error) {
    const detail = String((error && error.data && error.data.detail) || error.message || '');
    const code = String((error && error.data && error.data.code) || error.code || '');
    return error && error.status === 401 && (
      code === 'totp_required' ||
      detail.toLowerCase().includes('totp code required')
    );
  }

  function isTotpInvalidError(error) {
    const detail = String((error && error.data && error.data.detail) || error.message || '');
    const code = String((error && error.data && error.data.code) || error.code || '');
    return error && error.status === 401 && (
      code === 'totp_invalid' ||
      detail.toLowerCase().includes('invalid totp code')
    );
  }

  async function login(username, password, totpCode = '') {
    const payload = { username, password };
    if (totpCode) payload.totp_code = totpCode;
    let token;
    try {
      token = await request('/token/', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {},
      });
    } catch (error) {
      if (isTotpRequiredError(error)) {
        error.requiresTotp = true;
      }
      if (isTotpInvalidError(error)) {
        error.invalidTotp = true;
      }
      throw error;
    }
    localStorage.setItem(tokenKey, token.access);
    localStorage.setItem(refreshKey, token.refresh);
    const me = await request('/core/users/me/');
    const name = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.nickname || me.username;
    const user = {
      id: me.id,
      name,
      email: me.email || '',
      username: me.username,
      role: me.role || 'admin',
      initials: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U',
      lab: me.lab_details || null,
    };
    localStorage.setItem(userKey, JSON.stringify(user));
    return user;
  }

  async function createJob(payload) {
    const job = await request('/jobs/jobs/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    window.__MOLARIS_WORKSPACE = null;
    window.dispatchEvent(new CustomEvent('molaris-workspace-refresh'));
    return job;
  }

  async function fetchJobs(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.search) qs.set('search', filters.search);
    if (filters.status && filters.status !== 'all') qs.set('status', filters.status);
    if (filters.priority) qs.set('priority', filters.priority);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const jobs = await request(`/jobs/jobs/${suffix}`);
    return jobs.map(normalize.job);
  }

  async function updateJob(id, payload) {
    const job = await request(`/jobs/jobs/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    window.__MOLARIS_WORKSPACE = null;
    window.dispatchEvent(new CustomEvent('molaris-workspace-refresh'));
    return job;
  }

  async function createRecord(path, payload) {
    const record = await request(path, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    window.__MOLARIS_WORKSPACE = null;
    window.dispatchEvent(new CustomEvent('molaris-workspace-refresh'));
    return record;
  }

  async function transitionJobStatus(id, status, note) {
    const job = await request(`/jobs/jobs/${id}/transition-status/`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    });
    window.__MOLARIS_WORKSPACE = null;
    window.dispatchEvent(new CustomEvent('molaris-workspace-refresh'));
    return job;
  }

  async function updateInvoiceStatus(id, status) {
    const invoice = await request(`/invoices/${id}/status/`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    window.__MOLARIS_WORKSPACE = null;
    window.dispatchEvent(new CustomEvent('molaris-workspace-refresh'));
    return invoice;
  }

  async function searchGlobal(query, limit = 8) {
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (limit) qs.set('limit', String(limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/search/${suffix}`);
  }

  async function fetchMe() {
    return request('/core/users/me/');
  }

  async function updateMe(payload) {
    return request('/core/users/me/', {
      method: 'PUT',
      body: JSON.stringify(payload || {}),
    });
  }

  async function updateLab(id, payload) {
    if (!id) throw new Error('Lab ID is required');
    return request(`/core/labs/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload || {}),
    });
  }

  async function fetchLabMembers(limit = 100) {
    const qs = new URLSearchParams();
    if (limit) qs.set('limit', String(limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/users/${suffix}`);
  }

  async function fetchNotifications(limit = 8) {
    const qs = new URLSearchParams();
    if (limit) qs.set('limit', String(limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/notifications/${suffix}`);
  }

  async function fetchUnreadCount() {
    return request('/notifications/unread-count/');
  }

  async function markNotificationRead(id) {
    return request(`/notifications/${id}/mark-read/`, { method: 'POST' });
  }

  async function markAllNotificationsRead() {
    return request('/notifications/mark-all-read/', { method: 'POST' });
  }

  function authUrl(path) {
    return `${API_BASE}${path}`;
  }

  async function downloadInvoicePdf(id, filename) {
    const access = localStorage.getItem(tokenKey);
    const response = await fetch(authUrl(`/invoices/${id}/pdf/`), {
      headers: access ? { Authorization: `Bearer ${access}` } : {},
    });
    if (!response.ok) throw new Error('PDF download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `invoice-${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(refreshKey);
    localStorage.removeItem(userKey);
  }

  function savedUser() {
    if (!isAuthenticated()) return null;
    try { return JSON.parse(localStorage.getItem(userKey) || 'null'); } catch { return null; }
  }

  function isAuthenticated() {
    return !!localStorage.getItem(tokenKey);
  }

  const fmtDate = (value) => value ? new Date(value).toLocaleDateString('sk-SK') : '—';
  const number = (value) => Number(value || 0);

  const normalize = {
    job(job) {
      const patient = job.patient_details
        ? `${job.patient_details.first_name || ''} ${job.patient_details.last_name || ''}`.trim()
        : `Pacient #${job.patient}`;
      const clinic = job.clinic_details ? job.clinic_details.name : `Klinika #${job.clinic}`;
      const doctor = job.doctor_details
        ? `${job.doctor_details.title_before || ''} ${job.doctor_details.first_name || ''} ${job.doctor_details.last_name || ''}`.trim()
        : '';
      return {
        id: job.id,
        patient,
        clinic,
        doctor: doctor || 'Bez lekára',
        type: job.description || (job.procedure_codes || []).join(', ') || 'Dentálna práca',
        due: job.due_date ? new Date(job.due_date).toLocaleDateString('sk-SK') : 'Bez termínu',
        status: job.status,
        raw: job,
      };
    },
    patient(patient, jobs = []) {
      return {
        id: patient.id,
        first: patient.first_name,
        last: patient.last_name,
        birth: patient.birth_number || '',
        phone: patient.phone || (patient.contact_info && patient.contact_info.phone) || '',
        email: patient.email || (patient.contact_info && patient.contact_info.email) || '',
        jobs: jobs.filter((job) => job.patient === patient.id || (job.raw && job.raw.patient === patient.id)).length,
        raw: patient,
      };
    },
    clinic(clinic, jobs = []) {
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
        activeJobs: jobs.filter((job) => job.raw && job.raw.clinic === clinic.id && ['new', 'in_progress'].includes(job.raw.status)).length,
        ytd: revenue,
        raw: clinic,
      };
    },
    doctor(doctor, jobs = []) {
      const activeJobs = jobs.filter((job) => job.raw && job.raw.doctor === doctor.id && ['new', 'in_progress'].includes(job.raw.status)).length;
      return {
        id: doctor.id,
        title: doctor.title_before || '',
        first: doctor.first_name,
        last: doctor.last_name,
        clinic: doctor.clinic_name || 'Bez kliniky',
        specialty: (doctor.contact_info && doctor.contact_info.specialty) || 'Všeobecná stomatológia',
        phone: doctor.phone || '',
        email: doctor.email || '',
        activeJobs,
        raw: doctor,
      };
    },
    technician(technician, jobs = []) {
      const assigned = jobs.filter((job) => job.raw && job.raw.technician === technician.id);
      const active = assigned.filter((job) => ['new', 'in_progress'].includes(job.raw.status)).length;
      const name = `${technician.first_name || ''} ${technician.last_name || ''}`.trim();
      const contact = technician.contact_info || {};
      return {
        id: technician.id,
        first: technician.first_name || name,
        last: technician.last_name || '',
        role: contact.role || 'Technik',
        specialty: contact.specialty || 'Dentálna technika',
        email: contact.email || '',
        workload: Math.min(100, Math.round((active / 8) * 100)),
        jobsThisMonth: assigned.length,
        raw: technician,
      };
    },
    invoice(invoice) {
      const statusLabels = { draft: 'Koncept', issued: 'Vystavená', paid: 'Zaplatená', cancelled: 'Zrušená' };
      return {
        id: invoice.id,
        number: invoice.number,
        clinic: invoice.clinic_name || `Klinika #${invoice.clinic}`,
        issued: fmtDate(invoice.issued_at || invoice.created_at),
        due: fmtDate(invoice.due_date),
        amount: number(invoice.total_amount),
        status: invoice.status,
        statusLabel: statusLabels[invoice.status] || invoice.status,
        items: invoice.items ? invoice.items.length : 0,
        lineItems: (invoice.items || []).map((item) => ({
          name: item.description,
          qty: item.quantity,
          unit: number(item.unit_price),
          total: number(item.line_total),
        })),
        raw: invoice,
      };
    },
    priceItem(item) {
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
    },
    warehouseItem(item) {
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
    },
    calendarEvent(job, index) {
      const due = job.raw && job.raw.due_date ? new Date(job.raw.due_date) : null;
      return {
        day: due ? (due.getDay() + 6) % 7 : index % 5,
        start: 8 + (index % 7),
        duration: 1.5,
        title: `${job.type} — ${job.patient}`,
        type: ['completed', 'finished_factured', 'closed'].includes(job.status) ? 'deadline' : 'job',
        ref: `#${job.id}`,
        raw: job.raw,
      };
    },
  };

  async function loadWorkspace() {
    const [stats, jobsRaw, patientsRaw, clinicsRaw, doctors, technicians, invoices, priceList, warehouse] = await Promise.all([
      request('/dashboard/stats/').catch(() => null),
      request('/jobs/jobs/').catch(() => []),
      request('/crm/patients/').catch(() => []),
      request('/crm/clinics/').catch(() => []),
      request('/crm/doctors/').catch(() => []),
      request('/jobs/technicians/').catch(() => []),
      request('/invoices/').catch(() => []),
      request('/finance/price-list/').catch(() => []),
      request('/warehouse/').catch(() => []),
    ]);
    const jobs = jobsRaw.map(normalize.job);
    const patients = patientsRaw.map((patient) => normalize.patient(patient, jobs));
    const clinics = clinicsRaw.map((clinic) => normalize.clinic(clinic, jobs));
    const normalizedDoctors = doctors.map((doctor) => normalize.doctor(doctor, jobs));
    const normalizedTechnicians = technicians.map((technician) => normalize.technician(technician, jobs));
    const normalizedInvoices = invoices.map(normalize.invoice);
    const normalizedPriceList = priceList.map(normalize.priceItem);
    const normalizedWarehouse = warehouse.map(normalize.warehouseItem);
    const calendarEvents = jobs.slice(0, 24).map(normalize.calendarEvent);
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

  function useWorkspace() {
    const [state, setState] = React.useState(window.__MOLARIS_WORKSPACE || { loading: true, error: null });
    React.useEffect(() => {
      let alive = true;
      const refresh = () => {
        if (!localStorage.getItem(tokenKey)) {
          setState({ loading: false, error: null });
          return;
        }
        setState((current) => ({ ...current, loading: true, error: null }));
        loadWorkspace()
          .then((data) => {
            if (!alive) return;
            window.__MOLARIS_WORKSPACE = { ...data, loading: false, error: null };
            setState(window.__MOLARIS_WORKSPACE);
          })
          .catch((error) => {
            if (!alive) return;
            setState({ loading: false, error: error.message });
          });
      };
      refresh();
      window.addEventListener('molaris-workspace-refresh', refresh);
      return () => {
        alive = false;
        window.removeEventListener('molaris-workspace-refresh', refresh);
      };
    }, []);
    return state;
  }

  window.MolarisAPI = {
    API_BASE,
    request,
    login,
    createJob,
    fetchJobs,
    updateJob,
    createRecord,
    transitionJobStatus,
    updateInvoiceStatus,
    searchGlobal,
    fetchNotifications,
    fetchUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    fetchMe,
    updateMe,
    isTotpRequiredError,
    isTotpInvalidError,
    updateLab,
    fetchLabMembers,
    authUrl,
    downloadInvoicePdf,
    logout,
    savedUser,
    isAuthenticated,
    loadWorkspace,
    useWorkspace,
  };
})();
