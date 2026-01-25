import { create } from 'zustand';
import api from '../lib/api';

const useAuthStore = create((set) => ({
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    login: async (username, password) => {
        try {
            const response = await api.post('/token/', { username, password });
            const { access, refresh } = response.data;
            localStorage.setItem('token', access);
            localStorage.setItem('refresh', refresh);
            set({ token: access, isAuthenticated: true, user: { username } });
            return true;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    },
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh');
        set({ user: null, token: null, isAuthenticated: false });
    },
}));

export default useAuthStore;
