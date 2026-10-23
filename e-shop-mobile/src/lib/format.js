const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rupeesShort = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatPrice = (amount) => rupees.format(Number(amount) || 0);
export const formatPriceShort = (amount) => rupeesShort.format(Number(amount) || 0);

export const discountOf = (product) => {
  const price = Number(product?.price || 0);
  const compare = Number(product?.compare_price || 0);
  return compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
};

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export const timeAgo = (value) => {
  if (!value) return "";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const units = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
    }
  }
  return "";
};

export const firstName = (name = "") => name.trim().split(/\s+/)[0] || "there";

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "EZ";

export const ORDER_STATUSES = {
  pending: { label: "Pending", color: "#9a6512", background: "#fdf3e1" },
  processing: { label: "Processing", color: "#245f86", background: "#e6f1f8" },
  shipped: { label: "Shipped", color: "#5b43a6", background: "#efeafb" },
  delivered: { label: "Delivered", color: "#22774b", background: "#e5f4ec" },
  cancelled: { label: "Cancelled", color: "#a63d2f", background: "#fbe9e6" },
};

export const PAYMENT_STATUSES = {
  unpaid: { label: "Unpaid", color: "#9a6512", background: "#fdf3e1" },
  paid: { label: "Paid", color: "#22774b", background: "#e5f4ec" },
  refunded: { label: "Refunded", color: "#245f86", background: "#e6f1f8" },
  failed: { label: "Failed", color: "#a63d2f", background: "#fbe9e6" },
};

/** Seller listings wait for an admin review before shoppers can see them. */
export const APPROVAL_STATUSES = {
  pending: { label: "In review", color: "#9a6512", background: "#fdf3e1" },
  approved: { label: "Approved", color: "#22774b", background: "#e5f4ec" },
  rejected: { label: "Rejected", color: "#a63d2f", background: "#fbe9e6" },
};

export const paymentMethodLabel =(method) => (method === "razorpay" ? "Online (UPI / net banking)" : "Cash on delivery");
