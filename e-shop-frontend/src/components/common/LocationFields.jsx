import React, { useEffect, useState } from "react";
import { fetchGeo, findByName } from "./geo";

const OTHER = "__other__";

/** Loads one geo list; `path` null means "nothing to load yet". */
const useGeoList = (path) => {
  const [result, setResult] = useState({ path: null, items: [], error: "" });

  useEffect(() => {
    if (!path) return undefined;
    let active = true;
    fetchGeo(path)
      .then((items) => active && setResult({ path, items, error: "" }))
      .catch((error) => active && setResult({ path, items: [], error: error.message }));
    return () => { active = false; };
  }, [path]);

  const current = path && result.path === path;
  return { loading: Boolean(path) && !current, items: current ? result.items : [], error: current ? result.error : "" };
};

/**
 * Country → state → city dropdowns for an address anywhere in the world. Values are names ("India", "Maharashtra", "Mumbai").
 * When a state or city isn't listed (or a country has none), people type it instead. `onChange` gets input-style events.
 */
const LocationFields = ({ values, errors = {}, onChange, idPrefix = "address", wrapperClass = "col-md-6", stateOptional = false }) => {
  const [typing, setTyping] = useState({ state: false, city: false });
  const countries = useGeoList("countries");
  const country = findByName(countries.items, values.country);
  const states = useGeoList(country ? `countries/${country.code}/states` : null);
  const state = findByName(states.items, values.state);
  const cities = useGeoList(country && state ? `countries/${country.code}/states/${state.code}/cities` : null);
  const city = cities.items.find((name) => name.toLowerCase() === String(values.city || "").trim().toLowerCase());

  // Each field is a dropdown ("select"), waiting on the field before it ("wait"), or typed when there is no list ("type").
  // "Not listed" (or a saved name missing from the list) keeps the dropdown and adds a box to type in.
  const countryUnlisted = Boolean(values.country) && !country && !countries.loading;
  const stateMode = countries.error || countryUnlisted || states.error || (country && !states.loading && !states.items.length) ? "type"
    : !country || states.loading ? "wait" : "select";
  const stateOther = stateMode === "select" && (typing.state || Boolean(values.state && !state));
  const cityMode = stateMode === "type" || stateOther || cities.error || (state && !cities.loading && !cities.items.length) ? "type"
    : !state || cities.loading ? "wait" : "select";
  const cityOther = cityMode === "select" && (typing.city || Boolean(values.city && !city));

  const emit = (name, value) => onChange({ target: { name, value, type: "text" } });
  const changeCountry = (value) => {
    setTyping({ state: false, city: false });
    emit("country", value);
    emit("state", "");
    emit("city", "");
  };
  const changeState = (value) => {
    setTyping({ state: value === OTHER, city: false });
    emit("state", value === OTHER ? "" : value);
    emit("city", "");
  };
  const changeCity = (value) => {
    setTyping((current) => ({ ...current, city: value === OTHER }));
    emit("city", value === OTHER ? "" : value);
  };

  const id = (name) => `${idPrefix}-${name}`;
  const invalid = (name) => (errors[name] ? " is-invalid" : "");
  const feedback = (name) => errors[name] && <div className="invalid-feedback">{errors[name]}</div>;
  // `extra` marks the "type it" box shown under a dropdown, which shares the dropdown's label.
  const textInput = (name, placeholder, autoComplete, extra = false) => (
    <input id={extra ? undefined : id(name)} name={name} className={`form-control${invalid(name)}${extra ? " mt-2" : ""}`} value={values[name] || ""}
      onChange={(event) => emit(name, event.target.value)} placeholder={placeholder} autoComplete={autoComplete} maxLength={120}
      required={name !== "state" || !stateOptional} aria-label={extra ? placeholder : undefined} />
  );
  const stateLabel = ["IN", "US"].includes(country?.code) ? "State" : "State / province";

  return (
    <>
      <div className={wrapperClass}>
        <label htmlFor={id("country")} className="form-label">Country</label>
        {countries.error ? textInput("country", "Country", "country-name") : (
          <select id={id("country")} name="country" className={`form-select${invalid("country")}`} value={country?.name || values.country || ""} onChange={(event) => changeCountry(event.target.value)} disabled={countries.loading} autoComplete="country-name" required>
            <option value="">{countries.loading ? "Loading countries…" : "Select country"}</option>
            {countryUnlisted && <option value={values.country}>{values.country}</option>}
            {countries.items.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
          </select>
        )}
        {feedback("country")}
      </div>

      <div className={wrapperClass}>
        <label htmlFor={id("state")} className="form-label">{stateLabel}{stateOptional ? " (optional)" : ""}</label>
        {stateMode === "type" ? textInput("state", "Type your state or region", "address-level1") : (
          <>
            <select id={id("state")} name="state" className={`form-select${invalid("state")}`} value={stateOther ? OTHER : state?.name || ""} onChange={(event) => changeState(event.target.value)} disabled={stateMode === "wait"} autoComplete="address-level1" required={!stateOptional}>
              <option value="">{!country ? "Select a country first" : states.loading ? "Loading…" : `Select ${stateLabel.toLowerCase()}`}</option>
              <option value={OTHER}>Not listed — type it</option>
              {states.items.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
            </select>
            {stateOther && textInput("state", "Type your state or region", "address-level1", true)}
          </>
        )}
        {feedback("state")}
      </div>

      <div className={wrapperClass}>
        <label htmlFor={id("city")} className="form-label">City / town</label>
        {cityMode === "type" ? textInput("city", "Type your city or town", "address-level2") : (
          <>
            <select id={id("city")} name="city" className={`form-select${invalid("city")}`} value={cityOther ? OTHER : city || ""} onChange={(event) => changeCity(event.target.value)} disabled={cityMode === "wait"} autoComplete="address-level2" required>
              <option value="">{!state ? `Select a ${stateLabel.toLowerCase()} first` : cities.loading ? "Loading cities…" : "Select city"}</option>
              <option value={OTHER}>Not listed — type it</option>
              {cities.items.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            {cityOther && textInput("city", "Type your city or town", "address-level2", true)}
          </>
        )}
        {feedback("city")}
      </div>
    </>
  );
};

export default LocationFields;
