import axios from 'axios';

// Cliente HTTP único: adjunta el token de sesión en cada petición para que el
// backend (los Proxies) sepa quién llama y con qué rol.
const api = axios.create({ baseURL: 'http://localhost:5000' });

export const getUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem('cineverse_user'));
  } catch {
    return null;
  }
};

api.interceptors.request.use((config) => {
  const token = getUsuario()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Sesión inválida/expirada (401): se limpia y se vuelve al login.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && getUsuario()) {
      localStorage.removeItem('cineverse_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
