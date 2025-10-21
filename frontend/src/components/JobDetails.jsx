import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import BusinessIcon from '@mui/icons-material/Business';
import BuildIcon from '@mui/icons-material/Build';
import EuroIcon from '@mui/icons-material/Euro';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ToothMap from './ToothMap';

const statusTranslations = {
  'pending': 'Čaká na spracovanie',
  'in_progress': 'Prebieha',
  'completed': 'Ukončená',
  'closed': 'Uzavretá',
  'cancelled': 'Zrušená',
  'draft': 'Návrh',
  '': '-',
  null: '-',
  undefined: '-',
};

const statusColors = {
  'pending': 'warning',
  'in_progress': 'info',
  'completed': 'success',
  'closed': 'default',
  'cancelled': 'error',
  'draft': 'default',
};

const InfoRow = ({ icon, label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
    {icon && <Box sx={{ mr: 1 }}>{icon}</Box>}
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90, fontWeight: 500 }}>{label}:</Typography>
    <Typography variant="body2" sx={{ ml: 1, fontWeight: value ? 500 : 400 }}>{value || '-'}</Typography>
  </Box>
);

const DateRow = ({ label, date }) => (
  <InfoRow label={label} value={date ? new Date(date).toLocaleDateString('sk-SK') : '-'} />
);

const JobDetails = ({ token, setError }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientName, setPatientName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [procedureNames, setProcedureNames] = useState({});
  const [invoiceId, setInvoiceId] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState(null);

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        setLoading(true);
        const apiClient = api(token);
        // Fetch job details
        const jobResponse = await apiClient.get(`/jobs/${id}`);
        const jobData = jobResponse.data;
        setJob(jobData);

        // Fetch patient name
        if (jobData.patient_id) {
          const patientResponse = await apiClient.get(`/patients/${jobData.patient_id}`);
          setPatientName(`${patientResponse.data.first_name} ${patientResponse.data.last_name}`);
        }

        // Fetch clinic name
        if (jobData.clinic_id) {
          const clinicResponse = await apiClient.get(`/clinics/${jobData.clinic_id}`);
          setClinicName(clinicResponse.data.name || '-');
        }

        // Fetch doctor name
        if (jobData.doctor_id) {
          const doctorResponse = await apiClient.get(`/doctors/${jobData.doctor_id}`);
          setDoctorName(`${doctorResponse.data.first_name} ${doctorResponse.data.last_name}`);
        }

        // Fetch technician name
        if (jobData.technician_id) {
          const technicianResponse = await apiClient.get(`/technicians/${jobData.technician_id}`);
          setTechnicianName(`${technicianResponse.data.first_name} ${technicianResponse.data.last_name}`);
        }

        // Fetch procedure descriptions from price_list
        if (jobData.procedure_codes?.length > 0) {
          const procedureResponse = await apiClient.get(`/price_list`);
          const namesMap = procedureResponse.data.reduce((acc, proc) => ({
            ...acc,
            [proc.code]: proc.description,
          }), {});
          setProcedureNames(namesMap);
        }

        // Fetch invoice information for this job
        try {
          const invoicesResponse = await apiClient.get(`/invoices/`);
          const allInvoices = invoicesResponse.data;
          for (const invoice of allInvoices) {
            const itemsResponse = await apiClient.get(`/invoices/${invoice.id}/items`);
            const hasJob = itemsResponse.data.some(item => item.job_id === parseInt(id));
            if (hasJob) {
              setInvoiceId(invoice.id);
              setInvoiceNumber(invoice.number);
              break;
            }
          }
        } catch {
          // No invoice found for this job or error fetching invoices
        }
      } catch (err) {
        setError(
          `Nepodarilo sa načítať detaily práce: ${err.response?.data?.detail || 'Skontrolujte pripojenie'}`
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchJobDetails();
  }, [id, token, setError]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', ml: { xs: 0, md: '240px' } }}>
        <CircularProgress size={32} thickness={4} sx={{ mb: 2 }} />
        <Typography variant="h6" sx={{ color: 'text.secondary' }}>
          Načítavam detaily práce...
        </Typography>
      </Box>
    );
  }

  if (!job) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', ml: { xs: 0, md: '240px' } }}>
        <Typography variant="h6" color="error.main" sx={{ mb: 2 }}>
          Chyba pri načítaní dát práce.
        </Typography>
        <Button variant="outlined" onClick={() => navigate(-1)} startIcon={<ArrowBackIcon />}>Späť</Button>
      </Box>
    );
  }

  // Modern, structured layout with better visual hierarchy
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, sm: 4 }, ml: { xs: 0, md: '240px' }, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header with back button */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" fontWeight="bold" color="text.primary" gutterBottom>
              Práca #{job.id}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Chip
                label={statusTranslations[job.status] || job.status || '-'}
                color={statusColors[job.status] || 'default'}
                size="medium"
                sx={{ fontWeight: 600 }}
              />
              {typeof job.price === 'number' && !isNaN(job.price) && (
                <Chip
                  icon={<EuroIcon />}
                  label={`${job.price.toFixed(2)} €`}
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {invoiceId && invoiceNumber && (
                <Chip
                  icon={<ReceiptIcon />}
                  label={invoiceNumber}
                  color="info"
                  variant="outlined"
                  clickable
                  onClick={() => navigate(`/invoices`)}
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Stack>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ borderRadius: 2, textTransform: 'none', px: 3, py: 1 }}
          >
            Späť
          </Button>
        </Stack>
      </Paper>

      {/* Main content area */}
      <Grid container spacing={3}>
        {/* Left column - Patient and clinic info */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, height: '100%' }}>
            <Typography variant="h6" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon color="primary" />
              Informácie o pacientovi a klinike
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Pacient
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ mt: 0.5 }}>
                  {patientName || '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Klinika
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BusinessIcon fontSize="small" color="action" />
                  {clinicName || '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Ošetrujúci lekár
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalHospitalIcon fontSize="small" color="success" />
                  {doctorName || '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Zubný technik
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildIcon fontSize="small" color="warning" />
                  {technicianName || '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Odtieň zuba
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ mt: 0.5 }}>
                  {job.tooth_color || '-'}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Right column - Time information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, height: '100%' }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Časový harmonogram
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Termín dodania
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ mt: 0.5, color: 'primary.main' }}>
                  {job.due_date ? new Date(job.due_date).toLocaleDateString('sk-SK', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Začiatok práce
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ mt: 0.5 }}>
                  {job.start_date ? new Date(job.start_date).toLocaleDateString('sk-SK') : '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Try-in (skúška)
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ mt: 0.5 }}>
                  {job.try_in ? new Date(job.try_in).toLocaleDateString('sk-SK') : '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Ukončenie práce
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ mt: 0.5 }}>
                  {job.end_date ? new Date(job.end_date).toLocaleDateString('sk-SK') : '-'}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Procedures section - full width */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Vykonané úkony
            </Typography>
            <Divider sx={{ mb: 3 }} />
            {Array.isArray(job.procedure_codes) && job.procedure_codes.length > 0 ? (
              <Grid container spacing={2}>
                {job.procedure_codes.map((code, idx) => {
                  let quantity = 1;
                  try {
                    const parsed = job.procedure_quantities
                      ? typeof job.procedure_quantities === 'string'
                        ? JSON.parse(job.procedure_quantities)
                        : job.procedure_quantities
                      : {};
                    quantity = parsed && typeof parsed === 'object' && code in parsed ? parsed[code] : 1;
                  } catch { quantity = 1; }
                  return (
                    <Grid item xs={12} sm={6} md={4} key={idx}>
                      <Box sx={{ 
                        p: 2.5, 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        '&:hover': { boxShadow: 2, borderColor: 'primary.light' },
                        transition: 'all 0.2s'
                      }}>
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                          <Typography variant="body1" fontWeight={500} sx={{ flex: 1, lineHeight: 1.4 }}>
                            {procedureNames[code] || `Úkon ${code}`}
                          </Typography>
                          <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ flexShrink: 0 }}>
                            ×{quantity}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Kód: {code}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">Žiadne úkony neboli pridané k tejto práci.</Typography>
            )}
          </Paper>
        </Grid>

        {/* Tooth Map - if available */}
  {job.tooth_procedures && typeof job.tooth_procedures === 'object' && Object.keys(job.tooth_procedures).length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Zubná mapa pre túto prácu
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <ToothMap 
                  editable={false} 
                  value={job.tooth_procedures} 
                />
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Description - full width at bottom */}
        {job.description && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Poznámky a popis práce
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {job.description}
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default JobDetails;