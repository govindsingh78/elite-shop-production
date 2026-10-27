/** A category request's status as sellers and admins see it; `tone` picks the badge colour (see .seller-status). */
export const REQUEST_STATUSES = {
  pending: { label: "Waiting", tone: "pending" },
  approved: { label: "Added", tone: "approved" },
  declined: { label: "Not added", tone: "rejected" },
};

/** Tabs on the admin page, in order; `key` is also the key in the API's counts. */
export const REQUEST_TABS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Added" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

/** How many a seller can ask for on the sign-up form (more later, from the seller hub). */
export const AT_SIGN_UP = 3;

export const emptyRequest = () => ({ name: "", parent_id: "", note: "" });

/** One request as the API takes it. */
export const requestPayload = ({ name, parent_id: parentId, note }) => ({
  name: name.trim(),
  parent_id: parentId ? Number(parentId) : null,
  note: note.trim() || null,
});

/** "Footwear under Kids", or "Footwear (a new main collection)". */
export const requestPlace = (request) => (request.parent_name ? `under ${request.parent_name}` : "a new main collection");
