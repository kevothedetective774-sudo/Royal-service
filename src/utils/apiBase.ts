// Base API URL resolver supporting custom backend deployments (e.g., Netlify frontend + Cloud Run/Render/Railway backend)
export const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')
  : '';

/**
 * Returns a fully qualified API path, prepending VITE_API_URL if configured.
 * Example: apiUrl('/api/packages') => 'https://backend.app/api/packages' (or '/api/packages' if VITE_API_URL is unset)
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

/**
 * Safe JSON parser that checks whether the response is valid JSON or unexpected HTML
 * (common when a static host like Netlify falls back to index.html for unknown /api routes).
 */
export async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const text = await res.text();
    if (text.includes('<!doctype html') || text.includes('<html')) {
      throw new Error(
        `Backend API returned an HTML page instead of JSON (${res.status} ${res.statusText}). If you are running the frontend on Netlify, configure your backend URL in the VITE_API_URL environment variable.`
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }
  }
  return res.json();
}
