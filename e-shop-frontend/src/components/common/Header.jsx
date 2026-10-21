import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Navbar from "react-bootstrap/Navbar";
import BrandLogo from "./BrandLogo";
import { useStorefrontCategories } from "./useStorefrontCategories";
import { useCart } from "../context/CartContext";
import AccountMenu from "./AccountMenu";
import { formatPrice } from "./currency";

const Header = () => {
  const { categories, loading } = useStorefrontCategories();
  const { count, subtotal } = useCart();
  const [expanded, setExpanded] = useState(false);

  const closeMenu = () => setExpanded(false);

  return (
    <>
      <div className="store-announcement">
        <div className="container d-flex justify-content-between align-items-center">
          <span>Thoughtfully picked. Made to be worn on repeat.</span>
          <Link to="/shop" className="store-announcement-link">Explore the edit <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <header className="store-header sticky-top">
        <div className="container">
          <Navbar expand="lg" expanded={expanded} onToggle={setExpanded} className="store-navbar">
            <Navbar.Brand as={Link} to="/" onClick={closeMenu} className="store-brand" aria-label="Elitezaar home">
              <BrandLogo />
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="store-nav" aria-label="Toggle navigation" />
            <Navbar.Collapse id="store-nav">
              <nav className="store-category-nav" aria-label="Shop categories">
                <NavLink to="/shop" end onClick={closeMenu} className={({ isActive }) => `store-nav-link${isActive ? " active" : ""}`}>
                  Discover
                </NavLink>
                {categories.map((category) => (
                  <NavLink
                    key={category.id}
                    to={`/shop/${category.slug}`}
                    onClick={closeMenu}
                    className={({ isActive }) => `store-nav-link${isActive ? " active" : ""}`}
                  >
                    {category.name}
                  </NavLink>
                ))}
                {!categories.length && loading && <span className="store-nav-loading">Loading collections…</span>}
              </nav>
              <div className="store-header-actions">
                <AccountMenu onNavigate={closeMenu} />
                <Link to="/cart" onClick={closeMenu} className={`header-action header-bag${count ? " has-items" : ""}`} aria-label={`Shopping bag, ${count} ${count === 1 ? "item" : "items"}, ${formatPrice(subtotal)}`}>
                  <span className="header-bag-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>
                    {/* Keyed on count so the bounce replays every time an item is added. */}
                    {count > 0 && <span key={count} className="header-bag-count">{count > 99 ? "99+" : count}</span>}
                  </span>
                  <span className="header-action-copy">
                    <small>Your bag</small>
                    <strong>{count ? formatPrice(subtotal) : "Empty"}</strong>
                  </span>
                </Link>
              </div>
            </Navbar.Collapse>
          </Navbar>
        </div>
      </header>
    </>
  );
};

export default Header;
