import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Box, Grid, Paper, Typography } from '@mui/material';

const FinanceOverview = ({ token, setError }) => {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await axios.get('http://localhost:8000/invoices/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setInvoices(resp.data || []);
      } catch (err) {
        setError?.('Nepodarilo sa načítať financie: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    fetchData();
  }, [token, setError]);

  const stats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const paid = invoices.filter(i => i.status === 'paid');
    const unpaid = invoices.filter(i => i.status !== 'paid');
    const monthly = paid.filter(i => {
      const d = i.paid_date ? new Date(i.paid_date) : (i.issued_date ? new Date(i.issued_date) : null);
      return d && d.getFullYear() === y && d.getMonth() === m;
    });
    const yearly = paid.filter(i => {
      const d = i.paid_date ? new Date(i.paid_date) : (i.issued_date ? new Date(i.issued_date) : null);
      return d && d.getFullYear() === y;
    });
    const monthlyIncome = monthly.reduce((s, i) => s + (i.total || 0), 0);
    const yearlyIncome = yearly.reduce((s, i) => s + (i.total || 0), 0);
    const outstanding = unpaid.reduce((s, i) => s + (i.total || 0), 0);
    return { monthlyIncome, yearlyIncome, outstanding, paid: paid.length, unpaid: unpaid.length, count: invoices.length };
  }, [invoices]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Financie – Prehľad</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Mesačný príjem</Typography>
            <Typography variant="h5">{stats.monthlyIncome.toFixed(2)} €</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Ročný príjem</Typography>
            <Typography variant="h5">{stats.yearlyIncome.toFixed(2)} €</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Nevysporiadané (nezaplatené)</Typography>
            <Typography variant="h5">{stats.outstanding.toFixed(2)} €</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default FinanceOverview;