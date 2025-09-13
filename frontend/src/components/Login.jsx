import React from 'react';
import axios from 'axios';
import { Box, TextField, Button, Typography, Paper } from '@mui/material';

const Login = ({ loginData, setLoginData, setToken, setIsLoggedIn, setError, error }) => {
  const handleLoginChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const payload = new URLSearchParams({
        username: loginData.username,
        password: loginData.password,
      }).toString();
      //console.log('Login payload:', payload);
      const response = await axios.post(
        'http://localhost:8000/users/token',
        payload,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const newToken = response.data.access_token;
      console.log('Received token:', newToken);
      setToken(newToken);
      localStorage.setItem('token', newToken);
      setIsLoggedIn(true);
      setLoginData({ username: '', password: '' });
      setError('');
    } catch (err) {
      setError('Prihlásenie zlyhalo: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      console.error('Login error:', err);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
          Zubná technika - Prihlásenie
        </Typography>
        {error && (
          <Typography color="error" sx={{ mb: 2, textAlign: 'center' }}>
            {error}
          </Typography>
        )}
        <form onSubmit={handleLogin}>
          <TextField
            fullWidth
            label="Používateľské meno"
            name="username"
            value={loginData.username}
            onChange={handleLoginChange}
            variant="outlined"
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Heslo"
            name="password"
            type="password"
            value={loginData.password}
            onChange={handleLoginChange}
            variant="outlined"
            margin="normal"
            required
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            sx={{ mt: 2 }}
          >
            Prihlásiť sa
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default Login;