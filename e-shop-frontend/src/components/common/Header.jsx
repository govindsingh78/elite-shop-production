import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Navbar from "react-bootstrap/Navbar";
import BrandLogo from "./BrandLogo";
import { useStorefrontCategories } from "./useStorefrontCategories";
import { useCart } from "../context/CartContext";
import AccountMenu from "./AccountMenu";

const Header = () => {
  const { categories, loading } = useStorefrontCategories();
  const { count } = useCart();
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
            <Navbar.Brand as={Link} to="/" onClick={closeMenu} className="store-brand" aria-label="Street Shop home">
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
                <Link to="/cart" className="store-icon-link store-bag-link position-relative" aria-label={`Shopping bag, ${count} items`} title="Shopping bag">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>
                  {count > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{count}</span>}
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
