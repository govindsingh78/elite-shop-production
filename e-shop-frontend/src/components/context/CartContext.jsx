import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "eshop_cart";

/** One bag line per product and size: the same shirt in M and in L is two lines. */
const lineKey = (productId, sizeId) => (sizeId ? `${productId}:${sizeId}` : String(productId));

const readCart = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    // Bags saved before sizes existed have no line key yet.
    return Array.isArray(value) ? value.map((item) => ({ ...item, key: item.key || lineKey(item.id, item.size_id) })) : [];
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

  /** `size` is one of the product's sizes ({size_id, name, qty}) for products sold in sizes. */
  const addItem = useCallback((product, quantity = 1, size = null) => {
    const key = lineKey(product.id, size?.size_id);
    const available = size ? size.qty : product.qty;
    persist((() => {
      const current = readCart();
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) => item.key === key
          ? { ...item, quantity: Math.min(999, item.quantity + quantity) }
          : item);
      }
      return [...current, {
        key,
        id: product.id,
        slug: product.slug || null,
        title: product.title,
        price: Number(product.price),
        image: product.image || null,
        sku: product.sku || "",
        size_id: size?.size_id ?? null,
        size: size?.name ?? null,
        qtyAvailable: available == null ? null : Number(available),
        quantity: Math.max(1, Math.min(999, quantity)),
      }];
    })());
  }, [persist]);

  const updateQuantity = useCallback((key, quantity) => {
    const safeQuantity = Math.max(1, Math.min(999, Number(quantity) || 1));
    persist(readCart().map((item) => item.key === key ? { ...item, quantity: safeQuantity } : item));
  }, [persist]);

  const removeItem = useCallback((key) => {
    persist(readCart().filter((item) => item.key !== key));
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
