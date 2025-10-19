import React from 'react';
import { FormControl, InputLabel, Select as MUISelect, MenuItem } from '@mui/material';

const Select = ({ label, value, onChange, items = [], fullWidth = true, size = 'small', name, renderValue, ...rest }) => (
  <FormControl fullWidth={fullWidth} size={size}>
    {label && <InputLabel>{label}</InputLabel>}
    <MUISelect value={value} onChange={onChange} label={label} name={name} renderValue={renderValue} {...rest}>
      {items.map((opt) => (
        <MenuItem key={opt.value ?? opt} value={opt.value ?? opt}>
          {opt.label ?? opt}
        </MenuItem>
      ))}
    </MUISelect>
  </FormControl>
);

export default Select;
