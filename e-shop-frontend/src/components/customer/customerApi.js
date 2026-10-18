import { apiUrl } from "../common/http";

/** Calls a /api/customer/* endpoint with the signed-in customer's token. */
export const customerRequest = async (path, { method = "GET", body, signal } = {}) => {
  const token = localStorage.getItem("customerToken");
  let response;
  try {
    response = await fetch(`${apiUrl}/customer/${path}`, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(`Cannot reach the store API at ${apiUrl}. Make sure the backend server is running.`);
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    // Expired or revoked token: clear the session and send the shopper back to sign in.
    ["authUser", "authToken", "customer", "customerToken"].forEach((key) => localStorage.removeItem(key));
    window.location.assign("/customer/login");
  }
  if (!response.ok) {
    const error = new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Something went wrong. Please try again.");
    error.status = response.status;
    error.errors = Object.fromEntries(Object.entries(data.errors || {}).map(([field, messages]) => [field, messages[0]]));
    throw error;
  }
  return data;
};

export const STATUS_LABELS = {
  pending: "Order placed",
  processing: "Being prepared",
  shipped: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
