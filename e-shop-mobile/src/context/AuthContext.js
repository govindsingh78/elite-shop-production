import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import { googleSignIn } from "@/lib/googleSignIn";
import { LOGIN_PATHS } from "@/lib/portals";
import { getPushToken } from "@/lib/push";
import { secureStorage } from "@/lib/storage";

const SESSION_KEY = "elitezaar.session";
const AuthContext = createContext(null);

/**
 * One signed-in account at a time: a customer, a vendor (role "seller") or an admin.
 * The portal decides which part of the app is shown.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const sessionRef = useRef(null);
  // This phone’s push token once registered, so signing out can stop its notifications.
  const pushTokenRef = useRef(null);

  const save = useCallback(async (next) => {
    sessionRef.current = next;
    setSession(next);
    try {
      if (next) await secureStorage.set(SESSION_KEY, JSON.stringify(next));
      else await secureStorage.remove(SESSION_KEY);
    } catch {
      // Storage failures only mean the user signs in again next launch.
    }
  }, []);

  useEffect(() => {
    secureStorage.get(SESSION_KEY)
      .then((value) => {
        if (!value) return;
        const stored = JSON.parse(value);
        sessionRef.current = stored;
        setSession(stored);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Signed in (or back with a saved session): this phone gets the account’s push notifications.
  const authToken = session?.token;
  useEffect(() => {
    if (!authToken) return undefined;
    let cancelled = false;
    getPushToken().then((pushToken) => {
      if (cancelled || !pushToken) return;
      pushTokenRef.current = pushToken;
      api("/device-tokens", { method: "POST", token: authToken, body: { token: pushToken, platform: Platform.OS } }).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const signIn = useCallback(async (portal, email, password) => {
    const data = await api(LOGIN_PATHS[portal], { method: "POST", body: { email: email.trim(), password } });
    const next = { token: data.token, user: data.user, portal: data.portal || portal };
    await save(next);
    return next;
  }, [save]);

  /** "Continue with Google". Resolves with the session and whether the account is new, or null if they backed out. */
  const signInWithGoogle = useCallback(async (portal) => {
    const data = await googleSignIn(portal);
    if (!data) return null;
    const next = { token: data.token, user: data.user, portal: data.portal || portal };
    await save(next);
    return { session: next, created: data.status === 201, message: data.message };
  }, [save]);

  /** Starts a customer session from a register or checkout response that already carries a token. */
  const startSession = useCallback((token, user, portal = "customer") => save({ token, user, portal }), [save]);

  const signOut = useCallback(async () => {
    const token = sessionRef.current?.token;
    const pushToken = pushTokenRef.current;
    pushTokenRef.current = null;
    await save(null);
    if (!token) return;
    // Stop this phone getting the account’s notifications, then end the session.
    const forgetPhone = pushToken ? api("/device-tokens", { method: "DELETE", token, body: { token: pushToken } }).catch(() => {}) : Promise.resolve();
    forgetPhone.finally(() => api("/logout", { method: "POST", token }).catch(() => {}));
  }, [save]);

  const updateUser = useCallback((user) => {
    if (sessionRef.current) save({ ...sessionRef.current, user: { ...sessionRef.current.user, ...user } });
  }, [save]);

  /** API call as the signed-in user. An expired token signs the user out. */
  const request = useCallback(async (path, options = {}) => {
    try {
      return await api(path, { ...options, token: sessionRef.current?.token });
    } catch (error) {
      if (error.status === 401 && sessionRef.current) {
        await save(null);
        error.message = "Your session has ended. Please sign in again.";
      }
      throw error;
    }
  }, [save]);

  const value = useMemo(() => ({
    ready,
    session,
    user: session?.user || null,
    portal: session?.portal || null,
    isCustomer: session?.portal === "customer",
    signIn,
    signInWithGoogle,
    startSession,
    signOut,
    updateUser,
    request,
  }), [ready, session, signIn, signInWithGoogle, startSession, signOut, updateUser, request]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
};
