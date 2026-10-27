import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, useFonts } from "@expo-google-fonts/outfit";
import { Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold } from "@expo-google-fonts/rajdhani";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { stackHeader } from "@/lib/navigation";
import { installCrashReporting, reportError, setMonitorScreen, setMonitorToken } from "@/lib/monitor";
import { useNotificationTaps } from "@/lib/push";
import { colors, fonts } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
    Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold,
  });

  return (
    <SafeAreaProvider>
      {/* Lets form screens keep the focused field above the keyboard (see Screen in components/ui).
          Expo apps draw edge-to-edge on Android; without these flags the status bar turns white. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
            <ToastProvider>
              <RootNavigator fontsReady={fontsLoaded || !!fontError} />
            </ToastProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

/** A screen crashed: a friendly way out instead of a blank screen, and the admins are told. */
export function ErrorBoundary({ error, retry }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.cream }}>
      <Text style={{ color: colors.ink, fontFamily: fonts.heading, fontSize: 22, textAlign: "center" }}>Something went wrong</Text>
      <Text style={{ marginTop: 8, color: colors.muted, fontFamily: fonts.body, fontSize: 16, textAlign: "center" }}>Sorry about that — our team has been told. Trying again usually fixes it.</Text>
      <Pressable onPress={retry} accessibilityRole="button" style={{ marginTop: 20, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13, backgroundColor: colors.emerald }}>
        <Text style={{ color: colors.white, fontFamily: fonts.heading, fontSize: 16 }}>Try again</Text>
      </Pressable>
      <Pressable onPress={() => router.replace("/")} accessibilityRole="button" style={{ marginTop: 12, padding: 8 }}>
        <Text style={{ color: colors.emerald, fontFamily: fonts.heading, fontSize: 15 }}>Go to the shop</Text>
      </Pressable>
    </View>
  );
}

function RootNavigator({ fontsReady }) {
  const { ready, portal, request, session } = useAuth();
  const segments = useSegments();

  // Crash reports say which screen and which kind of user (shopper, seller or admin) ran into them.
  useEffect(() => {
    installCrashReporting();
  }, []);
  useEffect(() => {
    setMonitorScreen(segments);
  }, [segments]);
  useEffect(() => {
    setMonitorToken(session?.token);
  }, [session?.token]);
  const sentStaffHome = useRef(false);
  const loaded = ready && fontsReady;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  // A tapped notification opens its screen (and is marked read), taking the place of the usual start screen.
  const openNotification = useCallback((data) => {
    sentStaffHome.current = true;
    if (data.notification_id) request(`/notifications/${data.notification_id}/read`, { method: "PATCH" }).catch(() => {});
    router.push(typeof data.url === "string" && data.url ? data.url : "/notifications");
  }, [request]);
  useNotificationTaps(openNotification, loaded);

  // Vendors and admins open straight into their dashboard when the app starts.
  useEffect(() => {
    if (!loaded || sentStaffHome.current) return;
    sentStaffHome.current = true;
    if ((portal === "vendor" || portal === "admin") && segments[0] !== portal) router.replace(`/${portal}`);
  }, [loaded, portal, segments]);

  if (!loaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={stackHeader}>
        <Stack.Screen name="(store)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ title: "" }} />
        <Stack.Screen name="reviews/[id]" options={{ title: "Ratings & reviews" }} />
        <Stack.Screen name="write-review" options={{ title: "Your review" }} />
        <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
        <Stack.Screen name="about" options={{ title: "About us" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="return-policy" options={{ title: "Returns & refunds" }} />
        <Stack.Screen name="terms" options={{ title: "Terms & conditions" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy policy" }} />
        <Stack.Screen name="cookie-policy" options={{ title: "Cookie policy" }} />
        <Stack.Screen name="payment" options={{ title: "Secure payment", presentation: "modal", gestureEnabled: false }} />
        <Stack.Screen name="order-confirmation" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ title: "" }} />
        <Stack.Screen name="register" options={{ title: "Create account" }} />
        <Stack.Screen name="vendor-register" options={{ title: "Become a seller" }} />
        <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />

        <Stack.Protected guard={!!portal}>
          <Stack.Screen name="change-password" options={{ title: "Password & sign-in" }} />
        </Stack.Protected>
        <Stack.Protected guard={portal === "customer"}>
          <Stack.Screen name="customer" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={portal === "vendor"}>
          <Stack.Screen name="vendor" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={portal === "admin"}>
          <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
