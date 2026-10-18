import React, { useId } from "react";

const BRAND_NAME = "Street Shop";
const BRAND_SLOGAN = "Everyday, elevated.";

/** The Street Shop mark: a striped awning over a shopfront on a deep-green tile, with a gold sparkle. */
export const BrandMark = ({ size = 40, className = "" }) => {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`brand-mark ${className}`} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={BRAND_NAME}>
      <defs>
        <linearGradient id={`${id}-tile`} x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2b5a4b" />
          <stop offset="1" stopColor="#0f241d" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="33" y1="5" x2="42" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f3dfb3" />
          <stop offset="1" stopColor="#c99a5b" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id}-tile)`} />
      <rect x=".75" y=".75" width="46.5" height="46.5" rx="12.25" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="1.5" />
      <path d="M10 15h28v5a3.5 3.5 0 0 1-7 0a3.5 3.5 0 0 1-7 0a3.5 3.5 0 0 1-7 0a3.5 3.5 0 0 1-7 0Z" fill="#fff" />
      <path d="M17 15h7v5a3.5 3.5 0 0 1-7 0ZM31 15h7v5a3.5 3.5 0 0 1-7 0Z" fill="#43c3d1" />
      <path d="M12.5 26v12h23V26" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 38v-6.5h6V38" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M37.5 4c.45 2.4 1.6 3.55 4 4-2.4.45-3.55 1.6-4 4-.45-2.4-1.6-3.55-4-4 2.4-.45 3.55-1.6 4-4Z" fill={`url(#${id}-gold)`} />
    </svg>
  );
};

/** Full logo: mark, wordmark and slogan. `tone="light"` is for dark backgrounds. */
const BrandLogo = ({ tone = "dark", size = 42, showSlogan = true, className = "" }) => (
  <span className={`brand-logo brand-logo--${tone} ${className}`}>
    <BrandMark size={size} />
    <span className="brand-logo-text">
      <strong>Street<span>Shop</span></strong>
      {showSlogan && <small>{BRAND_SLOGAN}</small>}
    </span>
  </span>
);

export default BrandLogo;
