import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Card, CardContent, TextField, Button, Stack,
  Alert, CircularProgress, Grid, Divider, Paper
} from '@mui/material';
import { Save as SaveIcon, Science as ScienceIcon } from '@mui/icons-material';

const LabSettings = ({ token, setError }) => {
  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchLab();
  }, []);

  const fetchLab = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:8000/labs/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Get the first lab (there should be only one)
      if (response.data.length > 0) {
        setLab(response.data[0]);
      } else {
        // Create a new lab if none exists
        setLab({
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
      setError('Nepodarilo sa načítať údaje laboratória: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (lab.id) {
        // Update existing lab
        await axios.put(`http://localhost:8000/labs/${lab.id}`, lab, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // Create new lab
        const response = await axios.post('http://localhost:8000/labs/', lab, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLab(response.data);
      }
      setSuccessMsg('Údaje laboratória boli úspešne uložené.');
    } catch (err) {
      setError('Nepodarilo sa uložiť údaje laboratória: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setLab(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!lab) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, ml: { xs: 0, md: '240px' } }}>
        <Alert severity="error">Nepodarilo sa načítať údaje laboratória.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, ml: { xs: 0, md: '240px' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <ScienceIcon sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Nastavenia laboratória
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Lab Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Základné údaje laboratória
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Názov laboratória"
                  value={lab.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
                <TextField
                  fullWidth
                  label="Adresa"
                  value={lab.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Mesto"
                  value={lab.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="PSČ"
                  value={lab.postal_code || ''}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Krajina"
                  value={lab.country || ''}
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
                  value={lab.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={lab.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Webová stránka"
                  value={lab.website || ''}
                  onChange={(e) => handleChange('website', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="URL loga"
                  value={lab.logo_url || ''}
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
                    value={lab.tax_id || ''}
                    onChange={(e) => handleChange('tax_id', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="IČ DPH"
                    value={lab.vat_id || ''}
                    onChange={(e) => handleChange('vat_id', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="IBAN"
                    value={lab.bank_account || ''}
                    onChange={(e) => handleChange('bank_account', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="BIC/SWIFT"
                    value={lab.bank_bic || ''}
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
          disabled={saving || !lab.name}
          size="large"
        >
          Uložiť údaje laboratória
        </Button>
      </Box>
    </Box>
  );
};

export default LabSettings;
