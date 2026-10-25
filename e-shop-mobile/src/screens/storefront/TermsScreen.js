import React from "react";
import { TERMS } from "@/lib/policy";
import PolicyScreen from "./PolicyScreen";

/** The Terms & Conditions for shopping and selling on Elitezaar. */
export default function TermsScreen() {
  return <PolicyScreen slug={TERMS} eyebrow="The fine print" heading="Terms & " accent="conditions." />;
}
