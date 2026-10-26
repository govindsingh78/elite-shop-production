import { apiUrl } from "./http";

/**
 * Cookie choices. Until a visitor chooses, only strictly necessary storage is used. A choice is kept for 12
 * months, or until the Cookie Policy changes what's used (bump CONSENT_VERSION to the policy's new "version",
 * in e-street-backend/resources/policies/cookies.json), and is recorded on the server as proof of consent.
 */
export const CONSENT_VERSION = "2026-10-26";
export const COOKIE_POLICY_PATH = "/cookie-policy";

const STORAGE_KEY = "ez_cookie_consent";
const MAX_AGE_DAYS = 365;
const OPEN_SETTINGS = "ez:open-cookie-settings";

/** The optional kinds of cookie a visitor can allow, besides the strictly necessary ones. */
export const OPTIONAL_CATEGORIES = [
  {
    key: "performance",
    title: "Performance",
    text: "Measures how fast the first page you open loads, so we can find and fix slow pages. Not linked to you, nothing is saved on your device, and it’s never used for advertising.",
  },
];

export const NECESSARY_SUMMARY = "Keep you signed in, remember your bag and wishlist, let you pay with Razorpay and sign in with Google, and keep the site secure — including telling us when a page breaks. The site can’t work without these.";

/** A random (version 4) UUID; randomUUID() itself is only available on HTTPS pages. */
function uuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

/** The visitor's current choice, or null if they haven't chosen (or it's out of date and must be asked again). */
export function readConsent() {
  const consent = stored();
  if (!consent || consent.version !== CONSENT_VERSION) return null;
  if (Date.now() - new Date(consent.at).getTime() > MAX_AGE_DAYS * 86400000) return null;
  return consent;
}

/** Whether a kind of cookie may be used right now. Strictly necessary ones always can. */
export const hasConsent = (category) => category === "necessary" || Boolean(readConsent()?.[category]);

/**
 * Saves a choice: "accept_all", "necessary_only", or "custom" with the chosen categories. The consent ID stays
 * the same across changes, so the server's records show one visitor's history.
 */
export function saveConsent(choice, categories = {}) {
  const consent = {
    id: stored()?.id || uuid(),
    choice,
    version: CONSENT_VERSION,
    at: new Date().toISOString(),
    ...Object.fromEntries(OPTIONAL_CATEGORIES.map(({ key }) => [key, choice === "accept_all" || (choice === "custom" && Boolean(categories[key]))])),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Storage blocked: the choice holds for this visit only.
  }

  const token = localStorage.getItem("authToken");
  fetch(`${apiUrl}/consents`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      consent_id: consent.id,
      choice,
      performance: consent.performance,
      version: CONSENT_VERSION,
      page: window.location.pathname.replace(/\/\d+(?=\/|$)/g, "/:id").replace(/[^A-Za-z0-9/:._-]/g, "").slice(0, 190) || "/",
    }),
  }).catch(() => {});

  return consent;
}

/** Opens the cookie settings (from the footer, the Cookie Policy…). */
export const openCookieSettings = () => window.dispatchEvent(new Event(OPEN_SETTINGS));

export const onOpenCookieSettings = (listener) => {
  window.addEventListener(OPEN_SETTINGS, listener);
  return () => window.removeEventListener(OPEN_SETTINGS, listener);
};
