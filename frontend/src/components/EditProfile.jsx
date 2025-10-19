import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, TextField, Button, Paper
} from '@mui/material';

const EditProfile = ({ token, setError }) => {
  const [userData, setUserData] = useState({ username: '', password: '' });
  const [originalUsername, setOriginalUsername] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get('http://localhost:8000/users/me/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserData({ username: response.data.username, password: '' });
        setOriginalUsername(response.data.username);
      } catch (err) {
        setError('Nepodarilo sa načítať údaje používateľa: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      }
    };
    fetchUserData();
  }, [token, setError]);

  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { username: userData.username, password: userData.password || undefined };
      await axios.put('http://localhost:8000/users/me/', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setError('Údaje boli úspešne uložené');
    } catch (err) {
      setError('Nepodarilo sa uložiť údaje: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Upraviť profil</Typography>
      <Paper sx={{ p: 2 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            margin="normal"
            label="Meno"
            name="username"
            value={userData.username}
            onChange={handleChange}
            fullWidth
            required
            disabled={userData.username === originalUsername}
          />
          <TextField
            margin="normal"
            label="Nové heslo"
            name="password"
            type="password"
            value={userData.password}
            onChange={handleChange}
            fullWidth
            helperText="Ponechajte prázdne, ak nechcete meniť heslo"
          />
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>
            Uložiť
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default EditProfile;