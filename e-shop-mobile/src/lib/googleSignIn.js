import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, ApiError } from "./api";
import { API_URL } from "./config";

/** Google sign-in hands back to the app on this path (elitezaar://auth/google). See app/+native-intent.js. */
export const GOOGLE_RETURN_PATH = "auth/google";

let providers;
/** Which sign-in options the API offers; "Continue with Google" is hidden until Google is configured there. */
export function fetchAuthProviders() {
  providers ??= api("/auth/providers").catch(() => {
    providers = undefined;
    return {};
  });
  return providers;
}

const toBase64url = (base64) => base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Signs in through Google in the system browser (Custom Tab / ASWebAuthenticationSession), via the API.
 * The browser returns with a one-time code that only this call can redeem: it alone holds the PKCE
 * verifier behind the challenge it sent. Resolves with the session response, or null if the person backed out.
 */
export async function googleSignIn(portal) {
  const verifier = (Crypto.randomUUID() + Crypto.randomUUID()).replace(/-/g, "");
  const challenge = toBase64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  const returnTo = Linking.createURL(GOOGLE_RETURN_PATH);
  const query = new URLSearchParams({ portal, return_to: returnTo, code_challenge: challenge });

  // Android: launch the browser directly (no-history) rather than through expo-web-browser's proxy activity.
  // The proxy's browser task outlives a successful sign-in, so the next sign-in only brought that stale
  // task forward and bounced straight back without opening Google.
  const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/auth/google/redirect?${query}`, returnTo, { useProxyActivity: false });
  if (result.type !== "success") return null;

  const { queryParams = {} } = Linking.parse(result.url);
  if (queryParams.cancelled) return null;
  if (queryParams.error || !queryParams.code) {
    throw new ApiError(String(queryParams.error || "Google sign-in didn’t finish. Please try again."));
  }
  return api("/auth/google/exchange", { method: "POST", body: { code: String(queryParams.code), code_verifier: verifier } });
}
