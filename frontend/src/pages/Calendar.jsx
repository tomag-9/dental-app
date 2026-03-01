import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Loader2, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVacationDialog, setShowVacationDialog] = useState(false);
  const [vacation, setVacation] = useState({ start: '', end: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, vacationsRes] = await Promise.all([
        api.get('/jobs/'),
        api.get('/vacations/').catch(() => ({ data: [] }))
      ]);

      const jobEvents = jobsRes.data.map(job => ({
        id: `job-${job.id}`,
        type: 'job',
        title: `Job #${job.id}`,
        status: job.status,
        date: job.start_date || job.due_date,
        startDate: job.start_date,
        endDate: job.end_date || job.due_date,
        resource: job
      }));

      const vacationEvents = vacationsRes.data.map(vac => ({
        id: `vacation-${vac.id}`,
        type: 'vacation',
        title: vac.description || 'Vacation',
        date: vac.start,
        startDate: vac.start,
        endDate: vac.end,
        resource: vac
      }));

      setEvents([...jobEvents, ...vacationEvents]);
    } catch (err) {
      setError('Failed to load calendar events: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

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
      await api.post('/vacations/', {
        start: new Date(vacation.start).toISOString(),
        end: new Date(vacation.end).toISOString(),
        description: vacation.description
      });
      setShowVacationDialog(false);
      setVacation({ start: '', end: '', description: '' });
      await fetchEvents();
    } catch (err) {
      setError('Failed to save vacation: ' + (err.response?.data?.detail || err.message));
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
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.filter(event => {
      const eventStart = format(parseISO(event.startDate), 'yyyy-MM-dd');
      const eventEnd = format(parseISO(event.endDate), 'yyyy-MM-dd');
      const eventDate = format(parseISO(event.date), 'yyyy-MM-dd');
      
      // Check if date is within vacation range or is job date
      if (event.type === 'vacation') {
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
        <h1 className="text-4xl font-bold">Calendar</h1>
        <Button onClick={() => fetchEvents()} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <Card className="p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {format(currentDate, 'MMMM yyyy')}
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
              Today
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
            <div key={day} className="h-10 flex items-center justify-center font-semibold text-gray-600 text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 bg-gray-50 p-2 rounded-lg">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = day && isSameMonth(day, currentDate);
            const isToday = day && format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <div
                key={idx}
                onClick={() => day && isCurrentMonth && handleDateClick(day)}
                className={`
                  min-h-24 p-2 rounded border border-gray-200 cursor-pointer
                  ${!day || !isCurrentMonth ? 'bg-gray-100' : 'bg-white hover:bg-blue-50'}
                  ${isToday ? 'bg-blue-100 border-blue-300' : ''}
                `}
              >
                {day && (
                  <>
                    <div className={`text-sm font-semibold mb-1 ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          className={`
                            text-xs px-1.5 py-0.5 rounded truncate text-white font-medium
                            ${event.type === 'vacation' ? 'bg-purple-500' : 'bg-blue-500'}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Add Vacation</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={vacation.start}
                  onChange={e => setVacation(v => ({ ...v, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={vacation.end}
                  onChange={e => setVacation(v => ({ ...v, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Summer vacation"
                  value={vacation.description}
                  onChange={e => setVacation(v => ({ ...v, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                Cancel
              </Button>
              <Button
                onClick={handleVacationSave}
                className="flex-1"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
