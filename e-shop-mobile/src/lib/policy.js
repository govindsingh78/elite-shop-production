import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Store policies come from the API (/api/storefront/policies/...), so the app and website always show the same text. */
export const RETURN_POLICY = "return-refund";
export const TERMS = "terms";
export const PRIVACY = "privacy";

/** Each policy's screen, for links from one policy to another. */
export const POLICY_ROUTES = { [RETURN_POLICY]: "/return-policy", [TERMS]: "/terms", [PRIVACY]: "/privacy" };

const cache = new Map();

function fetchPolicy(slug) {
  if (!cache.has(slug)) {
    cache.set(slug, api(`/storefront/policies/${slug}`).catch((error) => {
      cache.delete(slug);
      throw error;
    }));
  }
  return cache.get(slug);
}

/** { policy, error } — policy is null while loading. */
export function usePolicy(slug) {
  const [result, setResult] = useState({ policy: null, error: "" });

  useEffect(() => {
    let active = true;
    fetchPolicy(slug)
      .then((policy) => active && setResult({ policy, error: "" }))
      .catch((error) => active && setResult({ policy: null, error: error.message }));
    return () => { active = false; };
  }, [slug]);

  return result;
}
