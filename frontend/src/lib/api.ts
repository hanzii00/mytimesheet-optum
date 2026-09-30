import { API_URL } from "./format";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function describeFailure(response: Response) {
  try {
    const payload = await response.json();
    return payload.detail ?? Object.values(payload).flat().join(" ");
  } catch {
    return "Something went wrong. Please try again.";
  }
}

/**
 * Every API call goes through here so the session cookie is always sent and
 * unsafe methods always carry the CSRF token Django expects.
 */
export async function api(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    const token = readCookie("csrftoken");
    if (token) headers.set("X-CSRFToken", token);
  }

  return fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await api(path, options);
  if (!response.ok) {
    throw new ApiError(await describeFailure(response), response.status);
  }
  return (await response.json()) as T;
}

export const postJson = <T,>(path: string, body: unknown) =>
  apiJson<T>(path, { method: "POST", body: JSON.stringify(body) });

export const putJson = <T,>(path: string, body: unknown) =>
  apiJson<T>(path, { method: "PUT", body: JSON.stringify(body) });
