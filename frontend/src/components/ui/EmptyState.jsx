import React from 'react';
import { Box, Typography } from '@mui/material';

const EmptyState = ({ title = 'Žiadne dáta', description }) => (
  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
    <Typography variant="h6" sx={{ mb: 1 }}>{title}</Typography>
    {description && <Typography variant="body2">{description}</Typography>}
  </Box>
);

export default EmptyState;
