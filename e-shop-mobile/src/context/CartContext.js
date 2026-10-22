import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readJson, writeJson } from "@/lib/storage";

const CART_KEY = "elitezaar.cart";
const CartContext = createContext(null);

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
      const valid = Array.isArray(stored) ? stored : [];
      itemsRef.current = valid;
      setItems(valid);
    });
  }, []);

  const persist = useCallback((next) => {
    itemsRef.current = next;
    setItems(next);
    writeJson(CART_KEY, next);
  }, []);

  const addItem = useCallback((product, quantity = 1) => {
    const available = product.qty == null ? null : Number(product.qty);
    const current = itemsRef.current;
    const existing = current.find((item) => item.id === product.id);
    persist(existing
      ? current.map((item) => (item.id === product.id ? { ...item, quantity: clampQuantity(item.quantity + quantity, available), qtyAvailable: available } : item))
      : [...current, {
        id: product.id,
        title: product.title,
        price: Number(product.price),
        image: product.image || null,
        sku: product.sku || "",
        qtyAvailable: available,
        quantity: clampQuantity(quantity, available),
      }]);
  }, [persist]);

  const updateQuantity = useCallback((productId, quantity) => {
    persist(itemsRef.current.map((item) => (item.id === productId ? { ...item, quantity: clampQuantity(quantity, item.qtyAvailable) } : item)));
  }, [persist]);

  const removeItem = useCallback((productId) => persist(itemsRef.current.filter((item) => item.id !== productId)), [persist]);
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
