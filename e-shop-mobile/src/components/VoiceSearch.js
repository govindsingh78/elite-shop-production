import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, T } from "@/components/ui";
import { VOICE_ERRORS, listen, voiceAvailable } from "@/lib/voice";
import { colors, fonts, radius } from "@/theme";

/** Requests to start listening (from the home screen's mic) that have been acted on, this app session. */
const handledRequests = new Set();

/**
 * A mic button for search: tap it, say what you're looking for, and `onResult` gets the words. While listening,
 * a sheet shows what's being heard. Changing `listenRequest` (e.g. the home screen's mic) starts it too.
 * Hidden on phones (or app builds) without speech recognition.
 */
export default function VoiceSearchButton({ onResult, hints, listenRequest, size = 34 }) {
  const [available] = useState(voiceAvailable);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [message, setMessage] = useState("");
  const session = useRef(null);
  // The latest props, so `begin` stays the same function from render to render.
  const props = useRef({ hints, onResult });
  useEffect(() => {
    props.current = { hints, onResult };
  });

  const begin = useCallback(async () => {
    if (session.current) return;
    setOpen(true);
    setHeard("");
    setMessage("");
    setListening(true);
    let latest = "";
    session.current = { abort: () => {}, stop: () => {} };
    try {
      session.current = await listen({
        hints: props.current.hints,
        onText: (text, isFinal) => {
          latest = text;
          setHeard(text);
          if (isFinal) session.current?.stop();
        },
        onEnd: (error) => {
          session.current = null;
          setListening(false);
          if (latest && error !== "aborted") {
            // A moment to read what was heard, then the results.
            setTimeout(() => {
              setOpen(false);
              props.current.onResult(latest);
            }, 450);
          } else if (error !== "aborted") {
            setMessage(VOICE_ERRORS[error] ?? (error ? "Voice search stopped. Tap the mic to try again." : VOICE_ERRORS["no-speech"]));
          }
        },
      });
    } catch {
      session.current = null;
      setListening(false);
      setMessage("Voice search couldn’t start. Tap the mic to try again, or type instead.");
    }
  }, []);

  const close = () => {
    session.current?.abort();
    session.current = null;
    setListening(false);
    setOpen(false);
  };

  // Started from elsewhere (the home screen's mic): each request listens once, even if the screen remounts.
  useEffect(() => {
    if (!available || !listenRequest || handledRequests.has(listenRequest)) return undefined;
    // Marked handled only once it starts, so a re-render that cancels the timer doesn't lose the request.
    const timer = setTimeout(() => {
      handledRequests.add(listenRequest);
      begin();
    }, 250);
    return () => clearTimeout(timer);
  }, [available, listenRequest, begin]);

  if (!available) return null;

  return (
    <>
      <Pressable onPress={begin} hitSlop={8} accessibilityRole="button" accessibilityLabel="Search by voice" style={({ pressed }) => [styles.mic, { width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.8 }]}>
        <Ionicons name="mic" size={size * 0.52} color={colors.emerald} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <T variant="h2" center>Search Elitezaar</T>
            <Pulse active={listening} onPress={listening ? () => session.current?.stop() : begin} />
            <Text style={[styles.status, message ? { color: colors.danger } : null]} accessibilityLiveRegion="polite">
              {listening ? (heard ? "Listening…" : "Listening… say what you’re looking for") : message || (heard ? "Searching…" : "Tap the mic and say what you’re looking for")}
            </Text>
            <Text style={styles.heard} accessibilityLiveRegion="polite">{heard ? `“${heard}”` : " "}</Text>
            {!listening ? <T variant="small" center>Try “linen shirts under 2000” or “silk saree for women”.</T> : null}
            <Button title={listening ? "Cancel" : "Close"} variant="ghost" small block={false} style={{ alignSelf: "center", marginTop: 12 }} onPress={close} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** The big mic; rings ripple out while it's listening. */
function Pulse({ active, onPress }) {
  const [ring] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== "web" }));
    loop.start();
    return () => {
      loop.stop();
      ring.setValue(0);
    };
  }, [active, ring]);

  return (
    <View style={styles.pulseWrap}>
      {active ? <Animated.View style={[styles.ring, { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] }]} /> : null}
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={active ? "Stop listening" : "Search by voice"} style={({ pressed }) => [styles.bigMic, active && { backgroundColor: colors.danger }, pressed && { opacity: 0.85 }]}>
        <Ionicons name={active ? "mic" : "mic-outline"} size={40} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  mic: { alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  backdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(12,26,20,0.6)" },
  sheet: { borderRadius: radius.xl, padding: 24, backgroundColor: colors.cream },
  pulseWrap: { alignSelf: "center", width: 150, height: 150, alignItems: "center", justifyContent: "center", marginVertical: 12 },
  ring: { position: "absolute", width: 96, height: 96, borderRadius: 48, backgroundColor: colors.danger },
  bigMic: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.emerald },
  status: { color: colors.body, fontFamily: fonts.bodySemi, fontSize: 16, textAlign: "center" },
  heard: { minHeight: 30, marginTop: 6, marginBottom: 6, color: colors.ink, fontFamily: fonts.heading, fontSize: 21, textAlign: "center" },
});
