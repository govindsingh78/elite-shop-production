import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";
import { useStorefrontCategories } from "./useStorefrontCategories";
import { SUPPORT_EMAIL, SUPPORT_PHONES } from "./support";
import founderPhoto from "../../assets/images/founder.jpg";
import { FOUNDER, ORGANIZATION_ID, SITE_URL, breadcrumbs, useSeo } from "./seo";

const Icon = ({ children }) => <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;

const PROMISES = [
  {
    title: "Every listing reviewed",
    copy: "Products from our sellers are checked by the Elitezaar team before they appear in the store.",
    icon: <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  },
  {
    title: "Independent sellers",
    copy: "We are home to independent brands and makers, so every order supports a real business.",
    icon: <><path d="M4 10h16l-1.5-5h-13L4 10Z" /><path d="M5 10v9h14v-9M9 19v-5h6v5" /></>,
  },
  {
    title: "Tracked to your door",
    copy: "Follow your order from packing to delivery, with live updates in your account.",
    icon: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></>,
  },
  {
    title: "Pay your way",
    copy: "UPI, net banking or cash on delivery. Online payments are processed securely by Razorpay.",
    icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  },
];

const FOUNDER_FACTS = [
  ["Education", "B.Tech in Computer Science (2011), Rajasthan Technical University · Shrinath Ji Institute of Technology & Engineering"],
  ["Experience", "15 years building web and mobile applications"],
  ["Hobbies", "Singing and playing cricket"],
];

const FOUNDER_STACK = ["PHP", "OOP", "Laravel", "Drupal", "HTML", "CSS", "Bootstrap", "jQuery", "AJAX", "React", "React Native"];

const STEPS = [
  { title: "Discover", copy: "Browse collections picked for everyday wear, from wardrobe staples to the finishing touches." },
  { title: "Order", copy: "Check out as a guest or with an account, and pay online or in cash when it arrives." },
  { title: "Track", copy: "Watch your order move from our sellers to your door, and call us if you need a hand." },
];

const About = () => {
  const { categories } = useStorefrontCategories();
  // "Read our story" links straight to the founder section.
  useEffect(() => {
    if (window.location.hash === "#founder") document.getElementById("founder")?.scrollIntoView();
  }, []);
  useSeo({
    title: "About us — our story and our founder",
    description: `Elitezaar is an online marketplace for hand-picked everyday style from independent sellers, founded by ${FOUNDER}. Meet the founder and see what we promise on every order.`,
    path: "/about",
    jsonLd: [
      {
        "@type": "AboutPage",
        "@id": `${SITE_URL}/about#page`,
        url: `${SITE_URL}/about`,
        name: "About Elitezaar",
        about: { "@id": ORGANIZATION_ID },
        mainEntity: { "@id": `${SITE_URL}/about#founder` },
      },
      {
        "@type": "Person",
        "@id": `${SITE_URL}/about#founder`,
        name: FOUNDER,
        jobTitle: "Founder",
        image: new URL(founderPhoto, SITE_URL).href,
        worksFor: { "@id": ORGANIZATION_ID },
        alumniOf: { "@type": "CollegeOrUniversity", name: "Rajasthan Technical University" },
        knowsAbout: ["Web application development", "Mobile app development", ...FOUNDER_STACK],
      },
      breadcrumbs([["Home", "/"], ["About us", "/about"]]),
    ],
  });

  return (
    <Layout>
      <main className="about-page">
        <section className="sp-hero">
          <span className="sp-hero-mark" aria-hidden="true">About</span>
          <div className="container">
            <nav aria-label="Breadcrumb">
              <ol className="breadcrumb shop-breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                <li className="breadcrumb-item active" aria-current="page">About us</li>
              </ol>
            </nav>
            <div className="sp-hero-copy">
              <div>
                <span className="sp-hero-eyebrow"><i aria-hidden="true" />Our story</span>
                <h1>Good things, <em>chosen well.</em></h1>
                <p>Elitezaar is an online marketplace for considered everyday style: clothing, accessories and more from independent sellers, brought together in one carefully kept store.</p>
                <div className="ab-hero-actions">
                  <Link to="/shop" className="btn btn-primary lp-btn">Shop the collection <span aria-hidden="true">↗</span></Link>
                  <Link to="/vendor/register" className="lp-btn-ghost">Sell on Elitezaar</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="container">
            <div className="row g-4 g-lg-5 align-items-center">
              <div className="col-lg-7">
                <span className="shop-eyebrow">WHO WE ARE</span>
                <h2 className="ab-title">A store you can trust, made of sellers you’ll love.</h2>
                <p className="ab-copy">Shopping online should feel as considered as a good local shop. Instead of an endless aisle, Elitezaar keeps a curated edit: pieces chosen to be worn on repeat, from sellers who care about what they make.</p>
                <p className="ab-copy">Every seller on Elitezaar runs their own store with us, and every product they list is reviewed by our team before shoppers can see it. That way you get the variety of a marketplace with the care of a boutique.</p>
              </div>
              <div className="col-lg-5">
                <figure className="ab-quote">
                  <span className="ab-quote-mark" aria-hidden="true">“</span>
                  <blockquote>Fewer, better things, chosen with care and delivered with it too.</blockquote>
                  <figcaption>The Elitezaar promise</figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section lp-section--warm" id="founder" aria-labelledby="about-founder">
          <div className="container">
            <div className="ab-founder">
              <figure className="ab-founder-photo">
                <img src={founderPhoto} alt="Govind Singh, founder of Elitezaar" width="600" height="600" loading="lazy" />
                <figcaption><strong>Govind Singh</strong><span>Founder, Elitezaar.com</span></figcaption>
              </figure>
              <div>
                <span className="shop-eyebrow">MEET THE FOUNDER</span>
                <h2 className="ab-title" id="about-founder">A dream project, built with care.</h2>
                <p className="ab-copy">After completing my B.Tech in Computer Science in 2011, I’ve spent 15 years building web and mobile applications for companies. Today I pair that experience with AI tools like Claude to build better products, faster.</p>
                <p className="ab-copy">Elitezaar is my dream project, and where all of it comes together: a store built to make shopping online feel as personal and trustworthy as a good local shop.</p>
                <p className="ab-signature" aria-hidden="true">Govind Singh</p>
                <dl className="ab-founder-facts">
                  {FOUNDER_FACTS.map(([label, value]) => (
                    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
                <div className="ab-founder-stack">
                  <span>Tools of the trade</span>
                  <ul>{FOUNDER_STACK.map((tool) => <li key={tool}>{tool}</li>)}</ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="container">
            <div className="lp-head">
              <div>
                <span className="shop-eyebrow">WHY ELITEZAAR</span>
                <h2>What we promise</h2>
                <p>The things we look after on every order.</p>
              </div>
            </div>
            <div className="row g-3 g-lg-4">
              {PROMISES.map((promise) => (
                <div className="col-sm-6 col-xl-3" key={promise.title}>
                  <article className="ab-card">
                    <span className="ab-card-icon"><Icon>{promise.icon}</Icon></span>
                    <h3>{promise.title}</h3>
                    <p>{promise.copy}</p>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-section--warm">
          <div className="container">
            <div className="lp-head">
              <div>
                <span className="shop-eyebrow">HOW IT WORKS</span>
                <h2>From our sellers to your door</h2>
              </div>
            </div>
            <ol className="ab-steps">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="ab-step-number">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="lp-section">
            <div className="container">
              <div className="lp-head">
                <div>
                  <span className="shop-eyebrow">OUR COLLECTIONS</span>
                  <h2>Find your edit</h2>
                </div>
                <Link to="/shop" className="lp-head-link">All products <span aria-hidden="true">→</span></Link>
              </div>
              <nav className="ab-collections" aria-label="Collections">
                {categories.map((category) => (
                  <Link key={category.id} to={`/shop/${category.slug}`}>
                    {category.name}
                    {category.children?.length > 0 && <small>{category.children.map((child) => child.name).join(" · ")}</small>}
                  </Link>
                ))}
              </nav>
            </div>
          </section>
        )}

        <section className="lp-section">
          <div className="container">
            <div className="row g-4">
              <div className="col-lg-6">
                <article className="ab-panel">
                  <span className="shop-eyebrow">FOR SHOPPERS</span>
                  <h2>Shop with confidence</h2>
                  <p>Create an account to save your addresses, check out faster and follow every order live.</p>
                  <div className="ab-panel-actions">
                    <Link to="/customer/register" className="btn btn-primary">Create an account</Link>
                    <Link to="/shop" className="lp-btn-ghost">Start shopping</Link>
                  </div>
                </article>
              </div>
              <div className="col-lg-6">
                <article className="ab-panel ab-panel--dark">
                  <span className="shop-eyebrow">FOR SELLERS</span>
                  <h2>Grow your brand with us</h2>
                  <p>Open your Elitezaar store, list your products and manage orders and shipping from one simple seller hub.</p>
                  <div className="ab-panel-actions">
                    <Link to="/vendor/register" className="btn lp-btn-gold">Become a seller</Link>
                    <Link to="/vendor/login" className="ab-link-light">Seller login →</Link>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="container">
            <div className="ab-contact">
              <div>
                <span className="shop-eyebrow">TALK TO US</span>
                <h2>We’re here to help</h2>
                <p>Questions about an order, a product or selling with us? Call our helpline for customers and sellers, or write to us.</p>
              </div>
              <div className="ab-contact-links">
                {SUPPORT_PHONES.map((phone) => (
                  <a key={phone.tel} href={`tel:${phone.tel}`}>
                    <Icon><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></Icon>
                    {phone.label}
                  </a>
                ))}
                <a href={`mailto:${SUPPORT_EMAIL}`}>
                  <Icon><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Icon>
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </div>
            <p className="ab-credits">
              Country, state and city lists in our address forms come from the{" "}
              <a href="https://github.com/dr5hn/countries-states-cities-database" target="_blank" rel="noreferrer">Countries States Cities Database</a>
              {" "}© its contributors, used under the{" "}
              <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Database License</a>.
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default About;
