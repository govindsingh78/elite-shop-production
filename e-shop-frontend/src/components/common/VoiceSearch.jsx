import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VOICE_ERRORS, listen, onOpenSearch, voiceSearchSupported } from "./voice";

const EXAMPLES = ["linen shirts for men under 2000", "silk saree", "kids toys", "Levis jeans"];

/**
 * The search window: speak (tap the mic) or type, and the results open on the shop page. Opened from the
 * header's search button, or the mic in the shop's search box, which starts listening straight away.
 */
const VoiceSearch = () => {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");
  const recognition = useRef(null);
  const dialog = useRef(null);
  const navigate = useNavigate();

  const showResults = useCallback((query, viaVoice) => {
    const text = query.trim();
    if (!text) return;
    setOpen(false);
    navigate(`/shop?${new URLSearchParams({ q: text, ...(viaVoice ? { voice: "1" } : {}) })}`);
  }, [navigate]);

  const start = useCallback(() => {
    if (!voiceSearchSupported || recognition.current) return;
    setHeard("");
    setMessage("");
    setListening(true);
    let latest = "";
    try {
      recognition.current = listen({
        onText: (text, isFinal) => {
          latest = text;
          setHeard(text);
          if (isFinal) recognition.current?.stop();
        },
        onEnd: (error) => {
          recognition.current = null;
          setListening(false);
          if (latest && error !== "aborted") {
            // A moment to read what was heard before the results open (closing the window cancels).
            setTimeout(() => showResults(latest, true), 450);
          } else {
            setMessage(VOICE_ERRORS[error] ?? (error ? "Voice search stopped. Tap the mic to try again." : VOICE_ERRORS["no-speech"]));
          }
        },
      });
    } catch {
      recognition.current = null;
      setListening(false);
      setMessage("Voice search couldn’t start. Tap the mic to try again, or type instead.");
    }
  }, [showResults]);

  const close = useCallback(() => {
    recognition.current?.abort();
    recognition.current = null;
    setListening(false);
    setOpen(false);
  }, []);

  useEffect(() => onOpenSearch(({ listen: startListening }) => {
    setOpen(true);
    setTyped("");
    setHeard("");
    setMessage("");
    if (startListening) start();
  }), [start]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    dialog.current?.querySelector(voiceSearchSupported ? ".voice-mic" : "input")?.focus();
    const onKey = (event) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("voice-search-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("voice-search-open");
      previous?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;

  const status = listening
    ? (heard ? "Listening…" : "Listening… say what you’re looking for")
    : message || (heard ? "Searching…" : voiceSearchSupported ? "Tap the mic and say what you’re looking for" : "Voice search works in Chrome, Edge and Safari. You can type here instead.");

  return (
    <div className="voice-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="voice-dialog" role="dialog" aria-modal="true" aria-labelledby="voice-title" ref={dialog}>
        <button type="button" className="btn-close voice-close" aria-label="Close search" onClick={close} />
        <h2 id="voice-title">Search Elitezaar</h2>

        {voiceSearchSupported && (
          <button type="button" className={`voice-mic${listening ? " is-listening" : ""}`} onClick={listening ? () => recognition.current?.stop() : start} aria-label={listening ? "Stop listening" : "Search by voice"} aria-pressed={listening}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></svg>
          </button>
        )}
        <p className={`voice-status${message ? " is-error" : ""}`} role="status" aria-live="polite">{status}</p>
        <p className="voice-heard" aria-live="polite">{heard ? `“${heard}”` : " "}</p>

        <form className="voice-type" onSubmit={(event) => { event.preventDefault(); showResults(typed, false); }}>
          <label htmlFor="voice-typed" className="visually-hidden">Type your search</label>
          <input id="voice-typed" type="search" className="form-control" placeholder={voiceSearchSupported ? "Or type your search" : "Type your search"} value={typed} onChange={(event) => setTyped(event.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={!typed.trim()}>Search</button>
        </form>

        <div className="voice-examples">
          <span>Try</span>
          {EXAMPLES.map((example) => <button key={example} type="button" onClick={() => showResults(example, false)}>{example}</button>)}
        </div>
      </div>
    </div>
  );
};

export default VoiceSearch;
