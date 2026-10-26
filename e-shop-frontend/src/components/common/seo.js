import { useEffect } from "react";
import { SUPPORT_EMAIL, SUPPORT_PHONES } from "./support";

/**
 * Search and sharing tags. index.html carries site-wide defaults for crawlers that don't run JavaScript;
 * useSeo() gives each public page its own title, description, canonical URL, Open Graph / Twitter tags
 * and schema.org data, and puts the defaults back when the page closes.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://elitezaar.com").replace(/\/+$/, "");
export const SITE_NAME = "Elitezaar";
export const FOUNDER = "Govind Singh";

const DEFAULTS = {
  title: "Elitezaar — Everyday style, elevated | Online shopping in India",
  description: "Shop hand-picked clothing and accessories for women, men and kids from independent sellers. UPI, net banking or cash on delivery, with live order tracking.",
  image: `${SITE_URL}/og-image.jpg`,
};

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/** The store, as schema.org sees it (also in index.html). */
export const organization = () => ({
  "@type": "OnlineStore",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icon-512.png`,
  email: SUPPORT_EMAIL,
  founder: { "@type": "Person", name: FOUNDER },
  contactPoint: SUPPORT_PHONES.map((phone) => ({ "@type": "ContactPoint", telephone: phone.tel, contactType: "customer service", areaServed: "IN", availableLanguage: "en" })),
});

/** Home › Shop › … as schema.org BreadcrumbList. `items` are [name, path] pairs. */
export const breadcrumbs = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], index) => ({ "@type": "ListItem", position: index + 1, name, item: `${SITE_URL}${path}` })),
});

/** Plain text of at most `max` characters, cut at a word, for meta descriptions. */
export const summarize = (text, max = 158) => {
  const plain = String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

const absolute = (url) => (!url ? DEFAULTS.image : /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`);

const PAGE_MARK = "data-seo-page";

function setTag(tag, keyAttr, key, valueAttr, value, pageOnly = false) {
  let node = document.head.querySelector(`${tag}[${keyAttr}="${key}"]`);
  if (!node) {
    node = document.createElement(tag);
    node.setAttribute(keyAttr, key);
    if (pageOnly) node.setAttribute(PAGE_MARK, "");
    document.head.appendChild(node);
  }
  node.setAttribute(valueAttr, value);
}

function apply({ title, description, path, image, type, noindex, extraMeta = [], jsonLd }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULTS.title;
  const url = path ? `${SITE_URL}${path}` : null;
  document.title = fullTitle;
  setTag("meta", "name", "description", "content", description || DEFAULTS.description);
  setTag("meta", "name", "robots", "content", noindex ? "noindex, follow" : "index, follow, max-image-preview:large");
  setTag("meta", "property", "og:type", "content", type || "website");
  setTag("meta", "property", "og:title", "content", title || DEFAULTS.title);
  setTag("meta", "property", "og:description", "content", description || DEFAULTS.description);
  setTag("meta", "property", "og:image", "content", absolute(image));
  setTag("meta", "name", "twitter:title", "content", title || DEFAULTS.title);
  setTag("meta", "name", "twitter:description", "content", description || DEFAULTS.description);
  setTag("meta", "name", "twitter:image", "content", absolute(image));
  if (url) {
    setTag("link", "rel", "canonical", "href", url, true);
    setTag("meta", "property", "og:url", "content", url, true);
  }
  extraMeta.forEach(([property, content]) => setTag("meta", "property", property, "content", content, true));
  if (jsonLd) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute(PAGE_MARK, "");
    script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": [].concat(jsonLd) });
    document.head.appendChild(script);
  }
}

function reset() {
  document.head.querySelectorAll(`[${PAGE_MARK}]`).forEach((node) => node.remove());
  apply({});
}

/**
 * Sets this page's search and sharing tags. Pass `path` (e.g. "/product/classic-linen-shirt") for the canonical URL,
 * `jsonLd` for schema.org objects, and `noindex` for pages search engines shouldn't list.
 * Pass `ready: false` while the page's data is loading, so the tags aren't set twice.
 */
export function useSeo(options) {
  const key = JSON.stringify(options || {});
  useEffect(() => {
    const parsed = JSON.parse(key);
    if (parsed.ready === false) return undefined;
    document.head.querySelectorAll(`[${PAGE_MARK}]`).forEach((node) => node.remove());
    apply(parsed);
    return reset;
  }, [key]);
}
