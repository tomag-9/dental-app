import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Box, Grid, Paper, Typography, Chip, List, ListItem, ListItemText, Divider, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function LabDashboard({ token, setError }) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [warehouse, setWarehouse] = useState([]);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    const load = async () => {
      try {
        const [jobsR, patsR, invR, whR] = await Promise.all([
          axios.get('http://localhost:8000/jobs/', { headers }),
          axios.get('http://localhost:8000/patients/', { headers }),
          axios.get('http://localhost:8000/invoices/', { headers }),
          axios.get('http://localhost:8000/warehouse/items', { headers }),
        ]);
        setJobs(jobsR.data || []);
        setPatients(patsR.data || []);
        setInvoices(invR.data || []);
        setWarehouse(whR.data || []);
      } catch (err) {
        setError?.('Nepodarilo sa načítať dashboard: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    load();
  }, [token, setError]);

  const kpis = useMemo(() => {
    const activeJobs = jobs.filter(j => !j.end_date).length;
    const dueSoon = jobs.filter(j => j.due_date && new Date(j.due_date) <= new Date(Date.now() + 3*24*3600*1000)).length;
    const lowStock = warehouse.filter(i => i.min_threshold != null && i.quantity <= i.min_threshold).length;
    const outstanding = invoices.filter(inv => inv.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0);
    return { patients: patients.length, activeJobs, dueSoon, lowStock, outstanding };
  }, [jobs, patients, invoices, warehouse]);

  const upcomingJobs = useMemo(() => jobs
    .filter(j => j.due_date)
    .sort((a,b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 6), [jobs]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Dashboard laboratória</Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={() => navigate('/jobs')}>Zobraziť práce</Button>
        <Button variant="outlined" onClick={() => navigate('/finance/invoices')}>Nezaplatené faktúry</Button>
        <Button variant="outlined" onClick={() => navigate('/storage/items')}>Nízke zásoby</Button>
      </Stack>
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Pacienti</Typography>
            <Typography variant="h5">{kpis.patients}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Aktívne práce</Typography>
            <Typography variant="h5">{kpis.activeJobs}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Termíny do 3 dní</Typography>
            <Typography variant="h5">{kpis.dueSoon}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Nízky stav skladu</Typography>
            <Typography variant="h5">{kpis.lowStock}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Blížiace sa termíny</Typography>
            <List dense>
              {upcomingJobs.map(j => (
                <ListItem key={j.id} divider>
                  <ListItemText
                    primary={j.description || `Práca #${j.id}`}
                    secondary={`Do: ${j.due_date || '—'}`}
                  />
                  <Chip label={j.status || '—'} size="small" />
                </ListItem>
              ))}
              {upcomingJobs.length === 0 && (
                <Typography color="text.secondary">Žiadne termíny</Typography>
              )}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Nesplatené faktúry</Typography>
            <Typography variant="h5">{kpis.outstanding.toFixed(2)} €</Typography>
            <Divider sx={{ my: 1 }} />
            <Typography color="text.secondary" variant="body2">Súčet sumy faktúr, ktoré nie sú zaplatené.</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
