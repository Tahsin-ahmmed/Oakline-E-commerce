/** Browser-side fetch helper for our JSON API. Throws ApiClientError with field details on failure. */

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: Record<string, string[] | string> | { items?: string[] },
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export async function api<T = unknown>(url: string, opts: { method?: Method; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch {
    throw new ApiClientError("Network error — please check your connection and try again.", 0, "NETWORK");
  }
  let json: { success?: boolean; data?: T; error?: { code: string; message: string; details?: never } } | null = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok || !json?.success) {
    throw new ApiClientError(
      json?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      json?.error?.code ?? "UNKNOWN",
      json?.error?.details,
    );
  }
  return json.data as T;
}

/** Multipart upload helper (image uploads). */
export async function uploadFile(file: File, folder: string): Promise<{ url: string; publicId: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch("/api/admin/uploads", { method: "POST", body: form, credentials: "same-origin" });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new ApiClientError(json?.error?.message ?? "Upload failed", res.status, json?.error?.code ?? "UNKNOWN");
  }
  return json.data;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Apply API field errors to a react-hook-form instance. */
export function applyFieldErrors(
  error: unknown,
  setError: (name: never, err: { type: string; message: string }) => void,
) {
  if (!(error instanceof ApiClientError) || !error.details) return false;
  let applied = false;
  for (const [field, messages] of Object.entries(error.details)) {
    if (field === "items" || field === "_") continue;
    const msg = Array.isArray(messages) ? messages[0] : messages;
    if (typeof msg === "string") {
      setError(field as never, { type: "server", message: msg });
      applied = true;
    }
  }
  return applied;
}
