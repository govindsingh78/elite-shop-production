import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Sign-in tokens go to the device keychain/keystore; the web build (used for previews) falls back to AsyncStorage. */
const secure = Platform.OS !== "web";

export const secureStorage = {
  get: (key) => (secure ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key)),
  set: (key, value) => (secure ? SecureStore.setItemAsync(key, value) : AsyncStorage.setItem(key, value)),
  remove: (key) => (secure ? SecureStore.deleteItemAsync(key) : AsyncStorage.removeItem(key)),
};

export const readJson = async (key, fallback) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const writeJson = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
