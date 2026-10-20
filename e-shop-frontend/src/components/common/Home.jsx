import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { formatPrice } from "./currency";
import { useStorefrontCategories } from "./useStorefrontCategories";
import StorefrontProductCard from "./StorefrontProductCard";
import BannerImage1 from "../../assets/images/banner-1.jpg";
import BannerImage2 from "../../assets/images/banner-2.jpg";

const imageBase = apiUrl.replace(/\/api\/?$/, "");
const productImage = (product) => (product?.image ? `${imageBase}/uploads/products/small/${encodeURIComponent(product.image)}` : null);

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

const Icon = ({ children }) => <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;

const SectionHead = ({ eyebrow, title, copy, link, linkLabel }) => (
  <div className="lp-head">
    <div>
      <span className="shop-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </div>
    {link && <Link to={link} className="lp-head-link">{linkLabel} <span aria-hidden="true">→</span></Link>}
  </div>
);

/* ---------- Hero ---------- */
const HERO_SLIDES = [
  { image: BannerImage1, eyebrow: "The new edit", title: "Clean lines, easy fits" },
  { image: BannerImage2, eyebrow: "Just landed", title: "Fresh pieces, every week" },
];

const HeroSlider = ({ categories }) => {
  const [swiper, setSwiper] = useState(null);
  const [active, setActive] = useState(0);
  const progressRef = useRef(null);
  const pad = (value) => String(value).padStart(2, "0");

  return (
    <div className="lp-slider">
      <Swiper
        modules={[Autoplay, EffectFade]}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        rewind
        speed={1100}
        autoplay={{ delay: 6000, disableOnInteraction: false, pauseOnMouseEnter: true }}
        onSwiper={setSwiper}
        onSlideChange={(instance) => setActive(instance.realIndex)}
        onAutoplayTimeLeft={(instance, time, progress) => progressRef.current?.style.setProperty("--lp-progress", `${(1 - progress) * 100}%`)}
        className="lp-hero-swiper"
      >
        {HERO_SLIDES.map((slide, index) => {
          const category = categories[index];
          return (
            <SwiperSlide key={slide.image}>
              <img src={slide.image} alt="" className="lp-hero-image" />
              <div className="lp-slide-caption">
                <small>{pad(index + 1)} <i aria-hidden="true" /> {slide.eyebrow}</small>
                <strong>{slide.title}</strong>
                <Link to={category ? `/shop/${category.slug}` : "/shop"}>{category ? `Shop ${category.name}` : "Shop now"} <span aria-hidden="true">→</span></Link>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
      <div className="lp-slider-progress" ref={progressRef} aria-hidden="true">
        {HERO_SLIDES.map((slide, index) => (
          <span key={slide.image} className={index < active ? "is-done" : index === active ? "is-active" : ""}><i /></span>
        ))}
      </div>
      <div className="lp-slider-controls">
        <span className="lp-slider-count"><b>{pad(active + 1)}</b> / {pad(HERO_SLIDES.length)}</span>
        <button type="button" aria-label="Previous slide" onClick={() => swiper?.slidePrev()}>←</button>
        <button type="button" aria-label="Next slide" onClick={() => swiper?.slideNext()}>→</button>
      </div>
    </div>
  );
};

const Hero = ({ stats, spotlight, categories }) => {
  const firstCategory = categories[0];
  return (
  <section className="lp-hero">
    <div className="container">
      <div className="row g-4 g-xl-5 align-items-center">
        <div className="col-lg-6">
          <div className="lp-hero-copy">
            <span className="lp-hero-eyebrow"><i aria-hidden="true" /> NEW SEASON · {new Date().getFullYear()}</span>
            <h1>Everyday style,<br /><em>elevated.</em></h1>
            <p>Thoughtfully picked pieces from independent sellers — delivered to your door, with live tracking from checkout to doorstep.</p>
            <div className="lp-hero-actions">
              <Link to="/shop" className="btn btn-primary lp-btn">Shop the collection <span aria-hidden="true">↗</span></Link>
              {firstCategory
                ? <Link to={`/shop/${firstCategory.slug}`} className="lp-btn-ghost">Explore {firstCategory.name}</Link>
                : <a href="#collections" className="lp-btn-ghost">Browse collections</a>}
            </div>
            <dl className="lp-hero-stats">
              <div><dt>{stats.products ?? "—"}</dt><dd>Pieces in stock</dd></div>
              <div><dt>{stats.categories ?? "—"}</dt><dd>Collections</dd></div>
              <div><dt>{stats.brands ?? "—"}</dt><dd>Brands</dd></div>
            </dl>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="lp-hero-visual">
            <HeroSlider categories={categories} />
            <div className="lp-hero-badge" aria-hidden="true"><Icon><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></Icon>Secure checkout</div>
            {spotlight && (
              <Link to={`/product/${spotlight.id}`} className="lp-spotlight">
                <span className="lp-spotlight-image">{productImage(spotlight) ? <img src={productImage(spotlight)} alt="" /> : <span>ES</span>}</span>
                <span className="lp-spotlight-copy">
                  <small>{spotlight.is_featured === "yes" ? "Editor’s pick" : "Just in"}</small>
                  <strong>{spotlight.title}</strong>
                  <b>{formatPrice(spotlight.price)}{discountOf(spotlight) > 0 && <s>{formatPrice(spotlight.compare_price)}</s>}</b>
                </span>
                <span className="lp-spotlight-arrow" aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  </section>
  );
};

/* ---------- Trust bar ---------- */
const TrustBar = ({ online }) => {
  const items = [
    online && ["UPI & net banking", "Pay securely online", <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2M9.5 8.5 12 11l3-4" /></>],
    ["Cash on delivery", "Pay when it arrives", <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>],
    ["Live order tracking", "Follow every step", <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></>],
    ["Carefully packed", "Checked before it ships", <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" /></>],
  ].filter(Boolean);
  return (
    <section className="lp-trust" aria-label="Why shop with us">
      <div className="container">
        <ul>
          {items.map(([title, copy, icon]) => (
            <li key={title}><span><Icon>{icon}</Icon></span><div><strong>{title}</strong><small>{copy}</small></div></li>
          ))}
        </ul>
      </div>
    </section>
  );
};

/* ---------- Collections ---------- */
const Collections = ({ categories, covers }) => {
  if (!categories.length) return null;
  return (
    <section className="lp-section" id="collections">
      <div className="container">
        <SectionHead eyebrow="SHOP BY COLLECTION" title="Find your edit" copy="Every collection, hand-picked and updated as new pieces arrive." link="/shop" linkLabel="All products" />
        <div className={`lp-collections lp-collections--${Math.min(categories.length, 4)}`}>
          {categories.slice(0, 6).map((category, index) => {
            const cover = covers[category.id];
            return (
              <Link key={category.id} to={`/shop/${category.slug}`} className={`lp-collection${index === 0 ? " is-large" : ""}`}>
                {cover?.image ? <img src={cover.image} alt="" loading="lazy" /> : <span className="lp-collection-fallback">{category.name.charAt(0)}</span>}
                <span className="lp-collection-copy">
                  <small>{cover ? `${cover.total} ${cover.total === 1 ? "piece" : "pieces"}` : "Collection"}</small>
                  <strong>{category.name}</strong>
                  <span className="lp-collection-cta">Shop now <span aria-hidden="true">→</span></span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ---------- Product grid ---------- */
const ProductGrid = ({ eyebrow, title, copy, products, link, linkLabel, tone }) => {
  if (!products.length) return null;
  return (
    <section className={`lp-section${tone ? ` lp-section--${tone}` : ""}`}>
      <div className="container">
        <SectionHead eyebrow={eyebrow} title={title} copy={copy} link={link} linkLabel={linkLabel} />
        <div className="row g-3 g-lg-4">
          {products.map((product, index) => (
            <div className="col-6 col-md-4 col-xl-3 sp-grid-item" style={{ "--item-index": index }} key={product.id}><StorefrontProductCard product={product} /></div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------- Featured carousel ---------- */
const FeaturedCarousel = ({ products }) => {
  if (!products.length) return null;
  return (
    <section className="lp-section lp-featured">
      <div className="container">
        <SectionHead eyebrow="EDITOR’S PICKS" title="Chosen by our team" copy="The pieces we keep coming back to this season." link="/shop" linkLabel="Shop all" />
        <Swiper
          modules={[Navigation, Pagination, Autoplay]}
          navigation
          pagination={{ clickable: true }}
          autoplay={{ delay: 5000, pauseOnMouseEnter: true, disableOnInteraction: false }}
          spaceBetween={20}
          slidesPerView={1.25}
          breakpoints={{ 576: { slidesPerView: 2.2 }, 992: { slidesPerView: 3 }, 1200: { slidesPerView: 4 } }}
          className="lp-featured-swiper"
        >
          {products.map((product) => <SwiperSlide key={product.id}><StorefrontProductCard product={product} /></SwiperSlide>)}
        </Swiper>
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
        <SectionHead eyebrow="SHOP BY BRAND" title="Labels you’ll love" />
        <div className="lp-brand-list">
          {brands.map((brand) => (
            <Link key={brand.id} to={`/shop?brand=${brand.id}`} className="lp-brand">
              <span aria-hidden="true">{brand.name.charAt(0)}</span>{brand.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------- How it works ---------- */
const HowItWorks = ({ online }) => (
  <section className="lp-section">
    <div className="container">
      <div className="lp-how">
        <div className="lp-how-intro">
          <span className="shop-eyebrow">HOW IT WORKS</span>
          <h2>From our shelf to your door — in plain sight.</h2>
          <p>No guesswork. Follow your order live, every step of the way.</p>
          <Link to="/customer/orders" className="btn btn-primary lp-btn">Track an order <span aria-hidden="true">→</span></Link>
        </div>
        <ol className="lp-steps">
          <li><span>01</span><strong>Pick your pieces</strong><small>Browse collections, add to your bag and check out in minutes.</small></li>
          <li><span>02</span><strong>{online ? "Pay your way" : "Pay on delivery"}</strong><small>{online ? "UPI, net banking or cash when it arrives — your choice." : "No card needed — pay in cash or UPI when it arrives."}</small></li>
          <li><span>03</span><strong>Track it live</strong><small>Packed, dispatched, out for delivery — updates appear as they happen.</small></li>
        </ol>
      </div>
    </div>
  </section>
);

/* ---------- Become a seller ---------- */
const SellerCta = () => (
  <section className="lp-section">
    <div className="container">
      <div className="lp-seller">
        <div>
          <span className="lp-seller-badge">FOR SELLERS</span>
          <h2>Have something worth selling?</h2>
          <p>Open your Elite Shop store in under a minute. List products, ship orders and track sales from your own seller dashboard.</p>
        </div>
        <div className="lp-seller-actions">
          <Link to="/vendor/register" className="btn lp-btn lp-btn-gold">Become a seller ↗</Link>
          <Link to="/vendor/login" className="lp-seller-link">Already selling? Sign in</Link>
        </div>
      </div>
    </div>
  </section>
);

const HomeContent = () => {
  const { categories } = useStorefrontCategories();
  const [latest, setLatest] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [online, setOnline] = useState(false);
  const [covers, setCovers] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getJson("/storefront/products", controller.signal)
      .then(setLatest)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError("We’re having trouble loading products right now. Please refresh in a moment.");
      });
    getJson("/storefront/products?featured=yes", controller.signal).then((data) => setFeatured(data.products?.data || [])).catch(() => {});
    getJson("/storefront/payment-methods", controller.signal).then((data) => setOnline(!!data.online)).catch(() => {});
    return () => controller.abort();
  }, []);

  // One small request per collection for its cover image and item count.
  useEffect(() => {
    if (!categories.length) return undefined;
    const controller = new AbortController();
    Promise.all(categories.slice(0, 6).map((category) => getJson(`/storefront/products?category_id=${category.id}`, controller.signal)
      .then((data) => [category.id, { total: Number(data.products?.total || 0), image: productImage((data.products?.data || []).find((item) => item.image)) }])
      .catch(() => null)))
      .then((entries) => setCovers(Object.fromEntries(entries.filter(Boolean))));
    return () => controller.abort();
  }, [categories]);

  const latestProducts = useMemo(() => latest?.products?.data || [], [latest]);
  const brands = latest?.brands || [];
  const deals = useMemo(() => {
    const unique = new Map([...latestProducts, ...featured].map((product) => [product.id, product]));
    return [...unique.values()].filter((product) => discountOf(product) > 0).sort((a, b) => discountOf(b) - discountOf(a)).slice(0, 4);
  }, [latestProducts, featured]);

  const stats = {
    products: latest ? Number(latest.products?.total || 0) : null,
    categories: categories.length || null,
    brands: latest ? brands.length : null,
  };

  return (
    <main className="lp-page">
      <Hero stats={stats} spotlight={featured[0] || latestProducts[0]} categories={categories} />
      <TrustBar online={online} />
      {error && <div className="container"><div className="lp-error" role="status"><span aria-hidden="true">⚠</span>{error}</div></div>}
      {!latest && !error && (
        <section className="lp-section"><div className="container"><div className="row g-3 g-lg-4">
          {[1, 2, 3, 4].map((item) => <div className="col-6 col-xl-3" key={item}><div className="sp-skeleton"><span /><i /><b /></div></div>)}
        </div></div></section>
      )}
      <Collections categories={categories} covers={covers} />
      <ProductGrid eyebrow="NEW ARRIVALS" title="Just landed" copy="Fresh pieces, added this week." products={latestProducts.slice(0, 8)} link="/shop" linkLabel="View all" />
      <FeaturedCarousel products={featured} />
      <ProductGrid tone="warm" eyebrow="OFFERS" title="Offers you’ll love" copy="Our best prices right now — while stock lasts." products={deals} link="/shop?sort=price_asc" linkLabel="Shop by price" />
      <Brands brands={brands} />
      <HowItWorks online={online} />
      <SellerCta />
    </main>
  );
};

const Home = () => (
  <Layout>
    <HomeContent />
  </Layout>
);

export default Home;
