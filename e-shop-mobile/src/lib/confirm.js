import { Alert, Platform } from "react-native";

/** Yes/no question before something destructive. Falls back to the browser dialog in the web preview. */
export function confirmAction({ title, message, confirmLabel = "Delete", destructive = true, onConfirm }) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message || ""}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}
