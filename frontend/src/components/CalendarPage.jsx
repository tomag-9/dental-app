import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Calendar as CalendarIcon, Loader2, Plus } from 'lucide-react';
import Modal from './Modal';

const localizer = momentLocalizer(moment);

export default function CalendarPage({ token, setError }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [vacation, setVacation] = useState({ start: '', end: '', description: '' });

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await api(token).get('/jobs/');
      setEvents(res.data.map(j => ({ id: j.id, title: `Práca #${j.id}`, start: new Date(j.due_date), end: new Date(j.due_date), allDay: true })));
    } catch { setError('Chyba kalendára'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) fetchEvents(); }, [token, setError]);

  return (
    <div className="space-y-6 h-full">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-black uppercase">Kalendár</h2></div>
      <div className="bg-white p-6 rounded-3xl shadow border h-[600px]">
        {loading ? <Loader2 className="animate-spin mx-auto mt-20" /> : <Calendar localizer={localizer} events={events} style={{ height: '100%' }} />}
      </div>
    </div>
  );
}
