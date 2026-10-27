import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const SAVED_KEY = "elitezaar.coupon";

/** Offers (live, listed coupons) covering any of these products. */
export async function fetchOffers(productIds) {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (!ids.length) return [];
  try {
    return (await api("/storefront/coupons", { query: { products: ids.join(",") } })).offers || [];
  } catch {
    return [];
  }
}

/**
 * Whether a code works for these bag items, and how much it takes off. Errors carry the reason the API gave. With a
 * customer token, per-customer limits use the account.
 */
export async function checkCoupon(code, items, { email, token } = {}) {
  try {
    return await api("/storefront/coupons/check", {
      method: "POST",
      token,
      body: { code, customer_email: email || null, items: items.map((item) => ({ product_id: item.id, quantity: item.quantity })) },
    });
  } catch (error) {
    error.message = error.fieldErrors?.coupon_code || error.fieldErrors?.code || error.message;
    throw error;
  }
}

/** The code a shopper last tapped on a product's offers, which checkout applies for them. */
export const savedCode = () => AsyncStorage.getItem(SAVED_KEY).then((code) => code || "").catch(() => "");

export const saveCode = (code) => (code ? AsyncStorage.setItem(SAVED_KEY, code) : AsyncStorage.removeItem(SAVED_KEY)).catch(() => {});
