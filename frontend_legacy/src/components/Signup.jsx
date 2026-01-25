import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Grid,
  Link,
  CircularProgress,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Science as ScienceIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Signup = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    labName: '',
    email: '',
    nickname: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.labName || !formData.email || !formData.password) {
      setError('Všetky polia sú povinné');
      return;
    }
    if (!formData.lab_email.trim()) {
      setError('Email je povinný');
      return;
    }
    if (!formData.username.trim()) {
      setError('Používateľské meno je povinné');
      return;
    }
    if (formData.password.length < 6) {
      setError('Heslo musí mať aspoň 6 znakov');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Heslá sa nezhodujú');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:8000/users/signup', {
        lab_name: formData.labName,
        email: formData.email,
        nickname: formData.nickname,
        password: formData.password,
      });

      // Auto-login with returned token
      const { token, user, lab } = response.data;
      localStorage.setItem('token', token.access_token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('lab', JSON.stringify(lab));
      
      onLoginSuccess(token.access_token);
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.detail || 
        'Registrácia zlyhala. Skúste to znova.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
            <ScienceIcon sx={{ fontSize: 40, color: 'primary.main', mr: 1 }} />
            <Typography variant="h4" component="h1" fontWeight="bold">
              Nové laboratórium
            </Typography>
          </Box>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            Vyplňte základné údaje pre registráciu
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Názov laboratória"
                  value={formData.lab_name}
                  onChange={handleChange('lab_name')}
                  autoFocus
                  disabled={loading}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  type="email"
                  label="Email"
                  value={formData.lab_email}
                  onChange={handleChange('lab_email')}
                  disabled={loading}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Prezývka administrátora"
                  value={formData.nickname}
                  onChange={handleChange('nickname')}
                  disabled={loading}
                  helperText="Voliteľné - použije sa ako zobrazované meno"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  type={showPassword ? 'text' : 'password'}
                  label="Heslo"
                  value={formData.password}
                  onChange={handleChange('password')}
                  helperText="Minimálne 6 znakov"
                  disabled={loading}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  type={showPassword ? 'text' : 'password'}
                  label="Potvrďte heslo"
                  value={formData.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  disabled={loading}
                />
              </Grid>
            </Grid>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading && <CircularProgress size={20} />}
              sx={{ mt: 3 }}
            >
              {loading ? 'Registrujem...' : 'Zaregistrovať'}
            </Button>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Už máte účet?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/login')}
                sx={{ cursor: 'pointer', fontWeight: 'bold' }}
              >
                Prihláste sa
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Signup;
