import { useEffect, useState } from "react";
import { apiUrl } from "./http";

const TOKENS = { customer: "customerToken", vendor: "vendorToken", admin: "adminToken" };

/**
 * Calls the phone sign-in API. With `portal` set, it's sent as that portal's signed-in user (for confirming a
 * number). Errors carry `status`, `field` (the first field with a problem) and `retryAfter` (seconds).
 */
export async function phoneRequest(path, { method = "POST", body, portal } = {}) {
  const token = portal ? localStorage.getItem(TOKENS[portal]) : null;
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("We can’t reach the store right now. Please try again shortly.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const [field, messages] = Object.entries(data.errors || {})[0] || [];
    const error = new Error((messages && [].concat(messages)[0]) || data.message || "Something went wrong. Please try again.");
    error.status = response.status;
    error.field = field;
    error.retryAfter = data.retry_after || null;
    throw error;
  }
  return data;
}

/** Keeps digits, spaces, + and - while typing a phone number. */
export const cleanPhone = (value) => value.replace(/[^\d+\s-]/g, "").slice(0, 16);

/** Keeps the 6 digits of a code (pasted codes often come with spaces). */
export const cleanCode = (value) => value.replace(/\D/g, "").slice(0, 6);

/** Seconds left before another code can be sent, counting down; set it to start. */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return [seconds, setSeconds];
}
