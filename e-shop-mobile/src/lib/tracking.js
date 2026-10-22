/** Delivery tracking statuses, in journey order. Keep in sync with OrderTrackingEvent on the API. */
export const TRACKING_STATUSES = {
  order_placed: { label: "Order placed", note: "Order received.", icon: "receipt-outline" },
  confirmed: { label: "Order confirmed", note: "Order confirmed and being prepared.", icon: "checkmark-circle-outline" },
  packed: { label: "Packed", note: "Items packed and ready for dispatch.", icon: "cube-outline" },
  dispatched: { label: "Dispatched", note: "Handed over to the courier.", icon: "paper-plane-outline" },
  in_transit: { label: "In transit", note: "Shipment is on its way.", icon: "car-outline" },
  out_for_delivery: { label: "Out for delivery", note: "Out for delivery with our courier partner.", icon: "bicycle-outline" },
  delivery_attempted: { label: "Delivery attempted", note: "We tried to deliver but couldn't reach you. We'll try again.", icon: "alert-circle-outline" },
  delivered: { label: "Delivered", note: "Delivered. Enjoy your purchase!", icon: "home-outline" },
  cancelled: { label: "Cancelled", note: "Order cancelled.", icon: "close-circle-outline" },
};

export const TRACKING_STATUS_KEYS = Object.keys(TRACKING_STATUSES);

/** The five milestones shown on the customer's progress bar. */
export const MILESTONES = [
  { label: "Placed", statuses: ["order_placed"] },
  { label: "Packed", statuses: ["confirmed", "packed"] },
  { label: "Dispatched", statuses: ["dispatched", "in_transit"] },
  { label: "Out for delivery", statuses: ["out_for_delivery", "delivery_attempted"] },
  { label: "Delivered", statuses: ["delivered"] },
];

export const trackingLabel = (status) => TRACKING_STATUSES[status]?.label || status;

const milestoneIndex = (status) => MILESTONES.findIndex((milestone) => milestone.statuses.includes(status));
const ORDER_STATUS_MILESTONE = { pending: 0, processing: 1, shipped: 2, delivered: 4 };

/** Furthest milestone reached, judged by both the latest tracking event and the order status. */
export const currentMilestone = (order) => {
  const latest = order?.tracking_events?.[0];
  return Math.max(latest ? milestoneIndex(latest.status) : 0, ORDER_STATUS_MILESTONE[order?.status] ?? 0);
};

/** The newest event that names a place, i.e. where the parcel was last seen. */
export const lastKnownLocation = (events = []) => events.find((event) => event.location)?.location || "";
