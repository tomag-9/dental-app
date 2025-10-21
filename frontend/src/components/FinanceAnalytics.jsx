import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Box, Grid, Paper, Typography, List, ListItem, ListItemText } from '@mui/material';
import { BarChart, PieChart } from '@mui/x-charts';

export default function FinanceAnalytics({ token, setError }) {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await axios.get('http://localhost:8000/invoices/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setInvoices(resp.data || []);
      } catch (err) {
        setError?.('Nepodarilo sa načítať analytiku: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    fetchData();
  }, [token, setError]);

  const byMonth = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      const d = inv.paid_date ? new Date(inv.paid_date) : (inv.issued_date ? new Date(inv.issued_date) : null);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      map.set(key, (map.get(key) || 0) + (inv.total || 0));
    }
    const arr = Array.from(map.entries()).sort();
    return {
      labels: arr.map(([k]) => k),
      values: arr.map(([, v]) => v),
      entries: arr,
    };
  }, [invoices]);

  const topClients = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      const key = inv.clinic_id || 'unknown';
      map.set(key, (map.get(key) || 0) + (inv.total || 0));
    }
    const arr = Array.from(map.entries()).sort((a,b) => b[1]-a[1]).slice(0, 5);
    return {
      labels: arr.map(([id]) => `Klinika #${id}`),
      values: arr.map(([, v]) => v),
      entries: arr,
    };
  }, [invoices]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Financie – Analytika</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Tržby podľa mesiaca</Typography>
            {byMonth.values?.length ? (
              <BarChart
                xAxis={[{ scaleType: 'band', data: byMonth.labels }]}
                series={[{ data: byMonth.values, label: '€' }]}
                height={300}
              />
            ) : (
              <Typography color="text.secondary">Žiadne dáta</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Top kliniky podľa tržieb</Typography>
            {topClients.values?.length ? (
              <PieChart
                series={[{ data: topClients.entries.map(([id, v]) => ({ id, value: v, label: `#${id}` })) }]}
                height={300}
              />
            ) : (
              <Typography color="text.secondary">Žiadne dáta</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
