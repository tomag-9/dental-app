import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { FlaskConical, AlertCircle, Loader2 } from 'lucide-react';
export default function Signup({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ lab_name: '', email: '', password: '', confirmPassword: '' });
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) { setError('Heslá sa nezhodujú'); return; }
    setLoading(true); setError('');
    try {
      const response = await axios.post('http://localhost:8000/api/signup/', formData);
      const { token, user } = response.data;
      localStorage.setItem('token', token.access_token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('role', user.role);
      onLoginSuccess(token.access_token); navigate('/');
    } catch { setError('Registrácia zlyhala'); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center"><FlaskConical className="h-12 w-12 text-primary" /></div>
        <h2 className="mt-6 text-center text-3xl font-black text-gray-900 tracking-tight">Nové laboratórium</h2>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
          {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold">{error}</div>}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input name="lab_name" placeholder="Názov laboratória" required value={formData.lab_name} onChange={handleChange} className="w-full border rounded-xl p-3" />
            <input name="email" type="email" placeholder="Email" required value={formData.email} onChange={handleChange} className="w-full border rounded-xl p-3" />
            <input name="password" type="password" placeholder="Heslo" required value={formData.password} onChange={handleChange} className="w-full border rounded-xl p-3" />
            <input name="confirmPassword" type="password" placeholder="Potvrdiť heslo" required value={formData.confirmPassword} onChange={handleChange} className="w-full border rounded-xl p-3" />
            <button type="submit" disabled={loading} className="w-full py-4 bg-primary text-white font-black rounded-xl shadow-lg">{loading ? <Loader2 className="animate-spin mx-auto" /> : 'ZAREGISTROVAŤ'}</button>
          </form>
          <div className="mt-6 text-center"><p className="text-sm font-bold text-gray-500">Máte účet? <Link to="/login" className="text-primary hover:underline">Prihlásiť sa</Link></p></div>
        </div>
      </div>
    </div>
  );
}
