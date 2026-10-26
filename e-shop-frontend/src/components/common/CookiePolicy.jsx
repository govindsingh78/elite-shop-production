import React from "react";
import PolicyPage from "./PolicyPage";
import { COOKIE_POLICY_PATH, openCookieSettings } from "./consent";
import { COOKIES } from "./policy";

/** The cookies and browser storage the website uses, and changing your cookie choices. */
const CookiePolicy = () => (
  <PolicyPage
    slug={COOKIES}
    path={COOKIE_POLICY_PATH}
    mark="Cookies"
    crumb="Cookie policy"
    eyebrow="Your choices, respected"
    heading={<>About <em>cookies.</em></>}
    fallbackIntro="The cookies and browser storage elitezaar.com uses, and how you choose which ones you allow."
    action={<button type="button" className="btn btn-light pol-cookie-settings" onClick={openCookieSettings}>Change cookie settings</button>}
  />
);

export default CookiePolicy;
