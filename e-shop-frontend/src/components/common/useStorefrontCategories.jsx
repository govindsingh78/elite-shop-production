import { createContext, useContext, useEffect, useState } from "react";
import { apiUrl } from "./http";

const CACHE_KEY = "storefrontCategories";
const CACHE_TTL = 5 * 60 * 1000;
const StorefrontCategoriesContext = createContext({ categories: [], loading: true });

export const StorefrontCategoriesProvider = ({ children }) => {
  const [categories, setCategories] = useState(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.items)) {
        return cached.items;
      }
    } catch {
      sessionStorage.removeItem(CACHE_KEY);
    }
    return [];
  });
  const [loading, setLoading] = useState(categories.length === 0);

  useEffect(() => {
    const controller = new AbortController();
    const loadCategories = async () => {
      try {
        const response = await fetch(`${apiUrl}/storefront/categories`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load categories.");
        const data = await response.json();
        const activeCategories = Array.isArray(data)
          ? data.map((category) => ({
              ...category,
              slug: category.slug || String(category.name || "category")
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
            }))
          : [];
        setCategories(activeCategories);
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items: activeCategories }));
      } catch (error) {
        if (error.name !== "AbortError") {
          // Keep the last cached category list if the API is temporarily unavailable.
          console.error("Unable to load storefront categories:", error);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadCategories();
    return () => controller.abort();
  }, []);

  return (
    <StorefrontCategoriesContext.Provider value={{ categories, loading }}>
      {children}
    </StorefrontCategoriesContext.Provider>
  );
};

export const useStorefrontCategories = () => useContext(StorefrontCategoriesContext);
