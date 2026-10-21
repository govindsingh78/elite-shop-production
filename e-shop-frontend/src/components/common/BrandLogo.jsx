import React, { useId } from "react";

const BRAND_NAME = "Elitezaar";
const BRAND_SLOGAN = "Everyday, elevated.";

/**
 * The Elitezaar mark: a bold "Z" framed by a gold shopfront arch (the doorway to the bazaar),
 * on a deep-emerald tile with a gold sparkle. Keep in sync with public/favicon.svg and public/brand/.
 */
export const BrandMark = ({ size = 40, className = "" }) => {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`brand-mark ${className}`} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={BRAND_NAME}>
      <defs>
        <linearGradient id={`${id}-tile`} x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1f5a4a" />
          <stop offset=".55" stopColor="#123a30" />
          <stop offset="1" stopColor="#0a1f19" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="12" y1="4" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f6e3b8" />
          <stop offset="1" stopColor="#c99a5b" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id}-tile)`} />
      <rect x=".75" y=".75" width="46.5" height="46.5" rx="12.25" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="1.5" />
      {/* shopfront arch */}
      <path d="M13 39.5V21.5a11 11 0 0 1 22 0v18" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Z */}
      <path d="M18.6 20.5h10.8L18.6 32.5h10.8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* sparkle */}
      <path d="M39.5 4.5c.4 2.1 1.4 3.1 3.5 3.5-2.1.4-3.1 1.4-3.5 3.5-.4-2.1-1.4-3.1-3.5-3.5 2.1-.4 3.1-1.4 3.5-3.5Z" fill={`url(#${id}-gold)`} />
    </svg>
  );
};

/** Full logo: mark, wordmark and slogan. `tone="light"` is for dark backgrounds. */
const BrandLogo = ({ tone = "dark", size = 42, showSlogan = true, className = "" }) => (
  <span className={`brand-logo brand-logo--${tone} ${className}`}>
    <BrandMark size={size} />
    <span className="brand-logo-text">
      <strong>Elite<span>zaar</span><i>.com</i></strong>
      {showSlogan && <small>{BRAND_SLOGAN}</small>}
    </span>
  </span>
);

export default BrandLogo;
