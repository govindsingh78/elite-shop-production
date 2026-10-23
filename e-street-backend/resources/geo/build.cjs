// Rebuilds the address data in this folder from the Countries States Cities Database (ODbL-1.0):
//   https://github.com/dr5hn/countries-states-cities-database  →  json/countries+states+cities.json
// Usage: node resources/geo/build.cjs <path to countries+states+cities.json>
// Writes countries.json and regions/<ISO2>.json (that country's states, each with its city names).
const fs = require("fs");
const path = require("path");

const source = process.argv[2];
if (!source) {
  console.error("Usage: node resources/geo/build.cjs <countries+states+cities.json>");
  process.exit(1);
}

const out = __dirname;
const byName = (a, b) => a.name.localeCompare(b.name, "en");
const world = JSON.parse(fs.readFileSync(source, "utf8"));

fs.rmSync(path.join(out, "regions"), { recursive: true, force: true });
fs.mkdirSync(path.join(out, "regions"));

const countries = [];
let stateCount = 0;
let cityCount = 0;

for (const country of world) {
  if (!/^[A-Z]{2}$/.test(country.iso2 || "")) continue;

  let states = (country.states || []).map((state) => ({
    id: String(state.id),
    iso2: state.iso2,
    name: state.name.trim(),
    cities: [...new Set((state.cities || []).map((city) => city.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en")),
  }));
  // Some countries list two levels side by side (France: regions with no cities next to departments with cities).
  // Keep the level that has cities; if no subdivision has any, keep them all and let shoppers type the city.
  if (states.some((state) => state.cities.length)) states = states.filter((state) => state.cities.length);

  // State codes go in URLs: use the ISO code when it is simple and unique in the country, else the dataset id.
  const isoCounts = states.reduce((counts, state) => ({ ...counts, [state.iso2]: (counts[state.iso2] || 0) + 1 }), {});
  const regions = states.sort(byName).map((state) => ({
    code: /^[A-Za-z0-9]{1,8}$/.test(state.iso2 || "") && isoCounts[state.iso2] === 1 ? state.iso2 : state.id,
    name: state.name,
    cities: state.cities,
  }));

  countries.push({ code: country.iso2, name: country.name.trim() });
  fs.writeFileSync(path.join(out, "regions", `${country.iso2}.json`), JSON.stringify(regions));
  stateCount += regions.length;
  cityCount += regions.reduce((total, region) => total + region.cities.length, 0);
}

fs.writeFileSync(path.join(out, "countries.json"), JSON.stringify(countries.sort(byName)));
console.log(`countries: ${countries.length}, states: ${stateCount}, cities: ${cityCount}`);
