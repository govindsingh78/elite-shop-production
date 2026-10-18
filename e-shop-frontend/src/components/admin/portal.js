/** Per-portal settings that let the admin product and order screens also serve vendors. */
export const PORTALS = {
  admin: {
    tokenKey: "adminToken",
    api: "admin",
    sidebar: "admin",
    sessionExpired: "Your admin session has expired. Sign in again.",
    productsPath: "/admin/manage-products",
    createProductPath: "/admin/create-product",
    editProductPath: (id) => `/admin/edit-product/${id}`,
    ordersPath: "/admin/manage-orders",
    orderPath: (id) => `/admin/manage-orders/${id}`,
  },
  vendor: {
    tokenKey: "vendorToken",
    api: "vendor",
    sidebar: "vendor",
    sessionExpired: "Your vendor session has expired. Sign in again.",
    productsPath: "/vendor/products",
    createProductPath: "/vendor/products/create",
    editProductPath: (id) => `/vendor/products/${id}/edit`,
    ordersPath: "/vendor/orders",
    orderPath: (id) => `/vendor/orders/${id}`,
  },
};

export const portalConfig = (portal) => PORTALS[portal] || PORTALS.admin;

export const portalToken = (portal) => localStorage.getItem(portalConfig(portal).tokenKey);
