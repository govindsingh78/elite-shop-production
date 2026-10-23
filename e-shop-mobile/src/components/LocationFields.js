import React, { useState } from "react";
import { View } from "react-native";
import { SelectField, TextField } from "@/components/ui";
import { findByName, OTHER, useGeoList } from "@/lib/geo";

const NOT_LISTED = { value: OTHER, label: "Not listed — type it", pinned: true };

/**
 * Country → state → city pickers for an address anywhere in the world. Values are names ("India", "Maharashtra", "Mumbai").
 * When a state or city isn't listed (or a country has none), people type it instead. `onChange(name, value)`.
 */
export default function LocationFields({ values, errors = {}, onChange }) {
  const [typing, setTyping] = useState({ state: false, city: false });
  const countries = useGeoList("countries");
  const country = findByName(countries.items, values.country);
  const states = useGeoList(country ? `countries/${country.code}/states` : null);
  const state = findByName(states.items, values.state);
  const cities = useGeoList(country && state ? `countries/${country.code}/states/${state.code}/cities` : null);
  const city = cities.items.find((name) => name.toLowerCase() === String(values.city || "").trim().toLowerCase());

  // Each field is a picker ("select"), waiting on the field before it ("wait"), or typed when there is no list ("type").
  // "Not listed" (or a saved name missing from the list) keeps the picker and adds a box to type in.
  const countryUnlisted = Boolean(values.country) && !country && !countries.loading;
  const stateMode = countries.error || countryUnlisted || states.error || (country && !states.loading && !states.items.length) ? "type"
    : !country || states.loading ? "wait" : "select";
  const stateOther = stateMode === "select" && (typing.state || Boolean(values.state && !state));
  const cityMode = stateMode === "type" || stateOther || cities.error || (state && !cities.loading && !cities.items.length) ? "type"
    : !state || cities.loading ? "wait" : "select";
  const cityOther = cityMode === "select" && (typing.city || Boolean(values.city && !city));

  const changeCountry = (value) => {
    setTyping({ state: false, city: false });
    onChange("country", value);
    onChange("state", "");
    onChange("city", "");
  };
  const changeState = (value) => {
    setTyping({ state: value === OTHER, city: false });
    onChange("state", value === OTHER ? "" : value);
    onChange("city", "");
  };
  const changeCity = (value) => {
    setTyping((current) => ({ ...current, city: value === OTHER }));
    onChange("city", value === OTHER ? "" : value);
  };

  const stateLabel = ["IN", "US"].includes(country?.code) ? "State" : "State / province";
  const typed = (name, props) => (
    <TextField value={values[name] ?? ""} onChangeText={(text) => onChange(name, text)} error={errors[name]} {...props} />
  );

  return (
    <View>
      {countries.error ? typed("country", { label: "Country", autoComplete: "country" }) : (
        <SelectField
          label="Country"
          value={country?.name || values.country || ""}
          options={[...(countryUnlisted ? [{ value: values.country, label: values.country }] : []), ...countries.items.map((item) => ({ value: item.name, label: item.name }))]}
          onChange={changeCountry}
          error={errors.country}
          placeholder={countries.loading ? "Loading countries…" : "Select country"}
          disabled={countries.loading}
        />
      )}

      {stateMode === "type" ? typed("state", { label: stateLabel, placeholder: "Type your state or region" }) : (
        <>
          <SelectField
            label={stateLabel}
            value={stateOther ? OTHER : state?.name || ""}
            options={[NOT_LISTED, ...states.items.map((item) => ({ value: item.name, label: item.name }))]}
            onChange={changeState}
            error={stateOther ? undefined : errors.state}
            placeholder={!country ? "Select a country first" : states.loading ? "Loading…" : `Select ${stateLabel.toLowerCase()}`}
            disabled={stateMode === "wait"}
          />
          {stateOther ? typed("state", { placeholder: "Type your state or region", style: { marginTop: -6 } }) : null}
        </>
      )}

      {cityMode === "type" ? typed("city", { label: "City / town", placeholder: "Type your city or town" }) : (
        <>
          <SelectField
            label="City / town"
            value={cityOther ? OTHER : city || ""}
            options={[NOT_LISTED, ...cities.items.map((name) => ({ value: name, label: name }))]}
            onChange={changeCity}
            error={cityOther ? undefined : errors.city}
            placeholder={!state ? `Select a ${stateLabel.toLowerCase()} first` : cities.loading ? "Loading cities…" : "Select city"}
            disabled={cityMode === "wait"}
          />
          {cityOther ? typed("city", { placeholder: "Type your city or town", style: { marginTop: -6 } }) : null}
        </>
      )}
    </View>
  );
}
