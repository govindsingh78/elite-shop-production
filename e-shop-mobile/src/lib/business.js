import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";

/** Where shoppers can look up a GSTIN on the government's GST portal. */
export const GST_SEARCH_URL = "https://services.gst.gov.in/services/searchtp";

let request = null;

/**
 * The business behind the store ({ legal_name, gstin, state, address }), as set in Admin › GST & invoices.
 * Loaded once while the app is open; null if the API can't be reached.
 */
export function loadBusiness() {
  request ||= api("/storefront/business")
    .then((data) => data.business || null)
    .catch(() => null)
    .then((business) => {
      // Try again next time if this one failed.
      if (!business) request = null;
      return business;
    });
  return request;
}

export const useBusiness = () => useLoad(loadBusiness, []).data;
