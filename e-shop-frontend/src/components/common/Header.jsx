import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Navbar from "react-bootstrap/Navbar";
import BrandLogo from "./BrandLogo";
import { useStorefrontCategories } from "./useStorefrontCategories";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/wishlist";
import { HeartIcon } from "./WishlistButton";
import AccountMenu from "./AccountMenu";
import { formatPrice } from "./currency";
import { SUPPORT_PHONES } from "./support";
import { diwaliSeason } from "./festive";
import { DiyaIcon } from "./Diwali";

/** "Categories" dropdown in the main menu: every category with its subcategories underneath. Desktop only; phones list them in the menu. */
const CategoriesMenu = ({ categories, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);
  const hoveredAt = useRef(0);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => { if (!wrapRef.current?.contains(event.target)) setOpen(false); };
    const onKeyDown = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Mouse users open it by hovering (a click straight after doesn’t shut it again); touch and keyboard users tap the button.
  const hoverOpen = (event) => {
    if (event.pointerType !== "mouse") return;
    clearTimeout(closeTimer.current);
    hoveredAt.current = Date.now();
    setOpen(true);
  };
  const hoverClose = (event) => {
    if (event.pointerType !== "mouse") return;
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };
  const go = () => {
    setOpen(false);
    onNavigate();
  };

  if (!categories.length) return null;

  return (
    <div ref={wrapRef} className={`store-mega${open ? " is-open" : ""}`} onPointerEnter={hoverOpen} onPointerLeave={hoverClose}>
      <button type="button" className="store-nav-link store-mega-trigger" aria-expanded={open} aria-controls="store-mega-panel" onClick={() => setOpen((current) => (current && Date.now() - hoveredAt.current < 600) || !current)}>
        <svg className="store-mega-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>
        Categories
        <svg className="store-nav-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div id="store-mega-panel" className="store-mega-panel">
        <div className="store-mega-head">
          <span>Shop by category</span>
          <Link to="/shop" onClick={go}>Browse everything <span aria-hidden="true">→</span></Link>
        </div>
        <div className="store-mega-grid">
          {categories.map((category) => (
            <section key={category.id} className="store-mega-col" aria-label={category.name}>
              <Link to={`/shop/${category.slug}`} onClick={go} className="store-mega-title">{category.name}</Link>
              {category.children?.length ? (
                <ul>
                  {category.children.map((child) => (
                    <li key={child.id}><Link to={`/shop/${child.slug}`} onClick={go}>{child.name}</Link></li>
                  ))}
                </ul>
              ) : null}
              <Link to={`/shop/${category.slug}`} onClick={go} className="store-mega-all">Shop all {category.name} <span aria-hidden="true">→</span></Link>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

const Header = () => {
  const { categories, loading } = useStorefrontCategories();
  const { count, subtotal } = useCart();
  const { count: savedCount } = useWishlist();
  const [expanded, setExpanded] = useState(false);
  const { pathname } = useLocation();
  const [festive] = useState(diwaliSeason);

  const closeMenu = () => setExpanded(false);

  return (
    <>
      <div className={`store-announcement${festive ? " is-diwali" : ""}`}>
        <div className="container d-flex justify-content-between align-items-center">
          {festive
            ? <span className="d-none d-lg-inline-flex store-announcement-festive"><DiyaIcon /> Shubh Deepavali! {festive.countdown}. Festive picks, packed with care.</span>
            : <span className="d-none d-lg-inline">Thoughtfully picked. Made to be worn on repeat.</span>}
          <span className="store-helpline">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
            <span className="d-none d-sm-inline">Helpline</span>
            {SUPPORT_PHONES.map((phone, index) => (
              <React.Fragment key={phone.tel}>
                {index > 0 && <span aria-hidden="true">/</span>}
                <a href={`tel:${phone.tel}`}>{phone.label}</a>
              </React.Fragment>
            ))}
          </span>
          <Link to="/shop" className="store-announcement-link d-none d-md-inline">{festive ? "Shop the festive edit" : "Explore the edit"} <span aria-hidden="true">↗</span></Link>
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
                <CategoriesMenu categories={categories} onNavigate={closeMenu} />
                <NavLink to="/shop" end onClick={closeMenu} className={({ isActive }) => `store-nav-link${isActive ? " active" : ""}`}>
                  Discover
                </NavLink>
                {categories.map((category) => category.children?.length ? (
                  // Categories with subcategories open a small menu on hover / focus (listed inline on phones).
                  <div key={category.id} className="store-nav-item store-nav-quick">
                    <NavLink
                      to={`/shop/${category.slug}`}
                      onClick={closeMenu}
                      className={({ isActive }) => `store-nav-link${isActive || category.children.some((child) => pathname === `/shop/${child.slug}`) ? " active" : ""}`}
                    >
                      {category.name}
                      <svg className="store-nav-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                    </NavLink>
                    <div className="store-subnav">
                      <Link to={`/shop/${category.slug}`} onClick={closeMenu} className="store-subnav-all">All {category.name}</Link>
                      {category.children.map((child) => (
                        <NavLink key={child.id} to={`/shop/${child.slug}`} onClick={closeMenu} className={({ isActive }) => (isActive ? "active" : undefined)}>
                          {child.name}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ) : (
                  <NavLink
                    key={category.id}
                    to={`/shop/${category.slug}`}
                    onClick={closeMenu}
                    className={({ isActive }) => `store-nav-link store-nav-quick${isActive ? " active" : ""}`}
                  >
                    {category.name}
                  </NavLink>
                ))}
                {!categories.length && loading && <span className="store-nav-loading">Loading collections…</span>}
              </nav>
              <div className="store-header-actions">
                <Link to="/wishlist" onClick={closeMenu} className={`header-action header-wish${savedCount ? " has-items" : ""}`} aria-label={`Wishlist, ${savedCount} saved`} title="Wishlist">
                  <span className="header-wish-icon">
                    <HeartIcon filled={savedCount > 0} />
                    {savedCount > 0 && <span key={savedCount} className="header-bag-count">{savedCount > 99 ? "99+" : savedCount}</span>}
                  </span>
                </Link>
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
