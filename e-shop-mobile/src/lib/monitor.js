import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "./api";
import { readJson, writeJson } from "./storage";

/**
 * Reports crashes people run into in the app to Admin › Server & health. Reports never get in the way: they
 * are sent in the background and any failure is ignored. A crash that closes the app is saved and sent the
 * next time it opens.
 */

const PENDING = "elitezaar.pendingCrash";
const MAX_REPORTS = 10;
const sent = new Set();
let token = null;
let screen = null;
let installed = false;

/** Reports are tied to the signed-in user, so admins can see whether shoppers or sellers hit a problem. */
export const setMonitorToken = (value) => {
  token = value || null;
};

/** The current screen as its route, e.g. ["(store)", "product", "[id]"] → "/product/:id". */
export const setMonitorScreen = (segments) => {
  screen = `/${segments.filter((segment) => !segment.startsWith("(")).join("/")}`.replace(/\[\.{0,3}([^\]]+)\]/g, ":$1");
};

function reportFor(error, { component, fatal } = {}) {
  const raw = String(error?.message || error || "Unknown error");
  const message = error?.name && !raw.startsWith(error.name) ? `${error.name}: ${raw}` : raw;
  return {
    source: "app",
    message: `${fatal ? "App closed: " : ""}${message}`.slice(0, 2000),
    stack: error?.stack ? String(error.stack).slice(0, 8000) : null,
    page: screen,
    component: component ? String(component).slice(0, 190) : null,
    platform: `${Platform.OS} ${Platform.Version}`.slice(0, 60),
    version: Constants.expoConfig?.version || null,
  };
}

/** Resolves to whether the report got through. */
const send = (report) => api("/monitor/client-errors", { method: "POST", token, body: report }).then(() => true, () => false);

/** Sends a crash report, at most once per error and screen. */
export function reportError(error, options = {}) {
  try {
    if (__DEV__) return;
    const report = reportFor(error, options);
    const key = `${report.message}|${report.page}`;
    if (sent.has(key) || sent.size >= MAX_REPORTS) return;
    sent.add(key);
    // The app is about to close: keep the report so it can be sent next time if this one doesn't get out.
    if (options.fatal) writeJson(PENDING, report);
    send(report).then((delivered) => {
      if (delivered && options.fatal) writeJson(PENDING, null);
    });
  } catch {
    // Reporting must never cause a crash of its own.
  }
}

/** Called once when the app starts: catches errors outside screens, and sends a crash saved last time. */
export function installCrashReporting() {
  if (installed || __DEV__) return;
  installed = true;
  readJson(PENDING, null).then((report) => {
    if (!report) return;
    writeJson(PENDING, null);
    send(report);
  });
  const previous = global.ErrorUtils?.getGlobalHandler?.();
  if (previous) {
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      reportError(error, { fatal: isFatal });
      previous(error, isFatal);
    });
  }
}
