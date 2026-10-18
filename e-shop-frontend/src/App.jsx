import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './components/context/AdminAuth';
import Home from './components/common/Home';
import Shop from './components/common/Shop';
import Product from './components/common/Product';
import Cart from './components/common/Cart';
import Checkout from './components/common/Checkout';
import Login from './components/admin/Login';
import Dashboard from './components/admin/Dashboard';
import AdminRequireAuth from './components/admin/AdminRequireAuth';
import { ToastContainer } from 'react-toastify';
import Show from './components/admin/category/Show';
import Create from './components/admin/category/Create';
import Edit from './components/admin/category/Edit';
import ShowBrands from './components/admin/brands/ShowBrands';
import CreateBrands from './components/admin/brands/CreateBrands';
import EditBrands from './components/admin/brands/EditBrands';
import ChangePassword from './components/admin/ChangePassword';
import ManageShipping from './components/admin/shipping/ManageShipping';
import CreateShipping from './components/admin/shipping/CreateShipping';
import EditShipping from './components/admin/shipping/EditShipping';
import ManageUsers from './components/admin/users/ManageUsers';
import CreateUser from './components/admin/users/CreateUser';
import EditUser from './components/admin/users/EditUser';
import ManageProducts from './components/admin/products/ManageProducts';
import CreateProduct from './components/admin/products/CreateProduct';
import EditProduct from './components/admin/products/EditProduct';
import ManageOrders from './components/admin/orders/ManageOrders';
import OrderDetails from './components/admin/orders/OrderDetails';
import ForgotPassword from './components/common/ForgotPassword';
import ResetPassword from './components/common/ResetPassword';
import VendorRegister from './components/common/VendorRegister';
import VendorDashboard from './components/admin/VendorDashboard';
import { CartProvider } from './components/context/CartContext';
import OrderConfirmation from './components/common/OrderConfirmation';
import CustomerLogin from './components/customer/CustomerLogin';
import CustomerRegister from './components/customer/CustomerRegister';
import CustomerDashboard from './components/customer/CustomerDashboard';
import CustomerOrders from './components/customer/CustomerOrders';
import CustomerOrderDetails from './components/customer/CustomerOrderDetails';
import CustomerAddresses from './components/customer/CustomerAddresses';
import CustomerProfile from './components/customer/CustomerProfile';

function App() {
  return (
    <AdminAuthProvider>
      <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:categorySlug" element={<Shop />} />
          <Route path="/product" element={<Product />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/vendor/login" element={<Login portal="vendor" />} />
          <Route path="/vendor/register" element={<VendorRegister />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route path="/customer/register" element={<CustomerRegister />} />
          <Route
            path="/customer/dashboard"
            element={
              <AdminRequireAuth role="customer">
                <CustomerDashboard />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/customer/orders"
            element={
              <AdminRequireAuth role="customer">
                <CustomerOrders />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/customer/orders/:id"
            element={
              <AdminRequireAuth role="customer">
                <CustomerOrderDetails />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/customer/addresses"
            element={
              <AdminRequireAuth role="customer">
                <CustomerAddresses />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/customer/profile"
            element={
              <AdminRequireAuth role="customer">
                <CustomerProfile />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/vendor/dashboard"
            element={
              <AdminRequireAuth role="vendor">
                <VendorDashboard />
              </AdminRequireAuth>
            }
          />
          <Route path="/vendor/products" element={<AdminRequireAuth role="vendor"><ManageProducts portal="vendor" /></AdminRequireAuth>} />
          <Route path="/vendor/products/create" element={<AdminRequireAuth role="vendor"><CreateProduct portal="vendor" /></AdminRequireAuth>} />
          <Route path="/vendor/products/:id/edit" element={<AdminRequireAuth role="vendor"><EditProduct portal="vendor" /></AdminRequireAuth>} />
          <Route path="/vendor/orders" element={<AdminRequireAuth role="vendor"><ManageOrders portal="vendor" /></AdminRequireAuth>} />
          <Route path="/vendor/orders/:id" element={<AdminRequireAuth role="vendor"><OrderDetails portal="vendor" /></AdminRequireAuth>} />
          <Route path="/vendor/change-password" element={<AdminRequireAuth role="vendor"><ChangePassword portal="vendor" /></AdminRequireAuth>} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRequireAuth>
                <Dashboard />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/change-password"
            element={
              <AdminRequireAuth>
                <ChangePassword />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/manage-shipping"
            element={
              <AdminRequireAuth>
                <ManageShipping />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/manage-users"
            element={
              <AdminRequireAuth>
                <ManageUsers />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/manage-products"
            element={
              <AdminRequireAuth>
                <ManageProducts />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/manage-orders"
            element={
              <AdminRequireAuth>
                <ManageOrders />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/manage-orders/:id"
            element={
              <AdminRequireAuth>
                <OrderDetails />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/create-product"
            element={
              <AdminRequireAuth>
                <CreateProduct />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/edit-product/:id"
            element={
              <AdminRequireAuth>
                <EditProduct />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/create-user"
            element={
              <AdminRequireAuth>
                <CreateUser />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/edit-user/:id"
            element={
              <AdminRequireAuth>
                <EditUser />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/create-shipping"
            element={
              <AdminRequireAuth>
                <CreateShipping />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/edit-shipping/:id"
            element={
              <AdminRequireAuth>
                <EditShipping />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/manage-categories"
            element={
              <AdminRequireAuth>
                <Show />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/create-category"
            element={
              <AdminRequireAuth>
                <Create />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/edit-category/:id"
            element={
              <AdminRequireAuth>
                <Edit />
              </AdminRequireAuth>
            }
          />

<Route
            path="/admin/manage-brands"
            element={
              <AdminRequireAuth>
                <ShowBrands />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/create-brand"
            element={
              <AdminRequireAuth>
                <CreateBrands />
              </AdminRequireAuth>
            }
          />
          <Route
            path="/admin/edit-brand/:id"
            element={
              <AdminRequireAuth>
                <EditBrands />
              </AdminRequireAuth>
            }
          />
        </Routes>
        {/* Inside the router so toast messages can contain <Link>s. */}
        <ToastContainer />
      </BrowserRouter>
      </CartProvider>
    </AdminAuthProvider>
  );
}

export default App;