import React, { useEffect, useRef } from "react";
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

function RootNavigator({ fontsReady }) {
  const { ready, portal } = useAuth();
  const segments = useSegments();
  const sentStaffHome = useRef(false);
  const loaded = ready && fontsReady;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

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
        <Stack.Screen name="return-policy" options={{ title: "Returns & refunds" }} />
        <Stack.Screen name="terms" options={{ title: "Terms & conditions" }} />
        <Stack.Screen name="payment" options={{ title: "Secure payment", presentation: "modal", gestureEnabled: false }} />
        <Stack.Screen name="order-confirmation" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ title: "" }} />
        <Stack.Screen name="register" options={{ title: "Create account" }} />
        <Stack.Screen name="vendor-register" options={{ title: "Become a seller" }} />
        <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />

        <Stack.Protected guard={!!portal}>
          <Stack.Screen name="change-password" options={{ title: "Change password" }} />
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
