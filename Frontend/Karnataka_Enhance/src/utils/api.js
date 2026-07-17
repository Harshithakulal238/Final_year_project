import axios from 'axios';

const AUTH_TOKEN_KEY = 'kgss_token';
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 5000,
});

apiClient.interceptors.request.use((config) => {
  if (!config.headers) {
    config.headers = {};
  }
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const mockRequest = (response, delay = 500) =>
  new Promise((resolve) => setTimeout(() => resolve({ data: response }), delay));

export default apiClient;
