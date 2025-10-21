import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import axios from 'axios';

const SuperadminDashboard = ({ token, setError }) => {
  const [loading, setLoading] = useState(true);
  const [labs, setLabs] = useState([]);
  const [stats, setStats] = useState({
    totalLabs: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    inactiveSubscriptions: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/labs/superadmin/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const labsData = response.data;
      setLabs(labsData);
      
      // Calculate stats
      const totalUsers = labsData.reduce((sum, lab) => sum + lab.user_count, 0);
      const active = labsData.filter(lab => lab.subscription_status === 'active').length;
      const inactive = labsData.length - active;
      
      setStats({
        totalLabs: labsData.length,
        totalUsers: totalUsers,
        activeSubscriptions: active,
        inactiveSubscriptions: inactive
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Nepodarilo sa načítať údaje');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'error';
      case 'trial':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'free':
        return 'default';
      case 'basic':
        return 'primary';
      case 'premium':
        return 'secondary';
      default:
        return 'default';
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
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Superadmin Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BusinessIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalLabs}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Celkom laboratórií
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PeopleIcon sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalUsers}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Celkom používateľov
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.activeSubscriptions}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktívne predplatné
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CancelIcon sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.inactiveSubscriptions}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Neaktívne predplatné
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Labs Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Prehľad laboratórií
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell><strong>ID</strong></TableCell>
                  <TableCell><strong>Názov</strong></TableCell>
                  <TableCell><strong>Mesto</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Používatelia</strong></TableCell>
                  <TableCell><strong>Plán</strong></TableCell>
                  <TableCell><strong>Stav</strong></TableCell>
                  <TableCell><strong>Vytvoren é</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {labs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary">Žiadne laboratóriá</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  labs.map((lab) => (
                    <TableRow key={lab.id} hover>
                      <TableCell>{lab.id}</TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">{lab.name}</Typography>
                      </TableCell>
                      <TableCell>{lab.city || '-'}</TableCell>
                      <TableCell>{lab.email || '-'}</TableCell>
                      <TableCell>
                        <Chip label={lab.user_count} size="small" color="info" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={lab.subscription_plan.toUpperCase()} 
                          size="small" 
                          color={getPlanColor(lab.subscription_plan)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={lab.subscription_status} 
                          size="small" 
                          color={getStatusColor(lab.subscription_status)}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(lab.created_at).toLocaleDateString('sk-SK')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SuperadminDashboard;
