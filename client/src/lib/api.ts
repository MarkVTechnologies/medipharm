// Thin fetch wrapper feeding SWR (spec §4.5). Logic only — no JSX.

const BASE: string = import.meta.env.VITE_API_URL ?? "";

export type ValidationErrors = Record<string, string[]>;

export class ApiError extends Error {
  status: number;
  errors: ValidationErrors;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.errors = (data.errors as ValidationErrors) ?? {};
  }

  /** First message for a field, for inline form errors. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number; last_page: number } & Record<string, unknown>;
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

let csrfReady: Promise<void> | null = null;

/** Laravel's CSRF bootstrap — once per session (spec §4.2). */
export function ensureCsrf(force = false): Promise<void> {
  if (!csrfReady || force) {
    csrfReady = fetch(`${BASE}/sanctum/csrf-cookie`, {
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    }).then(() => undefined);
  }
  return csrfReady;
}

async function safeData(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface ApiInit extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Don't broadcast auth:expired on 401 (used by the boot /me probe and login). */
  silentAuth?: boolean;
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { body, silentAuth, ...rest } = init;
  const method = (rest.method ?? "GET").toUpperCase();
  const isForm = body instanceof FormData;

  if (method !== "GET" && method !== "HEAD") {
    await ensureCsrf();
  }

  const doFetch = () => {
    const xsrf = readCookie("XSRF-TOKEN");
    return fetch(`${BASE}${path}`, {
      ...rest,
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(isForm || body === undefined ? {} : { "Content-Type": "application/json" }),
        "X-Requested-With": "XMLHttpRequest",
        ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}),
        ...(rest.headers ?? {}),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    throw new ApiError("Network problem — check your connection and try again.", 0);
  }

  // A stale CSRF token (419) is retried once with a fresh cookie before giving up.
  if (res.status === 419) {
    await ensureCsrf(true);
    res = await doFetch();
  }

  if (res.status === 419 || res.status === 401) {
    if (!silentAuth) window.dispatchEvent(new Event("auth:expired"));
    const data = await safeData(res);
    throw new ApiError((data.message as string) || "Session expired", res.status, data);
  }

  if (!res.ok) {
    const data = await safeData(res);
    if (res.status === 402) window.dispatchEvent(new Event("billing:readonly"));
    throw new ApiError((data.message as string) || `Request failed (${res.status})`, res.status, data);
  }

  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

export const fetcher = <T,>(path: string) => api<T>(path);

/** Absolute URL for links the browser opens itself (CSV exports, PDFs). */
export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
