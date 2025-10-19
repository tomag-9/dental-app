import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Divider,
  Button,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Reusable component for key-value display
const InfoItem = ({ label, value, isStatus = false }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5, borderBottom: 1, borderColor: 'grey.100' }}>
    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
      {label}:
    </Typography>
    {isStatus ? (
      <Chip
        label={value || '-'}
        color={value === 'completed' ? 'success' : value === 'pending' ? 'warning' : 'primary'}
        size="small"
        sx={{ fontWeight: 'medium' }}
      />
    ) : (
      <Typography variant="body2" sx={{ fontWeight: value ? 'medium' : 'normal', textAlign: 'right' }}>
        {value || '-'}
      </Typography>
    )}
  </Box>
);

// Reusable component for date display
const DateItem = ({ label, date }) => (
  <InfoItem label={label} value={date ? new Date(date).toLocaleDateString('sk-SK') : '-'} />
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

  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        setLoading(true);
        // Fetch job details
        const jobResponse = await axios.get(`http://localhost:8000/jobs/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const jobData = jobResponse.data;
        setJob(jobData);

        // Fetch patient name
        if (jobData.patient_id) {
          const patientResponse = await axios.get(`http://localhost:8000/patients/${jobData.patient_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setPatientName(`${patientResponse.data.first_name} ${patientResponse.data.last_name}`);
        }

        // Fetch clinic name
        if (jobData.clinic_id) {
          const clinicResponse = await axios.get(`http://localhost:8000/clinics/${jobData.clinic_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setClinicName(clinicResponse.data.name || '-');
        }

        // Fetch doctor name
        if (jobData.doctor_id) {
          const doctorResponse = await axios.get(`http://localhost:8000/doctors/${jobData.doctor_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setDoctorName(`${doctorResponse.data.first_name} ${doctorResponse.data.last_name}`);
        }

        // Fetch technician name
        if (jobData.technician_id) {
          const technicianResponse = await axios.get(`http://localhost:8000/technicians/${jobData.technician_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setTechnicianName(`${technicianResponse.data.first_name} ${technicianResponse.data.last_name}`);
        }

        // Fetch procedure descriptions from price_list
        if (jobData.procedure_codes?.length > 0) {
          const procedureResponse = await axios.get(`http://localhost:8000/price_list`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('Price List Response:', procedureResponse.data); // Debug log
          const namesMap = procedureResponse.data.reduce((acc, proc) => ({
            ...acc,
            [proc.code]: proc.description,
          }), {});
          console.log('Procedure Names Map:', namesMap); // Debug log
          setProcedureNames(namesMap);
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', ml: { xs: 0, md: '240px' } }}>
        <CircularProgress size={24} />
        <Typography variant="body1" sx={{ ml: 2, color: 'text.secondary' }}>
          Načítavam detaily...
        </Typography>
      </Box>
    );
  }

  if (!job) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', ml: { xs: 0, md: '240px' } }}>
        <Typography variant="body1" color="error.main">
          Chyba pri načítaní dát.
        </Typography>
      </Box>
    );
  }

  // const formatProcedures = (codes, quantities) => {
  //   if (!codes || codes.length === 0) return '-';
  //   try {
  //     const parsedQuantities = quantities
  //       ? typeof quantities === 'string'
  //         ? JSON.parse(quantities)
  //         : quantities
  //       : {};
  //     console.log('Parsed Quantities:', parsedQuantities); // Debug log
  //     return codes
  //       .map(code => {
  //         const description = procedureNames[code] || `No description for ${code}`; // Fallback with context
  //         const quantity = parsedQuantities[code] || 1; // Get quantity for specific code
  //         return `${code} - ${description} (x${quantity})`;
  //       })
  //       .join(', ');
  //   } catch (e) {
  //     console.error('Error parsing quantities:', e); // Debug log
  //     return codes
  //       .map(code => {
  //         const description = procedureNames[code] || `No description for ${code}`;
  //         return `${code} - ${description} (x1)`; // Default to 1 if parsing fails
  //       })
  //       .join(', ');
  //   }
  // };

  const renderProcedures = (codes, quantities) => {
    if (!codes || codes.length === 0) return <InfoItem label="Žiadne úkony" value="-" />;
    try {
      const parsedQuantities = quantities
        ? typeof quantities === 'string'
          ? JSON.parse(quantities)
          : quantities
        : {};
      console.log('Parsed Quantities:', parsedQuantities); // Debug log
      return codes.map((code, index) => {
        const description = procedureNames[code] || `No description for ${code}`;
        const quantity = parsedQuantities[code] || 1;
        return (
          <Grid item xs={12} key={index}>
            <InfoItem
              label=""
              value={`${code} - ${description} (x${quantity})`}
            />
          </Grid>
        );
      });
    } catch (e) {
      console.error('Error parsing quantities:', e); // Debug log
      return codes.map((code, index) => {
        const description = procedureNames[code] || `No description for ${code}`;
        return (
          <Grid item xs={12} key={index}>
            <InfoItem
              label=""
              value={`${code} - ${description} (x1)`}
            />
          </Grid>
        );
      });
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, sm: 3 }, ml: { xs: 0, md: '240px' }, minHeight: '100vh' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold" color="text.primary">
          Detaily práce #{job.id}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
        >
          Späť
        </Button>
      </Stack>
      <Grid container spacing={3}>
        {/* Basic Information and Time Information side by side */}
        <Grid item xs={12} sm={6}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Základné informácie
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <InfoItem label="Pacient" value={patientName} />
            <InfoItem label="Klinika" value={clinicName} />
            <InfoItem label="Lekár" value={doctorName} />
            <InfoItem label="Technik" value={technicianName} />
            <InfoItem label="Stav" value={job.status} isStatus />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Časové údaje
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <DateItem label="Dátum splatnosti" date={job.due_date} />
            <DateItem label="Začiatok" date={job.start_date} />
            <DateItem label="Koniec" date={job.end_date} />
            <DateItem label="Try-in" date={job.try_in} />
          </Paper>
        </Grid>
        {/* Procedures with one row per record */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Úkony
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={1}>
              {renderProcedures(job.procedure_codes, job.procedure_quantities)}
            </Grid>
          </Paper>
        </Grid>
        {/* Description */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              Popis
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {job.description || 'Žiadny popis k dispozícii.'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default JobDetails;