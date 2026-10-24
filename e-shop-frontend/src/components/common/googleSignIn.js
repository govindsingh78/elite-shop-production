import { apiUrl } from "./http";

const PENDING_KEY = "eshop_google_signin";

export const PORTAL_LOGIN = { customer: "/customer/login", vendor: "/vendor/login", admin: "/admin/login" };
export const PORTAL_HOME = { customer: "/customer/dashboard", vendor: "/vendor/dashboard", admin: "/admin/dashboard" };

let providers;
/** Which sign-in options the API offers; "Continue with Google" is hidden until Google is configured there. */
export function fetchAuthProviders() {
  providers ??= fetch(`${apiUrl}/auth/providers`, { headers: { Accept: "application/json" } })
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => {
      providers = undefined;
      return {};
    });
  return providers;
}

const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Sends the browser to Google through the API. Google returns to /auth/google/callback with a one-time
 * code, which only this tab can redeem: it holds the PKCE verifier behind the challenge sent now.
 */
export async function startGoogleSignIn(portal, from) {
  if (!window.crypto?.subtle) throw new Error("Google sign-in needs a secure (https) connection.");
  const verifier = base64url(window.crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ portal, from, verifier }));

  const returnTo = `${window.location.origin}/auth/google/callback?portal=${portal}`;
  const query = new URLSearchParams({ portal, return_to: returnTo, code_challenge: challenge });
  window.location.assign(`${apiUrl}/auth/google/redirect?${query}`);
}

/** The sign-in this tab started, if any. Read once: the verifier is cleared with it. */
export function takePendingGoogleSignIn() {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    sessionStorage.removeItem(PENDING_KEY);
    return pending;
  } catch {
    return null;
  }
}

/** Trades the code from the callback for a session, in the same shape as a password sign-in. */
export async function exchangeGoogleCode(code, verifier) {
  const response = await fetch(`${apiUrl}/auth/google/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
  if (!response.ok) throw new Error(result.message || "Google sign-in didn’t finish. Please try again.");
  return result;
}
