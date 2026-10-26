import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { COOKIE_POLICY_PATH, NECESSARY_SUMMARY, OPTIONAL_CATEGORIES, onOpenCookieSettings, readConsent, saveConsent } from "./consent";

/**
 * The cookie banner on a first visit (Accept all / Necessary only / Manage preferences), and the cookie settings
 * window, which the footer's "Cookie settings" and the Cookie Policy open at any time.
 */
const CookieConsent = () => {
  const [consent, setConsent] = useState(() => readConsent());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useEffect(() => onOpenCookieSettings(() => setSettingsOpen(true)), []);

  const choose = (choice, categories) => {
    setConsent(saveConsent(choice, categories));
    setSettingsOpen(false);
  };

  return (
    <>
      {!consent && !settingsOpen && (
        <section className="cookie-banner" role="region" aria-label="Cookie choices">
          <div className="cookie-banner-text">
            <strong>Cookies on Elitezaar</strong>
            <p>
              We use essential cookies to keep you signed in, remember your bag and keep the site secure. With your OK, we also measure how fast pages load, to make the site faster — never for advertising. <Link to={COOKIE_POLICY_PATH}>Cookie Policy</Link>
            </p>
          </div>
          <div className="cookie-banner-actions">
            <button type="button" className="btn btn-primary" onClick={() => choose("accept_all")}>Accept all</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => choose("necessary_only")}>Necessary only</button>
            <button type="button" className="btn btn-link" onClick={() => setSettingsOpen(true)}>Manage preferences</button>
          </div>
        </section>
      )}
      {settingsOpen && (
        <CookieSettings
          consent={consent}
          onSave={(categories) => {
            choose("custom", categories);
            toast.success("Your cookie choices are saved.");
          }}
          onChoose={(choice) => {
            choose(choice);
            toast.success("Your cookie choices are saved.");
          }}
          onClose={closeSettings}
        />
      )}
    </>
  );
};

const CookieSettings = ({ consent, onSave, onChoose, onClose }) => {
  const [choices, setChoices] = useState(() => Object.fromEntries(OPTIONAL_CATEGORIES.map(({ key }) => [key, Boolean(consent?.[key])])));
  const dialog = useRef(null);

  // A proper dialog: focus moves into it, Escape closes it, and the page behind doesn't scroll.
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector("input:not(:disabled), button")?.focus();
    const close = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    document.body.classList.add("cookie-settings-open");
    return () => {
      document.removeEventListener("keydown", close);
      document.body.classList.remove("cookie-settings-open");
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="cookie-settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="cookie-settings" role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title" ref={dialog}>
        <header>
          <h2 id="cookie-settings-title">Cookie settings</h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </header>
        <p className="cookie-settings-intro">Choose which cookies Elitezaar may use. You can change this at any time from “Cookie settings” at the bottom of every page. <Link to={COOKIE_POLICY_PATH} onClick={onClose}>Read the Cookie Policy</Link></p>

        <ul className="cookie-categories">
          <li>
            <div>
              <strong>Strictly necessary</strong>
              <p>{NECESSARY_SUMMARY}</p>
            </div>
            <span className="cookie-always">Always on</span>
          </li>
          {OPTIONAL_CATEGORIES.map((category) => (
            <li key={category.key}>
              <div>
                <label htmlFor={`cookie-${category.key}`}><strong>{category.title}</strong></label>
                <p>{category.text}</p>
              </div>
              <div className="form-check form-switch">
                <input
                  id={`cookie-${category.key}`}
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  checked={choices[category.key]}
                  onChange={(event) => setChoices((current) => ({ ...current, [category.key]: event.target.checked }))}
                />
              </div>
            </li>
          ))}
        </ul>

        {consent && <p className="cookie-settings-id">Your consent ID: <code>{consent.id}</code> · chosen {new Date(consent.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}

        <footer>
          <button type="button" className="btn btn-outline-secondary" onClick={() => onChoose("necessary_only")}>Necessary only</button>
          <button type="button" className="btn btn-outline-primary" onClick={() => onSave(choices)}>Save my choices</button>
          <button type="button" className="btn btn-primary" onClick={() => onChoose("accept_all")}>Accept all</button>
        </footer>
      </div>
    </div>
  );
};

export default CookieConsent;
