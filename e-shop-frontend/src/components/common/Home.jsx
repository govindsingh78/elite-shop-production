import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { formatWholePrice } from "./currency";
import HomeHero from "./HomeHero";
import ProductSlider from "./ProductSlider";
import StartSelling from "./StartSelling";
import founderPhoto from "../../assets/images/founder.jpg";
import { AdminAuthContext } from "../context/AdminAuth";
import { useSeo } from "./seo";
import { productImage, productPath } from "./productPath";
import { categoryBannerUrl } from "./categoryBanner";
import { diwaliSeason } from "./festive";
import { DiwaliLettering, DiyaIcon, Mandala, Rangoli, Toran } from "./Diwali";

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

const NEW_ARRIVALS = 8;
const SHELF_PRODUCTS = 3;
const HERO_WINDOWS = 3;
const HERO_COLLECTIONS = 4;
const BUDGETS = [500, 1000, 2000, 5000];

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
  const hero = take(unique([...featured.slice(0, 1), ...everyCollection, ...featured, ...latest]).filter((product) => product.image), HERO_WINDOWS).slice(0, HERO_WINDOWS);
  const arrivals = take(latest, NEW_ARRIVALS).slice(0, NEW_ARRIVALS);
  const shelves = collections.filter((category) => category.total > 0).map((category) => {
    const products = take(category.products, SHELF_PRODUCTS);
    return { category, products, feature: products.slice(SHELF_PRODUCTS).find((product) => product.image) };
  });
  const everything = unique([...latest, ...featured, ...collections.flatMap((category) => category.products)]);
  const deals = everything.filter((product) => discountOf(product) > 0).sort((a, b) => discountOf(b) - discountOf(a));
  // A budget is only offered if something is in it, and shows the piece that sits closest to its limit.
  const budgets = BUDGETS.map((limit, index) => ({
    limit,
    product: everything.filter((product) => product.image && Number(product.price) < limit && Number(product.price) >= (BUDGETS[index - 1] || 0)).sort((a, b) => Number(b.price) - Number(a.price))[0],
  })).filter((budget) => budget.product);

  return { hero, arrivals, shelves, deals, budgets };
};

const productWindow = (product, index) => ({ key: product.id, to: productPath(product), image: productImage(product, index === 0 ? "large" : "small"), thumb: productImage(product), title: product.title, price: product.price, priority: index === 0 });

/** The banner's slides: the season first, then each collection, then the best offers. */
const planSlides = ({ plan, collections, festive, shopperName, loading }) => {
  const opening = {
    key: "edit",
    tone: festive ? "maroon" : "forest",
    tab: festive ? "Diwali edit" : "The edit",
    headline: true,
    eyebrow: festive ? <><DiyaIcon /> {festiveEyebrow(festive, shopperName)}</> : shopperName ? greetingFor(shopperName) : "New this season",
    title: <>{festive ? "Diwali gifts," : "Good things,"} <em>chosen well.</em></>,
    copy: "Thoughtfully picked pieces from independent sellers. Every listing is checked by our team, and every order is tracked to your door.",
    to: "/shop",
    action: festive ? "Shop the festive edit" : "Shop everything",
    windows: plan.hero.map(productWindow),
  };
  if (loading) return [opening];

  const tones = ["forest", "aubergine", "terracotta", "forest"];
  const shownFirst = new Set(plan.hero.map((product) => product.id));
  const collectionSlides = collections.filter((category) => category.total > 0 && category.products.some((product) => product.image)).slice(0, HERO_COLLECTIONS).map((category, index) => {
    const pictured = category.products.filter((product) => product.image);
    const fresh = [...pictured.filter((product) => !shownFirst.has(product.id)), ...pictured.filter((product) => shownFirst.has(product.id))];
    const banner = categoryBannerUrl(category.banner);
    const windows = fresh.slice(0, HERO_WINDOWS).map(productWindow);
    if (banner) windows[0] = { key: "banner", to: `/shop/${category.slug}`, image: banner, title: category.name };
    return {
      key: `collection-${category.id}`,
      tone: tones[index % tones.length],
      tab: category.name,
      eyebrow: `Collection · ${category.total} ${category.total === 1 ? "piece" : "pieces"}`,
      title: <em>{category.name}</em>,
      copy: `Our newest pieces in ${category.name}, each one checked by our team before it reaches you.`,
      to: `/shop/${category.slug}`,
      action: `Explore ${category.name}`,
      windows,
    };
  });

  const offers = plan.deals.filter((product) => product.image).slice(0, HERO_WINDOWS);
  const offerSlide = offers.length ? [{
    key: "offers",
    tone: "maroon",
    tab: "Offers",
    eyebrow: festive ? <><DiyaIcon /> Diwali offers</> : "On offer now",
    title: <>Up to {discountOf(plan.deals[0])}% <em>off.</em></>,
    copy: "Marked-down prices across the store, with the biggest savings first.",
    to: "/shop?sort=price_asc",
    action: "See the best prices",
    windows: offers.map(productWindow),
  }] : [];

  return [opening, ...collectionSlides, ...offerSlide];
};

const Icon = ({ children }) => <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;

/* ---------- Why shop with us, in one moving line ---------- */
const TrustRibbon = ({ online }) => {
  const items = [
    online && ["UPI & net banking", <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2M9.5 8.5 12 11l3-4" /></>],
    ["Cash on delivery", <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>],
    ["Live order tracking", <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></>],
    ["Checked by our team", <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>],
  ].filter(Boolean);
  return (
    <section className="lp-ribbon" aria-label="Why shop with us">
      <div className="lp-ribbon-track">
        {/* Four copies, so the line never runs out on a wide screen. */}
        {[0, 1, 2, 3].map((copy) => <ul key={copy} aria-hidden={copy > 0 || undefined}>{items.map(([title, icon]) => <li key={title}><Icon>{icon}</Icon>{title}</li>)}</ul>)}
      </div>
    </section>
  );
};

/* ---------- Every collection, one tap away ---------- */
const CategoryNav = ({ collections }) => {
  const live = collections.filter((category) => category.total > 0);
  if (!live.length) return null;
  return (
    <nav className="lp-catnav lp-reveal" aria-label="Shop by category">
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
    <section className="lp-section lp-reveal">
      <div className="container">
        <div className="lp-title">
          <h2>{title}</h2>
          <Link to={link} className="lp-link">{linkLabel} <span aria-hidden="true">→</span></Link>
        </div>
        <ProductSlider products={products} label={title} />
      </div>
    </section>
  );
};

/* ---------- Gifts by what you'd like to spend ---------- */
const Budgets = ({ budgets, festive }) => {
  if (budgets.length < 2) return null;
  return (
    <section className="lp-section lp-budgets lp-reveal">
      <div className="container">
        <div className="lp-title"><h2>{festive ? "Gifts for every budget" : "Something for every budget"}</h2></div>
        <ul>
          {budgets.map(({ limit, product }) => (
            <li key={limit}>
              <Link to={`/shop?max_price=${limit - 1}`} aria-label={`Under ${formatWholePrice(limit)}`}>
                <span className="lp-budget-copy"><small>Under</small><strong>{formatWholePrice(limit)}</strong></span>
                <span className="lp-budget-arch"><img src={productImage(product)} alt="" loading="lazy" /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

/* ---------- A collection: its banner beside its newest pieces ---------- */
const CategoryShelf = ({ category, products, feature, index }) => {
  const banner = categoryBannerUrl(category.banner);
  return (
    <section className={`lp-section lp-shelf lp-reveal${index % 2 ? " is-flipped" : ""}`} aria-labelledby={`shelf-${category.id}`}>
      <div className="container">
        <div className="lp-shelf-grid">
          <Link to={`/shop/${category.slug}`} className={`lp-shelf-panel lp-shelf-panel--${index % 3}${banner ? " has-photo" : feature ? " has-feature" : ""}`}>
            {banner
              ? <img src={banner} alt="" loading="lazy" className="lp-shelf-photo" />
              : feature ? <span className="lp-shelf-feature"><img src={productImage(feature)} alt="" loading="lazy" /></span> : <Mandala className="lp-shelf-mandala" />}
            <span className="lp-shelf-copy">
              <h2 id={`shelf-${category.id}`}>{category.name}</h2>
              <small>{category.total} {category.total === 1 ? "piece" : "pieces"}</small>
              <span className="lp-shelf-cta">View all <span aria-hidden="true">→</span></span>
            </span>
          </Link>
          <div className="lp-shelf-rail"><ProductSlider products={products} label={category.name} columns={3} /></div>
        </div>
      </div>
    </section>
  );
};

/* ---------- The days left, ticking ---------- */
const Countdown = ({ to }) => {
  const [left, setLeft] = useState(() => to - Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setLeft(to - Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [to]);
  if (left <= 0) return null;
  const parts = [["Days", Math.floor(left / 86400000)], ["Hours", Math.floor(left / 3600000) % 24], ["Mins", Math.floor(left / 60000) % 60], ["Secs", Math.floor(left / 1000) % 60]];
  return (
    <div className="lp-countdown" role="timer" aria-label={`${parts[0][1]} days to Diwali`}>
      {parts.map(([label, value]) => <span key={label} aria-hidden="true"><b>{String(value).padStart(2, "0")}</b><small>{label}</small></span>)}
    </div>
  );
};

/* ---------- The festival's own moment on the page, and the best prices year round ---------- */
const OffersBand = ({ products, festive }) => {
  if (!festive && !products.length) return null;
  return (
    <section className={`lp-offers lp-reveal${festive ? " is-festive" : ""}${products.length ? "" : " is-words-only"}`}>
      {festive && <Toran className="dw-toran" />}
      {festive && <><Rangoli className="lp-offers-rangoli is-left" /><Rangoli className="lp-offers-rangoli is-right" /></>}
      <div className="container">
        <div className="lp-offers-grid">
          <div className="lp-offers-copy">
            {festive ? <DiwaliLettering className="lp-offers-lettering" /> : <h2>Best prices right now</h2>}
            {festive ? <p>Light up someone’s year with a gift they’ll keep.</p> : <p>Marked-down prices, with the biggest savings first.</p>}
            {festive && <Countdown to={festive.diwaliAt} />}
            <Link to="/shop?sort=price_asc" className="lp-cta lp-cta--gold">{festive ? "Shop the Diwali offers" : "See the best prices"} <span aria-hidden="true">→</span></Link>
          </div>
          {products.length > 0 && <div className="lp-offers-rail"><ProductSlider products={products} label="Best prices" columns={3} /></div>}
        </div>
      </div>
    </section>
  );
};

/* ---------- Brands ---------- */
const Brands = ({ brands }) => {
  if (!brands.length) return null;
  return (
    <section className="lp-section lp-brands lp-reveal">
      <div className="container">
        <h2>Shop by brand</h2>
        <ul>{brands.map((brand) => <li key={brand.id}><Link to={`/shop?brand=${brand.id}`}>{brand.name}</Link></li>)}</ul>
      </div>
    </section>
  );
};

/* ---------- A note from the founder ---------- */
const FounderNote = () => (
  <section className="lp-founder lp-reveal" aria-labelledby="founder-note">
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
  <section className="lp-seller lp-reveal">
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
  const slides = useMemo(() => planSlides({ plan, collections: collections || [], festive, shopperName, loading }), [plan, collections, festive, shopperName, loading]);
  const emptyStore = latest && Number(latest.products?.total || 0) === 0;

  return (
    <main className="lp-page">
      <HomeHero slides={slides} loading={loading} festive={festive} />
      <TrustRibbon online={online} />
      {error && <div className="container"><div className="lp-error" role="status"><span aria-hidden="true">⚠</span>{error}</div></div>}
      {emptyStore && <section className="lp-section"><div className="container"><StartSelling /></div></section>}
      {!loading && (
        <>
          <CategoryNav collections={collections || []} />
          <ProductRow title="Just landed" link="/shop" linkLabel="View all" products={plan.arrivals} />
          <Budgets budgets={plan.budgets} festive={festive} />
          {plan.shelves.map((shelf, index) => <CategoryShelf key={shelf.category.id} {...shelf} index={index} />)}
          <OffersBand products={plan.deals} festive={emptyStore ? null : festive} />
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
