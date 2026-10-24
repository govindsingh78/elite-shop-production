import React, { useContext, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminAuthContext } from "../context/AdminAuth";
import CustomerAuthShell from "../customer/CustomerAuthShell";
import { exchangeGoogleCode, PORTAL_HOME, PORTAL_LOGIN, takePendingGoogleSignIn } from "./googleSignIn";

/** Google sends the browser back here (via the API). Finishes the sign-in, or returns to the sign-in page with the reason. */
const GoogleCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useContext(AdminAuthContext);
  const handled = useRef(false);
  const portal = Object.hasOwn(PORTAL_LOGIN, params.get("portal") ?? "") ? params.get("portal") : "customer";

  useEffect(() => {
    // The code works once; React's development double-run must not spend it twice.
    if (handled.current) return;
    handled.current = true;

    const pending = takePendingGoogleSignIn();
    const backToSignIn = (error) => navigate(PORTAL_LOGIN[portal], { replace: true, state: { from: pending?.from, error } });

    const code = params.get("code");
    if (params.get("cancelled")) {
      backToSignIn();
    } else if (params.get("error") || !code) {
      backToSignIn(params.get("error") || "Google sign-in didn’t finish. Please try again.");
    } else if (!pending?.verifier || pending.portal !== portal) {
      backToSignIn("Please start Google sign-in again from this browser tab.");
    } else {
      exchangeGoogleCode(code, pending.verifier)
        .then((result) => {
          login(result);
          navigate(pending.from || PORTAL_HOME[result.portal] || PORTAL_HOME[portal], { replace: true });
        })
        .catch((error) => backToSignIn(error instanceof TypeError ? "Cannot reach the store right now. Please try again shortly." : error.message));
    }
  }, [params, portal, navigate, login]);

  return (
    <CustomerAuthShell portal={portal} eyebrow="Almost there" title="Signing you in…" subtitle="Just a moment while we finish signing you in with Google.">
      <div className="d-flex justify-content-center py-4" role="status" aria-live="polite">
        <div className="spinner-border text-success" aria-hidden="true" />
        <span className="visually-hidden">Signing you in</span>
      </div>
    </CustomerAuthShell>
  );
};

export default GoogleCallback;
