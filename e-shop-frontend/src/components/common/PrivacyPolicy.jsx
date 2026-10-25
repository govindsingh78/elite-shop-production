import React from "react";
import PolicyPage from "./PolicyPage";
import { PRIVACY, PRIVACY_PATH } from "./policy";

/** How Elitezaar collects, uses and protects personal information. */
const PrivacyPolicy = () => (
  <PolicyPage
    slug={PRIVACY}
    path={PRIVACY_PATH}
    mark="Privacy"
    crumb="Privacy policy"
    eyebrow="Your data, respected"
    heading={<>Your <em>privacy.</em></>}
    fallbackIntro="How Elitezaar collects, uses and protects your personal information."
  />
);

export default PrivacyPolicy;
