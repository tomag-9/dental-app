import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

let isRefreshing = false;
let pendingRequests = [];

const resolvePendingRequests = (newToken, refreshError = null) => {
    pendingRequests.forEach((callback) => callback(newToken, refreshError));
    pendingRequests = [];
};

const clearAuthStorage = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
};

const redirectToLogin = () => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login');
    }
};

// Add a request interceptor to include the token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401s (optional)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (!error.response || error.response.status !== 401) {
            return Promise.reject(error);
        }

        const refreshToken = localStorage.getItem('refresh');
        const isRefreshCall = originalRequest?.url?.includes('/token/refresh/');

        if (!refreshToken || isRefreshCall) {
            clearAuthStorage();
            redirectToLogin();
            return Promise.reject(error);
        }

        if (originalRequest._retry) {
            return Promise.reject(error);
        }
        originalRequest._retry = true;

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                pendingRequests.push((newToken, refreshError) => {
                    if (refreshError) {
                        reject(refreshError);
                        return;
                    }
                    if (!newToken) {
                        reject(error);
                        return;
                    }
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    resolve(api(originalRequest));
                });
            });
        }

        isRefreshing = true;
        try {
            const refreshResponse = await axios.post('/api/token/refresh/', {
                refresh: refreshToken,
            });
            const newAccessToken = refreshResponse.data?.access;

            if (!newAccessToken) {
                throw new Error('Missing access token in refresh response');
            }

            localStorage.setItem('token', newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            resolvePendingRequests(newAccessToken);
            return api(originalRequest);
        } catch (refreshError) {
            const refreshStatus = refreshError?.response?.status;
            if (refreshStatus === 401 || refreshStatus === 403) {
                clearAuthStorage();
                redirectToLogin();
            }
            resolvePendingRequests(null, refreshError);
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
