import React from "react";
import PolicyPage from "./PolicyPage";
import { TERMS, TERMS_PATH } from "./policy";

/** The Terms & Conditions for shopping and selling on Elitezaar. */
const TermsConditions = () => (
  <PolicyPage
    slug={TERMS}
    path={TERMS_PATH}
    mark="Terms"
    crumb="Terms & conditions"
    eyebrow="The fine print"
    heading={<>Terms &amp; <em>conditions.</em></>}
    fallbackIntro="The terms for shopping and selling on Elitezaar."
  />
);

export default TermsConditions;
