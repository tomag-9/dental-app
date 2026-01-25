import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';

const API_URL = 'http://localhost:8000';

export default function LabManagement({ token }) {
  const [labs, setLabs] = useState([]);
  const [filteredLabs, setFilteredLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  
  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    postal_code: '',
    country: '',
    ico: '',
    dic: '',
    ic_dph: '',
    phone: '',
  });

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLab, setDeletingLab] = useState(null);

  useEffect(() => {
    fetchLabs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [labs, searchTerm, statusFilter, planFilter]);

  const fetchLabs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/labs/superadmin/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLabs(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load labs: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...labs];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lab => 
        lab.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lab.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lab.city && lab.city.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lab => lab.subscription_status === statusFilter);
    }

    // Plan filter
    if (planFilter !== 'all') {
      filtered = filtered.filter(lab => lab.subscription_plan === planFilter);
    }

    setFilteredLabs(filtered);
  };

  const handleEditClick = async (lab) => {
    try {
      // Fetch full lab details
      const response = await axios.get(`${API_URL}/labs/${lab.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingLab(lab);
      setEditFormData({
        name: response.data.name || '',
        email: response.data.email || '',
        address: response.data.address || '',
        city: response.data.city || '',
        postal_code: response.data.postal_code || '',
        country: response.data.country || '',
        ico: response.data.ico || '',
        dic: response.data.dic || '',
        ic_dph: response.data.ic_dph || '',
        phone: response.data.phone || '',
      });
      setEditDialogOpen(true);
    } catch (err) {
      setError('Failed to load lab details: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEditSave = async () => {
    try {
      await axios.put(
        `${API_URL}/labs/${editingLab.id}`,
        editFormData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Lab updated successfully');
      setEditDialogOpen(false);
      fetchLabs();
    } catch (err) {
      setError('Failed to update lab: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteClick = (lab) => {
    setDeletingLab(lab);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await axios.delete(`${API_URL}/labs/${deletingLab.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Lab deleted successfully');
      setDeleteDialogOpen(false);
      fetchLabs();
    } catch (err) {
      setError('Failed to delete lab: ' + (err.response?.data?.detail || err.message));
    }
  };

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'free': return 'default';
      case 'basic': return 'primary';
      case 'premium': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'trial': return 'warning';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Lab Management
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search"
              placeholder="Search by name, email, or city"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Subscription Status</InputLabel>
              <Select
                value={statusFilter}
                label="Subscription Status"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="trial">Trial</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Subscription Plan</InputLabel>
              <Select
                value={planFilter}
                label="Subscription Plan"
                onChange={(e) => setPlanFilter(e.target.value)}
              >
                <MenuItem value="all">All Plans</MenuItem>
                <MenuItem value="free">Free</MenuItem>
                <MenuItem value="basic">Basic</MenuItem>
                <MenuItem value="premium">Premium</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Labs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Users</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Seats</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLabs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  No labs found
                </TableCell>
              </TableRow>
            ) : (
              filteredLabs.map((lab) => (
                <TableRow key={lab.id} hover>
                  <TableCell>{lab.id}</TableCell>
                  <TableCell>{lab.name}</TableCell>
                  <TableCell>{lab.email}</TableCell>
                  <TableCell>{lab.city || '-'}</TableCell>
                  <TableCell>{lab.user_count}</TableCell>
                  <TableCell>
                    <Chip
                      label={lab.subscription_plan}
                      color={getPlanColor(lab.subscription_plan)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={lab.subscription_status}
                      color={getStatusColor(lab.subscription_status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{lab.subscription_seats}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      color="primary"
                      onClick={() => handleEditClick(lab)}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDeleteClick(lab)}
                      title="Delete"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Lab: {editingLab?.name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Lab Name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="City"
                value={editFormData.city}
                onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Postal Code"
                value={editFormData.postal_code}
                onChange={(e) => setEditFormData({ ...editFormData, postal_code: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Country"
                value={editFormData.country}
                onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="IČO"
                value={editFormData.ico}
                onChange={(e) => setEditFormData({ ...editFormData, ico: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="DIČ"
                value={editFormData.dic}
                onChange={(e) => setEditFormData({ ...editFormData, dic: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="IČ DPH"
                value={editFormData.ic_dph}
                onChange={(e) => setEditFormData({ ...editFormData, ic_dph: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the lab <strong>{deletingLab?.name}</strong>?
            This action cannot be undone and will delete all associated data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
