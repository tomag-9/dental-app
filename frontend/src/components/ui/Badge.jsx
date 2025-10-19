import React from 'react';
import { Chip } from '@mui/material';

const Badge = ({ label, color = 'default', size = 'small', sx }) => (
  <Chip label={label} color={color} size={size} sx={sx} />
);

export default Badge;
