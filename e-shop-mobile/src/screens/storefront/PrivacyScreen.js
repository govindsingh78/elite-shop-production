import React from "react";
import { PRIVACY } from "@/lib/policy";
import PolicyScreen from "./PolicyScreen";

/** How Elitezaar collects, uses and protects personal information. */
export default function PrivacyScreen() {
  return <PolicyScreen slug={PRIVACY} eyebrow="Your data, respected" heading="Your " accent="privacy." />;
}
