import React from 'react';
import {
  Table as MUITable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';

export const Table = ({ columns = [], rows = [], renderRow, minWidth = 650, headRowSx }) => (
  <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
    <MUITable sx={{ minWidth }}>
      {columns.length > 0 && (
        <TableHead>
          <TableRow sx={headRowSx || { backgroundColor: 'grey.50' }}>
            {columns.map((col) => (
              <TableCell key={col.key || col.label} sx={{ fontWeight: 'bold', ...col.sx }} align={col.align}>
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
      )}
      <TableBody>{rows.map((row, idx) => (renderRow ? renderRow(row, idx) : null))}</TableBody>
    </MUITable>
  </TableContainer>
);

export default Table;
