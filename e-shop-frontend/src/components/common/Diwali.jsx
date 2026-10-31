import React from "react";
import { DIWALI_COLORS as C, DIYA, LANTERN, greetingScene, mandala, nightSky, rangoli, toran } from "./festive";
import { HAPPY_DIWALI, SHUBH_DEEPAVALI } from "./diwaliLettering";

// Drawn once: the shapes never change while the page is open.
const TORAN = toran({ width: 2400 });
// The phone layout drops the greeting below the slider's counter and lifts the diyas above the caption.
const SCENES = { wide: greetingScene({ height: 750, textTop: 128, groundY: 512 }), compact: greetingScene({ height: 750, textTop: 150, groundY: 446 }) };
const LEDGE = Array.from({ length: 16 }, (_, index) => 75 + index * 150);
const SKY = nightSky();
const HALO = mandala(0, 0, 250);
const RANGOLI = rangoli(236);
// Soft festival lights drifting up behind the banner: [left %, top %, size px, delay s, duration s].
const LIGHTS = [[3, 93, 14, 0, 9], [14, 30, 8, 2.4, 11], [27, 92, 18, 1.2, 10], [38, 46, 10, 4, 12], [47, 76, 12, 0.6, 9], [55, 22, 9, 3.1, 13],
  [63, 64, 16, 5, 10], [72, 38, 11, 1.8, 12], [81, 80, 15, 3.6, 9], [89, 28, 9, 0.9, 11], [95, 58, 13, 2.7, 10], [33, 14, 7, 6, 14]];

/** Gradients for the lamps and lanterns in one SVG; `id` keeps each SVG's names apart. */
const LightDefs = ({ id }) => (
  <>
    <radialGradient id={`${id}-glow`}><stop offset="0" stopColor="#ffd36b" stopOpacity=".7" /><stop offset=".45" stopColor="#ffb547" stopOpacity=".25" /><stop offset="1" stopColor="#ffb547" stopOpacity="0" /></radialGradient>
    <linearGradient id={`${id}-flame`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff7d6" /><stop offset=".45" stopColor="#ffc53d" /><stop offset="1" stopColor="#ff6a13" /></linearGradient>
    <linearGradient id={`${id}-clay`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e2733b" /><stop offset="1" stopColor="#8f3112" /></linearGradient>
    <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.goldLight} /><stop offset=".55" stopColor={C.gold} /><stop offset="1" stopColor={C.goldDeep} /></linearGradient>
    <radialGradient id={`${id}-paper`} cx=".5" cy=".45" r=".6"><stop offset="0" stopColor="#fff2b3" /><stop offset=".4" stopColor="#ffb627" /><stop offset=".78" stopColor="#f0662a" /><stop offset="1" stopColor="#b8231b" /></radialGradient>
  </>
);

/** A clay diya with a flickering flame, centred on its rim. */
const Diya = ({ id, x, y, scale = 1, delay = 0 }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <circle className="dw-glow" cx="0" cy="-26" r="54" fill={`url(#${id}-glow)`} style={{ animationDelay: `${delay}s` }} />
    <path d={DIYA.foot} fill="#7a2a0e" />
    <path d={DIYA.bowl} fill={`url(#${id}-clay)`} />
    <path d={DIYA.band} fill="none" stroke={C.gold} strokeWidth="2.2" strokeLinecap="round" />
    <path d={DIYA.dots} fill={C.goldLight} />
    <path d={DIYA.rim} fill={`url(#${id}-gold)`} />
    <path d={DIYA.oil} fill="#3d1606" />
    <path d={DIYA.wick} stroke="#2a1205" strokeWidth="2.2" strokeLinecap="round" />
    <g className="dw-flame" style={{ animationDelay: `${delay}s` }}>
      <path d={DIYA.flame} fill={`url(#${id}-flame)`} />
      <path d={DIYA.core} fill="#fffbe8" opacity=".85" />
    </g>
  </g>
);

/** A paper lantern on a string from the top edge, swinging gently. */
const Lantern = ({ id, x, drop, scale, delay = 0 }) => (
  <g className="dw-swing" style={{ transformOrigin: `${x}px 0px`, animationDelay: `${delay}s` }}>
    <path d={`M${x} 0L${x} ${drop}`} stroke={C.gold} strokeOpacity=".7" strokeWidth="1.4" />
    <g transform={`translate(${x} ${drop + 4}) scale(${scale})`}>
      <circle className="dw-glow" cx="0" cy="50" r="86" fill={`url(#${id}-glow)`} />
      <path d={LANTERN.ring} fill="none" stroke={C.gold} strokeWidth="1.6" />
      <path d={LANTERN.fringeGold} stroke={C.gold} strokeWidth="3.2" strokeLinecap="round" />
      <path d={LANTERN.fringeRed} stroke="#d62839" strokeWidth="3.2" strokeLinecap="round" />
      <path d={LANTERN.body} fill={`url(#${id}-paper)`} />
      <path d={LANTERN.shine} fill="#fff" opacity=".16" />
      <path d={LANTERN.ribs} fill="none" stroke="#8a1c12" strokeOpacity=".45" strokeWidth="1.4" />
      <path d={LANTERN.cap} fill={`url(#${id}-gold)`} />
      <path d={LANTERN.base} fill={`url(#${id}-gold)`} />
      <path d={LANTERN.tassel} fill="#d62839" />
    </g>
  </g>
);

/** Marigold and mango-leaf garland, hung along the top of the banner. */
export const Toran = ({ className }) => (
  <svg className={className} viewBox={`0 0 ${TORAN.width} ${TORAN.height}`} preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">
    <defs><linearGradient id="dw-toran-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.goldLight} /><stop offset="1" stopColor={C.goldDeep} /></linearGradient></defs>
    <path d={TORAN.leaves.light} fill={C.leaf} />
    <path d={TORAN.leaves.dark} fill={C.leafDark} />
    <path d={TORAN.leaves.ribs} stroke="#8fd18f" strokeOpacity=".5" strokeWidth="1" />
    <path d={TORAN.thread} stroke="#b8862b" strokeWidth="3" />
    <path d={TORAN.flowers.orange} fill={C.marigold} stroke={C.marigoldDark} strokeWidth="1.6" strokeDasharray="2 1.6" />
    <path d={TORAN.flowers.yellow} fill={C.yellow} stroke={C.yellowDark} strokeWidth="1.6" strokeDasharray="2 1.6" />
    <path d={TORAN.flowers.orangeHearts} fill={C.marigoldDark} />
    <path d={TORAN.flowers.yellowHearts} fill={C.yellowDark} />
    <path d={TORAN.bells} fill="url(#dw-toran-gold)" />
    <path d={TORAN.knots} fill="#d62839" />
  </svg>
);

/** A row of lit diyas along the foot of the banner. */
export const DiyaLedge = () => (
  <svg className="dw-ledge" viewBox="0 0 2400 110" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <defs><LightDefs id="dw-ledge" /></defs>
    <path d="M0 104L2400 104" stroke={C.gold} strokeOpacity=".3" strokeWidth="2" />
    {LEDGE.map((x, index) => <Diya key={x} id="dw-ledge" x={x} y={68} scale={0.62} delay={(index % 5) * 0.37} />)}
  </svg>
);

/** Warm points of light drifting up behind the banner. */
export const FestiveLights = () => (
  <div className="dw-lights" aria-hidden="true">
    {LIGHTS.map(([left, top, size, delay, duration]) => (
      <span key={`${left}-${top}`} style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, animationDelay: `${delay}s`, animationDuration: `${duration}s` }} />
    ))}
  </div>
);

/** Fireworks, twinkling stars and paper lanterns behind the home banner. */
export const FestiveSky = () => (
  <svg className="dw-sky" viewBox={`0 0 ${SKY.width} ${SKY.height}`} preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">
    <defs><LightDefs id="dw-sky" /></defs>
    {SKY.bursts.map((item, index) => (
      <g key={index} className="dw-burst" style={{ animationDelay: `${index * 1.4}s` }}>
        <path d={item.rays} stroke={item.color} strokeWidth="2.4" strokeLinecap="round" />
        <path d={item.dots} fill={item.color} />
      </g>
    ))}
    {SKY.sparkles.map((d, index) => <path key={index} className="dw-twinkle" d={d} fill={C.goldLight} style={{ animationDelay: `${index * 0.9}s` }} />)}
    <g className="dw-sky-lanterns">{SKY.lanterns.map((item, index) => <Lantern key={item.x} id="dw-sky" {...item} delay={index * -2.2} />)}</g>
  </svg>
);

/** Fine gold line-work that turns slowly behind the windows. */
export const Mandala = ({ className }) => (
  <svg className={className} viewBox="-260 -260 520 520" aria-hidden="true" focusable="false">
    <g className="dw-mandala" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d={HALO.rings} />
      <path d={HALO.petals} />
      <path d={HALO.dots} fill="currentColor" stroke="none" />
    </g>
  </svg>
);

/** A round rangoli seen from above. */
export const Rangoli = ({ className }) => (
  <svg className={className} viewBox="-264 -264 528 528" aria-hidden="true" focusable="false">
    {RANGOLI.map((shape, index) => <path key={index} d={shape.d} fill={shape.fill} opacity={shape.opacity} />)}
  </svg>
);

/** "शुभ दीपावली, Happy Diwali" in gold lettering. */
export const DiwaliLettering = ({ className }) => (
  <svg className={className} viewBox="0 0 520 178" role="img" aria-label="शुभ दीपावली, Happy Diwali">
    <defs><linearGradient id="dw-letters" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.goldLight} /><stop offset=".55" stopColor={C.gold} /><stop offset="1" stopColor={C.goldDeep} /></linearGradient></defs>
    <g fill="url(#dw-letters)">
      <path d={SHUBH_DEEPAVALI.d} transform={`translate(${260 - SHUBH_DEEPAVALI.width * 0.25} 0) scale(.5)`} />
      <path d={HAPPY_DIWALI.d} transform={`translate(${260 - HAPPY_DIWALI.width / 2} 66)`} />
    </g>
  </svg>
);

/** Small lit diya for labels such as the announcement bar. */
export const DiyaIcon = ({ className = "dw-icon" }) => (
  <svg className={className} viewBox="-44 -54 88 94" aria-hidden="true" focusable="false">
    <path d={DIYA.bowl} fill="#e2733b" />
    <path d={DIYA.rim} fill={C.gold} />
    <path d={DIYA.oil} fill="#3d1606" />
    <path d={DIYA.flame} fill="#ffc53d" />
    <path d={DIYA.core} fill="#fff7d6" />
  </svg>
);

/** The "Happy Diwali" greeting card used as the first banner slide (4:5). */
export const DiwaliArt = ({ className, compact = false }) => {
  const s = SCENES[compact ? "compact" : "wide"];
  // Each copy of the card names its own gradients: one copy is hidden at a time, and a hidden SVG's gradients don't paint.
  const id = compact ? "dw-artc" : "dw-art";
  return (
    <svg className={className} viewBox={`0 0 ${s.width} ${s.height}`} role="img" aria-label="Happy Diwali, शुभ दीपावली. Warm wishes from the Elitezaar family.">
      <defs>
        <LightDefs id={id} />
        <radialGradient id={`${id}-sky`} cx=".5" cy=".3" r=".85"><stop offset="0" stopColor="#9b2048" /><stop offset=".45" stopColor={C.maroon} /><stop offset="1" stopColor="#24050f" /></radialGradient>
        <radialGradient id={`${id}-floor`}><stop offset="0" stopColor="#ffb547" stopOpacity=".42" /><stop offset="1" stopColor="#ffb547" stopOpacity="0" /></radialGradient>
        <filter id={`${id}-soft`} x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      <rect width={s.width} height={s.height} fill={`url(#${id}-sky)`} />
      <ellipse cx="300" cy={s.rangoli.cy} rx="340" ry="190" fill={`url(#${id}-floor)`} />

      <g className="dw-mandala">
        <path d={s.mandala.rings} fill="none" stroke={C.gold} strokeOpacity=".2" strokeWidth="1.2" />
        <path d={s.mandala.petals} fill="none" stroke={C.gold} strokeOpacity=".2" strokeWidth="1.2" />
        <path d={s.mandala.dots} fill={C.gold} opacity=".24" />
      </g>

      {s.bursts.map((item, index) => (
        <g key={index} className="dw-burst" style={{ animationDelay: `${index * 1.4}s` }}>
          <path d={item.rays} stroke={item.color} strokeWidth="2.4" strokeLinecap="round" />
          <path d={item.dots} fill={item.color} />
        </g>
      ))}
      {s.sparkles.map((d, index) => <path key={index} className="dw-twinkle" d={d} fill={C.goldLight} style={{ animationDelay: `${index * 0.9}s` }} />)}

      {s.lanterns.map((item, index) => <Lantern key={item.x} id={id} {...item} delay={index * -2.2} />)}

      <g fill={`url(#${id}-gold)`}>
        <path d={SHUBH_DEEPAVALI.d} transform={`translate(${s.shubh.x} ${s.shubh.y}) scale(${s.shubh.scale})`} />
        <path d={HAPPY_DIWALI.d} transform={`translate(${s.happy.x} ${s.happy.y}) scale(${s.happy.scale})`} fill={C.gold} opacity=".55" filter={`url(#${id}-soft)`} />
        <path d={HAPPY_DIWALI.d} transform={`translate(${s.happy.x + 2} ${s.happy.y + 3}) scale(${s.happy.scale})`} fill="#24050f" opacity=".55" />
        <path d={HAPPY_DIWALI.d} transform={`translate(${s.happy.x} ${s.happy.y}) scale(${s.happy.scale})`} />
      </g>
      <path d={`M170 ${s.flourishY}L278 ${s.flourishY}M322 ${s.flourishY}L430 ${s.flourishY}`} stroke={C.gold} strokeOpacity=".7" strokeWidth="1.4" />
      <path d={`M300 ${s.flourishY - 7}L307 ${s.flourishY}L300 ${s.flourishY + 7}L293 ${s.flourishY}Z`} fill={C.gold} />
      <text x="300" y={s.wishesY} textAnchor="middle" fill={C.chalk} opacity=".85" fontFamily="Rajdhani, Arial, sans-serif" fontSize="16" fontWeight="700" letterSpacing="4">WARM WISHES FROM THE ELITEZAAR FAMILY</text>

      <g transform={`translate(${s.rangoli.cx} ${s.rangoli.cy}) scale(1 ${s.rangoli.squash})`} opacity=".95">
        {s.rangoli.shapes.map((shape, index) => <path key={index} d={shape.d} fill={shape.fill} opacity={shape.opacity} />)}
      </g>
      {s.diyas.map((item, index) => <Diya key={item.x} id={id} {...item} delay={index * 0.31} />)}
    </svg>
  );
};
