import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { readJson, writeJson } from "@/lib/storage";

const WISHLIST_KEY = "elitezaar.wishlist";
const WishlistContext = createContext(null);

/** The product fields a saved item keeps, shaped like a storefront product so it can be shown as a product card. */
export const toWishlistItem = (product) => ({
  id: product.id,
  title: product.title,
  price: product.price,
  compare_price: product.compare_price ?? null,
  image: product.image || null,
  sku: product.sku || "",
  qty: product.qty ?? null,
  sizes: product.sizes || [],
  brand: product.brand?.name ? { name: product.brand.name } : null,
  category: product.category?.name ? { name: product.category.name, slug: product.category.slug } : null,
  available: product.available ?? true,
});

/**
 * Saved products. Guests keep them on this phone; signed-in customers keep them on their account, shared with the website.
 * Anything saved before signing in is added to the account.
 */
export function WishlistProvider({ children }) {
  const { isCustomer, request, session } = useAuth();
  const token = session?.token;
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  const accountRef = useRef(false);

  const apply = useCallback((next) => {
    itemsRef.current = next;
    setItems(next);
    if (!accountRef.current) writeJson(WISHLIST_KEY, next);
  }, []);

  useEffect(() => {
    accountRef.current = isCustomer;
    let active = true;
    readJson(WISHLIST_KEY, []).then(async (stored) => {
      const local = Array.isArray(stored) ? stored : [];
      if (!active) return;
      if (!isCustomer) {
        apply(local);
        return;
      }
      try {
        const data = await request("/customer/wishlist/sync", { method: "POST", body: { product_ids: local.map((item) => item.id) } });
        if (!active) return;
        writeJson(WISHLIST_KEY, []);
        apply(data.data || []);
      } catch {
        // Keep showing what we have; saving or removing again will retry.
      }
    });
    return () => { active = false; };
  }, [isCustomer, token, request, apply]);

  const add = useCallback(async (product) => {
    if (itemsRef.current.some((item) => item.id === product.id)) return;
    apply([toWishlistItem(product), ...itemsRef.current]);
    if (!accountRef.current) return;
    try {
      const data = await request("/customer/wishlist", { method: "POST", body: { product_id: product.id } });
      // The account's copy carries the current price and availability.
      apply(itemsRef.current.map((item) => (item.id === product.id ? data.data : item)));
    } catch (error) {
      apply(itemsRef.current.filter((item) => item.id !== product.id));
      throw error;
    }
  }, [apply, request]);

  const remove = useCallback(async (productId) => {
    const removed = itemsRef.current.find((item) => item.id === productId);
    if (!removed) return;
    apply(itemsRef.current.filter((item) => item.id !== productId));
    if (!accountRef.current) return;
    try {
      await request(`/customer/wishlist/${productId}`, { method: "DELETE" });
    } catch (error) {
      apply([removed, ...itemsRef.current]);
      throw error;
    }
  }, [apply, request]);

  /** Saves or un-saves a product; resolves to true when it is now saved. */
  const toggle = useCallback(async (product) => {
    if (itemsRef.current.some((item) => item.id === product.id)) {
      await remove(product.id);
      return false;
    }
    await add(product);
    return true;
  }, [add, remove]);

  const value = useMemo(() => {
    const saved = new Set(items.map((item) => item.id));
    return { items, count: items.length, isSaved: (productId) => saved.has(productId), add, remove, toggle };
  }, [items, add, remove, toggle]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider.");
  return context;
};
