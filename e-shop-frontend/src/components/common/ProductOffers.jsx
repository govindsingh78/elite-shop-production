import React, { useEffect, useState } from "react";
import { copyCode, copyText, fetchOffers } from "./coupons";

/**
 * "Offers and discounts" on the product page: the coupons that cover this product, each with its code to copy, a
 * share button and the T&C. Hidden when there are none.
 */
const ProductOffers = ({ productId, productTitle }) => {
  const [offers, setOffers] = useState([]);
  const [copied, setCopied] = useState("");
  const [terms, setTerms] = useState(null);

  useEffect(() => {
    let active = true;
    fetchOffers([productId]).then((list) => active && setOffers(list)).catch(() => {});
    return () => { active = false; };
  }, [productId]);

  useEffect(() => {
    if (!terms) return undefined;
    const close = (event) => event.key === "Escape" && setTerms(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [terms]);

  if (!offers.length) return null;

  // Copied, and remembered: checkout applies it.
  const copy = async (code) => {
    await copyCode(code);
    setCopied(code);
    setTimeout(() => setCopied((current) => (current === code ? "" : current)), 2000);
  };

  const share = async (offer) => {
    const text = `Use code ${offer.code} on Elitezaar: ${offer.title}`;
    if (navigator.share) {
      navigator.share({ title: productTitle, text, url: window.location.href }).catch(() => {});
    } else if (await copyText(`${text} ${window.location.href}`)) {
      setCopied(`share:${offer.code}`);
      setTimeout(() => setCopied(""), 2000);
    }
  };

  return (
    <section className="pd-offers" aria-labelledby="pd-offers-title">
      <h2 id="pd-offers-title">Offers and discounts</h2>
      <div className="pd-offer-list">
        {offers.map((offer, index) => (
          <article key={offer.code} className={`pd-offer pd-offer--${index % 3}`}>
            <div className="pd-offer-top">
              <span className="pd-offer-badge" aria-hidden="true">%</span>
              <strong title={offer.title}>{offer.title}</strong>
              <button type="button" className="pd-offer-terms" onClick={() => setTerms(offer)}>T&amp;C <span aria-hidden="true">›</span></button>
            </div>
            <p title={offer.description || offer.headline}>{offer.description || offer.headline}</p>
            <div className="pd-offer-actions">
              <button type="button" className="pd-offer-code" onClick={() => copy(offer.code)} aria-label={`Copy code ${offer.code}`}>
                <span>{copied === offer.code ? "Copied ✓" : offer.code}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
              </button>
              <button type="button" className="pd-offer-share" onClick={() => share(offer)} aria-label={`Share the ${offer.code} offer`} title={copied === `share:${offer.code}` ? "Link copied" : "Share"}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></svg>
              </button>
            </div>
          </article>
        ))}
      </div>

      {terms && (
        <div className="pd-offer-modal-backdrop" onClick={() => setTerms(null)}>
          <div className="pd-offer-modal" role="dialog" aria-modal="true" aria-labelledby="pd-offer-modal-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn-close" aria-label="Close" onClick={() => setTerms(null)} />
            <span className="pd-offer-modal-code">{terms.code}</span>
            <h3 id="pd-offer-modal-title">{terms.title}</h3>
            {terms.description && <p>{terms.description}</p>}
            <h4>Terms & conditions</h4>
            <ul>{terms.conditions.map((line) => <li key={line}>{line}</li>)}</ul>
            {terms.terms && <p className="pd-offer-modal-terms">{terms.terms}</p>}
            <button type="button" className="btn btn-primary w-100" onClick={() => { copy(terms.code); setTerms(null); }}>Copy code {terms.code}</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductOffers;
