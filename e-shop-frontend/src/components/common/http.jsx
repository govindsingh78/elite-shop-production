// Set VITE_API_URL at build time (e.g. in .env.production); falls back to the local Laravel server.
export const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
