import React from 'react'
import {AdminAuthContext} from '../context/AdminAuth';
import {useContext} from 'react';
import { useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const { logout } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };
   
  return (
    <nav className="bg-light text-white p-3" style={{ width: "300px", height: "70vh" }}>
         
    <ul className="nav flex-column">
        <li className="nav-item">
          <a href="/admin/dashboard" className="nav-link text-dark">
            <strong>Admin Dashboard</strong>
          </a>
        </li>
        <li className="nav-item">
          <a href="/admin/manage-categories" className="nav-link text-dark">
            Categories
          </a>
        </li>
        <li className="nav-item">
          <a href="/admin/manage-brands" className="nav-link text-dark">
            Brands
          </a>
        </li>
        <li className="nav-item">
          <a href="/admin/manage-products" className="nav-link text-dark">
            Products
          </a>
        </li>
        <li className="nav-item">
          <a href="/admin/manage-orders" className="nav-link text-dark">
            Orders
          </a>
        </li>
        <li className="nav-item">
          <a href="/admin/manage-users" className="nav-link text-dark">
            Users
          </a>
        </li>
        <li className="nav-item">
          <a href="/admin/manage-shipping" className="nav-link text-dark">
            Shipping
          </a>
        </li>
        <li className="nav-item">
          <a href="/admin/change-password" className="nav-link text-dark">
            Change Password
          </a>
        </li>
        <li className="nav-item">
          <button onClick={handleLogout} className="btn btn-danger mt-3 w-100">
            Logout
          </button>
        </li>
      </ul>
    </nav>
  )
}

export default Sidebar
