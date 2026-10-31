import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";
import ProductForm from "./ProductForm";
import { SellerRestriction } from "../sellers/SellerBits";
import { portalConfig, portalToken } from "../portal";
import { ReviewPanel, SellerReviewNotice } from "./ReviewBits";
import { gstValues, productPayload, sizeValues, sizesProblem } from "./productPayload";

const apiOrigin = apiUrl.replace(/\/api\/?$/, "");
const emptyValues = {
  title: "", price: "", compare_price: "", description: "", short_description: "",
  category_id: "", brand_id: "", sku: "", barcode: "", qty: "0", status: "1",
  is_featured: "no", gallery: [], hasSizes: false, sizes: [], hsn_code: "", gst_rate: "",
};

const EditProduct = ({ portal = "admin" }) => {
  const config = portalConfig(portal);
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(emptyValues);
  const [currentImages, setCurrentImages] = useState([]);
  const [review, setReview] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [sizeOptions, setSizeOptions] = useState([]);
  const [sellerRestriction, setSellerRestriction] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = portalToken(portal);
        if (!token) throw new Error(config.sessionExpired);
        const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
        const [productResponse, optionsResponse] = await Promise.all([
          fetch(`${apiUrl}/${config.api}/products/${id}`, { headers }),
          fetch(`${apiUrl}/${config.api}/product-options`, { headers }),
        ]);
        const productData = await productResponse.json();
        const optionsData = await optionsResponse.json();
        if (!productResponse.ok) throw new Error(productData.message || "Unable to load product.");
        if (!optionsResponse.ok) throw new Error(optionsData.message || "Unable to load categories and brands.");

        setCategories(optionsData.categories || []);
        setBrands(optionsData.brands || []);
        setSizeOptions(optionsData.sizes || []);
        setSellerRestriction(optionsData.seller_restriction || null);
        setValues({
          ...emptyValues,
          title: productData.title || "",
          price: String(productData.price ?? ""),
          compare_price: productData.compare_price == null ? "" : String(productData.compare_price),
          description: productData.description || "",
          short_description: productData.short_description || "",
          category_id: String(productData.category_id || ""),
          brand_id: String(productData.brand_id || ""),
          sku: productData.sku || "",
          barcode: productData.barcode || "",
          // Blank = stock not tracked (showing 0 here used to make the product sold out on the next save).
          qty: productData.qty == null ? "" : String(productData.qty),
          status: String(productData.status ?? 1),
          is_featured: productData.is_featured || "no",
          gallery: [],
          ...sizeValues(productData),
          ...gstValues(productData),
        });
        const images = productData.images?.length
          ? productData.images.map((image) => image.image)
          : productData.image ? [productData.image] : [];
        setCurrentImages(images);
        setReview({
          id: productData.id,
          vendor_id: productData.vendor_id,
          vendor: productData.vendor,
          approval_status: productData.approval_status || "approved",
          review_note: productData.review_note,
        });
      } catch (error) {
        setErrors({ general: error.message || "Unable to load product." });
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [id, portal, config]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const token = portalToken(portal);
      if (!token) throw new Error(config.sessionExpired);
      const problem = sizesProblem(values);
      if (problem) {
        setErrors({ sizes: problem });
        return;
      }
      const payload = productPayload(values);
      const response = await fetch(`${apiUrl}/${config.api}/products/${id}`, {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.status === 422) {
        const fieldErrors = {};
        Object.entries(data.errors || {}).forEach(([field, messages]) => { fieldErrors[field] = messages[0]; });
        setErrors(fieldErrors);
        return;
      }
      if (!response.ok) throw new Error(data.message || "Unable to update product.");
      toast.success(data.message || "Product updated.");
      navigate(config.productsPath);
    } catch (error) {
      setErrors({ general: error.message || "Unable to update product." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-5"><div className="d-flex admin-dashboard-layout"><Sidebar variant={config.sidebar} /><main className="container-fluid p-4">
        <h2 className="mb-4">Edit Product</h2>
        {!loadingData && review && portal === "admin" && (review.vendor_id || review.approval_status !== "approved") && (
          <ReviewPanel product={review} onReviewed={(data) => { toast.success(data.message || "Review saved."); navigate(config.productsPath); }} />
        )}
        {loadingData ? <p role="status">Loading product...</p> : (
          <div className="card shadow-sm"><div className="card-body">
            {sellerRestriction && <SellerRestriction message={sellerRestriction} />}
            {portal === "vendor" && review && <SellerReviewNotice status={review.approval_status} note={review.review_note} />}
            {currentImages.length > 0 && (
              <div className="mb-4">
                <h6>Current images</h6>
                <div className="d-flex flex-wrap gap-3">
                  {currentImages.map((image) => (
                    <img key={image} src={`${apiOrigin}/uploads/products/small/${encodeURIComponent(image)}`} alt="Product" className="border rounded" style={{ width: 110, height: 110, objectFit: "cover" }} />
                  ))}
                </div>
                <p className="form-text">Existing images are retained. Add more images below if needed.</p>
              </div>
            )}
            <ProductForm blocked={Boolean(sellerRestriction)} portal={portal} values={values} setValues={setValues} categories={categories} brands={brands} sizeOptions={sizeOptions} onSubmit={handleSubmit} errors={errors} loading={loading} submitLabel={portal === "vendor" && review?.approval_status === "rejected" ? "Save & resubmit" : "Save changes"} />
          </div></div>
        )}
        {!loadingData && errors.general && <button className="btn btn-link mt-2" onClick={() => navigate(config.productsPath)}>Back to products</button>}
      </main></div></div>
    </Layout>
  );
};

export default EditProduct;
