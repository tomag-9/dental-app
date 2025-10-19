import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, Alert, CircularProgress, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent, Divider,
  Select, MenuItem
} from '@mui/material';
import { Delete as DeleteIcon, PictureAsPdf as PdfIcon, QrCode as QrIcon, 
         Visibility as ViewIcon, Add as AddIcon } from '@mui/icons-material';

const InvoiceHistory = ({ token, setError, onCreateNew }) => {
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const response = await axios.get('http://localhost:8000/invoices/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvoices(response.data);
    } catch (err) {
      setError('Nepodarilo sa načítať faktúry: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setLoadingInvoices(false);
    }
  };

  const updateInvoiceStatus = async (invoiceId, newStatus) => {
    try {
      setUpdatingStatusId(invoiceId);
      await axios.put(`http://localhost:8000/invoices/${invoiceId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccessMsg('Stav faktúry bol aktualizovaný.');
      await fetchInvoices();
    } catch (err) {
      setError('Nepodarilo sa aktualizovať stav faktúry: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const openInvoiceQr = (invoiceId) => {
    axios
      .get(`http://localhost:8000/invoices/${invoiceId}/qr`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })
      .then((res) => {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'image/svg+xml' }));
        window.open(url, '_blank');
      })
      .catch((err) => setError('Nepodarilo sa zobraziť QR: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie')));
  };

  const openInvoicePdf = (invoiceId) => {
    axios
      .get(`http://localhost:8000/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      })
      .then((res) => {
        const file = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(file);
        window.open(url, '_blank');
      })
      .catch((err) => setError('Nepodarilo sa stiahnuť PDF: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie')));
  };

  const deleteInvoice = async (invoiceId) => {
    try {
      setDeletingId(invoiceId);
      await axios.delete(`http://localhost:8000/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccessMsg('Faktúra bola zmazaná.');
      await fetchInvoices();
    } catch (err) {
      setError('Nepodarilo sa zmazať faktúru: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setDeletingId(null);
    }
  };

  const viewInvoiceDetail = async (invoiceId) => {
    try {
      const response = await axios.get(`http://localhost:8000/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedInvoice(response.data);
      setInvoiceDetailOpen(true);
    } catch (err) {
      setError('Nepodarilo sa načítať detail faktúry: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'default';
      case 'issued': return 'primary';
      case 'paid': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'draft': return 'Návrh';
      case 'issued': return 'Vystavená';
      case 'paid': return 'Zaplatená';
      case 'cancelled': return 'Zrušená';
      default: return status;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          História faktúr
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateNew}
          size="large"
        >
          Nová faktúra
        </Button>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      <Card>
        <CardContent>
          {loadingInvoices ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Číslo faktúry</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Stav</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Celková suma</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Dátum vytvorenia</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Akcie</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map(inv => (
                    <TableRow key={inv.id} hover>
                      <TableCell sx={{ fontWeight: 'medium' }}>{inv.number}</TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusText(inv.status)} 
                          color={getStatusColor(inv.status)}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Select
                          size="small"
                          value={inv.status}
                          onChange={(e) => updateInvoiceStatus(inv.id, e.target.value)}
                          disabled={updatingStatusId === inv.id}
                          sx={{ minWidth: 120 }}
                        >
                          <MenuItem value="draft">Návrh</MenuItem>
                          <MenuItem value="issued">Vystavená</MenuItem>
                          <MenuItem value="paid">Zaplatená</MenuItem>
                          <MenuItem value="cancelled">Zrušená</MenuItem>
                        </Select>
                        {updatingStatusId === inv.id && <CircularProgress size={18} sx={{ ml: 1 }} />}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>€{inv.total_amount?.toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(inv.created_at).toLocaleDateString('sk-SK')}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Tooltip title="Zobraziť detail">
                            <IconButton size="small" onClick={() => viewInvoiceDetail(inv.id)}>
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="QR kód">
                            <IconButton size="small" onClick={() => openInvoiceQr(inv.id)}>
                              <QrIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="PDF faktúra">
                            <IconButton size="small" onClick={() => openInvoicePdf(inv.id)}>
                              <PdfIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Zmazať faktúru">
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={() => deleteInvoice(inv.id)} 
                              disabled={deletingId === inv.id}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={invoiceDetailOpen} onClose={() => setInvoiceDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Detail faktúry</DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6">{selectedInvoice.number}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Vystavená: {new Date(selectedInvoice.created_at).toLocaleDateString('sk-SK')}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Klinika:</Typography>
              <Typography sx={{ mb: 2 }}>{selectedInvoice.clinic_name}</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Pacienti:</Typography>
              <Typography sx={{ mb: 2 }}>{(selectedInvoice.patient_names || []).join(', ')}</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Stav:</Typography>
              <Chip 
                label={getStatusText(selectedInvoice.status)} 
                color={getStatusColor(selectedInvoice.status)}
                sx={{ mb: 2 }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Celková suma:</Typography>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>€{selectedInvoice.total_amount?.toFixed(2)}</Typography>
              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Položky:</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Popis</TableCell>
                          <TableCell align="right">Množstvo</TableCell>
                          <TableCell align="right">Jednotková cena</TableCell>
                          <TableCell align="right">Celkom</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedInvoice.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.description}</TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                            <TableCell align="right">€{item.unit_price?.toFixed(2)}</TableCell>
                            <TableCell align="right">€{item.line_total?.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvoiceDetailOpen(false)}>Zavrieť</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoiceHistory;
