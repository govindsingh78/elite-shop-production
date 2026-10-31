/** Laravel API base URL, e.g. http://13.55.216.53/api. Set EXPO_PUBLIC_API_URL in .env. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://13.55.216.53/api").replace(/\/+$/, "");

/** Uploaded product images are served from the site root, next to /api. */
export const SITE_URL = API_URL.replace(/\/api$/, "");

export const productImageUrl = (image, size = "small") =>
  image ? `${SITE_URL}/uploads/products/${size}/${encodeURIComponent(image)}` : null;

/** A category's banner photo, or null if it hasn't got one. */
export const categoryBannerUrl = (banner) => (banner ? `${SITE_URL}/uploads/categories/${encodeURIComponent(banner)}` : null);

export const BRAND = {
  name: "Elitezaar",
  domain: "elitezaar.com",
  slogan: "Everyday, elevated.",
  supportEmail: "support@elitezaar.com",
  // Helpline for customers and sellers.
  supportPhones: [
    { label: "+91 70734 44156", tel: "+917073444156" },
    { label: "+91 87699 70222", tel: "+918769970222" },
  ],
};
