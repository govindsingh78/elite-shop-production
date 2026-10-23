import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";
import ProductForm from "./ProductForm";
import { portalConfig, portalToken } from "../portal";
import { SellerReviewNotice } from "./ReviewBits";

const initialValues = {
  title: "", price: "", compare_price: "", description: "", short_description: "",
  category_id: "", brand_id: "", sku: "", barcode: "", qty: "0", status: "1",
  is_featured: "no", gallery: [],
};

const CreateProduct = ({ portal = "admin" }) => {
  const config = portalConfig(portal);
  const [values, setValues] = useState(initialValues);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch(`${apiUrl}/${config.api}/product-options`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${portalToken(portal) || ""}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load categories and brands.");
        setCategories(data.categories || []);
        setBrands(data.brands || []);
      } catch (error) {
        setErrors({ general: error.message || "Unable to load product options." });
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, [portal, config]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const token = portalToken(portal);
      if (!token) throw new Error(config.sessionExpired);
      const payload = {
        ...values,
        price: Number(values.price),
        compare_price: values.compare_price === "" ? null : Number(values.compare_price),
        category_id: Number(values.category_id),
        brand_id: Number(values.brand_id),
        qty: values.qty === "" ? null : Number(values.qty),
        status: Number(values.status),
        gallery: values.gallery.map((image) => image.id),
      };
      const response = await fetch(`${apiUrl}/${config.api}/products`, {
        method: "POST",
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
      if (!response.ok) throw new Error(data.message || "Unable to create product.");
      toast.success(data.message || "Product created.");
      navigate(config.productsPath);
    } catch (error) {
      setErrors({ general: error.message || "Unable to create product." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-5"><div className="d-flex"><Sidebar variant={config.sidebar} /><main className="container-fluid p-4">
        <h2 className="mb-4">{portal === "vendor" ? "List a new product" : "Create Product"}</h2>
        {loadingOptions ? <p role="status">Loading categories and brands...</p> : (
          <div className="card shadow-sm"><div className="card-body">
            {portal === "vendor" && <SellerReviewNotice status="new" />}
            <ProductForm portal={portal} values={values} setValues={setValues} categories={categories} brands={brands} onSubmit={handleSubmit} errors={errors} loading={loading} submitLabel={portal === "vendor" ? "Submit for review" : "Create product"} />
          </div></div>
        )}
      </main></div></div>
    </Layout>
  );
};

export default CreateProduct;
