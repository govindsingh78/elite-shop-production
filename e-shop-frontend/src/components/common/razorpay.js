import { apiUrl } from "./http";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise;

/** Loads Razorpay's checkout script once. */
export const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error("Couldn’t load the secure payment window. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
};

/** POSTs to one of the /orders/{id}/payment/* endpoints with the checkout's payment token. */
export const paymentRequest = async (orderId, action, paymentToken, body = {}) => {
  const response = await fetch(`${apiUrl}/orders/${orderId}/payment/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...body, payment_token: paymentToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Payment request failed. Please try again.");
  return data;
};

/** Razorpay checkout display config that opens straight on one payment method. */
export const methodDisplay = (method) => ({
  display: {
    blocks: {
      chosen: method === "upi"
        ? { name: "Pay using UPI", instruments: [{ method: "upi" }] }
        : { name: "Pay using net banking", instruments: [{ method: "netbanking" }] },
    },
    sequence: ["block.chosen"],
    preferences: { show_default_blocks: false },
  },
});
