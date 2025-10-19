import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Card, CardContent, TextField, Button, Stack,
  Alert, CircularProgress, Grid, Divider, Paper
} from '@mui/material';
import { Save as SaveIcon, Business as BusinessIcon } from '@mui/icons-material';

const CompanySettings = ({ token, setError }) => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:8000/companies/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Get the first company (there should be only one)
      if (response.data.length > 0) {
        setCompany(response.data[0]);
      } else {
        // Create a new company if none exists
        setCompany({
          name: '',
          address: '',
          city: '',
          postal_code: '',
          country: 'Slovakia',
          tax_id: '',
          vat_id: '',
          bank_account: '',
          bank_bic: '',
          phone: '',
          email: '',
          website: '',
          logo_url: ''
        });
      }
    } catch (err) {
      setError('Nepodarilo sa načítať údaje spoločnosti: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (company.id) {
        // Update existing company
        await axios.put(`http://localhost:8000/companies/${company.id}`, company, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // Create new company
        const response = await axios.post('http://localhost:8000/companies/', company, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCompany(response.data);
      }
      setSuccessMsg('Údaje spoločnosti boli úspešne uložené.');
    } catch (err) {
      setError('Nepodarilo sa uložiť údaje spoločnosti: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setCompany(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!company) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, ml: { xs: 0, md: '240px' } }}>
        <Alert severity="error">Nepodarilo sa načítať údaje spoločnosti.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, ml: { xs: 0, md: '240px' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <BusinessIcon sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Nastavenia spoločnosti
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Company Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Základné údaje spoločnosti
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Názov spoločnosti"
                  value={company.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
                <TextField
                  fullWidth
                  label="Adresa"
                  value={company.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Mesto"
                  value={company.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="PSČ"
                  value={company.postal_code || ''}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Krajina"
                  value={company.country || ''}
                  onChange={(e) => handleChange('country', e.target.value)}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Contact Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Kontaktné údaje
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Telefón"
                  value={company.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={company.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Webová stránka"
                  value={company.website || ''}
                  onChange={(e) => handleChange('website', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="URL loga"
                  value={company.logo_url || ''}
                  onChange={(e) => handleChange('logo_url', e.target.value)}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Tax and Bank Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Daňové a bankové údaje
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="IČO/DIC"
                    value={company.tax_id || ''}
                    onChange={(e) => handleChange('tax_id', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="IČ DPH"
                    value={company.vat_id || ''}
                    onChange={(e) => handleChange('vat_id', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="IBAN"
                    value={company.bank_account || ''}
                    onChange={(e) => handleChange('bank_account', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="BIC/SWIFT"
                    value={company.bank_bic || ''}
                    onChange={(e) => handleChange('bank_bic', e.target.value)}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !company.name}
          size="large"
        >
          Uložiť údaje spoločnosti
        </Button>
      </Box>
    </Box>
  );
};

export default CompanySettings;
