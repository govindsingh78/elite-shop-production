/**
 * The Diwali festive banner: when it shows, and the shapes it is drawn from.
 * Shapes are plain SVG path strings so the website (SVG) and the app (react-native-svg) draw the same artwork.
 * The website and the app keep identical copies of this file.
 */

/* ---------- Season ---------- */
// Lakshmi Puja falls on Sunday 8 November 2026. The banner shows from SEASON_START and switches itself off after SEASON_END.
const DIWALI_DAY = "2026-11-08";
const SEASON_START = "2026-10-18";
const SEASON_END = "2026-11-12";
const FESTIVAL_DAYS = { "2026-11-06": "Happy Dhanteras", "2026-11-07": "Happy Choti Diwali" };

const localDate = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const isoDate = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

/** Null outside the festive season; otherwise how many days are left and the greeting for today. */
export function diwaliSeason(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < localDate(SEASON_START) || today > localDate(SEASON_END)) return null;
  const daysToGo = Math.round((localDate(DIWALI_DAY) - today) / 86400000);
  return {
    year: localDate(DIWALI_DAY).getFullYear(),
    daysToGo,
    greeting: FESTIVAL_DAYS[isoDate(today)] || "Happy Diwali",
    // Before Dhanteras the banner leads with the festive edit; from Dhanteras on it wishes shoppers well.
    festivalDays: daysToGo <= 2,
    countdown: daysToGo > 1 ? `${daysToGo} days to Diwali` : daysToGo === 1 ? "Diwali is tomorrow" : daysToGo === 0 ? "Diwali is today" : "Wishing you a bright year ahead",
  };
}

/* ---------- Colours ---------- */
export const DIWALI_COLORS = {
  night: "#0a1f19",
  maroon: "#5c0d2c",
  gold: "#f2c25b",
  goldLight: "#fff1c1",
  goldDeep: "#c98a2e",
  marigold: "#ff8c1a",
  marigoldDark: "#d9620b",
  yellow: "#ffc21a",
  yellowDark: "#e69a00",
  leaf: "#2f8f3a",
  leafDark: "#1f6e2a",
  magenta: "#e0457b",
  teal: "#1fb5a8",
  purple: "#7b2cbf",
  chalk: "#fff3d6",
};

/* ---------- Geometry helpers ---------- */
const round = (value) => Math.round(value * 10) / 10;
const polar = (cx, cy, radius, angle) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
const point = (cx, cy, radius, angle) => polar(cx, cy, radius, angle).map(round).join(" ");
/** A circle as a path, so many dots can share one element. */
const dot = (cx, cy, r) => `M${round(cx - r)} ${round(cy)}a${round(r)} ${round(r)} 0 1 0 ${round(2 * r)} 0a${round(r)} ${round(r)} 0 1 0 ${round(-2 * r)} 0Z`;
/** A pointed petal from radius r0 out to r1 along `angle`, roughly `spread` radians wide. */
const petal = (cx, cy, r0, r1, angle, spread) => {
  const side = (r0 + r1) / 2 / Math.cos(spread);
  return `M${point(cx, cy, r0, angle)}Q${point(cx, cy, side, angle - spread)} ${point(cx, cy, r1, angle)}Q${point(cx, cy, side, angle + spread)} ${point(cx, cy, r0, angle)}Z`;
};
const ring = (count, draw, offset = 0) => Array.from({ length: count }, (_, index) => draw(offset + (index / count) * Math.PI * 2)).join("");
/** A four-pointed twinkle. */
export const sparkle = (x, y, size) => `M${x} ${y - size}Q${x} ${y} ${x + size} ${y}Q${x} ${y} ${x} ${y + size}Q${x} ${y} ${x - size} ${y}Q${x} ${y} ${x} ${y - size}Z`;

/* ---------- Marigold toran ---------- */
/**
 * A garland of marigolds and mango leaves `width` units wide (about 90 tall): swags between hanging strands,
 * each strand ending in a small brass bell. Flowers of one colour share a path.
 */
export function toran({ width, spacing = 240, dip = 34, flower = 7 }) {
  const top = 9;
  const leaves = { light: "", dark: "", ribs: "" };
  for (let x = 10, index = 0; x < width; x += 19, index += 1) {
    const length = index % 2 ? 30 : 36;
    leaves[index % 2 ? "dark" : "light"] += `M${x} 5C${x + 8} ${13} ${x + 8} ${length - 8} ${x} ${length}C${x - 8} ${length - 8} ${x - 8} ${13} ${x} 5Z`;
    leaves.ribs += `M${x} 8L${x} ${length - 4}`;
  }

  const flowers = { orange: "", yellow: "", orangeHearts: "", yellowHearts: "" };
  const addFlower = (x, y, r, orange) => {
    flowers[orange ? "orange" : "yellow"] += dot(x, y, r);
    flowers[orange ? "orangeHearts" : "yellowHearts"] += dot(x, y, r * 0.38);
  };
  let bells = "";
  let knots = "";
  const anchors = [];
  for (let x = 0; x <= width + spacing; x += spacing) anchors.push(x);

  anchors.forEach((x, index) => {
    // The swag to the next anchor: a shallow curve, flowers in blocks of three colours.
    if (index < anchors.length - 1) {
      const count = Math.round(spacing / (flower * 1.6));
      for (let step = 1; step < count; step += 1) {
        const t = step / count;
        const fx = x + spacing * t;
        const fy = top + 4 * dip * t * (1 - t);
        addFlower(fx, fy, flower, Math.floor(step / 3) % 2 === 0);
      }
    }
    // The strand hanging from the anchor.
    for (let step = 0; step < 5; step += 1) addFlower(x, top + 4 + step * flower * 1.55, flower * 0.86, step % 2 === 1);
    const bellTop = top + 4 + 5 * flower * 1.55 - 2;
    bells += `M${x - 6} ${bellTop + 9}C${x - 6} ${bellTop} ${x + 6} ${bellTop} ${x + 6} ${bellTop + 9}L${x + 8} ${bellTop + 14}L${x - 8} ${bellTop + 14}Z${dot(x, bellTop + 16.5, 2.2)}`;
    knots += dot(x, top, 5.5);
  });

  return { width, height: 92, thread: `M0 ${top}L${width} ${top}`, leaves, flowers, bells, knots };
}

/* ---------- Diya ---------- */
// One clay lamp, centred on the rim; the bowl sits below 0 and the flame rises above it.
export const DIYA = {
  bowl: "M-40 0C-38 21-20 31 0 31C20 31 38 21 40 0Z",
  foot: "M-13 29L13 29L17 37L-17 37Z",
  rim: "M-40 0a40 6.5 0 1 0 80 0a40 6.5 0 1 0 -80 0Z",
  oil: "M-32 0.6a32 4 0 1 0 64 0a32 4 0 1 0 -64 0Z",
  band: "M-36 11C-20 17 20 17 36 11",
  dots: [-24, -12, 0, 12, 24].map((x) => dot(x, 21 - Math.abs(x) / 8, 1.8)).join(""),
  wick: "M0 0L0 -7",
  flame: "M0 -50C10 -34 13 -20 0 -6C-13 -20 -10 -34 0 -50Z",
  core: "M0 -33C5 -25 6 -16 0 -9C-6 -16 -5 -25 0 -33Z",
};

/* ---------- Lantern (akash kandil) ---------- */
// Hangs from 0,0; about 72 wide and 140 tall with its tassel.
export const LANTERN = {
  ring: dot(0, -3, 3.5),
  cap: "M-14 0L14 0L22 12L-22 12Z",
  body: "M-22 12L22 12L36 50L22 88L-22 88L-36 50Z",
  shine: "M-17 17L-9 17L-19 50L-9 83L-17 83L-29 50Z",
  ribs: "M-8 12L-13 50L-8 88M8 12L13 50L8 88M-36 50L36 50",
  base: "M-22 88L22 88L15 97L-15 97Z",
  fringeGold: "M-19 97L-19 128M-5 98L-5 120M9 98L9 126",
  fringeRed: "M-12 98L-12 122M2 98L2 130M16 97L16 120",
  tassel: `${dot(0, 101, 3.2)}M-5 104L5 104L9 140L-9 140Z`,
};

/* ---------- Rangoli ---------- */
/** A round rangoli centred on 0,0 with radius `r`; drawn squashed (scaleY ~0.4) it lies on the floor. */
export function rangoli(r) {
  return [
    { d: dot(0, 0, r * 1.03), fill: "#000", opacity: 0.16 },
    { d: ring(48, (angle) => dot(...polar(0, 0, r * 1.1, angle), r * 0.014)), fill: DIWALI_COLORS.chalk },
    { d: ring(24, (angle) => petal(0, 0, r * 0.7, r, angle, 0.26)), fill: DIWALI_COLORS.magenta },
    { d: ring(24, (angle) => dot(...polar(0, 0, r * 0.93, angle), r * 0.028), Math.PI / 24), fill: DIWALI_COLORS.yellow },
    { d: ring(16, (angle) => petal(0, 0, r * 0.46, r * 0.76, angle, 0.36)), fill: DIWALI_COLORS.marigold },
    { d: ring(16, (angle) => dot(...polar(0, 0, r * 0.66, angle), r * 0.02)), fill: DIWALI_COLORS.chalk },
    { d: ring(8, (angle) => petal(0, 0, r * 0.22, r * 0.56, angle, 0.58), Math.PI / 8), fill: DIWALI_COLORS.yellow },
    { d: ring(8, (angle) => petal(0, 0, r * 0.2, r * 0.44, angle, 0.55)), fill: DIWALI_COLORS.teal },
    { d: dot(0, 0, r * 0.21), fill: DIWALI_COLORS.purple },
    { d: ring(8, (angle) => dot(...polar(0, 0, r * 0.15, angle), r * 0.022)), fill: DIWALI_COLORS.chalk },
    { d: dot(0, 0, r * 0.08), fill: DIWALI_COLORS.yellow },
  ];
}

/* ---------- Mandala and fireworks ---------- */
/** Faint line-work mandala behind the greeting. */
export function mandala(cx, cy, r) {
  return {
    rings: [0.18, 0.46, 0.82, 1].map((share) => dot(cx, cy, r * share)).join(""),
    petals: ring(16, (angle) => petal(cx, cy, r * 0.46, r * 0.82, angle, 0.16)) + ring(12, (angle) => petal(cx, cy, r * 0.18, r * 0.46, angle, 0.22), Math.PI / 12),
    dots: ring(36, (angle) => dot(...polar(cx, cy, r * 0.91, angle), 2.2)),
  };
}

/** A firework burst: rays and a dot at the end of each. */
export function burst(cx, cy, r, rays = 14) {
  return {
    rays: ring(rays, (angle) => `M${point(cx, cy, r * 0.32, angle)}L${point(cx, cy, r * 0.8, angle)}`),
    dots: ring(rays, (angle) => dot(...polar(cx, cy, r * 0.93, angle), Math.max(1.6, r * 0.045))),
  };
}

/* ---------- The greeting card ---------- */
/**
 * Where everything sits on the 600-unit-wide greeting card. `textTop` is the top of the Hindi line and
 * `groundY` the centre of the rangoli, so each banner can leave room for its own caption.
 */
export function greetingScene({ height, textTop, groundY }) {
  const happyTop = textTop + 56;
  const wishesY = happyTop + 128;
  return {
    width: 600,
    height,
    shubh: { x: 300 - (417.7 * 0.44) / 2, y: textTop, scale: 0.44 },
    happy: { x: 300 - (494.4 * 0.8) / 2, y: happyTop, scale: 0.8 },
    flourishY: happyTop + 100,
    wishesY,
    mandala: mandala(300, happyTop + 30, 196),
    lanterns: [{ x: 46, drop: textTop + 4, scale: 0.8 }, { x: 554, drop: textTop + 64, scale: 0.8 }],
    bursts: [
      { ...burst(168, textTop * 0.55, 40), color: DIWALI_COLORS.gold },
      { ...burst(436, textTop * 0.5, 30, 12), color: "#ff9fc0" },
      { ...burst(500, wishesY + 52, 30), color: "#9fe6dd" },
    ],
    sparkles: [
      [sparkle(112, textTop + 36, 7), sparkle(498, happyTop + 4, 6), sparkle(250, wishesY + 40, 5), sparkle(560, groundY - 40, 6)].join(""),
      [sparkle(330, textTop * 0.35, 6), sparkle(84, happyTop + 150, 6), sparkle(386, wishesY + 52, 4)].join(""),
      [sparkle(240, textTop * 0.7, 4), sparkle(60, groundY - 90, 5), sparkle(410, happyTop - 10, 4), sparkle(150, wishesY + 30, 4)].join(""),
    ],
    rangoli: { cx: 300, cy: groundY, r: 236, squash: 0.38, shapes: rangoli(236) },
    diyas: [
      { x: 300, y: groundY - 10, scale: 1.2 },
      { x: 158, y: groundY + 14, scale: 0.92 },
      { x: 442, y: groundY + 14, scale: 0.92 },
      { x: 56, y: groundY + 50, scale: 0.74 },
      { x: 544, y: groundY + 50, scale: 0.74 },
    ],
  };
}
