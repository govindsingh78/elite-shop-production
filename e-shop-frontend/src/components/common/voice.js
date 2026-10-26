/**
 * Voice search with the browser's own speech recognition (Chrome, Edge, Safari, Samsung Internet; not Firefox).
 * The browser turns speech into text — Chrome with Google's speech service, Safari with Apple's — and only the
 * text reaches Elitezaar, like a typed search. It needs HTTPS (or localhost).
 */
const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

export const voiceSearchSupported = Boolean(Recognition) && typeof window !== "undefined" && window.isSecureContext;

/** Indian English, so Indian accents and words like "kurta" and "saree" are understood. */
export const VOICE_LANGUAGE = "en-IN";

/** What to tell the shopper when listening stops with an error (null: nothing to say). */
export const VOICE_ERRORS = {
  "not-allowed": "Allow microphone access for elitezaar.com in your browser to search by voice.",
  "service-not-allowed": "Voice search is switched off in this browser. You can type instead.",
  "no-speech": "We didn’t hear anything. Tap the mic and try again.",
  "audio-capture": "No microphone was found. Check that one is connected.",
  network: "Voice search needs an internet connection. Check yours and try again.",
  "language-not-supported": "Voice search isn’t available in this browser’s language. You can type instead.",
  aborted: null,
};

/**
 * Listens for one search. `onText(text, isFinal)` gets the words as they're recognised; `onEnd(error)` runs when
 * listening stops (error is a VOICE_ERRORS key, or null). Returns { stop, abort }.
 */
export function listen({ onText, onEnd }) {
  const recognition = new Recognition();
  recognition.lang = VOICE_LANGUAGE;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let error = null;
  recognition.onresult = (event) => {
    const results = [...event.results];
    onText(results.map((result) => result[0].transcript).join("").trim(), results.at(-1).isFinal);
  };
  recognition.onerror = (event) => { error = event.error; };
  recognition.onend = () => onEnd(error);
  recognition.start();

  return { stop: () => recognition.stop(), abort: () => recognition.abort() };
}

const OPEN = "ez:open-search";

/** Opens the search window (header, shop page…); `listen` starts listening straight away. */
export const openSearch = ({ listen: startListening = false } = {}) => window.dispatchEvent(new CustomEvent(OPEN, { detail: { listen: startListening } }));

export const onOpenSearch = (listener) => {
  const handler = (event) => listener(event.detail || {});
  window.addEventListener(OPEN, handler);
  return () => window.removeEventListener(OPEN, handler);
};
