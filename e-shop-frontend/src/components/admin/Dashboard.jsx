import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../common/Layout";
import Sidebar from "../common/Sidebar";
import { apiUrl } from "../common/http";

const dashboardCards = [
  {
    key: "users",
    title: "Customers & users",
    description: "Keep your community organized and up to date.",
    action: "Manage users",
    href: "/admin/manage-users",
    accent: "violet",
    icon: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.4-3.2 2.2-5 5.5-5s5.1 1.8 5.5 5" /><path d="M16 5.3a3 3 0 0 1 0 5.8M17 14c2.2.7 3.4 2.3 3.6 5" /></>,
  },
  {
    key: "products",
    title: "Products",
    description: "Refresh your catalog and showcase new arrivals.",
    action: "Manage products",
    href: "/admin/manage-products",
    accent: "teal",
    icon: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12.2V21M8 5.3l8 4.6" /></>,
  },
  {
    key: "orders",
    title: "Orders",
    description: "Track purchases and keep every delivery moving.",
    action: "View orders",
    href: "/admin/manage-orders",
    accent: "amber",
    icon: <><path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L9.5 21 7 19.3 5 21V3Z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
  },
];

const Dashboard = () => {
  const [stats, setStats] = useState({ users: null, products: null, orders: null });
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadStats = async () => {
      const token = localStorage.getItem("adminToken");
      if (!token) return;
      const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
      const resources = ["admin/users", "admin/products", "admin/orders"];
      try {
        const results = await Promise.all(resources.map(async (resource) => {
          const response = await fetch(`${apiUrl}/${resource}?per_page=1`, { headers, signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || "Dashboard totals are temporarily unavailable.");
          return Number(data.total ?? data.meta?.total ?? (Array.isArray(data) ? data.length : 0));
        }));
        setStats({ users: results[0], products: results[1], orders: results[2] });
      } catch (error) {
        if (error.name !== "AbortError") setStatsError("Live totals are temporarily unavailable.");
      }
    };
    loadStats();
    return () => controller.abort();
  }, []);

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid admin-dashboard-content">
            <div className="admin-dashboard-intro">
              <div>
                <span className="admin-dashboard-eyebrow">YOUR STORE, AT A GLANCE</span>
                <h1>Welcome back<span>.</span></h1>
                <p>Here’s what’s happening with your store today.</p>
              </div>
              <Link to="/admin/create-product" className="btn btn-primary admin-dashboard-create">＋ Add a product</Link>
            </div>
            {statsError && <p className="small text-muted mb-3" role="status">{statsError}</p>}
            <div className="row g-4">
              {dashboardCards.map((card, index) => (
                <div className="col-md-6 col-xl-4" key={card.key}>
                  <article className={`admin-stat-card admin-stat-card--${card.accent}`} style={{ "--card-index": index }}>
                    <div className="admin-stat-card-top">
                      <span className="admin-stat-icon"><svg viewBox="0 0 24 24" aria-hidden="true">{card.icon}</svg></span>
                      <span className="admin-stat-kicker">{card.key === "users" ? "COMMUNITY" : card.key.toUpperCase()}</span>
                    </div>
                    <p className="admin-stat-label">{card.title}</p>
                    <div className="admin-stat-number">{stats[card.key] === null ? <span className="admin-stat-skeleton" aria-label="Loading total" /> : stats[card.key].toLocaleString()}</div>
                    <p className="admin-stat-description">{card.description}</p>
                    <Link to={card.href} className="admin-stat-action">{card.action}<span aria-hidden="true">↗</span></Link>
                    <span className="admin-stat-watermark" aria-hidden="true">0{index + 1}</span>
                  </article>
                </div>
              ))}
            </div>
            <section className="admin-dashboard-tip mt-4">
              <span className="admin-dashboard-tip-icon">✦</span>
              <div><strong>A little progress goes a long way.</strong><p>Keep your catalog fresh and your customers in the loop.</p></div>
              <Link to="/admin/manage-products" className="admin-dashboard-tip-link">Explore your catalog <span aria-hidden="true">→</span></Link>
            </section>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;