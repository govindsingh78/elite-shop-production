import React, { useId } from "react";

const BRAND_NAME = "Elite Shop";
const BRAND_SLOGAN = "Everyday, elevated.";

/**
 * The Elite Shop mark: a faceted gem that doubles as a shopping bag (handle on top),
 * on a deep-emerald tile with a gold sparkle. Keep in sync with public/favicon.svg.
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
        <linearGradient id={`${id}-gold`} x1="36" y1="4" x2="44" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f6e3b8" />
          <stop offset="1" stopColor="#c99a5b" />
        </linearGradient>
        <linearGradient id={`${id}-gem`} x1="24" y1="17" x2="24" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#43c3d1" stopOpacity=".28" />
          <stop offset="1" stopColor="#43c3d1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id}-tile)`} />
      <rect x=".75" y=".75" width="46.5" height="46.5" rx="12.25" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="1.5" />
      {/* bag handle */}
      <path d="M19.2 17v-2.4a4.8 4.8 0 0 1 9.6 0V17" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      {/* gem body */}
      <path d="M15 17h18l5 6-14 16-14-16 5-6Z" fill={`url(#${id}-gem)`} stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M10.6 23h26.8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      {/* facets */}
      <path d="M17.2 23 24 37.5 30.8 23M19.6 17.6 17.2 23M28.4 17.6 30.8 23" fill="none" stroke="#43c3d1" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
      <strong>Elite<i aria-hidden="true">◆</i><span>Shop</span></strong>
      {showSlogan && <small>{BRAND_SLOGAN}</small>}
    </span>
  </span>
);

export default BrandLogo;
