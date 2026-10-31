import { apiUrl } from "./http";

const imageBase = apiUrl.replace(/\/api\/?$/, "");

/** A product's photo at "small" or "large", or null if it hasn't got one. */
export const productImage = (product, size = "small") => (product?.image ? `${imageBase}/uploads/products/${size}/${encodeURIComponent(product.image)}` : null);

/**
 * A product's web address: its readable name, e.g. /product/classic-linen-shirt. Anything saved before
 * products had names (an old bag, say) falls back to the id, which the product page moves on to the name.
 */
export const productPath = (product) => `/product/${product?.slug || product?.id}`;

/** The address of an ordered item's product, from its order line. */
export const orderItemPath = (item) => productPath({ slug: item.product?.slug, id: item.product_id });
