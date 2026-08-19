const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
export const AUTH_COOKIE = "auth_token";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message ?? message;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function getServerToken(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value;
}

/** Direct server-side call to the backend. Use from Server Components and Route Handlers. */
export async function serverApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getServerToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  return handleResponse<T>(res);
}

/** Browser-side call, routed through the same-origin proxy so the JWT never reaches client JS. */
export async function clientApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return handleResponse<T>(res);
}

/** Works in either Server or Client Components - picks the right transport automatically. */
export function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  if (typeof window === "undefined") return serverApi<T>(path, options);
  return clientApi<T>(path, options);
}
