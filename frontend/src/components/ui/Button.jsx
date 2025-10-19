import React from 'react';
import { Button as MUIButton } from '@mui/material';

const Button = ({ variant = 'contained', size = 'medium', ...props }) => {
  return <MUIButton variant={variant} size={size} {...props} />;
};

export default Button;
