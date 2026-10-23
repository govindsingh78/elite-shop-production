import { apiUrl } from "./http";

/** Country → state → city lists from the API (/api/geo/...), each fetched once per page load. */
const cache = new Map();

export const fetchGeo = (path) => {
  if (!cache.has(path)) {
    cache.set(path, fetch(`${apiUrl}/geo/${path}`, { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load locations.");
        return response.json();
      })
      .catch((error) => {
        // Let the next attempt try again instead of caching the failure.
        cache.delete(path);
        throw error;
      }));
  }
  return cache.get(path);
};

export const DEFAULT_COUNTRY = "India";

/** Addresses store names, so match a saved name (or a country code) back to its list entry. */
export const findByName = (items, name) => {
  const wanted = String(name || "").trim().toLowerCase();
  return wanted ? items.find((item) => item.name.toLowerCase() === wanted || item.code?.toLowerCase() === wanted) : undefined;
};

export const postalLabel = (country) => (!country || String(country).trim().toLowerCase() === "india" ? "PIN code" : "Postal / ZIP code");
