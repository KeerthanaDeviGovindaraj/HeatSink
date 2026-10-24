# HeatSink 🌊

**Where should AI's heat go?** A screening tool that shows where a seawater-cooled AI data center on the Massachusetts coast would push coastal habitat past species temperature limits, and where it would not.

> ⚠️ **Screening tool only.** HeatSink is not a hydrodynamic model or a permit decision. It helps answer "which sites deserve a closer look?"

| | |
|---|---|
| **Live demo** | TODO: https://… (free, no login) |
| **Demo video (< 3 min)** | TODO: https://youtube.com/… |
| **Track** | Climate Tech: *Understanding and protecting the ocean* |
| **Built with** | Kiro IDE + Kiro CLI (specs, steering, hooks, MCP, property-based testing) |

---

## The problem

AI data centers need cooling. Freshwater cooling is under pressure: Massachusetts has been in drought since October 2024. Seawater cooling avoids using up freshwater, so coastal sites start to look attractive, and seawater-cooled data centers already operate elsewhere (for example, near Hamina, Finland).

But seawater cooling returns the heat to the ocean, typically several degrees warmer than the surrounding water, on top of coastal habitat that is already warm. Massachusetts has seen this before: heated discharge from the Brayton Point power plant into Mount Hope Bay was linked by regulators to harm to species such as winter flounder, and in 2003 the plant was required to sharply cut its heat discharge (the owner disputed responsibility).

**Why now:** Executive Order 658 (September 8, 2026) requires Massachusetts to publish guidance by **December 31, 2026** to help municipalities evaluate data center proposals, including protocols for protecting water resources. Towns will need a fast, transparent way to ask the ocean side of that question.

## Who it's for

- **Town boards and planners** evaluating a data center proposal
- **State reviewers** (e.g., MassDEP) screening sites before detailed modeling
- **Fishers and fisheries advocates** who want to see what's at stake for their grounds

## What it does

1. **Baseline map:** coastal bottom temperatures from fishing-fleet data (FIShBOT grid, eMOLT points), labeled MEASURED, with "no data" shown honestly (never interpolated).
2. **Place a hypothetical data center:** 4 preset coastal sites or click-to-place in the water; set facility size (MW), discharge temperature rise, pre-mixing ratio, and heat fraction.
3. **Flow and scale:** heat to water, required seawater flow (m³/s and million gallons/day), compared with Brayton Point's peak.
4. **Screening plume:** warm-water rings on the map with plume area and reach.
5. **Species check:** area *newly* pushed past cited thermal limits for American lobster and winter flounder, shown separately from area already above the limit at baseline.
6. **Compare sites:** up to 4 sites ranked from lowest to highest risk, including "Low impact at screening level" when that's the honest answer.
7. **Shareable summary:** a one-page plain-English report (copy or Markdown download) with assumptions, sources, and the screening disclaimer.

## Screenshots

TODO: add 3–5 images from `docs/screens/` (map, plume, species overlay, compare table, summary).

## Run locally

Requirements: Node.js 20+ and npm.

```bash
git clone https://github.com/KeerthanaDeviGovindaraj/HeatSink.git
cd HeatSink
npm install
npm run dev      # open http://localhost:5173
npm test         # unit + property-based tests
npm run build    # production build in dist/
```

The app runs fully from committed data snapshots in `public/data/` (no API keys, works offline except map tiles).

Optional: refresh the data snapshots from the original sources:

```bash
npm run data
```

## How the model works

All equations and constants live in [`.kiro/steering/thermal-model.md`](.kiro/steering/thermal-model.md) (single source of truth).

- **Heat to water** = facility MW × heat fraction (default 0.88).
- **Required flow** = heat ÷ (seawater density × specific heat × temperature rise). Sanity check: 90 MW at 5 °C ≈ 4.4 m³/s ≈ 100 million gallons/day.
- **Pre-mixing** lowers discharge temperature and raises flow with the same total heat.
- **Plume:** excess temperature decays exponentially with distance; decay length grows with flow.
- **Fine sampling grid:** 250 m points within 20 km of the outfall; land points removed; each point uses the baseline of the ~7 km FIShBOT cell it falls in.
- **Shallow-water rule:** warm discharge floats, so bottom heating is applied only in water ≤ 20 m deep; deeper points are marked "surface plume only."
- **Score (0–100)** from the area newly pushed past a species limit; levels Low / Medium / High, or "Insufficient data" when less than half the plume has baseline data.

### Correctness

The model is covered by **16 property-based tests** (fast-check), each tied to an EARS requirement (Requirement 10 in [`requirements.md`](.kiro/specs/heatsink/requirements.md)). Examples: heat in equals heat out; the plume is never colder than the surrounding water; more heat never lowers the score; no sample point lies on land.

### Assumptions and limits (shown in the app at all times)

Radially symmetric plume, no tides or currents, steady state, bottom effect only in water ≤ 20 m deep, placeholder calibration constants (decay length, score scale). FIShBOT cells (~7 km) are coarser than most plumes. The eMOLT sample covers one week and is not used to claim trends. Intake effects (fish drawn into pipes) are out of scope.

## Data sources

| Source | Used for | Citation |
|---|---|---|
| FIShBOT bottom temperature | Baseline grid | Commercial Fisheries Research Foundation (ERDDAP) |
| eMOLT bottom temperature | Measured boat points | eMOLT program and the fishing vessels that collected the data |
| NOAA NDBC buoy 44013 | Surface water temperature context | NOAA National Data Buoy Center |
| Massachusetts land polygons | Land mask | TODO: MassGIS layer name |
| Species thermal thresholds | Lobster and winter flounder limits | TODO: sources listed in `public/data/species.json` |
| Policy context | Problem framing | Executive Order 658 (Sept 2026); Massachusetts drought declarations |

## How we used Kiro

The full write-up is in [`docs/KIRO_PLAYBOOK.md`](docs/KIRO_PLAYBOOK.md). In short:

- **Spec-driven development:** requirements → design → tasks in [`.kiro/specs/heatsink/`](.kiro/specs/heatsink/). The spec went through real revisions: v1 → v2 fixed a score formula where more heat could *lower* the risk score; v2 → v2.1 added a land mask and a negligible-first rule after a counterexample to an area property.
- **Steering:** always-on files for product honesty rules, stack conventions, and structure; file-matched files load physics equations only for model code and data rules only for data code.
- **Property-based testing:** 16 physics and scoring properties linked to requirements.
- **Agent hooks:** model tests on save, snapshot validation on save, and a manual log hook.
- **MCP:** fetch (reading real ERDDAP data), AWS documentation (deployment), Playwright (UI checks and screenshots).
- **Kiro IDE and Kiro CLI:** engine and UI in the IDE; data pipeline in the CLI.

## Project structure

```
.kiro/          steering, specs (requirements, design, tasks), hooks, MCP settings
docs/           Kiro playbook, team plan, prompts, logs, screenshots
public/data/    committed data snapshots, species.json, land mask
scripts/        data fetch scripts
src/model/      physics and scoring (pure functions, runSite entry point)
src/data/       validators and loaders
src/components/ map, site editor, species, compare table, report
tests/          property-based and unit tests
```

## Team

Keerthana Devi Govindaraj 
Khushi Lakhlani

## License

MIT, see [LICENSE](LICENSE). Uses open-source libraries including React, Vite, Leaflet, react-leaflet, Vitest, and fast-check under their respective licenses.
