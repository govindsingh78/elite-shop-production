import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, fonts, radius, shadow } from "@/theme";

const ToastContext = createContext(() => {});

const TONES = {
  success: { icon: "checkmark-circle", color: colors.success },
  error: { icon: "alert-circle", color: colors.danger },
  info: { icon: "information-circle", color: colors.tealDark },
};

/** Short confirmation banners, e.g. "Added to bag". */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message, tone = "success") => {
    clearTimeout(timer.current);
    setToast({ message, tone, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
    }, 2600);
    return () => clearTimeout(timer.current);
  }, [toast, opacity]);

  const tone = TONES[toast?.tone] || TONES.success;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10, opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
          <View style={styles.toast}>
            <Ionicons name={tone.icon} size={20} color={tone.color} />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 1000 },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: 520, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.white, ...shadow.lifted },
  text: { flexShrink: 1, color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 },
});
