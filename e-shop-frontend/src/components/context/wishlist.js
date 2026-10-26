import { createContext, useContext } from "react";

export const WishlistContext = createContext(null);

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider.");
  return context;
};

/** The product fields a saved item keeps, shaped like a storefront product so it can be shown as a product card. */
export const toWishlistItem = (product) => ({
  id: product.id,
  title: product.title,
  slug: product.slug || null,
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
