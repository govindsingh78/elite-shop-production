import React from "react";
import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import { COOKIE_POLICY_PATH, openCookieSettings } from "./consent";
import { useStorefrontCategories } from "./useStorefrontCategories";
import { SUPPORT_EMAIL, SUPPORT_PHONES } from "./support";
import founderPhoto from "../../assets/images/founder.jpg";

const PERKS = [
    { title: "Delivery, made easy", copy: "Carefully packed and tracked live to your door.", icon: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></> },
    { title: "Shop with confidence", copy: "Pay on delivery, with real help when you need it.", icon: <><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z" /></> },
    { title: "Checkout securely", copy: "Encrypted payments. Your details stay private.", icon: <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></> },
];

const Footer = () => {
    const { categories } = useStorefrontCategories();
    const year = new Date().getFullYear();

    return (
        <footer className="store-footer">
            <div className="store-footer-main">
                <div className="container">
                    <div className="store-footer-topline">
                        <span>THE GOOD-FIND EDIT</span>
                        <span>Good things, chosen well.</span>
                    </div>
                    <div className="row g-5 py-5">
                        <div className="col-lg-4 col-md-6">
                            <Link to="/" className="store-footer-brand" aria-label="Elitezaar home">
                                <BrandLogo tone="light" size={46} />
                            </Link>
                            <p className="store-footer-description">A considered collection for everyday living. Find your next favourite, and make it yours.</p>
                            <Link className="store-footer-cta" to="/shop">Discover the collection <span aria-hidden="true">↗</span></Link>
                            <Link className="store-footer-about" to="/about">Our story <span aria-hidden="true">→</span></Link>
                            <Link className="store-footer-founder" to="/about#founder">
                                <img src={founderPhoto} alt="" width="44" height="44" loading="lazy" />
                                <span><small>Founded with care by</small><strong>Govind Singh</strong></span>
                            </Link>
                        </div>
                        <div className="col-lg-2 col-6">
                            <h2 className="store-footer-heading">Explore</h2>
                            <ul className="store-footer-links">
                                <li><Link to="/shop">All products</Link></li>
                                {categories.slice(0, 6).map((category) => (
                                    <li key={category.id}><Link to={`/shop/${category.slug}`}>{category.name}</Link></li>
                                ))}
                                {!categories.length && <li><span className="store-footer-muted">Collections coming soon</span></li>}
                            </ul>
                        </div>
                        <div className="col-lg-2 col-6">
                            <h2 className="store-footer-heading">Your account</h2>
                            <ul className="store-footer-links">
                                <li><Link to="/customer/login">Customer sign in</Link></li>
                                <li><Link to="/customer/register">Create an account</Link></li>
                                <li><Link to="/cart">Shopping bag</Link></li>
                                <li><Link to="/vendor/login">Vendor login</Link></li>
                                <li><Link to="/vendor/register">Become a vendor</Link></li>
                                <li><Link to="/admin/login">Admin login</Link></li>
                            </ul>
                        </div>
                        <div className="col-lg-4 col-md-6">
                            <h2 className="store-footer-heading">We're here to help</h2>
                            <p className="store-footer-description">Questions about an order, a product or selling with us? Call our helpline for customers and sellers, or write to us.</p>
                            <ul className="store-footer-phones">
                                {SUPPORT_PHONES.map((phone) => (
                                    <li key={phone.tel}>
                                        <a href={`tel:${phone.tel}`}>
                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
                                            {phone.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            <a className="store-footer-email" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL} <span aria-hidden="true">↗</span></a>
                            <Link className="store-footer-policy" to="/return-refund-policy">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6" /><path d="M4 4v4.6h4.6" /></svg>
                                Return &amp; Refund Policy
                            </Link>
                            <Link className="store-footer-policy" to="/terms-and-conditions">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>
                                Terms &amp; Conditions
                            </Link>
                            <Link className="store-footer-policy" to="/privacy-policy">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><rect x="9" y="11" width="6" height="5" rx="1" /><path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11" /></svg>
                                Privacy Policy
                            </Link>
                        </div>
                    </div>
                    <ul className="store-footer-perks">
                        {PERKS.map(({ title, copy, icon }, index) => (
                            <li key={title} className="store-perk">
                                <span className="store-perk-icon"><svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg></span>
                                <span><strong>{title}</strong><small>{copy}</small></span>
                                <span className="store-perk-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="store-footer-bottom">
                        <div className="store-footer-legal">
                            <span>© {year} Elitezaar. All rights reserved.</span>
                            <nav aria-label="Footer">
                                <Link to="/about">About us</Link>
                                <Link to="/return-refund-policy">Returns &amp; refunds</Link>
                                <Link to="/terms-and-conditions">Terms</Link>
                                <Link to="/privacy-policy">Privacy</Link>
                                <Link to={COOKIE_POLICY_PATH}>Cookies</Link>
                                <button type="button" className="store-footer-link-button" onClick={openCookieSettings}>Cookie settings</button>
                                <Link to="/shop">Shop</Link>
                                <Link to="/customer/orders">Track an order</Link>
                                <a href={`tel:${SUPPORT_PHONES[0].tel}`}>Call support</a>
                            </nav>
                        </div>
                        <div className="store-footer-pay">
                            <span>We accept</span>
                            <ul aria-label="Payment methods">
                                <li>UPI</li>
                                <li>Net banking</li>
                                <li>Cash on delivery</li>
                            </ul>
                        </div>
                        <button type="button" className="store-footer-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                            Back to top <span aria-hidden="true">↑</span>
                        </button>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
