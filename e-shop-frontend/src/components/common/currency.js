export const formatPrice = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

/** For showing prices at a glance: ₹1,299 rather than ₹1,299.00, keeping any paise that matter. */
export const formatWholePrice = (amount) => formatPrice(amount).replace(/\.00$/, "");
