import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readJson, writeJson } from "@/lib/storage";

const CART_KEY = "elitezaar.cart";
const CartContext = createContext(null);

/** One bag line per product and size: the same shirt in M and in L is two lines. */
const lineKey = (productId, sizeId) => (sizeId ? `${productId}:${sizeId}` : String(productId));

const clampQuantity = (quantity, available) => {
  const max = available == null ? 999 : Math.max(1, Math.min(999, available));
  return Math.max(1, Math.min(max, Number(quantity) || 1));
};

/** The shopping bag, kept on the device between launches. Prices are re-checked by the API at checkout. */
export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  const itemsRef = useRef([]);

  useEffect(() => {
    readJson(CART_KEY, []).then((stored) => {
      // Bags saved before sizes existed have no line key yet.
      const valid = (Array.isArray(stored) ? stored : []).map((item) => ({ ...item, key: item.key || lineKey(item.id, item.size_id) }));
      itemsRef.current = valid;
      setItems(valid);
    });
  }, []);

  const persist = useCallback((next) => {
    itemsRef.current = next;
    setItems(next);
    writeJson(CART_KEY, next);
  }, []);

  /** `size` is one of the product's sizes ({size_id, name, qty}) for products sold in sizes. */
  const addItem = useCallback((product, quantity = 1, size = null) => {
    const key = lineKey(product.id, size?.size_id);
    const stock = size ? size.qty : product.qty;
    const available = stock == null ? null : Number(stock);
    const current = itemsRef.current;
    const existing = current.find((item) => item.key === key);
    persist(existing
      ? current.map((item) => (item.key === key ? { ...item, quantity: clampQuantity(item.quantity + quantity, available), qtyAvailable: available } : item))
      : [...current, {
        key,
        id: product.id,
        title: product.title,
        price: Number(product.price),
        image: product.image || null,
        sku: product.sku || "",
        size_id: size?.size_id ?? null,
        size: size?.name ?? null,
        qtyAvailable: available,
        quantity: clampQuantity(quantity, available),
      }]);
  }, [persist]);

  const updateQuantity = useCallback((key, quantity) => {
    persist(itemsRef.current.map((item) => (item.key === key ? { ...item, quantity: clampQuantity(quantity, item.qtyAvailable) } : item)));
  }, [persist]);

  const removeItem = useCallback((key) => persist(itemsRef.current.filter((item) => item.key !== key)), [persist]);
  const clearCart = useCallback(() => persist([]), [persist]);

  const value = useMemo(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    // The order just placed, for the confirmation screen (guests cannot fetch orders by id).
    lastOrder,
    setLastOrder,
  }), [items, addItem, updateQuantity, removeItem, clearCart, lastOrder]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
};
