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

function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRequireAuth>
                <Dashboard />
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
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </AdminAuthProvider>
  );
}

export default App;