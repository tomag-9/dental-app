import React, { useState } from 'react';
import axios from 'axios';
import { Box, TextField, Button, Typography, Paper, Link, Alert, CircularProgress, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff, Science as ScienceIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Login = ({ loginData, setLoginData, setToken, setIsLoggedIn, setError, error }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    setLoading(true);
    
    try {
      const payload = new URLSearchParams({
        username: loginData.email, // Backend expects 'username' field but we send email
        password: loginData.password,
      }).toString();
      const response = await axios.post(
        'http://localhost:8000/users/token',
        payload,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const newToken = response.data.access_token;
      console.log('Received token:', newToken);
      setToken(newToken);
      localStorage.setItem('token', newToken);
      
      // Fetch user data to store role and other info
      const userResponse = await axios.get('http://localhost:8000/users/me/', {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      const userData = userResponse.data;
      localStorage.setItem('user', JSON.stringify(userData));
      console.log('User data:', userData);
      
      setIsLoggedIn(true);
      setLoginData({ email: '', password: '' });
      navigate('/'); // Redirect to home page after login
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Nesprávne prihlasovacie údaje';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 420, width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <ScienceIcon sx={{ fontSize: 40, color: 'primary.main', mr: 1 }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            Dental Lab
          </Typography>
        </Box>
        
        <Typography variant="h6" sx={{ mb: 3, textAlign: 'center', color: 'text.secondary' }}>
          Prihlásenie
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        
        <form onSubmit={handleLogin}>
          <TextField
            fullWidth
            label="Email"
            name="email"
            type="email"
            value={loginData.email}
            onChange={handleChange}
            variant="outlined"
            margin="normal"
            required
            autoFocus
            disabled={loading}
          />
          <TextField
            fullWidth
            label="Heslo"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={loginData.password}
            onChange={handleChange}
            variant="outlined"
            margin="normal"
            required
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleLogin(e);
              }
            }}
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
          
          <Box sx={{ textAlign: 'right', mb: 2 }}>
            <Link
              component="button"
              variant="body2"
              onClick={(e) => {
                e.preventDefault();
                alert('Funkcia obnovenia hesla bude čoskoro dostupná');
              }}
              sx={{ cursor: 'pointer' }}
            >
              Zabudli ste heslo?
            </Link>
          </Box>
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
            sx={{ mt: 1, mb: 2 }}
          >
            {loading ? 'Prihlasovanie...' : 'Prihlásiť sa'}
          </Button>
        </form>
        
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Nemáte účet?{' '}
            <Link
              component="button"
              variant="body2"
              onClick={() => navigate('/signup')}
              sx={{ cursor: 'pointer', fontWeight: 'bold' }}
            >
              Zaregistrujte laboratórium
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default Login;