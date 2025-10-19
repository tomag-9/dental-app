import React from 'react';
import { TextField } from '@mui/material';

const Input = ({ fullWidth = true, margin = 'dense', variant = 'outlined', ...props }) => (
  <TextField fullWidth={fullWidth} margin={margin} variant={variant} {...props} />
);

export default Input;
