/** Delivery tracking statuses, in journey order. Keep in sync with OrderTrackingEvent on the API. */
export const TRACKING_STATUSES = {
  order_placed: { label: "Order placed", note: "Order received." },
  confirmed: { label: "Order confirmed", note: "Order confirmed and being prepared." },
  packed: { label: "Packed", note: "Items packed and ready for dispatch." },
  dispatched: { label: "Dispatched", note: "Handed over to the courier." },
  in_transit: { label: "In transit", note: "Shipment is on its way." },
  out_for_delivery: { label: "Out for delivery", note: "Out for delivery with our courier partner." },
  delivery_attempted: { label: "Delivery attempted", note: "We tried to deliver but couldn't reach you. We'll try again." },
  delivered: { label: "Delivered", note: "Delivered. Enjoy your purchase!" },
  cancelled: { label: "Cancelled", note: "Order cancelled." },
};

/** The five milestones shown on the customer's progress bar. */
export const MILESTONES = [
  { label: "Order placed", statuses: ["order_placed"] },
  { label: "Packed", statuses: ["confirmed", "packed"] },
  { label: "Dispatched", statuses: ["dispatched", "in_transit"] },
  { label: "Out for delivery", statuses: ["out_for_delivery", "delivery_attempted"] },
  { label: "Delivered", statuses: ["delivered"] },
];

export const trackingLabel = (status) => TRACKING_STATUSES[status]?.label || status;

export const milestoneIndex = (status) => MILESTONES.findIndex((milestone) => milestone.statuses.includes(status));

const ORDER_STATUS_MILESTONE = { pending: 0, processing: 1, shipped: 2, delivered: 4 };

/** Furthest milestone reached, judged by both the latest tracking event and the order status. */
export const currentMilestone = (order) => {
  const latest = order?.tracking_events?.[0];
  return Math.max(latest ? milestoneIndex(latest.status) : 0, ORDER_STATUS_MILESTONE[order?.status] ?? 0);
};

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const timeAgo = (value) => {
  if (!value) return "";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const units = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
};

/** The newest event that names a place, i.e. where the parcel was last seen. */
export const lastKnownLocation = (events = []) => events.find((event) => event.location)?.location || "";
