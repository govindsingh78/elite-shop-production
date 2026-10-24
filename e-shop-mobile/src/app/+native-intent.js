import { GOOGLE_RETURN_PATH } from "@/lib/googleSignIn";

/**
 * Deep links pass through here before the router sees them. Google sign-in returns on
 * elitezaar://auth/google?… (exp://…/--/auth/google?… in Expo Go), which the sign-in screen's browser
 * session reads itself. It isn't a screen, so the router must ignore it rather than show "page not found".
 */
export function redirectSystemPath({ path }) {
  const target = String(path).split(/[?#]/)[0].replace(/\/+$/, "");
  if (target === GOOGLE_RETURN_PATH || target.endsWith(`/${GOOGLE_RETURN_PATH}`)) return null;
  return path;
}
