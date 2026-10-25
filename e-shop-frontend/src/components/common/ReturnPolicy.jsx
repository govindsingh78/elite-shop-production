import React from "react";
import PolicyPage from "./PolicyPage";
import { RETURN_POLICY } from "./policy";

/** The Return & Refund Policy. */
const ReturnPolicy = () => (
  <PolicyPage
    slug={RETURN_POLICY}
    mark="Returns"
    crumb="Return & refund policy"
    eyebrow="Customer care"
    heading={<>Returns &amp; <em>refunds.</em></>}
    fallbackIntro="How returns, refunds and cancellations work on Elitezaar."
  />
);

export default ReturnPolicy;
