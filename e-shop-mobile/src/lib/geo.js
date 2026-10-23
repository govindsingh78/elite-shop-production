import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Country → state → city lists from the API (/api/geo/...), each fetched once while the app is open. */
const cache = new Map();

export function fetchGeo(path) {
  if (!cache.has(path)) {
    // A failed request is dropped from the cache so the next attempt tries again.
    cache.set(path, api(`/geo/${path}`).catch((error) => {
      cache.delete(path);
      throw error;
    }));
  }
  return cache.get(path);
}

/** One geo list; `path` null means "nothing to load yet". */
export function useGeoList(path) {
  const [result, setResult] = useState({ path: null, items: [], error: "" });

  useEffect(() => {
    if (!path) return undefined;
    let active = true;
    fetchGeo(path)
      .then((items) => active && setResult({ path, items, error: "" }))
      .catch((error) => active && setResult({ path, items: [], error: error.message }));
    return () => { active = false; };
  }, [path]);

  const current = Boolean(path) && result.path === path;
  return { loading: Boolean(path) && !current, items: current ? result.items : [], error: current ? result.error : "" };
}

export const DEFAULT_COUNTRY = "India";

/** The "Not listed — type it" choice in state and city pickers. */
export const OTHER = "__other__";

/** Addresses store names, so match a saved name (or a country code) back to its list entry. */
export const findByName = (items, name) => {
  const wanted = String(name || "").trim().toLowerCase();
  return wanted ? items.find((item) => item.name.toLowerCase() === wanted || item.code?.toLowerCase() === wanted) : undefined;
};

export const postalLabel = (country) => (!country || String(country).trim().toLowerCase() === "india" ? "PIN code" : "Postal / ZIP code");
