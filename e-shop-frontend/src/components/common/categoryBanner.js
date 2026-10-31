import { apiUrl } from "./http";

const imageBase = apiUrl.replace(/\/api\/?$/, "");

/** A category's banner photo, or null if it hasn't got one. */
export const categoryBannerUrl = (banner) => (banner ? `${imageBase}/uploads/categories/${encodeURIComponent(banner)}` : null);

/** What saving a category sends for its banner: nothing if it hasn't changed. */
export const bannerPayload = ({ banner_temp_id: tempId, remove_banner: remove }) => ({
  ...(tempId ? { banner_temp_id: tempId } : {}),
  ...(remove ? { remove_banner: true } : {}),
});
