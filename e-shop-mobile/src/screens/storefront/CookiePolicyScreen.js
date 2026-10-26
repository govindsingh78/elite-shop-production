import React from "react";
import { COOKIES } from "@/lib/policy";
import PolicyScreen from "./PolicyScreen";

/** The website's cookies and browser storage (the app keeps its sign-in, bag and wishlist on the phone instead). */
export default function CookiePolicyScreen() {
  return <PolicyScreen slug={COOKIES} eyebrow="Your choices, respected" heading="About " accent="cookies." />;
}
