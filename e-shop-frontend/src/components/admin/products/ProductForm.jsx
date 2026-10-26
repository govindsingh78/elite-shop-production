import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../../common/http";
import { portalConfig, portalToken } from "../portal";
import GstFields from "../gst/GstFields";

const apiOrigin = apiUrl.replace(/\/api\/?$/, "");

const ProductForm = ({
  portal = "admin",
  values,
  setValues,
  categories,
  brands,
  sizeOptions = [],
  onSubmit,
  errors = {},
  loading,
  submitLabel,
  // Saving isn't possible (a seller waiting for approval, or deactivated); the page says why.
  blocked = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setUploading(true);
    setUploadError("");
    try {
      const token = portalToken(portal);
      if (!token) throw new Error(portalConfig(portal).sessionExpired);

      const uploaded = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append("image", file);
        const response = await fetch(`${apiUrl}/temp-images`, {
          method: "POST",
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `Could not upload ${file.name}.`);
        return {
          id: result.data.id,
          name: result.data.name,
          preview: result.data.original_path ? `${apiOrigin}/${result.data.original_path}` : URL.createObjectURL(file),
        };
      }));

      setValues((current) => ({
        ...current,
        gallery: [...current.gallery, ...uploaded],
      }));
    } catch (error) {
      setUploadError(error.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (imageId) => {
    setValues((current) => ({
      ...current,
      gallery: current.gallery.filter((image) => image.id !== imageId),
    }));
  };

  const fieldError = (name) => errors[name] && <div className="invalid-feedback">{errors[name]}</div>;

  // Sizes: values.sizes holds [{size_id, qty}] for the ticked sizes, kept in the shop's size order.
  const toggleSizes = (event) => {
    const { checked } = event.target;
    setValues((current) => ({ ...current, hasSizes: checked }));
  };
  const toggleSize = (sizeId) => setValues((current) => {
    const ticked = current.sizes.some((row) => row.size_id === sizeId);
    const order = sizeOptions.map((size) => size.id);
    const sizes = ticked ? current.sizes.filter((row) => row.size_id !== sizeId) : [...current.sizes, { size_id: sizeId, qty: "" }];
    return { ...current, sizes: sizes.sort((a, b) => order.indexOf(a.size_id) - order.indexOf(b.size_id)) };
  });
  const setSizeQty = (sizeId, qty) => setValues((current) => ({
    ...current,
    sizes: current.sizes.map((row) => (row.size_id === sizeId ? { ...row, qty } : row)),
  }));
  // Shown in the stock box: the sizes' total, or blank while any size's stock isn't tracked.
  const sizeTotal = values.sizes.some((row) => row.qty === "") ? "" : values.sizes.reduce((sum, row) => sum + Number(row.qty || 0), 0);
  const sizeErrors = [...new Set(Object.entries(errors).filter(([key]) => key === "sizes" || key.startsWith("sizes.")).map(([, message]) => message))];

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="row">
        <div className="col-lg-8">
          <div className="mb-3">
            <label htmlFor="title" className="form-label">Product title</label>
            <input id="title" name="title" className={`form-control ${errors.title ? "is-invalid" : ""}`} value={values.title} onChange={handleChange} maxLength={255} required />
            {fieldError("title")}
          </div>
          <div className="mb-3">
            <label htmlFor="short_description" className="form-label">Short description</label>
            <textarea id="short_description" name="short_description" className={`form-control ${errors.short_description ? "is-invalid" : ""}`} value={values.short_description} onChange={handleChange} rows="2" />
            {fieldError("short_description")}
          </div>
          <div className="mb-3">
            <label htmlFor="description" className="form-label">Description</label>
            <textarea id="description" name="description" className={`form-control ${errors.description ? "is-invalid" : ""}`} value={values.description} onChange={handleChange} rows="5" />
            {fieldError("description")}
          </div>
        </div>
        <div className="col-lg-4">
          <div className="mb-3">
            <label htmlFor="sku" className="form-label">SKU</label>
            <input id="sku" name="sku" className={`form-control ${errors.sku ? "is-invalid" : ""}`} value={values.sku} onChange={handleChange} maxLength={255} required />
            {fieldError("sku")}
          </div>
          <div className="mb-3">
            <label htmlFor="barcode" className="form-label">Barcode</label>
            <input id="barcode" name="barcode" className={`form-control ${errors.barcode ? "is-invalid" : ""}`} value={values.barcode} onChange={handleChange} maxLength={255} />
            {fieldError("barcode")}
          </div>
          <div className="mb-3">
            <label htmlFor="category_id" className="form-label">Category</label>
            <select id="category_id" name="category_id" className={`form-select ${errors.category_id ? "is-invalid" : ""}`} value={values.category_id} onChange={handleChange} required>
              <option value="">Select category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.label || category.name}</option>)}
            </select>
            {fieldError("category_id")}
          </div>
          <div className="mb-3">
            <label htmlFor="brand_id" className="form-label">Brand</label>
            <select id="brand_id" name="brand_id" className={`form-select ${errors.brand_id ? "is-invalid" : ""}`} value={values.brand_id} onChange={handleChange} required>
              <option value="">Select brand</option>
              {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
            {fieldError("brand_id")}
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-3 mb-3">
          <label htmlFor="price" className="form-label">Price</label>
          <input id="price" name="price" type="number" min="0" step="0.01" className={`form-control ${errors.price ? "is-invalid" : ""}`} value={values.price} onChange={handleChange} required />
          {fieldError("price")}
        </div>
        <div className="col-md-3 mb-3">
          <label htmlFor="compare_price" className="form-label">Compare-at price</label>
          <input id="compare_price" name="compare_price" type="number" min="0" step="0.01" className={`form-control ${errors.compare_price ? "is-invalid" : ""}`} value={values.compare_price} onChange={handleChange} />
          {fieldError("compare_price")}
        </div>
        <div className="col-md-3 mb-3">
          <label htmlFor="qty" className="form-label">Stock quantity</label>
          <input id="qty" name="qty" type="number" min="0" step="1" className={`form-control ${errors.qty ? "is-invalid" : ""}`} value={values.hasSizes ? sizeTotal : values.qty} onChange={handleChange} disabled={values.hasSizes} aria-describedby="qty-help" />
          {fieldError("qty")}
          <div id="qty-help" className="form-text">{values.hasSizes ? "Added up from the sizes below." : "Leave blank if you don’t track stock."}</div>
        </div>
        {portal === "admin" && (
          <div className="col-md-3 mb-3">
            <label htmlFor="is_featured" className="form-label">Featured</label>
            <select id="is_featured" name="is_featured" className="form-select" value={values.is_featured} onChange={handleChange}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        )}
      </div>

      <section className={`pf-sizes mb-4${values.hasSizes ? " is-on" : ""}`} aria-labelledby="has_sizes_label">
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" role="switch" id="has_sizes" checked={values.hasSizes} onChange={toggleSizes} />
          <label className="form-check-label" htmlFor="has_sizes" id="has_sizes_label"><strong>Sold in sizes</strong> <span className="text-muted">e.g. Free Size, S, M, L, XL</span></label>
        </div>
        {values.hasSizes && (
          <>
            <p className="form-text mt-1 mb-3">Tick each size you sell and enter how many you have. Leave a size’s stock blank if you don’t track it. Shoppers pick a size before adding to their bag.</p>
            {sizeOptions.length ? (
              <div className="pf-size-grid">
                {sizeOptions.map((size) => {
                  const row = values.sizes.find((item) => item.size_id === size.id);
                  return (
                    <div key={size.id} className={`pf-size${row ? " is-ticked" : ""}`}>
                      <label className="pf-size-name">
                        <input type="checkbox" className="form-check-input" checked={Boolean(row)} onChange={() => toggleSize(size.id)} />
                        <span>{size.name}</span>
                      </label>
                      <input type="number" min="0" step="1" inputMode="numeric" className="form-control form-control-sm" placeholder={row ? "Stock" : "—"} value={row?.qty ?? ""} onChange={(event) => setSizeQty(size.id, event.target.value)} disabled={!row} aria-label={`Stock for size ${size.name}`} />
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-muted small mb-0">No sizes have been set up yet.</p>}
            {sizeErrors.map((message) => <div key={message} className="text-danger small mt-2" role="alert">{message}</div>)}
            <div className="form-text mt-2">
              {portal === "admin"
                ? <>Need another size, like UK 8 or 32? Add it under <Link to="/admin/manage-sizes">Sizes</Link>.</>
                : "Need a size that isn’t listed? Ask the Elitezaar team to add it."}
            </div>
          </>
        )}
      </section>

      <GstFields kind="product" values={{ hsn_code: values.hsn_code, gst_rate: values.gst_rate }} onChange={(next) => setValues((current) => ({ ...current, ...next }))} errors={errors} />

      <div className="row">
        <div className="col-md-4 mb-3">
          <label htmlFor="status" className="form-label">Status</label>
          <select id="status" name="status" className="form-select" value={values.status} onChange={handleChange}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>
        <div className="col-md-8 mb-3">
          <label htmlFor="gallery" className="form-label">Product images</label>
          <input id="gallery" type="file" className="form-control" accept="image/jpeg,image/png,image/gif" multiple onChange={uploadImages} disabled={uploading} />
          <div className="form-text">Choose one or more JPG, PNG, or GIF images. The first image becomes the main image.</div>
          {uploading && <div className="form-text" role="status">Uploading images...</div>}
          {uploadError && <div className="text-danger small mt-1" role="alert">{uploadError}</div>}
          {errors.gallery && <div className="text-danger small">{errors.gallery}</div>}
        </div>
      </div>

      {values.gallery.length > 0 && (
        <div className="d-flex flex-wrap gap-3 mb-3">
          {values.gallery.map((image) => (
            <div className="border rounded p-2" key={image.id} style={{ width: 130 }}>
              <img src={image.preview} alt={image.name} className="img-fluid rounded" style={{ height: 90, width: "100%", objectFit: "cover" }} />
              <div className="small text-truncate mt-1" title={image.name}>{image.name}</div>
              <button type="button" className="btn btn-sm btn-outline-danger mt-1 w-100" onClick={() => removeImage(image.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {errors.general && <div className="alert alert-danger" role="alert">{errors.general}</div>}
      <button type="submit" className="btn btn-primary" disabled={loading || uploading || blocked}>
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
};

export default ProductForm;
