import { apiUrl } from "../../common/http";

const TOKENS = { admin: "adminToken", vendor: "vendorToken" };

/** Calls the commission API as the signed-in admin or seller. Validation errors come back on `error.fieldErrors`. */
export async function commissionRequest(portal, path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem(TOKENS[portal]) || ""}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the store right now. Please try again shortly.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fieldErrors = Object.fromEntries(Object.entries(data.errors || {}).map(([field, messages]) => [field, [].concat(messages)[0]]));
    const error = new Error(Object.values(fieldErrors)[0] || data.message || "Something went wrong. Please try again.");
    error.fieldErrors = fieldErrors;
    throw error;
  }
  return data;
}

export const PAYOUT_METHODS = { upi: "UPI", bank_transfer: "Bank transfer", cash: "Cash", other: "Other" };

/** 10 → "10%", 12.5 → "12.5%" */
export const formatRate = (rate) => `${Number(rate || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

export const formatDay = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export const today = () => new Date().toISOString().slice(0, 10);
