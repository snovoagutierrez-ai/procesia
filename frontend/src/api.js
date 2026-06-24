const isDev = import.meta.env.DEV;
const API = isDev ? `http://${window.location.hostname}:8001` : "/api";

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
