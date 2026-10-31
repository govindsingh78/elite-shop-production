import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { formatWholePrice } from "./currency";
import StorefrontProductCard from "./StorefrontProductCard";
import StartSelling from "./StartSelling";
import founderPhoto from "../../assets/images/founder.jpg";
import { AdminAuthContext } from "../context/AdminAuth";
import { useSeo } from "./seo";
import { productPath } from "./productPath";
import { categoryBannerUrl } from "./categoryBanner";
import { diwaliSeason } from "./festive";
import { DiyaIcon } from "./Diwali";

/** "Good evening, Asha" for a signed-in shopper, by the time of day where they are. */
const greetingFor = (name) => {
  const hour = new Date().getHours();
  return `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, ${name}`;
};

/** "Happy Diwali, Asha" for a signed-in shopper; guests see the countdown until Dhanteras, then the day's greeting. */
const festiveEyebrow = (festive, shopperName) => {
  if (shopperName) return `${festive.greeting}, ${shopperName}`;
  return festive.festivalDays ? festive.greeting : `The Diwali edit · ${festive.countdown}`;
};

const imageBase = apiUrl.replace(/\/api\/?$/, "");
const productImage = (product, size = "small") => (product?.image ? `${imageBase}/uploads/products/${size}/${encodeURIComponent(product.image)}` : null);

const getJson = async (path, signal) => {
  const response = await fetch(`${apiUrl}${path}`, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
};

const discountOf = (product) => {
  const price = Number(product.price || 0);
  const compare = Number(product.compare_price || 0);
  return compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
};

const unique = (products) => [...new Map(products.map((product) => [product.id, product])).values()];

const NEW_ARRIVALS = 4;
const SHELF_PRODUCTS = 3;
const DEALS = 4;

/**
 * What each part of the page shows. A small catalogue would otherwise show the same few products over and over, so each
 * part takes products nothing above it has shown, and only falls back to repeats when it has nothing new.
 */
const planPage = (latest, featured, collections) => {
  const shown = new Set();
  const take = (products, count) => {
    const ordered = [...products.filter((product) => !shown.has(product.id)), ...products.filter((product) => shown.has(product.id))];
    ordered.slice(0, count).forEach((product) => shown.add(product.id));
    return ordered;
  };

  // One from each collection, so the first thing shoppers see is the whole range. A featured product leads.
  const everyCollection = collections.flatMap((category) => category.products.slice(0, 1));
  const hero = take(unique([...featured.slice(0, 1), ...everyCollection, ...featured, ...latest]).filter((product) => product.image), 3).slice(0, 3);
  const arrivals = take(latest, NEW_ARRIVALS).slice(0, NEW_ARRIVALS);
  const shelves = collections.filter((category) => category.total > 0).map((category) => {
    const products = take(category.products, SHELF_PRODUCTS);
    return { category, products, feature: products.slice(SHELF_PRODUCTS).find((product) => product.image) };
  });
  // A full row reads better than two new ones and a gap, so offers shown above can fill it.
  const onOffer = unique([...latest, ...featured, ...collections.flatMap((category) => category.products)])
    .filter((product) => discountOf(product) > 0).sort((a, b) => discountOf(b) - discountOf(a));
  const deals = take(onOffer, DEALS).slice(0, DEALS);

  return { hero, arrivals, shelves, deals };
};

const Icon = ({ children }) => <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;

/* ---------- Hero: the words, then the store's real products ---------- */
const HeroTile = ({ product, large }) => (
  <Link to={productPath(product)} className={`lp-tile${large ? " is-large" : ""}`}>
    <img src={productImage(product, large ? "large" : "small")} alt={product.title} fetchPriority={large ? "high" : undefined} />
    <span className="lp-tile-tag"><span>{product.title}</span><b>{formatWholePrice(product.price)}</b></span>
  </Link>
);

const Hero = ({ products, loading, shopperName, festive }) => (
  <section className="lp-hero">
    <div className="container">
      <div className={`lp-hero-grid${!loading && !products.length ? " is-words-only" : ""}`}>
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">
            {festive ? <><DiyaIcon /> {festiveEyebrow(festive, shopperName)}</> : shopperName ? greetingFor(shopperName) : "New this season"}
          </span>
          <h1>{festive ? "Diwali gifts," : "Good things,"} <em>chosen well.</em></h1>
          <p>Thoughtfully picked pieces from independent sellers. Every listing is checked by our team, and every order is tracked to your door.</p>
          <Link to="/shop" className="lp-cta">{festive ? "Shop the festive edit" : "Shop everything"} <span aria-hidden="true">→</span></Link>
        </div>
        {(loading || products.length > 0) && (
          <div className={`lp-mosaic lp-mosaic--${loading ? 3 : products.length}`} aria-busy={loading}>
            {loading
              ? [0, 1, 2].map((key) => <span key={key} className={`lp-tile lp-tile--loading${key === 0 ? " is-large" : ""}`} />)
              : products.map((product, index) => <HeroTile key={product.id} product={product} large={index === 0} />)}
          </div>
        )}
      </div>
    </div>
  </section>
);

/* ---------- Why shop with us, in one line ---------- */
const TrustBar = ({ online }) => {
  const items = [
    online && ["UPI & net banking", <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2M9.5 8.5 12 11l3-4" /></>],
    ["Cash on delivery", <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>],
    ["Live order tracking", <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></>],
    ["Checked by our team", <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>],
  ].filter(Boolean);
  return (
    <section className="lp-trust" aria-label="Why shop with us">
      <div className="container">
        <ul>{items.map(([title, icon]) => <li key={title}><Icon>{icon}</Icon>{title}</li>)}</ul>
      </div>
    </section>
  );
};

/* ---------- Every collection, one tap away ---------- */
const CategoryNav = ({ collections }) => {
  const live = collections.filter((category) => category.total > 0);
  if (!live.length) return null;
  return (
    <nav className="lp-catnav" aria-label="Shop by category">
      <div className="container">
        <ul>
          {live.map((category) => {
            const image = categoryBannerUrl(category.banner) || productImage(category.products.find((product) => product.image));
            return (
              <li key={category.id}>
                <Link to={`/shop/${category.slug}`}>
                  <span className="lp-catnav-image">{image ? <img src={image} alt="" loading="lazy" /> : category.name.charAt(0)}</span>
                  {category.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

/* ---------- A row of products ---------- */
const ProductRow = ({ title, link, linkLabel, products }) => {
  if (!products.length) return null;
  return (
    <section className="lp-section">
      <div className="container">
        <div className="lp-title">
          <h2>{title}</h2>
          <Link to={link} className="lp-link">{linkLabel} <span aria-hidden="true">→</span></Link>
        </div>
        <div className="lp-grid">
          {products.map((product, index) => <div className="sp-grid-item" style={{ "--item-index": index }} key={product.id}><StorefrontProductCard product={product} /></div>)}
        </div>
      </div>
    </section>
  );
};

/* ---------- A collection: its banner beside its newest pieces ---------- */
const CategoryShelf = ({ category, products, feature, index }) => {
  const banner = categoryBannerUrl(category.banner);
  return (
    <section className={`lp-section lp-shelf${index % 2 ? " is-flipped" : ""}`} aria-labelledby={`shelf-${category.id}`}>
      <div className="container">
        <div className="lp-shelf-grid">
          <Link to={`/shop/${category.slug}`} data-initial={category.name.charAt(0)} className={`lp-shelf-panel lp-shelf-panel--${index % 3}${banner ? " has-photo" : feature ? " has-feature" : ""}`}>
            {banner
              ? <img src={banner} alt="" loading="lazy" className="lp-shelf-photo" />
              : feature && <img src={productImage(feature)} alt="" loading="lazy" className="lp-shelf-feature" />}
            <span className="lp-shelf-copy">
              <h2 id={`shelf-${category.id}`}>{category.name}</h2>
              <small>{category.total} {category.total === 1 ? "piece" : "pieces"}</small>
              <span className="lp-shelf-cta">View all <span aria-hidden="true">→</span></span>
            </span>
          </Link>
          <div className="lp-shelf-rail">
            {products.map((product) => <div className="lp-shelf-item" key={product.id}><StorefrontProductCard product={product} /></div>)}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ---------- Brands ---------- */
const Brands = ({ brands }) => {
  if (!brands.length) return null;
  return (
    <section className="lp-section lp-brands">
      <div className="container">
        <h2>Shop by brand</h2>
        <ul>{brands.map((brand) => <li key={brand.id}><Link to={`/shop?brand=${brand.id}`}>{brand.name}</Link></li>)}</ul>
      </div>
    </section>
  );
};

/* ---------- A note from the founder ---------- */
const FounderNote = () => (
  <section className="lp-founder" aria-labelledby="founder-note">
    <div className="container">
      <div className="lp-founder-grid">
        <img src={founderPhoto} alt="Govind Singh, founder of Elitezaar" width="600" height="600" loading="lazy" />
        <div>
          <span className="lp-eyebrow">From our founder</span>
          <h2 id="founder-note">“Shopping online should feel as personal as walking into a good local shop.”</h2>
          <p>That’s why our team reviews every seller’s listing before it reaches the store, and why you can follow every order to your door. If anything isn’t right, call or write to us.</p>
          <div className="lp-founder-sign">
            <span className="ab-signature" aria-hidden="true">Govind Singh</span>
            <span><strong>Govind Singh</strong><small>Founder, Elitezaar.com</small></span>
            <Link to="/about#founder" className="lp-link">Our story <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </div>
  </section>
);

/* ---------- Become a seller ---------- */
const SellerCta = () => (
  <section className="lp-seller">
    <div className="container">
      <h2>Have something worth selling?</h2>
      <p>Open your Elitezaar store in under a minute, and manage everything from your own seller hub.</p>
      <div className="lp-seller-actions">
        <Link to="/vendor/register" className="lp-cta">Become a seller <span aria-hidden="true">→</span></Link>
        <Link to="/vendor/login" className="lp-link">Already selling? Sign in</Link>
      </div>
    </div>
  </section>
);

const HomeContent = () => {
  const { user } = useContext(AdminAuthContext);
  const shopperName = user?.portal === "customer" ? (user.user?.name || "").trim().split(/\s+/)[0] : "";
  useSeo({ path: "/" });
  const [festive] = useState(diwaliSeason);
  const [latest, setLatest] = useState(null);
  const [featured, setFeatured] = useState(null);
  // Every main collection with its banner, piece count and newest products.
  const [collections, setCollections] = useState(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getJson("/storefront/products", controller.signal)
      .then(setLatest)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError("We’re having trouble loading products right now. Please refresh in a moment.");
      });
    getJson("/storefront/products?featured=yes", controller.signal).then((data) => setFeatured(data.products?.data || [])).catch(() => setFeatured([]));
    getJson("/storefront/home-categories", controller.signal).then((data) => setCollections(data.categories || [])).catch(() => setCollections([]));
    getJson("/storefront/payment-methods", controller.signal).then((data) => setOnline(!!data.online)).catch(() => {});
    return () => controller.abort();
  }, []);

  const loading = !error && (!latest || !featured || !collections);
  const plan = useMemo(() => planPage(latest?.products?.data || [], featured || [], collections || []), [latest, featured, collections]);
  const emptyStore = latest && Number(latest.products?.total || 0) === 0;

  return (
    <main className="lp-page">
      <Hero products={loading ? [] : plan.hero} loading={loading} shopperName={shopperName} festive={festive} />
      <TrustBar online={online} />
      {error && <div className="container"><div className="lp-error" role="status"><span aria-hidden="true">⚠</span>{error}</div></div>}
      {emptyStore && <section className="lp-section"><div className="container"><StartSelling /></div></section>}
      {!loading && (
        <>
          <CategoryNav collections={collections || []} />
          <ProductRow title="Just landed" link="/shop" linkLabel="View all" products={plan.arrivals} />
          {plan.shelves.map((shelf, index) => <CategoryShelf key={shelf.category.id} {...shelf} index={index} />)}
          <ProductRow title="Best prices right now" link="/shop?sort=price_asc" linkLabel="View all" products={plan.deals} />
          <Brands brands={latest?.brands || []} />
        </>
      )}
      <FounderNote />
      {!emptyStore && <SellerCta />}
    </main>
  );
};

const Home = () => (
  <Layout>
    <HomeContent />
  </Layout>
);

export default Home;
