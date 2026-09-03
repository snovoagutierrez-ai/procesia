const isDev = import.meta.env.DEV;
const API = isDev ? `http://${window.location.hostname}:8001` : "/api";

export async function apiFetch(path, options = {}) {
  const cleanAPI = API.endsWith('/') ? API.slice(0, -1) : API;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  const headers = new Headers(options.headers || {});

  return fetch(`${cleanAPI}${cleanPath}`, { ...options, headers, credentials: 'include' });
}

/**
 * Igual que apiFetch pero LANZA si la respuesta no es 2xx.
 *
 * fetch() solo rechaza ante un fallo de red: un 422 o un 500 se resuelven
 * normalmente. Por eso los guardados que solo hacían `.catch(() => {})`
 * ignoraban también los errores del servidor y el usuario creía haber
 * guardado algo que nunca se persistió. Usar en toda operación de escritura.
 */
export async function apiMutate(path, options = {}) {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.clone().json();
      detail = body?.detail ? (typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)) : '';
    } catch { /* respuesta sin cuerpo JSON */ }
    const err = new Error(detail || `Error ${res.status} al guardar`);
    err.status = res.status;
    throw err;
  }
  return res;
}
