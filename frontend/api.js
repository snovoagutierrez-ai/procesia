const API = import.meta.env.VITE_API_URL || "https://aiproces-backend.onrender.com";

export async function apiFetch(path, options = {}) {
  const cleanAPI = API.endsWith('/') ? API.slice(0, -1) : API;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${cleanAPI}${cleanPath}`, { ...options, credentials: 'include' });
}
