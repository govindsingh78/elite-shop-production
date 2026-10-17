import React from "react";
import { Link } from "react-router-dom";
import LogoWhite from "../../assets/images/logo-white.png";
import { useStorefrontCategories } from "./useStorefrontCategories";

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
                            <Link to="/" className="store-footer-brand" aria-label="E-Shop home">
                                <img src={LogoWhite} alt="E-Shop" width={154} />
                            </Link>
                            <p className="store-footer-description">A considered collection for everyday living. Find your next favourite, and make it yours.</p>
                            <Link className="store-footer-cta" to="/shop">Discover the collection <span aria-hidden="true">↗</span></Link>
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
                                <li><Link to="/admin/login">Sign in</Link></li>
                                <li><Link to="/cart">Shopping bag</Link></li>
                                <li><Link to="/shop">New arrivals</Link></li>
                                <li><Link to="/vendor/register">Become a vendor</Link></li>
                            </ul>
                        </div>
                        <div className="col-lg-4 col-md-6">
                            <h2 className="store-footer-heading">A little note from us</h2>
                            <p className="store-footer-description">New finds, thoughtful details, and a fresh perspective—every now and then.</p>
                            <a className="store-footer-email" href="mailto:hello@eshop.example">hello@eshop.example <span aria-hidden="true">↗</span></a>
                        </div>
                    </div>
                    <div className="store-footer-perks row g-3">
                        <div className="col-md-4"><div className="store-perk"><span className="store-perk-icon">01</span><span><strong>Delivery, made easy</strong><small>Carefully packed, right to your door.</small></span></div></div>
                        <div className="col-md-4"><div className="store-perk"><span className="store-perk-icon">02</span><span><strong>Shopping with confidence</strong><small>Thoughtful service at every step.</small></span></div></div>
                        <div className="col-md-4"><div className="store-perk"><span className="store-perk-icon">03</span><span><strong>Checkout securely</strong><small>Your details stay protected.</small></span></div></div>
                    </div>
                    <div className="store-footer-bottom">
                        <span>© {year} E-Shop. Made for everyday.</span>
                        <Link to="/shop">Keep exploring <span aria-hidden="true">↑</span></Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
