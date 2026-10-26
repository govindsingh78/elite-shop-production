/** A seller account's standing, as the admin sees it (`short` reads inside a sentence). */
export const SELLER_STATUSES = {
  pending: { label: "Awaiting approval", short: "awaiting approval" },
  approved: { label: "Active", short: "active" },
  rejected: { label: "Declined", short: "declined" },
  deactivated: { label: "Deactivated", short: "deactivated" },
};

/** Tabs on the sellers page, in order; `count` is the key in the API's counts. "All" lists applications first. */
export const SELLER_TABS = [
  { key: "", label: "All sellers", count: "all" },
  { key: "pending", label: "Awaiting approval", count: "pending" },
  { key: "approved", label: "Active", count: "approved" },
  { key: "deactivated", label: "Deactivated", count: "deactivated" },
  { key: "rejected", label: "Declined", count: "rejected" },
];

/** Products from a seller who isn't approved stay out of the store. */
export const sellerIsInactive = (status) => Boolean(status) && status !== "approved";

/**
 * What the admin can do with a seller in each status. `status` is what the action changes it to; actions that
 * need a reason ask for one (the seller sees it).
 */
export const sellerActions = (status) => ({
  pending: [
    { status: "approved", label: "Approve", tone: "primary" },
    { status: "rejected", label: "Decline", tone: "danger", reason: "Why are you declining this application?" },
  ],
  approved: [{ status: "deactivated", label: "Deactivate", tone: "danger", reason: "Why are you deactivating this seller?" }],
  deactivated: [{ status: "approved", label: "Reactivate", tone: "primary" }],
  rejected: [{ status: "approved", label: "Approve", tone: "primary" }],
}[status] || []);
