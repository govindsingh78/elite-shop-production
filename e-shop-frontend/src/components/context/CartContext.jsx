import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "eshop_cart";

const readCart = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(readCart);

  const persist = useCallback((nextItems) => {
    setItems(nextItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  }, []);

  const addItem = useCallback((product, quantity = 1) => {
    persist((() => {
      const current = readCart();
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id
          ? { ...item, quantity: Math.min(999, item.quantity + quantity) }
          : item);
      }
      return [...current, {
        id: product.id,
        title: product.title,
        price: Number(product.price),
        image: product.image || null,
        sku: product.sku || "",
        qtyAvailable: product.qty == null ? null : Number(product.qty),
        quantity: Math.max(1, Math.min(999, quantity)),
      }];
    })());
  }, [persist]);

  const updateQuantity = useCallback((productId, quantity) => {
    const safeQuantity = Math.max(1, Math.min(999, Number(quantity) || 1));
    persist(readCart().map((item) => item.id === productId ? { ...item, quantity: safeQuantity } : item));
  }, [persist]);

  const removeItem = useCallback((productId) => {
    persist(readCart().filter((item) => item.id !== productId));
  }, [persist]);

  const clearCart = useCallback(() => persist([]), [persist]);

  const value = useMemo(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  }), [items, addItem, updateQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider.");
  return context;
};
