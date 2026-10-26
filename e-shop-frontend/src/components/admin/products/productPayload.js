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
  // Blank = use the category's GST.
  hsn_code: values.hsn_code?.trim() || null,
  gst_rate: values.gst_rate === "" || values.gst_rate == null ? null : Number(values.gst_rate),
});

/** Something to fix before saving, or null. */
export const sizesProblem = (values) => (values.hasSizes && !values.sizes.length ? "Tick at least one size, or switch off “Sold in sizes”." : null);

/** The form's GST fields for a product loaded from the API ("5.00" → "5" to match the rate list). */
export const gstValues = (product) => ({
  hsn_code: product.hsn_code || "",
  gst_rate: product.gst_rate == null ? "" : String(Number(product.gst_rate)),
});

/** The form's size fields for a product loaded from the API. */
export const sizeValues = (product) => ({
  hasSizes: (product.sizes || []).length > 0,
  sizes: (product.sizes || []).map((size) => ({ size_id: size.size_id, qty: size.qty == null ? "" : String(size.qty) })),
});
