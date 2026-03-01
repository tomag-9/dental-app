import axios from 'axios';

// Simple axios instance factory with token header and base URL fallback
export const api = (token) =>
  axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });

export const withError = async (promise, onError) => {
  try {
    const res = await promise;
    return [res, null];
  } catch (err) {
    const msg = err.response?.data?.detail || err.message || 'Skontrolujte pripojenie';
    onError?.(msg);
    return [null, msg];
  }
};
