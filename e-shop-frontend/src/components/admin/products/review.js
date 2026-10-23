import { apiUrl } from "../../common/http";
import { portalToken } from "../portal";

/** Seller listings wait for an admin review before shoppers can see them. */
export const APPROVAL = {
  pending: { label: "In review", badge: "bg-warning-subtle text-warning-emphasis border border-warning-subtle" },
  approved: { label: "Approved", badge: "bg-success-subtle text-success-emphasis border border-success-subtle" },
  rejected: { label: "Rejected", badge: "bg-danger-subtle text-danger-emphasis border border-danger-subtle" },
};

/** Admin decision on a listing: "approved", or "rejected" with a note the seller will see. */
export const reviewProduct = async (productId, decision, note = "") => {
  const response = await fetch(`${apiUrl}/admin/products/${productId}/review`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${portalToken("admin") || ""}` },
    body: JSON.stringify({ decision, note: note.trim() || null }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.errors?.note?.[0] || data.message || "Unable to save the review.");
  return data;
};
