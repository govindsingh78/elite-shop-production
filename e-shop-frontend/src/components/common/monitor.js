import { hasConsent } from "./consent";
import { apiUrl } from "./http";

/**
 * Reports crashes visitors run into, and (if they allowed performance cookies) how fast the first page they open
 * loads, to Admin › Server & health. Reports never get in the way: they are sent in the background and any
 * failure is ignored.
 */

const MAX_REPORTS = 5;
const sent = new Set();

/** "/product/classic-linen-shirt" → "/product/:handle"; ids in other addresses become ":id". */
export function pagePattern(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (/^\/product\/[^/]+$/.test(path)) return "/product/:handle";
  if (/^\/shop\/[^/]+$/.test(path)) return "/shop/:category";
  return path.replace(/\/\d+(?=\/|$)/g, "/:id").replace(/[^A-Za-z0-9/:._-]/g, "").slice(0, 190) || "/";
}

/** "Chrome 140 · Android" */
function browserName() {
  const agent = navigator.userAgent;
  const browser = [[/Edg\/(\d+)/, "Edge"], [/SamsungBrowser\/(\d+)/, "Samsung Internet"], [/Chrome\/(\d+)/, "Chrome"], [/Firefox\/(\d+)/, "Firefox"], [/Version\/(\d+).*Safari/, "Safari"]]
    .map(([pattern, name]) => (pattern.test(agent) ? `${name} ${agent.match(pattern)[1]}` : null)).find(Boolean) || "Other browser";
  const system = [[/Android/, "Android"], [/iPhone|iPad/, "iOS"], [/Windows/, "Windows"], [/Mac OS/, "macOS"], [/Linux/, "Linux"]]
    .map(([pattern, name]) => (pattern.test(agent) ? name : null)).find(Boolean) || "";
  return [browser, system].filter(Boolean).join(" · ").slice(0, 60);
}

/** `asUser`: say who's signed in (crash reports, to see whether shoppers or sellers hit it); speed figures never do. */
const post = (path, body, { asUser = false } = {}) => {
  const token = asUser ? localStorage.getItem("authToken") : null;
  return fetch(`${apiUrl}${path}`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }).catch(() => {});
};

/** Network hiccups (offline, a cancelled request) aren't bugs. */
const isNoise = (message) => /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$|ResizeObserver loop|^Script error\.?$|AbortError/i.test(message);

/** Sends a crash report: at most once per error and a few per page visit. */
export function reportError(error, { component } = {}) {
  try {
    const raw = String(error?.message || error || "Unknown error");
    const message = error?.name && !raw.startsWith(error.name) ? `${error.name}: ${raw}` : raw;
    const key = `${message}|${component || ""}`;
    if (isNoise(message) || sent.has(key) || sent.size >= MAX_REPORTS) return;
    sent.add(key);
    post("/monitor/client-errors", {
      source: "website",
      message: message.slice(0, 2000),
      stack: error?.stack ? String(error.stack).slice(0, 8000) : null,
      page: pagePattern(window.location.pathname),
      component: component ? component.slice(0, 190) : null,
      platform: browserName(),
    }, { asUser: true });
  } catch {
    // Reporting must never break the page.
  }
}

/**
 * How long the first page took to show its main content (largest contentful paint), sent once the visitor
 * moves on or after 15 seconds. Pages opened later inside the site load differently and aren't measured.
 */
function measureFirstPage() {
  if (!("PerformanceObserver" in window) || !PerformanceObserver.supportedEntryTypes?.includes("largest-contentful-paint")) return;
  const page = pagePattern(window.location.pathname);
  // Speed is about what shoppers and sellers wait for; the admin panel would only crowd the list.
  if (page.startsWith("/admin")) return;
  let lcp = 0;
  let done = false;
  const observer = new PerformanceObserver((list) => {
    const last = list.getEntries().at(-1);
    if (last) lcp = Math.round(last.renderTime || last.startTime);
  });
  observer.observe({ type: "largest-contentful-paint", buffered: true });

  const send = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    const navigation = performance.getEntriesByType("navigation")[0];
    // Performance measurement is optional: only sent if the visitor allowed it (they may say yes while here).
    if (!lcp || !navigation || document.prerendering || !hasConsent("performance")) return;
    post("/monitor/page-speed", {
      page,
      device: window.matchMedia("(max-width: 767px)").matches || /Mobi/i.test(navigator.userAgent) ? "mobile" : "desktop",
      lcp: Math.min(lcp, 120000),
      ttfb: Math.max(0, Math.round(navigation.responseStart)),
      load: Math.max(0, Math.round(navigation.loadEventEnd || navigation.domContentLoadedEventEnd)),
    });
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") send(); });
  window.addEventListener("pagehide", send);
  setTimeout(send, 15000);
}

/** Called once when the website starts. */
export function startMonitoring() {
  if (import.meta.env.DEV) return;
  window.addEventListener("error", (event) => reportError(event.error || event.message));
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason));
  try {
    measureFirstPage();
  } catch {
    // Older browsers: no speed figures from them.
  }
}
