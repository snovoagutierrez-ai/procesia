const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API = isLocal ? (import.meta.env.VITE_API_URL || "http://localhost:8000") : "/api";

export async function apiFetch(path, options = {}) {
  const cleanAPI = API.endsWith('/') ? API.slice(0, -1) : API;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem('access_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${cleanAPI}${cleanPath}`, { ...options, headers, credentials: 'include' });
}
