import React, { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { DIWALI_COLORS as C, DIYA, LANTERN, greetingScene, toran } from "@/lib/festive";
import { HAPPY_DIWALI, SHUBH_DEEPAVALI } from "@/lib/diwaliLettering";
import { fonts } from "@/theme";

// Drawn once: the shapes never change while the app is open.
const TORAN = toran({ width: 1600, spacing: 200, dip: 30 });
// Each loop starts at rest (full flame, lanterns hanging straight) and runs through [value, milliseconds] steps:
// an uneven flicker for the flames, a slow twinkle and a lantern swing.
const FLICKER = { rest: 1, steps: [[0.35, 140], [0.85, 220], [0.15, 160], [1, 260], [0.55, 200], [1, 180]] };
const TWINKLE = { rest: 1, steps: [[0, 1400], [1, 1400]] };
const SWING = { rest: 0.5, steps: [[1, 1300], [0, 2600], [0.5, 1300]] };

/** A looping 0–1 value; it stays at rest when the phone asks for reduced motion. */
function useLoop({ rest, steps }) {
  const [value] = useState(() => new Animated.Value(rest));
  useEffect(() => {
    let loop = null;
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active || reduce) return;
      loop = Animated.loop(Animated.sequence(steps.map(([toValue, duration]) => Animated.timing(value, {
        toValue, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web",
      }))));
      loop.start();
    }).catch(() => {});
    return () => {
      active = false;
      loop?.stop();
    };
  }, [steps, value]);
  return value;
}

/** Gradients for lamps and lanterns; every Svg needs its own copy. */
function LightDefs() {
  return (
    <>
      <RadialGradient id="glow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#ffd36b" stopOpacity="0.7" /><Stop offset="0.45" stopColor="#ffb547" stopOpacity="0.25" /><Stop offset="1" stopColor="#ffb547" stopOpacity="0" /></RadialGradient>
      <LinearGradient id="flame" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#fff7d6" /><Stop offset="0.45" stopColor="#ffc53d" /><Stop offset="1" stopColor="#ff6a13" /></LinearGradient>
      <LinearGradient id="clay" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#e2733b" /><Stop offset="1" stopColor="#8f3112" /></LinearGradient>
      <LinearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.goldLight} /><Stop offset="0.55" stopColor={C.gold} /><Stop offset="1" stopColor={C.goldDeep} /></LinearGradient>
      <RadialGradient id="paper" cx="50%" cy="45%" r="60%"><Stop offset="0" stopColor="#fff2b3" /><Stop offset="0.4" stopColor="#ffb627" /><Stop offset="0.78" stopColor="#f0662a" /><Stop offset="1" stopColor="#b8231b" /></RadialGradient>
    </>
  );
}

const at = ({ x, y, scale }) => `translate(${x} ${y}) scale(${scale})`;

/** Marigold and mango-leaf garland hung across the screen. */
export function Toran({ width, height = 50, style }) {
  return (
    <View style={[{ width, height }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} viewBox={`0 0 ${TORAN.width} ${TORAN.height}`} preserveAspectRatio="xMidYMin slice">
        <Defs><LinearGradient id="bell" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.goldLight} /><Stop offset="1" stopColor={C.goldDeep} /></LinearGradient></Defs>
        <Path d={TORAN.leaves.light} fill={C.leaf} />
        <Path d={TORAN.leaves.dark} fill={C.leafDark} />
        <Path d={TORAN.leaves.ribs} stroke="#8fd18f" strokeOpacity={0.5} strokeWidth={1} />
        <Path d={TORAN.thread} stroke="#b8862b" strokeWidth={3} />
        <Path d={TORAN.flowers.orange} fill={C.marigold} stroke={C.marigoldDark} strokeWidth={1.6} strokeDasharray="2 1.6" />
        <Path d={TORAN.flowers.yellow} fill={C.yellow} stroke={C.yellowDark} strokeWidth={1.6} strokeDasharray="2 1.6" />
        <Path d={TORAN.flowers.orangeHearts} fill={C.marigoldDark} />
        <Path d={TORAN.flowers.yellowHearts} fill={C.yellowDark} />
        <Path d={TORAN.bells} fill="url(#bell)" />
        <Path d={TORAN.knots} fill="#d62839" />
      </Svg>
    </View>
  );
}

/** A lantern on its own layer, turning about the point its string hangs from. */
function SwingingLantern({ lantern, k, offsetY, swing }) {
  const reach = lantern.drop + 4 + 140 * lantern.scale;
  const half = 72;
  const rotate = swing.interpolate({ inputRange: [0, 1], outputRange: lantern.x < 300 ? ["-2.5deg", "2.5deg"] : ["2.5deg", "-2.5deg"] });
  // The layer is twice the lantern's reach tall and centred on the hanging point, so rotating it swings the lantern.
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", left: (lantern.x - half) * k, top: offsetY - reach * k, width: half * 2 * k, height: reach * 2 * k, transform: [{ rotate }] }}>
      <Svg width="100%" height="100%" viewBox={`${lantern.x - half} ${-reach} ${half * 2} ${reach * 2}`}>
        <Defs><LightDefs /></Defs>
        <Path d={`M${lantern.x} 0L${lantern.x} ${lantern.drop}`} stroke={C.gold} strokeOpacity={0.7} strokeWidth={1.4} />
        <G transform={at({ x: lantern.x, y: lantern.drop + 4, scale: lantern.scale })}>
          <Ellipse cx={0} cy={50} rx={86} ry={86} fill="url(#glow)" />
          <Path d={LANTERN.ring} fill="none" stroke={C.gold} strokeWidth={1.6} />
          <Path d={LANTERN.fringeGold} stroke={C.gold} strokeWidth={3.2} strokeLinecap="round" />
          <Path d={LANTERN.fringeRed} stroke="#d62839" strokeWidth={3.2} strokeLinecap="round" />
          <Path d={LANTERN.body} fill="url(#paper)" />
          <Path d={LANTERN.shine} fill="#fff" opacity={0.16} />
          <Path d={LANTERN.ribs} fill="none" stroke="#8a1c12" strokeOpacity={0.45} strokeWidth={1.4} />
          <Path d={LANTERN.cap} fill="url(#gold)" />
          <Path d={LANTERN.base} fill="url(#gold)" />
          <Path d={LANTERN.tassel} fill="#d62839" />
        </G>
      </Svg>
    </Animated.View>
  );
}

/**
 * The "Happy Diwali" card that leads the home banner in the festive season, filling `width` x `height`.
 * Bottom ~40% is left calm for the slide's own caption.
 */
export function DiwaliGreeting({ width, height }) {
  const k = width / 600;
  // Wide screens would squash the card, so it keeps a minimum height and trims top and bottom evenly instead.
  const sceneHeight = Math.max(Math.round(height / k), 600);
  const offsetY = (height - sceneHeight * k) / 2;
  const scene = useMemo(() => greetingScene({ height: sceneHeight, textTop: 64, groundY: sceneHeight - 262 }), [sceneHeight]);
  const flicker = useLoop(FLICKER);
  const twinkle = useLoop(TWINKLE);
  const swing = useLoop(SWING);
  const viewBox = `0 0 600 ${sceneHeight}`;
  const layer = { width, height, viewBox, preserveAspectRatio: "xMidYMid slice" };

  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel="Happy Diwali, शुभ दीपावली. Warm wishes from the Elitezaar family.">
      <Svg {...layer}>
        <Defs>
          <LightDefs />
          <RadialGradient id="sky" cx="50%" cy="30%" r="85%"><Stop offset="0" stopColor="#9b2048" /><Stop offset="0.45" stopColor={C.maroon} /><Stop offset="1" stopColor="#24050f" /></RadialGradient>
          <RadialGradient id="floor" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#ffb547" stopOpacity="0.42" /><Stop offset="1" stopColor="#ffb547" stopOpacity="0" /></RadialGradient>
        </Defs>
        <Rect width={600} height={sceneHeight} fill="url(#sky)" />
        <Ellipse cx={300} cy={scene.rangoli.cy} rx={340} ry={190} fill="url(#floor)" />
        <Path d={scene.mandala.rings} fill="none" stroke={C.gold} strokeOpacity={0.2} strokeWidth={1.2} />
        <Path d={scene.mandala.petals} fill="none" stroke={C.gold} strokeOpacity={0.2} strokeWidth={1.2} />
        <Path d={scene.mandala.dots} fill={C.gold} opacity={0.24} />

        <Path d={SHUBH_DEEPAVALI.d} transform={at(scene.shubh)} fill="url(#gold)" />
        <Path d={HAPPY_DIWALI.d} transform={at({ ...scene.happy, x: scene.happy.x + 2, y: scene.happy.y + 3 })} fill="#24050f" opacity={0.55} />
        <Path d={HAPPY_DIWALI.d} transform={at(scene.happy)} fill="url(#gold)" />
        <Path d={`M170 ${scene.flourishY}L278 ${scene.flourishY}M322 ${scene.flourishY}L430 ${scene.flourishY}`} stroke={C.gold} strokeOpacity={0.7} strokeWidth={1.4} />
        <Path d={`M300 ${scene.flourishY - 7}L307 ${scene.flourishY}L300 ${scene.flourishY + 7}L293 ${scene.flourishY}Z`} fill={C.gold} />

        <G transform={`translate(${scene.rangoli.cx} ${scene.rangoli.cy}) scale(1 ${scene.rangoli.squash})`} opacity={0.95}>
          {scene.rangoli.shapes.map((shape, index) => <Path key={index} d={shape.d} fill={shape.fill} opacity={shape.opacity} />)}
        </G>
        {scene.diyas.map((diya) => (
          <G key={diya.x} transform={at(diya)}>
            <Path d={DIYA.foot} fill="#7a2a0e" />
            <Path d={DIYA.bowl} fill="url(#clay)" />
            <Path d={DIYA.band} fill="none" stroke={C.gold} strokeWidth={2.2} strokeLinecap="round" />
            <Path d={DIYA.dots} fill={C.goldLight} />
            <Path d={DIYA.rim} fill="url(#gold)" />
            <Path d={DIYA.oil} fill="#3d1606" />
            <Path d={DIYA.wick} stroke="#2a1205" strokeWidth={2.2} strokeLinecap="round" />
          </G>
        ))}
      </Svg>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]}>
        <Svg {...layer}>
          {scene.bursts.map((item, index) => (
            <G key={index}>
              <Path d={item.rays} stroke={item.color} strokeWidth={2.4} strokeLinecap="round" />
              <Path d={item.dots} fill={item.color} />
            </G>
          ))}
          {scene.sparkles.map((d, index) => <Path key={index} d={d} fill={C.goldLight} />)}
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: flicker.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }]}>
        <Svg {...layer}>
          <Defs><LightDefs /></Defs>
          {scene.diyas.map((diya) => (
            <G key={diya.x} transform={at(diya)}>
              <Ellipse cx={0} cy={-26} rx={54} ry={54} fill="url(#glow)" />
              <Path d={DIYA.flame} fill="url(#flame)" />
              <Path d={DIYA.core} fill="#fffbe8" opacity={0.85} />
            </G>
          ))}
        </Svg>
      </Animated.View>

      {scene.lanterns.map((lantern) => <SwingingLantern key={lantern.x} lantern={lantern} k={k} offsetY={offsetY} swing={swing} />)}
      <Text style={[styles.wishes, { top: offsetY + (scene.wishesY - 14) * k }]} numberOfLines={1}>WARM WISHES FROM THE ELITEZAAR FAMILY</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wishes: { position: "absolute", right: 0, left: 0, color: C.chalk, opacity: 0.85, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2.2, textAlign: "center" },
});
