const API = import.meta.env.VITE_API_URL;

export async function apiFetch(path, options = {}) {
  return fetch(`${API}${path}`, { ...options, credentials: 'include' });
}
