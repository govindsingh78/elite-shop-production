/** API paths and wording for the two back-office portals that share the product and order screens. */
export const PORTALS = {
  admin: {
    key: "admin",
    label: "Admin",
    home: "/admin",
    products: "/admin/products",
    productOptions: "/admin/product-options",
    orders: "/admin/orders",
    // Admins can also mark payments and keep internal notes.
    canEditPayment: true,
  },
  vendor: {
    key: "vendor",
    label: "Seller",
    home: "/vendor",
    products: "/vendor/products",
    productOptions: "/vendor/product-options",
    orders: "/vendor/orders",
    canEditPayment: false,
  },
};

export const LOGIN_PATHS = {
  customer: "/customer/login",
  vendor: "/vendor/login",
  admin: "/admin/login",
};
