import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';

const FinanceOverview = ({ token, setError }) => {
  const [overview, setOverview] = useState({
    monthlyIncome: 0,
    yearlyIncome: 0,
    unpaidInvoices: 0,
  });

  useEffect(() => {
    // Mock data (replace with real API call, e.g., axios.get('http://localhost:8000/finance/overview/'))
    setOverview({
      monthlyIncome: 15000, // €15000 for August 2025
      yearlyIncome: 180000, // €180000 for 2025
      unpaidInvoices: 5,    // 5 unpaid invoices
    });
  }, [token, setError]);

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Finančný prehľad
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6">Mesačný príjem (August 2025): {overview.monthlyIncome} €</Typography>
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6">Ročný príjem (2025): {overview.yearlyIncome} €</Typography>
      </Box>
      <Box>
        <Typography variant="h6">Nezaplatené faktúry: {overview.unpaidInvoices}</Typography>
      </Box>
    </Box>
  );
};

export default FinanceOverview;