import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

// Push notifications are a phone feature; the web preview skips them.
const SUPPORTED = Platform.OS !== "web";
// The notification last opened, so the one that launched the app isn’t opened again if the app re-renders.
let lastOpened = null;

if (SUPPORTED) {
  // Messages that arrive while the app is open still show as a banner.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * This phone's Expo push token, asking permission first if it hasn't been answered. Null when the user
 * declines, on simulators, or before push is set up for the build (Firebase on Android).
 */
export async function getPushToken() {
  if (!SUPPORTED) return null;
  try {
    // Android 13+ only shows the permission prompt once a channel exists.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Orders and updates",
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: "#18372e",
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (error) {
    if (__DEV__) console.warn("Push notifications unavailable:", error?.message || error);
    return null;
  }
}

/**
 * Calls `onOpen(data)` when the user taps a notification, including the one that launched the app.
 * `data.url` is the screen to open. Waits for `ready` (the app's navigation mounted).
 */
export function useNotificationTaps(onOpen, ready) {
  useEffect(() => {
    if (!SUPPORTED || !ready) return undefined;
    const open = (response) => {
      const id = response?.notification?.request?.identifier;
      if (!id || id === lastOpened || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      lastOpened = id;
      onOpen(response.notification.request.content.data || {});
    };
    try {
      open(Notifications.getLastNotificationResponse());
    } catch {
      // No launch notification.
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [onOpen, ready]);
}
