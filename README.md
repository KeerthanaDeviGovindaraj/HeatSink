# HeatSink

**Where should AI's heat go?** A screening tool for Massachusetts towns evaluating seawater-cooled data centers.

> Screening tool only — not a hydrodynamic model or a permit decision.

**Live demo:** TODO  
**Video (< 3 min):** TODO  
**Track:** Climate Tech (challenge: Understanding and protecting the ocean)

## The problem
TODO: 3–4 sentences. Drought pushes data centers toward seawater cooling; seawater cooling returns heat to already-warm habitat; Massachusetts must issue municipal data center guidance by Dec 31, 2026 (EO 658); Brayton Point precedent.

## What it does
- Baseline map of coastal bottom temperatures (FIShBOT, eMOLT)
- Place a hypothetical data center (or pick a preset site); set MW, discharge ΔT, pre-mixing
- Required seawater flow (m³/s and MGD) with a Brayton Point comparison
- Screening heat plume on a 250 m sampling grid
- Species check: area newly pushed past cited thermal thresholds
- Ranked comparison of up to 4 sites, plus a plain-English summary

## Run locally
```bash
npm install
npm run data   # optional: refresh snapshots (committed snapshots work offline)
npm run dev
npm test       # unit + property-based tests
```

## Model and assumptions
See `.kiro/steering/thermal-model.md`. Radially symmetric, no tides or currents, steady state, bottom effect only in water ≤ 20 m deep, land points excluded, placeholder calibration constants.

## Data sources
- FIShBOT — Commercial Fisheries Research Foundation
- eMOLT — the eMOLT program and the fishing vessels that collected the data
- NOAA National Data Buoy Center, buoy 44013
- MassGIS (land polygons for the land mask; diadromous fish stations)

## How we used Kiro
See `docs/KIRO_PLAYBOOK.md` (specs, steering, hooks, MCP, property-based testing).

## Team
TODO: names (max 4)

## License
MIT
