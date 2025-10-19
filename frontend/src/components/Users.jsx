import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Paper, Button, TextField, IconButton, Dialog, DialogActions,
  DialogContent, DialogTitle
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import MenuItem from '@mui/material/MenuItem';

const Users = ({ token, setError }) => {
  const [users, setUsers] = useState([]);
  const [openForm, setOpenForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user' // Assuming roles like 'user' or 'admin'
  });

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:8000/users/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (err) {
      setError('Nepodarilo sa načítať používateľov: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
  };

  const handleOpenForm = (user = null) => {
    setSelectedUser(user);
    setFormData(user || { username: '', password: '', role: 'user' });
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setSelectedUser(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        const data = { ...formData, password: formData.password || undefined }; // Only send password if provided
        if (selectedUser) {
        await axios.put(`http://localhost:8000/users/${selectedUser.id}`, data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        } else {
        await axios.post('http://localhost:8000/users/', data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        }
        fetchUsers();
        handleCloseForm();
    } catch (err) {
        setError('Nepodarilo sa uložiť používateľa: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
    };

    const handleDelete = async (id) => {
    try {
        await axios.delete(`http://localhost:8000/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
        });
        fetchUsers();
    } catch (err) {
        setError('Nepodarilo sa vymazať používateľa: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    }
    };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Používatelia</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenForm()}>
          Pridať používateľa
        </Button>
      </Box>
      <Paper sx={{ mb: 2, overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Meno</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Rola</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Akcie</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpenForm(user)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(user.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Dialog open={openForm} onClose={handleCloseForm}>
        <DialogTitle>{selectedUser ? 'Upraviť používateľa' : 'Pridať používateľa'}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Meno"
            name="username"
            value={formData.username}
            onChange={handleChange}
            fullWidth
            required
          />
          <TextField
            margin="dense"
            label="Heslo"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            fullWidth
            helperText={selectedUser ? 'Ponechajte prázdne, ak nechcete meniť heslo' : ''}
          />
          <TextField
            margin="dense"
            label="Rola"
            name="role"
            select
            value={formData.role}
            onChange={handleChange}
            fullWidth
            required
          >
            <MenuItem value="user">Používateľ</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Zrušiť</Button>
          <Button onClick={handleSubmit} variant="contained">Uložiť</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Users;