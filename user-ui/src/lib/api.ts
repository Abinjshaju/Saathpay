/**
 * API client for communicating with the SaathPay backend.
 * Replaces direct Supabase calls — all data flows through the FastAPI backend.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

const TOKEN_KEY = "saathpay_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null }> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 204) {
      return { data: null, error: null };
    }

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        body?.detail?.message ||
        body?.detail ||
        body?.message ||
        `Request failed (${res.status})`;
      return { data: null, error: typeof msg === "string" ? msg : JSON.stringify(msg) };
    }

    return { data: body as T, error: null };
  } catch (err) {
    return { data: null, error: (err as Error).message || "Network error" };
  }
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(path, { method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: "DELETE" }),
};
