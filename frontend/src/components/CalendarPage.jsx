import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack
} from '@mui/material';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const CalendarPage = ({ token, setError }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [vacation, setVacation] = useState({ start: '', end: '', description: '' });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const apiClient = api(token);
        // Fetch jobs
        const jobsRes = await apiClient.get('/jobs/');
        // Fetch vacations (assuming /vacations/ endpoint exists)
        let vacationsRes = { data: [] };
        try {
          vacationsRes = await apiClient.get('/vacations/');
        } catch {}
        // Map jobs to calendar events
        const jobEvents = jobsRes.data.map(job => ({
          id: `job-${job.id}`,
          title: `Práca #${job.id} - ${job.status}`,
          start: job.start_date ? new Date(job.start_date) : new Date(job.due_date),
          end: job.end_date ? new Date(job.end_date) : new Date(job.due_date),
          allDay: false,
          resource: { type: 'job', job },
        }));
        // Map vacations to calendar events
        const vacationEvents = vacationsRes.data.map(vac => ({
          id: `vacation-${vac.id}`,
          title: vac.description || 'Dovolenka',
          start: new Date(vac.start),
          end: new Date(vac.end),
          allDay: true,
          resource: { type: 'vacation', vac },
        }));
        setEvents([...jobEvents, ...vacationEvents]);
      } catch (err) {
        setError('Nepodarilo sa načítať kalendár: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, setError]);

  const handleSelectSlot = ({ start, end }) => {
    setVacation({ start, end, description: '' });
    setVacationDialogOpen(true);
  };

  const handleVacationSave = async () => {
    try {
      const apiClient = api(token);
      await apiClient.post('/vacations/', {
        start: vacation.start,
        end: vacation.end,
        description: vacation.description,
      });
      setVacationDialogOpen(false);
      setVacation({ start: '', end: '', description: '' });
      // Refresh events
      setLoading(true);
      const jobsRes = await apiClient.get('/jobs/');
      const vacationsRes = await apiClient.get('/vacations/');
      const jobEvents = jobsRes.data.map(job => ({
        id: `job-${job.id}`,
        title: `Práca #${job.id} - ${job.status}`,
        start: job.start_date ? new Date(job.start_date) : new Date(job.due_date),
        end: job.end_date ? new Date(job.end_date) : new Date(job.due_date),
        allDay: false,
        resource: { type: 'job', job },
      }));
      const vacationEvents = vacationsRes.data.map(vac => ({
        id: `vacation-${vac.id}`,
        title: vac.description || 'Dovolenka',
        start: new Date(vac.start),
        end: new Date(vac.end),
        allDay: true,
        resource: { type: 'vacation', vac },
      }));
      setEvents([...jobEvents, ...vacationEvents]);
    } catch (err) {
      setError('Nepodarilo sa uložiť dovolenku: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Kalendár prác a dovoleniek</Typography>
      <Paper sx={{ p: 2, minHeight: 600 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            selectable
            onSelectSlot={handleSelectSlot}
            popup
          />
        )}
      </Paper>
      <Dialog open={vacationDialogOpen} onClose={() => setVacationDialogOpen(false)}>
        <DialogTitle>Pridať dovolenku</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Začiatok"
              type="datetime-local"
              value={moment(vacation.start).format('YYYY-MM-DDTHH:mm')}
              onChange={e => setVacation(v => ({ ...v, start: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Koniec"
              type="datetime-local"
              value={moment(vacation.end).format('YYYY-MM-DDTHH:mm')}
              onChange={e => setVacation(v => ({ ...v, end: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Popis"
              value={vacation.description}
              onChange={e => setVacation(v => ({ ...v, description: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVacationDialogOpen(false)}>Zrušiť</Button>
          <Button onClick={handleVacationSave} variant="contained">Uložiť</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarPage;
