import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, FlaskConical, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

export default function Login({ setToken, setIsLoggedIn }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/api/token/', formData);
      const newToken = response.data.access;
      setToken(newToken); localStorage.setItem('token', newToken);
      const userRes = await api(newToken).get('/users/me/');
      localStorage.setItem('user', JSON.stringify(userRes.data));
      localStorage.setItem('role', userRes.data.role);
      setIsLoggedIn(true); navigate('/');
    } catch (_e) { setError('Nesprávne údaje'); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center"><FlaskConical className="h-12 w-12 text-primary" /></div>
        <h2 className="mt-6 text-center text-3xl font-black text-gray-900 tracking-tight">Dental Lab</h2>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
          {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold">{error}</div>}
          <form className="space-y-6" onSubmit={handleLogin}>
            <div><label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Email</label><input name="email" type="email" required value={formData.email} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3" /></div>
            <div><label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Heslo</label><input name="password" type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3" /></div>
            <button type="submit" disabled={loading} className="w-full py-4 bg-primary text-white font-black rounded-xl hover:bg-opacity-90 transition-all shadow-lg shadow-primary/20">{loading ? <Loader2 className="animate-spin mx-auto" /> : 'PRIHLÁSIŤ SA'}</button>
          </form>
          <div className="mt-6 text-center"><p className="text-sm font-bold text-gray-500">Nemáte účet? <Link to="/signup" className="text-primary hover:underline">Registrovať</Link></p></div>
        </div>
      </div>
    </div>
  );
}
