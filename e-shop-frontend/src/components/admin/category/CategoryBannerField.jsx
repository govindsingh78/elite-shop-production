import React, { useState } from "react";
import { apiUrl } from "../../common/http";
import { categoryBannerUrl } from "../../common/categoryBanner";

/**
 * A main category's home page banner. `current` is the banner it has now; `change` is what saving will do to it,
 * { banner_temp_id, preview } for a new photo or { remove_banner: true }, and is sent along with the category.
 */
const CategoryBannerField = ({ current, change, onChange, error }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const preview = change.preview || (change.remove_banner ? null : categoryBannerUrl(current));

  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch(`${apiUrl}/temp-images`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.errors?.image?.[0] || result.message || "Could not upload that photo.");
      onChange({ banner_temp_id: result.data.id, preview: URL.createObjectURL(file) });
    } catch (requestError) {
      setUploadError(requestError.message || "Could not upload that photo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-3">
      <span className="form-label d-block">Home page banner <span className="text-muted fw-normal">Optional</span></span>
      <div className={`category-banner-preview${preview ? " has-image" : ""}`}>
        {preview ? <img src={preview} alt="Banner preview" /> : <span>No banner yet: a coloured one is used instead.</span>}
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
        <label className={`btn btn-outline-secondary btn-sm mb-0${uploading ? " disabled" : ""}`}>
          {uploading ? "Uploading…" : preview ? "Replace photo" : "Choose a photo"}
          <input type="file" accept="image/jpeg,image/png" className="visually-hidden" onChange={choose} disabled={uploading} />
        </label>
        {preview && <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => onChange(current ? { remove_banner: true } : {})}>Remove</button>}
      </div>
      <div className="form-text">A wide JPG or PNG, about 1600 × 500 pixels. The name sits on the left, so keep the main subject in the centre or on the right. It shows on the home page once the category has live products.</div>
      {(uploadError || error) && <div className="text-danger small mt-1" role="alert">{uploadError || error}</div>}
    </div>
  );
};

export default CategoryBannerField;
