/**
 * Voice search with the phone's speech recognition (Google's on Android, Apple's on iPhone; the browser's in the
 * web preview), through expo-speech-recognition. Only the recognised text is sent to Elitezaar, like a typed
 * search. App builds made before it was added don't have the native part, so it's loaded carefully and the
 * mic is simply hidden there.
 */
let speech = null;
try {
  speech = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
} catch {
  speech = null;
}

/** Indian English, so Indian accents and words like "kurta" and "saree" are understood. */
export const VOICE_LANGUAGE = "en-IN";

export function voiceAvailable() {
  try {
    return Boolean(speech?.isRecognitionAvailable());
  } catch {
    return false;
  }
}

/** What to tell the shopper when listening stops with an error (null: nothing to say). */
export const VOICE_ERRORS = {
  "not-allowed": "Allow Elitezaar to use the microphone (and speech recognition) in your phone’s settings to search by voice.",
  "service-not-allowed": "Speech recognition is switched off on this phone. You can type instead.",
  "no-speech": "We didn’t hear anything. Tap the mic and try again.",
  "speech-timeout": "We didn’t hear anything. Tap the mic and try again.",
  "audio-capture": "The microphone isn’t available right now. Close other apps using it and try again.",
  network: "Voice search needs an internet connection. Check yours and try again.",
  busy: "Voice search is busy. Try again in a moment.",
  "language-not-supported": "Voice search isn’t available in Indian English on this phone. You can type instead.",
  aborted: null,
};

/**
 * Listens for one search. `onText(text, isFinal)` gets the words as they're recognised; `onEnd(error)` runs when
 * listening stops (error is a VOICE_ERRORS key, or null). `hints` are words to listen out for (brands,
 * collections). Asks for the microphone first. Returns { stop, abort }, or null if permission was refused.
 */
export async function listen({ onText, onEnd, hints = [] }) {
  const permission = await speech.requestPermissionsAsync();
  if (!permission.granted) {
    onEnd("not-allowed");
    return null;
  }

  let error = null;
  const subscriptions = [
    speech.addListener("result", (event) => onText((event?.results?.[0]?.transcript || "").trim(), Boolean(event?.isFinal))),
    speech.addListener("error", (event) => {
      error = event?.error || "aborted";
    }),
    speech.addListener("end", () => {
      subscriptions.forEach((subscription) => subscription.remove());
      onEnd(error);
    }),
  ];
  speech.start({
    lang: VOICE_LANGUAGE,
    interimResults: true,
    continuous: false,
    maxAlternatives: 1,
    contextualStrings: hints.slice(0, 100),
    addsPunctuation: false,
  });

  return { stop: () => speech.stop(), abort: () => speech.abort() };
}
