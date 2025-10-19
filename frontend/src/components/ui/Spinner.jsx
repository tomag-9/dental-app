import React from 'react';
import { Box, CircularProgress } from '@mui/material';

const Spinner = ({ size = 24, py = 4 }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py }}>
    <CircularProgress size={size} />
  </Box>
);

export default Spinner;
