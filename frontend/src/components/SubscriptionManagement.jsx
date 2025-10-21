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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const API_URL = 'http://localhost:8000';

export default function SubscriptionManagement({ token }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [editFormData, setEditFormData] = useState({
    plan: 'free',
    status: 'active',
    seats: 1,
    period_start: null,
    period_end: null,
  });

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/subscriptions/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscriptions(response.data);
      setError('');
    } catch (err) {
      setError('Failed to load subscriptions: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = async (subscription) => {
    try {
      const response = await axios.get(`${API_URL}/subscriptions/${subscription.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingSubscription(subscription);
      setEditFormData({
        plan: response.data.plan || 'free',
        status: response.data.status || 'active',
        seats: response.data.seats || 1,
        period_start: response.data.period_start ? new Date(response.data.period_start) : null,
        period_end: response.data.period_end ? new Date(response.data.period_end) : null,
      });
      setEditDialogOpen(true);
    } catch (err) {
      setError('Failed to load subscription details: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleEditSave = async () => {
    try {
      const payload = {
        ...editFormData,
        period_start: editFormData.period_start ? editFormData.period_start.toISOString().split('T')[0] : null,
        period_end: editFormData.period_end ? editFormData.period_end.toISOString().split('T')[0] : null,
      };
      
      await axios.put(
        `${API_URL}/subscriptions/${editingSubscription.id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Subscription updated successfully');
      setEditDialogOpen(false);
      fetchSubscriptions();
    } catch (err) {
      setError('Failed to update subscription: ' + (err.response?.data?.detail || err.message));
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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Subscription Management
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

        {/* Subscriptions Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Lab Name</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Seats</TableCell>
                <TableCell>Period Start</TableCell>
                <TableCell>Period End</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No subscriptions found
                  </TableCell>
                </TableRow>
              ) : (
                subscriptions.map((subscription) => (
                  <TableRow key={subscription.id} hover>
                    <TableCell>{subscription.id}</TableCell>
                    <TableCell>{subscription.lab_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={subscription.plan}
                        color={getPlanColor(subscription.plan)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={subscription.status}
                        color={getStatusColor(subscription.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{subscription.seats}</TableCell>
                    <TableCell>{formatDate(subscription.period_start)}</TableCell>
                    <TableCell>{formatDate(subscription.period_end)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        color="primary"
                        onClick={() => handleEditClick(subscription)}
                        title="Edit"
                      >
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Edit Subscription Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Edit Subscription: {editingSubscription?.lab_name}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Plan</InputLabel>
                  <Select
                    value={editFormData.plan}
                    label="Plan"
                    onChange={(e) => setEditFormData({ ...editFormData, plan: e.target.value })}
                  >
                    <MenuItem value="free">Free</MenuItem>
                    <MenuItem value="basic">Basic</MenuItem>
                    <MenuItem value="premium">Premium</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editFormData.status}
                    label="Status"
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="trial">Trial</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Number of Seats"
                  value={editFormData.seats}
                  onChange={(e) => setEditFormData({ ...editFormData, seats: parseInt(e.target.value) || 1 })}
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Period Start"
                  value={editFormData.period_start}
                  onChange={(newValue) => setEditFormData({ ...editFormData, period_start: newValue })}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Period End"
                  value={editFormData.period_end}
                  onChange={(newValue) => setEditFormData({ ...editFormData, period_end: newValue })}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Plan Information:</strong>
                  </Typography>
                  <Typography variant="body2">
                    • Free: Limited features, 1 seat<br />
                    • Basic: Standard features, up to 5 seats<br />
                    • Premium: All features, unlimited seats
                  </Typography>
                </Alert>
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
      </Box>
    </LocalizationProvider>
  );
}
