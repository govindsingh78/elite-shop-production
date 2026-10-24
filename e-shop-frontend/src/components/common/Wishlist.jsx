import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "./Layout";
import StorefrontProductCard from "./StorefrontProductCard";
import { HeartIcon } from "./WishlistButton";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/wishlist";
import { AdminAuthContext } from "../context/AdminAuth";

const canBuy = (item) => item.available !== false && item.qty !== 0;

/** Saved pieces, with "Move to bag". Guests are invited to sign in so the list follows them to the app. */
const Wishlist = () => {
  const { items, remove } = useWishlist();
  const { addItem } = useCart();
  const { user } = useContext(AdminAuthContext);
  const isCustomer = user?.portal === "customer";
  const buyable = items.filter(canBuy);

  const removeItem = (item) => remove(item.id).catch((error) => toast.error(error.message));

  const moveToBag = (item) => {
    addItem(item, 1);
    removeItem(item);
    toast.success(<span>{item.title} moved to your bag. <Link to="/cart">View bag</Link></span>);
  };

  const moveAll = () => {
    buyable.forEach((item) => {
      addItem(item, 1);
      removeItem(item);
    });
    toast.success(<span>{buyable.length} pieces moved to your bag. <Link to="/cart">View bag</Link></span>);
  };

  return (
    <Layout>
      <main className="wishlist-page">
        <section className="sp-hero">
          <span className="sp-hero-mark" aria-hidden="true">Saved</span>
          <div className="container">
            <nav aria-label="Breadcrumb">
              <ol className="breadcrumb shop-breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                <li className="breadcrumb-item active" aria-current="page">Wishlist</li>
              </ol>
            </nav>
            <div className="sp-hero-copy">
              <div>
                <span className="sp-hero-eyebrow"><i aria-hidden="true" />Saved for later</span>
                <h1>Your <em>wishlist.</em></h1>
                <p>{items.length ? `${items.length} ${items.length === 1 ? "piece" : "pieces"} you’ve saved. Move them to your bag whenever you’re ready.` : "Tap the heart on any piece to keep it here for later."}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="container py-4 py-lg-5">
          {!isCustomer && items.length > 0 && (
            <div className="wl-signin">
              <span className="wl-signin-icon"><HeartIcon filled /></span>
              <span><strong>Keep your wishlist everywhere.</strong> Sign in to save these pieces to your account and see them in the Elitezaar app too.</span>
              <Link to="/customer/login" state={{ from: "/wishlist" }} className="btn btn-primary">Sign in</Link>
            </div>
          )}

          {items.length ? (
            <>
              <div className="wl-toolbar">
                <strong>{items.length} saved</strong>
                {buyable.length > 1 && <button type="button" className="wl-move-all" onClick={moveAll}>Move all to bag <span aria-hidden="true">↗</span></button>}
              </div>
              <div className="row g-3 g-md-4">
                {items.map((item) => (
                  <div className="col-6 col-md-4 col-xl-3" key={item.id}>
                    <div className={`wl-item${item.available === false ? " is-unavailable" : ""}`}>
                      <StorefrontProductCard product={item} />
                      {item.available === false && <span className="wl-unavailable">No longer available</span>}
                      <div className="wl-actions">
                        <button type="button" className="wl-move" onClick={() => moveToBag(item)} disabled={!canBuy(item)}>
                          {item.available === false ? "Unavailable" : item.qty === 0 ? "Sold out" : "Move to bag"}
                        </button>
                        <button type="button" className="wl-remove" onClick={() => removeItem(item)} aria-label={`Remove ${item.title} from your wishlist`}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="shop-empty-state wl-empty">
              <span className="wl-empty-icon"><HeartIcon /></span>
              <h3>Your wishlist is empty</h3>
              <p>Tap the heart on any piece to save it here, then move it to your bag when you’re ready.</p>
              <Link to="/shop" className="btn btn-primary">Discover the collection</Link>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
};

export default Wishlist;
