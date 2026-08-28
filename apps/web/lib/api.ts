const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export type User = { id: string; email: string; role: "admin" | "viewer" };
export type Project = { _id: string; name: string; databaseName: string; username: string; description?: string; createdAt: string; updatedAt: string };
export type ProjectCreateResult = { project: Project; uri: string };
export type CollectionInfo = { name: string; type: string };
export type Backup = { _id: string; backupId: string; projectId: string; databaseName: string; status: "running" | "completed" | "failed"; error?: string; createdAt: string; updatedAt: string };

let refreshRequest: Promise<boolean> | null = null;

async function refreshSession() {
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && !retried && path !== "/auth/refresh" && path !== "/auth/login" && await refreshSession()) {
    return api<T>(path, init, true);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(body?.message || `Request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
