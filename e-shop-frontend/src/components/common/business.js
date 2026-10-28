import { useEffect, useState } from "react";
import { apiUrl } from "./http";

/** Where shoppers can look up a GSTIN on the government's GST portal. */
export const GST_SEARCH_URL = "https://services.gst.gov.in/services/searchtp";

let request = null;

/**
 * The business behind the store ({ legal_name, gstin, state, address }), as set in Admin › GST & invoices.
 * Loaded once per visit; null if the API can't be reached.
 */
export const loadBusiness = () => {
  request ||= fetch(`${apiUrl}/storefront/business`, { headers: { Accept: "application/json" } })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => data?.business || null)
    .catch(() => null)
    .then((business) => {
      // Try again on the next page if this one failed.
      if (!business) request = null;
      return business;
    });
  return request;
};

export const useBusiness = () => {
  const [business, setBusiness] = useState(null);
  useEffect(() => {
    let active = true;
    loadBusiness().then((details) => active && setBusiness(details));
    return () => { active = false; };
  }, []);
  return business;
};
