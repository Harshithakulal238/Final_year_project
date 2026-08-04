import apiClient from './api';

const STORAGE_KEY = 'kgss_user';
const AUTH_TOKEN_KEY = 'kgss_token';
// Always start a frontend load signed out so a prior user's dashboard cannot
// appear when the application is run again.
const startFreshSession = () => {
  // Vite can evaluate this module again when a route is lazy-loaded. Clear
  // persisted data only once for the initial page load, not on navigation.
  if (window.__kgssFreshSessionStarted) return;
  window.__kgssFreshSessionStarted = true;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
};

startFreshSession();

export const isAuthenticated = () => Boolean(sessionStorage.getItem(AUTH_TOKEN_KEY));

export const getStoredUser = () => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveUser = (user) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
};

export const clearUser = () => {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
};

export const registerUser = async (phone, username, password) => {
  await apiClient.post('/auth/register', { phone, username, password });
};

export const login = async (username, password) => {
  const response = await apiClient.post('/auth/login', { username, password });
  const { token, user } = response.data;
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  saveUser(user);
  return user;
};

export const fetchCurrentUser = async () => {
  const response = await apiClient.get('/auth/me');
  const { user } = response.data;
  saveUser(user);
  return user;
};

export const updateUserProfile = async (profileData) => {
  const response = await apiClient.put('/auth/profile', profileData);
  const { user } = response.data;
  saveUser(user);
  return user;
};

export const logout = () => {
  clearUser();
};

export const clearRegistration = () => {
  localStorage.removeItem('kgss_otp_verified');
};

export const markOtpVerified = () => {
  localStorage.setItem('kgss_otp_verified', 'true');
};

export const isOtpVerified = () => localStorage.getItem('kgss_otp_verified') === 'true';
