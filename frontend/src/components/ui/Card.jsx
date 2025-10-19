import React from 'react';
import { Card as MUICard, CardContent } from '@mui/material';

const Card = ({ children, contentSx, sx, ...rest }) => (
  <MUICard elevation={0} sx={{ border: '1px solid #eee', ...sx }} {...rest}>
    <CardContent sx={contentSx}>{children}</CardContent>
  </MUICard>
);

export default Card;
