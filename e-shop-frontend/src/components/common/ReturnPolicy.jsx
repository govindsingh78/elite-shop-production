import React from "react";
import PolicyPage from "./PolicyPage";
import { RETURN_POLICY, RETURN_POLICY_PATH } from "./policy";

/** The Return & Refund Policy. */
const ReturnPolicy = () => (
  <PolicyPage
    slug={RETURN_POLICY}
    path={RETURN_POLICY_PATH}
    mark="Returns"
    crumb="Return & refund policy"
    eyebrow="Customer care"
    heading={<>Returns &amp; <em>refunds.</em></>}
    fallbackIntro="How returns, refunds and cancellations work on Elitezaar."
  />
);

export default ReturnPolicy;
