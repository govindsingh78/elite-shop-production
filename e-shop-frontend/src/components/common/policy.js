import { useEffect, useState } from "react";
import { apiUrl } from "./http";

/** Store policies come from the API (/api/storefront/policies/...), so the website and app always show the same text. */
export const RETURN_POLICY = "return-refund";
export const RETURN_POLICY_PATH = "/return-refund-policy";
export const TERMS = "terms";
export const TERMS_PATH = "/terms-and-conditions";
export const PRIVACY = "privacy";
export const PRIVACY_PATH = "/privacy-policy";

/** Each policy's page, for links from one policy to another. */
export const POLICY_PATHS = { [RETURN_POLICY]: RETURN_POLICY_PATH, [TERMS]: TERMS_PATH, [PRIVACY]: PRIVACY_PATH };

const cache = new Map();

const fetchPolicy = (slug) => {
  if (!cache.has(slug)) {
    cache.set(slug, fetch(`${apiUrl}/storefront/policies/${slug}`, { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("This policy couldn’t be loaded. Please try again.");
        return response.json();
      })
      .catch((error) => {
        cache.delete(slug);
        throw error;
      }));
  }
  return cache.get(slug);
};

/** { policy, error } — policy is null while loading. */
export const usePolicy = (slug) => {
  const [result, setResult] = useState({ policy: null, error: "" });

  useEffect(() => {
    let active = true;
    fetchPolicy(slug)
      .then((policy) => active && setResult({ policy, error: "" }))
      .catch((error) => active && setResult({ policy: null, error: error.message }));
    return () => { active = false; };
  }, [slug]);

  return result;
};
