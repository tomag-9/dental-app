import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Card, CardContent, TextField, Button, Stack,
  Alert, CircularProgress, Grid, Divider, Paper
} from '@mui/material';
import { Save as SaveIcon, Person as PersonIcon } from '@mui/icons-material';

const TechnicianProfile = ({ token, setError }) => {
  const [technician, setTechnician] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchTechnician();
  }, []);

  const fetchTechnician = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:8000/technicians/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // For now, get the first technician. In a real app, you'd get the current user's technician profile
      if (response.data.length > 0) {
        setTechnician(response.data[0]);
      }
    } catch (err) {
      setError('Nepodarilo sa načítať profil technika: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`http://localhost:8000/technicians/${technician.id}`, technician, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccessMsg('Profil bol úspešne uložený.');
    } catch (err) {
      setError('Nepodarilo sa uložiť profil: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setTechnician(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!technician) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, ml: { xs: 0, md: '240px' } }}>
        <Alert severity="error">Technik nebol nájdený.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, ml: { xs: 0, md: '240px' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <PersonIcon sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Profil technika
        </Typography>
      </Box>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg('')}>
          {successMsg}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Personal Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Osobné údaje
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Meno"
                  value={technician.first_name || ''}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Priezvisko"
                  value={technician.last_name || ''}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Titul pred menom"
                  value={technician.title_before || ''}
                  onChange={(e) => handleChange('title_before', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Titul za menom"
                  value={technician.title_after || ''}
                  onChange={(e) => handleChange('title_after', e.target.value)}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Billing Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Fakturačné údaje
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Názov spoločnosti"
                  value={technician.company_name || ''}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Adresa"
                  value={technician.company_address || ''}
                  onChange={(e) => handleChange('company_address', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Mesto"
                  value={technician.company_city || ''}
                  onChange={(e) => handleChange('company_city', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="PSČ"
                  value={technician.company_postal_code || ''}
                  onChange={(e) => handleChange('company_postal_code', e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Krajina"
                  value={technician.company_country || ''}
                  onChange={(e) => handleChange('company_country', e.target.value)}
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
                    value={technician.tax_id || ''}
                    onChange={(e) => handleChange('tax_id', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="IČ DPH"
                    value={technician.vat_id || ''}
                    onChange={(e) => handleChange('vat_id', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="IBAN"
                    value={technician.bank_account || ''}
                    onChange={(e) => handleChange('bank_account', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="BIC/SWIFT"
                    value={technician.bank_bic || ''}
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
          disabled={saving}
          size="large"
        >
          Uložiť profil
        </Button>
      </Box>
    </Box>
  );
};

export default TechnicianProfile;
