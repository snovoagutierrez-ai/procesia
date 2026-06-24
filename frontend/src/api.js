const isDev = import.meta.env.DEV;
const API = isDev ? `http://${window.location.hostname}:8001` : "/api";

export async function apiFetch(path, options = {}) {
  const cleanAPI = API.endsWith('/') ? API.slice(0, -1) : API;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  const headers = new Headers(options.headers || {});

  return fetch(`${cleanAPI}${cleanPath}`, { ...options, headers, credentials: 'include' });
}
