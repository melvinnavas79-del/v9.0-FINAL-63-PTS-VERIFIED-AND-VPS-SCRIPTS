/**
 * api.js — Axios wrapper centralizado para Lluvia App Studio
 * Adjunta user_id automáticamente desde localStorage a cada request.
 */
import axios from 'axios';

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: BASE });

// Inyectar user_id en cada request si está disponible
api.interceptors.request.use((config) => {
  try {
    const saved = localStorage.getItem('user');
    if (saved) {
      const u = JSON.parse(saved);
      if (u?.id) {
        // GET: query param; POST/PUT/PATCH: body
        if (['get', 'delete'].includes(config.method?.toLowerCase())) {
          config.params = { user_id: u.id, ...config.params };
        }
        // No sobreescribir user_id si ya viene en el body
        if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
          if (config.data && typeof config.data === 'object' && !config.data.user_id) {
            config.data = { user_id: u.id, ...config.data };
          }
        }
      }
    }
  } catch { /* localStorage no disponible */ }
  return config;
});

export function formatError(e) {
  if (e?.response?.data?.detail) {
    const d = e.response.data.detail;
    return typeof d === 'string' ? d : JSON.stringify(d);
  }
  return e?.message || 'Error desconocido';
}
