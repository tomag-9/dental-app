import React from 'react';
import { Box, Typography } from '@mui/material';

const Analytics = ({ token, setError }) => {
  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Analytika (Zarážky technikov)
      </Typography>
      <Typography color="text.secondary">
        Táto sekcia bude čoskoro implementovaná
      </Typography>
    </Box>
  );
};

export default Analytics;