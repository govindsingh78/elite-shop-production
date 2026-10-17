import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Layout from "./Layout";
import { formatPrice } from "./currency";

const OrderConfirmation = () => {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState("");

  useEffect(() => {
    if (order) return undefined;
    // Do not call the admin-only order detail endpoint from the public confirmation page.
    setError(`Your order was received. Keep order number #${id} for your records.`);
    setLoading(false);
    return undefined;
  }, [id, order]);

  return (
    <Layout>
      <main className="container py-5" style={{ maxWidth: 760 }}>
        {loading ? <p role="status">Loading your order...</p> : (
          <div className="card border-0 shadow-sm text-center p-4 p-md-5">
            <div className="display-5 text-success mb-3" aria-hidden="true">✓</div>
            <p className="text-uppercase text-muted small mb-1">Order received</p>
            <h1 className="h2">Thank you for your order</h1>
            <p className="text-muted">Your confirmation number is <strong>#{order?.id || id}</strong>.</p>
            {order && (
              <div className="text-start border rounded p-3 my-3">
                <div className="d-flex justify-content-between"><span>Order status</span><strong className="text-capitalize">{order.status}</strong></div>
                <div className="d-flex justify-content-between mt-2"><span>Payment</span><strong className="text-capitalize">{order.payment_method} (due on delivery)</strong></div>
                <div className="d-flex justify-content-between border-top mt-3 pt-3"><span>Total</span><strong>{formatPrice(order.total)}</strong></div>
              </div>
            )}
            {error && <p className="small text-muted">{error}</p>}
            <p className="text-muted">We’ve saved your order. Our team will prepare it for delivery.</p>
            <Link to="/shop" className="btn btn-primary align-self-center">Continue shopping</Link>
          </div>
        )}
      </main>
    </Layout>
  );
};

export default OrderConfirmation;
