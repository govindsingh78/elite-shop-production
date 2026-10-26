import { GOOGLE_RETURN_PATH } from "@/lib/googleSignIn";

/**
 * Website pages whose app screen lives at a different path. Others match as they are: /about, and
 * /product/classic-linen-shirt (the product screen loads products by their web address or id).
 */
const WEB_TO_APP = [
  [/^\/shop\/([^/]+)\/?$/, (match, search) => `/shop?${new URLSearchParams({ ...Object.fromEntries(search), category: decodeURIComponent(match[1]) })}`],
  [/^\/terms-and-conditions\/?$/, () => "/terms"],
  [/^\/return-refund-policy\/?$/, () => "/return-policy"],
  [/^\/privacy-policy\/?$/, () => "/privacy"],
];

/**
 * Deep links pass through here before the router sees them.
 * - Google sign-in returns on elitezaar://auth/google?… (exp://…/--/auth/google?… in Expo Go), which the
 *   sign-in screen's browser session reads itself. It isn't a screen, so the router ignores it.
 * - Links to the website (https://elitezaar.com/…, see android.intentFilters in app.json) open the
 *   matching app screen.
 */
export function redirectSystemPath({ path }) {
  try {
    const target = String(path).split(/[?#]/)[0].replace(/\/+$/, "");
    if (target === GOOGLE_RETURN_PATH || target.endsWith(`/${GOOGLE_RETURN_PATH}`)) return null;

    if (/^https?:\/\//i.test(path)) {
      const url = new URL(path);
      if (/(^|\.)elitezaar\.com$/i.test(url.hostname)) {
        for (const [pattern, toApp] of WEB_TO_APP) {
          const match = url.pathname.match(pattern);
          if (match) return toApp(match, url.searchParams);
        }
        return `${url.pathname}${url.search}`;
      }
    }
  } catch {
    // Never fail a link here; let the router handle it as it is.
  }
  return path;
}
