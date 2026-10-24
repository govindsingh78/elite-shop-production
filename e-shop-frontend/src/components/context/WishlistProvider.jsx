import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AdminAuthContext } from "./AdminAuth";
import { WishlistContext, toWishlistItem } from "./wishlist";
import { customerRequest } from "../customer/customerApi";

const STORAGE_KEY = "eshop_wishlist";

const readLocal = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const writeLocal = (items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: the list still works for this visit.
  }
};

/**
 * Saved products. Guests keep them in this browser; signed-in customers keep them on their account, shared with the app.
 * Anything saved before signing in is added to the account.
 */
export const WishlistProvider = ({ children }) => {
  const { user } = useContext(AdminAuthContext);
  const isCustomer = user?.portal === "customer";
  const [items, setItems] = useState(readLocal);
  const itemsRef = useRef(items);
  const accountRef = useRef(isCustomer);

  const apply = useCallback((next) => {
    itemsRef.current = next;
    setItems(next);
    if (!accountRef.current) writeLocal(next);
  }, []);

  useEffect(() => {
    accountRef.current = isCustomer;
    if (!isCustomer) {
      apply(readLocal());
      return undefined;
    }
    let active = true;
    customerRequest("wishlist/sync", { method: "POST", body: { product_ids: readLocal().map((item) => item.id) } })
      .then((data) => {
        if (!active) return;
        localStorage.removeItem(STORAGE_KEY);
        apply(data.data || []);
      })
      .catch(() => {
        // Keep showing what we have; saving or removing again will retry.
      });
    return () => { active = false; };
  }, [isCustomer, user?.token, apply]);

  const add = useCallback(async (product) => {
    if (itemsRef.current.some((item) => item.id === product.id)) return;
    apply([toWishlistItem(product), ...itemsRef.current]);
    if (!accountRef.current) return;
    try {
      const data = await customerRequest("wishlist", { method: "POST", body: { product_id: product.id } });
      // The account's copy carries the current price and availability.
      apply(itemsRef.current.map((item) => (item.id === product.id ? data.data : item)));
    } catch (error) {
      apply(itemsRef.current.filter((item) => item.id !== product.id));
      throw error;
    }
  }, [apply]);

  const remove = useCallback(async (productId) => {
    const removed = itemsRef.current.find((item) => item.id === productId);
    if (!removed) return;
    apply(itemsRef.current.filter((item) => item.id !== productId));
    if (!accountRef.current) return;
    try {
      await customerRequest(`wishlist/${productId}`, { method: "DELETE" });
    } catch (error) {
      apply([removed, ...itemsRef.current]);
      throw error;
    }
  }, [apply]);

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
};
