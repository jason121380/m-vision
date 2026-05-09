// 後端 API base。本地開發 .env.local 設 VITE_API_BASE=http://localhost:3001
// 生產環境若前後端同域可留空字串。
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export const apiUrl = (path: string): string => `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;

export type ApiError = { error: string; status: number };

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(apiUrl(path), {
      credentials: 'include',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    const data = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const msg = (data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : res.statusText);
      return { ok: false, error: msg, status: res.status };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), status: 0 };
  }
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
