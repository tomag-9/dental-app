import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, TextField, Button, Paper
} from '@mui/material';

const EditProfile = ({ token, setError }) => {
  const [userData, setUserData] = useState({ nickname: '', password: '' });
  const [originalNickname, setOriginalNickname] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get('http://localhost:8000/users/me/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUserData({ nickname: response.data.nickname || '', password: '' });
        setOriginalNickname(response.data.nickname || '');
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
      const data = { nickname: userData.nickname, password: userData.password || undefined };
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
            label="Prezývka"
            name="nickname"
            value={userData.nickname}
            onChange={handleChange}
            fullWidth
            helperText="Voliteľné - použije sa ako zobrazované meno"
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