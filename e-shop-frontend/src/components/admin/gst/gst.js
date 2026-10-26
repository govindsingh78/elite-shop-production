import { apiUrl } from "../../common/http";
import { portalConfig, portalToken } from "../portal";

const apiOrigin = apiUrl.replace(/\/api\/?$/, "");

/** The usual GST rates, as offered in the forms. */
export const GST_RATES = [0, 3, 5, 12, 18, 28, 40];

/** An invoice's printable page: a signed link that opens without signing in (Print / Save as PDF there). */
export const invoiceUrl = (invoice) => `${apiOrigin}${invoice.print_url}`;

/** This month as YYYY-MM, for the month pickers. */
export const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

/** Calls the API as the signed-in admin or seller. 422 errors come back as `error.fields`. */
export async function gstRequest(portal, path, { method = "GET", body } = {}) {
  const token = portalToken(portal);
  if (!token) throw new Error(portalConfig(portal).sessionExpired);
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong. Please try again.");
    error.fields = Object.fromEntries(Object.entries(data.errors || {}).map(([field, messages]) => [field, messages[0]]));
    throw error;
  }
  return data;
}

/** Downloads a month's GST report (every invoice line, as a CSV spreadsheet). */
export async function downloadGstReport(portal, month) {
  const response = await fetch(`${apiUrl}/${portalConfig(portal).api}/gst/report?month=${month}`, {
    headers: { Accept: "text/csv", Authorization: `Bearer ${portalToken(portal) || ""}` },
  });
  if (!response.ok) throw new Error("We couldn’t prepare the report. Please try again.");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = `elitezaar-gst-${month}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const GST_KEYS = ["hsn_code", "gst_rate", "gst_rate_high", "gst_threshold"];

const asText = (value) => (value == null || value === "" ? "" : String(Number(value)));

/** A category's or product's GST fields as form values (blank = not set; "5.00" → "5" to match the rate lists). */
export const gstFieldValues = (item = {}) => ({
  hsn_code: item?.hsn_code || "",
  gst_rate: asText(item?.gst_rate),
  gst_rate_high: asText(item?.gst_rate_high),
  gst_threshold: asText(item?.gst_threshold),
});

/** Form values → API fields (blank → null). Only the keys present in `values` are sent. */
export const gstPayload = (values) => Object.fromEntries(Object.entries(values)
  .filter(([key]) => GST_KEYS.includes(key))
  .map(([key, value]) => [key, value === "" ? null : key === "hsn_code" ? value.trim() : Number(value)]));
