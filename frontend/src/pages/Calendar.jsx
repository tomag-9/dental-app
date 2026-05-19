import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Loader2, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { normalizeListResponse } from '../lib/utils';

const daysOfWeek = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVacationDialog, setShowVacationDialog] = useState(false);
  const [vacation, setVacation] = useState({ start: '', end: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const toISODateString = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return format(date, 'yyyy-MM-dd');
  };

  const formatMonthYear = (date) => date.toLocaleDateString('sk-SK', { month: 'long', year: 'numeric' });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, vacationsRes] = await Promise.all([
        api.get('/jobs/jobs/'),
        api.get('/jobs/vacations/').catch(() => ({ data: [] }))
      ]);

      const jobs = normalizeListResponse(jobsRes.data);
      const vacations = normalizeListResponse(vacationsRes.data);

      const jobEvents = jobs.map(job => ({
        id: `job-${job.id}`,
        type: 'job',
        title: `Práca #${job.id}`,
        status: job.status,
        date: job.start_date || job.due_date || job.created_at,
        startDate: job.start_date || job.due_date || job.created_at,
        endDate: job.end_date || job.due_date || job.start_date || job.created_at,
        resource: job
      })).filter(event => event.date);

      const vacationEvents = vacations.map(vac => ({
        id: `vacation-${vac.id}`,
        type: 'vacation',
        title: vac.description || 'Dovolenka',
        date: vac.start,
        startDate: vac.start,
        endDate: vac.end,
        resource: vac
      })).filter(event => event.startDate && event.endDate);

      setEvents([...jobEvents, ...vacationEvents]);
    } catch (err) {
      setError('Nepodarilo sa načítať udalosti kalendára: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDateClick = (date) => {
    setVacation({
      start: format(date, 'yyyy-MM-dd\'T\'HH:mm'),
      end: format(new Date(date.getTime() + 86400000), 'yyyy-MM-dd\'T\'HH:mm'),
      description: ''
    });
    setShowVacationDialog(true);
  };

  const handleVacationSave = async () => {
    try {
      setSubmitting(true);
      await api.post('/jobs/vacations/', {
        start: new Date(vacation.start).toISOString(),
        end: new Date(vacation.end).toISOString(),
        description: vacation.description
      });
      setShowVacationDialog(false);
      setVacation({ start: '', end: '', description: '' });
      await fetchEvents();
    } catch (err) {
      setError('Nepodarilo sa uložiť dovolenku: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const getDaysInMonth = () => {
    const firstDay = startOfMonth(currentDate);
    const lastDay = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: firstDay, end: lastDay });
    
    // Add padding days from previous month
    const startingDayOfWeek = getDay(firstDay);
    const paddingDays = Array(startingDayOfWeek).fill(null);
    
    return [...paddingDays, ...days];
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateStr = toISODateString(date);
    if (!dateStr) return [];

    return events.filter(event => {
      const eventStart = toISODateString(event.startDate);
      const eventEnd = toISODateString(event.endDate);
      const eventDate = toISODateString(event.date);
      if (!eventDate) return false;
      
      // Check if date is within vacation range or is job date
      if (event.type === 'vacation') {
        if (!eventStart || !eventEnd) return false;
        return dateStr >= eventStart && dateStr <= eventEnd;
      }
      return dateStr === eventDate;
    });
  };

  const days = getDaysInMonth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Kalendár</h1>
        <Button onClick={() => fetchEvents()} variant="outline" size="sm">
          Obnoviť
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/15 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-foreground">{error}</p>
        </div>
      )}

      <Card className="p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold capitalize">
            {formatMonthYear(currentDate)}
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setCurrentDate(new Date())}
              variant="outline"
              size="sm"
            >
              Dnes
            </Button>
            <Button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              variant="outline"
              size="sm"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek.map(day => (
            <div key={day} className="h-10 flex items-center justify-center font-semibold text-muted-foreground text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 rounded-lg bg-sky-50 p-2 border border-sky-200">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = day && isSameMonth(day, currentDate);
            const isToday = day && format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <div
                key={idx}
                onClick={() => day && isCurrentMonth && handleDateClick(day)}
                className={`
                  min-h-24 p-2 rounded border border-sky-200 cursor-pointer transition-colors
                  ${!day || !isCurrentMonth ? 'bg-sky-100/50' : 'bg-sky-50 hover:bg-sky-100'}
                  ${isToday ? 'ring-1 ring-blue-400 border-blue-300' : ''}
                `}
              >
                {day && (
                  <>
                    <div className={`text-sm font-semibold mb-1 ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/70'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          className={`
                            text-xs px-1.5 py-0.5 rounded truncate font-medium
                            ${event.type === 'vacation' ? 'bg-violet-500/30 text-violet-100 border border-violet-300/40' : 'bg-blue-500/30 text-blue-100 border border-blue-300/40'}
                          `}
                          title={event.title}
                        >
                          {event.type === 'vacation' ? '🏖️' : '📋'} {event.title}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Vacation Dialog */}
      {showVacationDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Pridať dovolenku</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Začiatok
                </label>
                <input
                  type="datetime-local"
                  value={vacation.start}
                  onChange={e => setVacation(v => ({ ...v, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg bg-sky-50 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Koniec
                </label>
                <input
                  type="datetime-local"
                  value={vacation.end}
                  onChange={e => setVacation(v => ({ ...v, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg bg-sky-50 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Popis (voliteľné)
                </label>
                <input
                  type="text"
                  placeholder="napr. Letná dovolenka"
                  value={vacation.description}
                  onChange={e => setVacation(v => ({ ...v, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg bg-sky-50 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowVacationDialog(false)}
                variant="outline"
                className="flex-1"
                disabled={submitting}
              >
                Zrušiť
              </Button>
              <Button
                onClick={handleVacationSave}
                className="flex-1"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Uložiť
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
