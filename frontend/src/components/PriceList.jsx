import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Paper, Button, TextField, IconButton, Dialog, DialogActions,
  DialogContent, DialogTitle, Checkbox, FormControlLabel
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Print as PrintIcon } from '@mui/icons-material';
import dayjs from 'dayjs';

const API_URL = "http://localhost:8000/price_list/";

const PriceList = ({ token, setError }) => {
  const [priceItems, setPriceItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    price: '',
    hasExpiry: false,
    valid_to: ''
  });

  // Load from DB
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to load price list');
      const data = await res.json();
      setPriceItems(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleOpen = (item = null) => {
    if (item) {
      setEditItem(item);
      setFormData({
        code: item.code,
        description: item.description,
        price: item.price,
        hasExpiry: !!item.valid_to,
        valid_to: item.valid_to || ''
      });
    } else {
      setEditItem(null);
      setFormData({ code: '', description: '', price: '', hasExpiry: false, valid_to: '' });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditItem(null);
  };

  const handleSave = async () => {
    try {
      const payload = {
        code: formData.code,
        description: formData.description,
        price: parseFloat(formData.price),
        valid_to: formData.hasExpiry && formData.valid_to ? formData.valid_to : null
      };

      const res = await fetch(
        editItem ? `${API_URL}/${editItem.id}` : API_URL,
        {
          method: editItem ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) throw new Error('Save failed');
      await fetchItems();
      handleClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        ...(token && { headers: { Authorization: `Bearer ${token}` } })
      });
      if (!res.ok) throw new Error('Delete failed');
      await fetchItems();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePrint = () => {
  const logoUrl = 'https://yourdomain.com/logo.png'; // nahraď si URL loga

  const html = `
    <html>
      <head>
        <title>Cenník</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #333;
          }
          header {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #1976d2;
            padding-bottom: 10px;
          }
          header img {
            height: 50px;
            margin-right: 20px;
          }
          header h1 {
            font-weight: 700;
            font-size: 2rem;
            color: #1976d2;
            margin: 0;
          }
          .print-date {
            text-align: right;
            font-size: 0.9rem;
            color: #555;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            box-shadow: 0 2px 8px rgb(0 0 0 / 0.1);
          }
          th, td {
            padding: 12px 15px;
            border: 1px solid #ddd;
            text-align: left;
          }
          th {
            background: #1976d2;
            color: white;
            font-weight: 600;
          }
          tbody tr:nth-child(even) {
            background-color: #f7f9fc;
          }
        </style>
      </head>
      <body>
        <header>
          <img src="${logoUrl}" alt="Logo" />
          <h1>Cenník služieb</h1>
        </header>
        <div class="print-date">Dátum tlače: ${dayjs().format('DD.MM.YYYY HH:mm')}</div>
        <table>
          <thead>
            <tr>
              <th>Kód</th>
              <th>Názov</th>
              <th>Cena (€)</th>
              <th>Platné do</th>
            </tr>
          </thead>
          <tbody>
            ${priceItems.map(item => `
              <tr>
                <td>${item.code}</td>
                <td>${item.description}</td>
                <td>${item.price.toFixed(2)}</td>
                <td>${item.valid_to ? dayjs(item.valid_to).format("DD.MM.YYYY") : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  // Počkáme chvíľu, kým sa načíta obsah, potom tlačíme a zatvárame okno
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
};


  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Cenník</Typography>
        <Button variant="contained" onClick={() => handleOpen()}>Pridať položku</Button>
      </Box>

      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Kód</TableCell>
              <TableCell>Názov</TableCell>
              <TableCell>Cena (€)</TableCell>
              <TableCell>Platné do</TableCell>
              <TableCell>Akcie</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {priceItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.code}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>{item.price}</TableCell>
                <TableCell>
                  {item.valid_to ? dayjs(item.valid_to).format("DD.MM.YYYY") : "-"}
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(item)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(item.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>Vytlačiť</Button>

      {/* Dialog Form */}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editItem ? 'Upraviť položku' : 'Pridať položku'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Kód"
            fullWidth
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Názov"
            fullWidth
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Cena (€)"
            fullWidth
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.hasExpiry}
                onChange={(e) => setFormData({ ...formData, hasExpiry: e.target.checked, valid_to: '' })}
              />
            }
            label="Má dátum expirácie"
          />
          {formData.hasExpiry && (
            <TextField
              margin="dense"
              label="Platné do"
              type="date"
              fullWidth
              value={formData.valid_to}
              onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Zrušiť</Button>
          <Button onClick={handleSave}>Uložiť</Button>
        </DialogActions>
      </Dialog>

      {/* Print styles */}
      <style>
        {`
          @media print {
            body { margin: 0; }
            .MuiPaper-root { box-shadow: none; border: 1px solid #ccc; }
            .MuiButton-root { display: none; }
            .MuiDialog-root { display: none; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
          }
        `}
      </style>
    </Box>
  );
};

export default PriceList;
