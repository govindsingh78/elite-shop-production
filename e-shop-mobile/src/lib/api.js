import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(message, status = 0, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Laravel sends validation errors as { errors: { field: [msg] } } (the login routes use "error"). */
const firstErrors = (errors) =>
  Object.fromEntries(Object.entries(errors || {}).map(([field, messages]) => [field, Array.isArray(messages) ? messages[0] : String(messages)]));

/**
 * Calls the Elitezaar API and returns the parsed JSON.
 * `body` is sent as JSON; `form` (FormData) is sent as multipart, e.g. for image uploads.
 */
export async function api(path, { method = "GET", body, form, token, query } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const search = query
    ? new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "")).toString()
    : "";

  let response;
  try {
    response = await fetch(`${API_URL}${path}${search ? `?${search}` : ""}`, { method, headers, body: payload });
  } catch (error) {
    // Not always the network: fetch also throws for a body it can't send. Keep the cause visible in development.
    if (__DEV__) console.warn(`${method} ${path} failed before a response:`, error);
    throw new ApiError("We can’t reach Elitezaar right now. Check your connection and try again.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldErrors = firstErrors(data.errors || data.error);
    // A 429 with retry_after (e.g. sign-in codes) says exactly how long to wait; plain throttling doesn't.
    const message = response.status === 429 && !data.retry_after
      ? "Too many attempts. Please wait a minute and try again."
      : Object.values(fieldErrors)[0] || data.message || `Something went wrong (${response.status}). Please try again.`;
    const error = new ApiError(message, response.status, fieldErrors);
    error.retryAfter = data.retry_after || null;
    throw error;
  }
  return data;
}
