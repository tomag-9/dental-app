import React from 'react';
import { Grid, TextField, Button, Typography } from '@mui/material';

const PatientForm = ({ formData, handleChange, handleSubmit, error, isEditMode = false }) => {
  return (
    <div style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '8px' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {isEditMode ? 'Upraviť pacienta' : 'Pridať pacienta'}
      </Typography>
      {error && (
        <Typography color="error" sx={{ mb: 2, fontSize: '0.875rem' }}>
          {error}
        </Typography>
      )}
      <form onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Meno"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              variant="outlined"
              size="small"
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Priezvisko"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              variant="outlined"
              size="small"
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Rodné číslo"
              name="birth_number"
              value={formData.birth_number}
              onChange={handleChange}
              variant="outlined"
              size="small"
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Adresa"
              name="address"
              value={formData.address}
              onChange={handleChange}
              variant="outlined"
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Telefón"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              variant="outlined"
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              variant="outlined"
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 2 }}
            >
              {isEditMode ? 'Uložiť zmeny' : 'Pridať pacienta'}
            </Button>
          </Grid>
        </Grid>
      </form>
    </div>
  );
};

export default PatientForm;