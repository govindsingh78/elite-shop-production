import React, { useEffect, useState } from "react";
import OtpSignIn from "./OtpSignIn";
import { fetchAuthProviders } from "./googleSignIn";

/**
 * "Email" or "Mobile number" above a sign-in form. The mobile option appears once the store can send codes by
 * SMS; `children` is the email and password form.
 */
const SignInMethods = ({ portal, onSignedIn, children }) => {
  const [phoneAvailable, setPhoneAvailable] = useState(false);
  const [method, setMethod] = useState("email");

  useEffect(() => {
    let active = true;
    fetchAuthProviders().then((options) => active && setPhoneAvailable(Boolean(options.phone))).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!phoneAvailable) return children;

  return (
    <>
      <div className="signin-methods" role="tablist" aria-label="Sign in with">
        {[["email", "Email"], ["phone", "Mobile number"]].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={method === key} className={method === key ? "is-active" : ""} onClick={() => setMethod(key)}>{label}</button>
        ))}
      </div>
      {method === "phone" ? <OtpSignIn portal={portal} onSignedIn={onSignedIn} /> : children}
    </>
  );
};

export default SignInMethods;
