# Address data (countries, states, cities)

Used by the country → state → city dropdowns at checkout and in address forms, served by
`GeoController` under `/api/geo/...`.

- `countries.json` — every country: `{ code (ISO 3166-1 alpha-2), name }`.
- `regions/<ISO2>.json` — that country's states/provinces, each `{ code, name, cities: [names] }`.
  Countries with no subdivisions have an empty list; shoppers type the state and city instead.

Addresses store the **names** (e.g. "India", "Maharashtra", "Mumbai"), so this data can be refreshed
without touching saved addresses or orders.

## Source and licence

Built from the [Countries States Cities Database](https://github.com/dr5hn/countries-states-cities-database)
(commit `47289b1ed4ad6a67e0d5380d72fb207fe3a34953`), © Countries States Cities Database contributors,
licensed under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
ODbL asks for attribution wherever the data is used publicly (e.g. a line on the site's terms or about page).

## Refreshing

```bash
# download json/countries+states+cities.json from the repository above, then:
node resources/geo/build.cjs path/to/countries+states+cities.json
```

Where a country lists two levels side by side (France: regions without cities next to departments with
cities), the build keeps the level that has cities.
