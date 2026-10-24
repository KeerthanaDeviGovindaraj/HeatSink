---
inclusion: always
---
# Tech stack and conventions

- Vite + React + TypeScript (strict). Static single-page app, no backend.
- Map: Leaflet via react-leaflet. Charts (if any): recharts.
- Tests: Vitest + fast-check (property-based). Every model function has property tests.
- Data scripts: TypeScript in /scripts, run with `npm run data` (tsx). Output JSON snapshots to /public/data.
- AI summaries (stretch): build-time script calling Amazon Bedrock, output JSON. Never call Bedrock from the browser; never commit credentials.

## Code rules
- All physics and scoring live in /src/model as pure, deterministic functions with no I/O.
- SI units internally. Numeric variable names carry a unit suffix: heatW, flowM3s, deltaTC, distanceM, areaKm2.
- Constants are defined once in src/model/constants.ts; never inline magic numbers.
- Invalid inputs throw typed errors; the UI prevents them with bounded controls.
- The browser reads only /public/data/*.json at runtime.
