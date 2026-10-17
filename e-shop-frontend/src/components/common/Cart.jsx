import React from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { useCart } from "../context/CartContext";

const imageBase = apiUrl.replace(/\/api\/?$/, "");

const Cart = () => {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  return (
    <Layout>
      <main className="container product-detail py-4">
        <nav aria-label="Breadcrumb" className="mb-4"><ol className="breadcrumb"><li className="breadcrumb-item"><Link to="/">Home</Link></li><li className="breadcrumb-item active" aria-current="page">Shopping bag</li></ol></nav>
        <div className="d-flex justify-content-between align-items-end border-bottom pb-3 mb-4">
          <div><p className="text-uppercase text-muted small mb-1">Your edit</p><h1 className="h2 mb-0">Shopping bag</h1></div>
          <span className="text-muted">{items.reduce((sum, item) => sum + item.quantity, 0)} item(s)</span>
        </div>
        {!items.length ? (
          <div className="text-center py-5"><h2 className="h4">Your bag is waiting</h2><p className="text-muted">Find something you’ll love wearing again and again.</p><Link to="/shop" className="btn btn-primary">Explore the collection</Link></div>
        ) : (
          <div className="row g-5">
            <div className="col-lg-8">
              {items.map((item) => (
                <article className="d-flex gap-3 border-bottom py-3" key={item.id}>
                  <Link to={`/product/${item.id}`} className="bg-light rounded flex-shrink-0" style={{ width: 112, height: 132, overflow: "hidden" }}>
                    {item.image && <img src={`${imageBase}/uploads/products/small/${encodeURIComponent(item.image)}`} alt={item.title} className="w-100 h-100" style={{ objectFit: "cover" }} />}
                  </Link>
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between gap-3"><div><Link to={`/product/${item.id}`} className="fw-semibold text-decoration-none">{item.title}</Link><div className="small text-muted mt-1">SKU: {item.sku || "—"}</div></div><strong>₹{(item.price * item.quantity).toFixed(2)}</strong></div>
                    <p className="mb-2 mt-2">₹{item.price.toFixed(2)} each</p>
                    <div className="d-flex align-items-center gap-3"><label htmlFor={`quantity-${item.id}`} className="small mb-0">Qty</label><input id={`quantity-${item.id}`} type="number" min="1" max={item.qtyAvailable ?? 999} className="form-control form-control-sm" style={{ width: 78 }} value={item.quantity} onChange={(event) => updateQuantity(item.id, event.target.value)} /><button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={() => removeItem(item.id)}>Remove</button></div>
                  </div>
                </article>
              ))}
            </div>
            <aside className="col-lg-4"><div className="card border-0 shadow-sm"><div className="card-body p-4"><h2 className="h5 mb-3">Order summary</h2><div className="d-flex justify-content-between border-bottom pb-2"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div><div className="d-flex justify-content-between py-2 text-muted"><span>Shipping</span><span>Calculated at checkout</span></div><div className="d-flex justify-content-between border-top pt-3 mt-2 fw-bold"><span>Total</span><span>₹{subtotal.toFixed(2)}</span></div><Link to="/checkout" className="btn btn-primary w-100 mt-4">Continue to checkout</Link><Link to="/shop" className="btn btn-link w-100 mt-2">Continue shopping</Link></div></div></aside>
          </div>
        )}
      </main>
    </Layout>
  );
};

export default Cart;
