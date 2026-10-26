/** The product form's values as the API expects them. Shared by the create and edit pages. */
export const productPayload = ({ hasSizes, ...values }) => ({
  ...values,
  price: Number(values.price),
  compare_price: values.compare_price === "" ? null : Number(values.compare_price),
  category_id: Number(values.category_id),
  brand_id: Number(values.brand_id),
  // A product sold in sizes gets its stock from them; an empty size list makes it a one-size product.
  qty: hasSizes || values.qty === "" ? null : Number(values.qty),
  status: Number(values.status),
  gallery: values.gallery.map((image) => image.id),
  sizes: hasSizes ? values.sizes.map(({ size_id: sizeId, qty }) => ({ size_id: sizeId, qty: qty === "" ? null : Number(qty) })) : [],
});

/** Something to fix before saving, or null. */
export const sizesProblem = (values) => (values.hasSizes && !values.sizes.length ? "Tick at least one size, or switch off “Sold in sizes”." : null);

/** The form's size fields for a product loaded from the API. */
export const sizeValues = (product) => ({
  hasSizes: (product.sizes || []).length > 0,
  sizes: (product.sizes || []).map((size) => ({ size_id: size.size_id, qty: size.qty == null ? "" : String(size.qty) })),
});
