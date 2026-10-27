import { apiUrl } from "./http";

/** Offers (live, listed coupons) covering any of these products. */
export async function fetchOffers(productIds) {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return [];
  const response = await fetch(`${apiUrl}/storefront/coupons?products=${ids.join(",")}`, { headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  return (await response.json()).offers || [];
}

/**
 * Whether a code works for these bag items, and how much it takes off. Errors carry the reason the API gave
 * ("Add ₹500.00 more to use this code…"). With a customer token, per-customer limits use the account.
 */
export async function checkCoupon(code, items, { email, token } = {}) {
  let response;
  try {
    response = await fetch(`${apiUrl}/storefront/coupons/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        code,
        customer_email: email || null,
        items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      }),
    });
  } catch {
    throw new Error("We can’t reach the store right now. Please try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.errors?.coupon_code?.[0] || data.errors?.code?.[0] || data.message || "That code didn’t work.");
  return data;
}

const SAVED_KEY = "ez_coupon";

/** The code a shopper last copied from an offer, which checkout applies for them. */
export const savedCode = () => {
  try {
    return localStorage.getItem(SAVED_KEY) || "";
  } catch {
    return "";
  }
};

export const saveCode = (code) => {
  try {
    if (code) localStorage.setItem(SAVED_KEY, code);
    else localStorage.removeItem(SAVED_KEY);
  } catch {
    // Not remembered; the shopper can still type it.
  }
};

/** Copies text; true when it worked. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Copies a code, and remembers it for checkout. */
export const copyCode = (code) => {
  saveCode(code);
  return copyText(code);
};
