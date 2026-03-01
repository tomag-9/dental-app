import { create } from 'zustand';
import api from '../lib/api';

const storedUser = (() => {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        return null;
    }
})();

const useAuthStore = create((set) => ({
    user: storedUser,
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    login: async (username, password) => {
        try {
            const response = await api.post('/token/', { username, password });
            const { access, refresh } = response.data;
            localStorage.setItem('token', access);
            localStorage.setItem('refresh', refresh);

            const meResponse = await api.get('/users/me/', {
                headers: {
                    Authorization: `Bearer ${access}`,
                },
            });
            const user = meResponse.data;
            localStorage.setItem('user', JSON.stringify(user));

            set({ token: access, isAuthenticated: true, user });
            return true;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    },
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh');
        localStorage.removeItem('user');
        set({ user: null, token: null, isAuthenticated: false });
    },
    updateUser: (userData) => {
        localStorage.setItem('user', JSON.stringify(userData));
        set({ user: userData });
    },
}));

export default useAuthStore;
