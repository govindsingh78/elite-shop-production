import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AdminAuthContext } from "../context/AdminAuth";

/**
 * "Start selling your products — become our first seller today", in place of an empty store or collection.
 * `collection` is the collection's name when only that one is empty. Signed-in sellers and admins are pointed at
 * adding a product instead.
 */
const StartSelling = ({ collection }) => {
  const { user } = useContext(AdminAuthContext);
  const portal = user?.portal;

  const title = collection ? `Nothing in ${collection} yet` : "Start selling your products";
  let copy;
  let actions;
  if (portal === "vendor") {
    copy = collection
      ? `Be the first seller in ${collection}. List a product today and it appears here once our team approves it.`
      : "Be our first seller today. List a product and it appears here once our team approves it.";
    actions = <>
      <Link to="/vendor/products/create" className="btn btn-primary">List a product</Link>
      <Link to="/vendor/dashboard">Go to your seller hub</Link>
    </>;
  } else if (portal === "admin") {
    copy = collection
      ? `No live products in ${collection} yet. Add one, or approve sellers’ listings waiting for review.`
      : "No live products yet. Add one, or approve sellers’ listings waiting for review.";
    actions = <>
      <Link to="/admin/create-product" className="btn btn-primary">Add a product</Link>
      <Link to="/admin/manage-products?approval=pending">Listings waiting for review</Link>
    </>;
  } else {
    copy = collection
      ? `Sell ${collection.toLowerCase()} on Elitezaar? Become the first seller in this collection today.`
      : "Become our first seller today. Open your Elitezaar store in under a minute, and your products will appear right here for shoppers.";
    actions = <>
      <Link to="/vendor/register" className="btn btn-primary">Become a seller <span aria-hidden="true">↗</span></Link>
      <Link to="/vendor/login">Already selling? Sign in</Link>
    </>;
  }

  return (
    <div className="start-selling">
      <span className="start-selling-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 10h16l-1.5-5h-13L4 10Z" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></svg>
      </span>
      <span className="start-selling-eyebrow">{collection ? "NEW COLLECTION" : "OPENING SOON"}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
      <div className="start-selling-actions">{actions}</div>
      {portal !== "vendor" && portal !== "admin" && (
        <ul className="start-selling-points">
          <li>Open your store in under a minute</li>
          <li>List products from your phone or computer</li>
          <li>Track orders and earnings in your seller hub</li>
        </ul>
      )}
      {collection && <Link to="/shop" className="start-selling-browse">Browse all products <span aria-hidden="true">→</span></Link>}
    </div>
  );
};

export default StartSelling;
