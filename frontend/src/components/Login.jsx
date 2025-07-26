import React from 'react';
import axios from 'axios';

const Login = ({ loginData, setLoginData, setToken, setIsLoggedIn, setError, error }) => {
  const handleLoginChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const payload = new URLSearchParams({
        username: loginData.username,
        password: loginData.password,
      }).toString();
      console.log('Login payload:', payload);
      const response = await axios.post(
        'http://localhost:8000/users/token',
        payload,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const newToken = response.data.access_token;
      console.log('Received token:', newToken);
      setToken(newToken);
      localStorage.setItem('token', newToken);
      setIsLoggedIn(true);
      setLoginData({ username: '', password: '' });
      setError('');
    } catch (err) {
      setError('Prihlásenie zlyhalo: ' + (err.response?.data?.detail || 'Skontrolujte pripojenie'));
      console.error('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center text-white">Zubná technika - Prihlásenie</h1>
        <form onSubmit={handleLogin} className="space-y-6">
          {error && <p className="text-red-400 text-center">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-300">Používateľské meno</label>
            <input
              type="text"
              name="username"
              value={loginData.username}
              onChange={handleLoginChange}
              className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Heslo</label>
            <input
              type="password"
              name="password"
              value={loginData.password}
              onChange={handleLoginChange}
              className="mt-1 p-2 w-full rounded-md bg-gray-700 text-white border border-gray-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md font-semibold transition"
          >
            Prihlásiť sa
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;