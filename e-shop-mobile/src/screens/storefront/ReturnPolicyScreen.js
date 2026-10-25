import React from "react";
import { RETURN_POLICY } from "@/lib/policy";
import PolicyScreen from "./PolicyScreen";

/** The Return & Refund Policy. */
export default function ReturnPolicyScreen() {
  return <PolicyScreen slug={RETURN_POLICY} eyebrow="Customer care" heading="Returns & " accent="refunds." />;
}
