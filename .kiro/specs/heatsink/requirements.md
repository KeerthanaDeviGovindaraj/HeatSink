# Requirements: HeatSink (v2.2)

## Introduction
HeatSink answers one question: "If an AI data center on the Massachusetts coast used seawater cooling, where would its waste heat do the least ecological harm?" It combines fishing-fleet bottom-temperature data (FIShBOT, eMOLT) and NOAA buoy context with a transparent screening heat model (steering: `thermal-model.md` v2.1). It is a SCREENING tool, not a hydrodynamic model or a permit decision, and must say so wherever results appear.

Context: Massachusetts Executive Order 658 (Sept 8, 2026) requires state guidance by Dec 31, 2026 to help municipalities evaluate data center proposals. Users: town boards and planners, state reviewers, fishers and fisheries advocates.

Glossary: MEASURED = derived directly from instruments (FIShBOT gridded daily average, eMOLT points, NDBC buoy). MODELED = computed by HeatSink (plume, combined temperature, scores). Plume point = water sample point with excessC ≥ NEGLIGIBLE_C.

## Requirement 1: Baseline map
**User story:** As a town planner, I want to see current bottom temperatures along the coast, so that I know where water is already warm.

1. WHEN the app loads THE SYSTEM SHALL display coastal Massachusetts with the FIShBOT baseline from the committed snapshot in `public/data/`.
2. THE SYSTEM SHALL use a colorblind-safe scale with a legend in °C and °F.
3. THE SYSTEM SHALL label every layer MEASURED or MODELED, with FIShBOT labeled "MEASURED (gridded daily average)".
4. WHEN a cell has no data THE SYSTEM SHALL render it as "no data" and SHALL NOT interpolate.
5. WHEN the user hovers or taps a cell THE SYSTEM SHALL show temperature, observation count, depth (if present), and date window.
6. THE SYSTEM SHALL show each source and snapshot `fetchedAt` in the Footer.
7. IF a snapshot fails to load THEN THE SYSTEM SHALL show an error card, not a blank map.

## Requirement 2: Data snapshots and validation
**User story:** As a developer, I want validated offline snapshots, so that the demo works on bad Wi-Fi and never shows impossible values.

1. WHEN `npm run data` runs THE SYSTEM SHALL write JSON snapshots with a meta block: source, url, fetchedAt, window, rowCount, droppedCount.
2. THE SYSTEM SHALL drop rows outside -2 to 35 °C, outside the MA coastal box, or with bad timestamps, and SHALL record each reason.
3. THE SYSTEM SHALL convert missing values (including NDBC "MM") to null, never 0.
4. THE SYSTEM SHALL read only `/public/data/*.json` (and `ma-land.geojson`) at runtime.
5. THE SYSTEM SHALL NOT present a warming trend from the one-week eMOLT kit sample.

## Requirement 3: Site editor
**User story:** As a resident, I want to place a hypothetical seawater-cooled data center and set its size, so that I can explore "what if" scenarios.

1. THE SYSTEM SHALL offer 4 preset sites spread along the coast near baseline data, plus click-to-place.
2. IF the user clicks on land (inside LAND_MASK) THEN THE SYSTEM SHALL explain the outfall must be in water and SHALL NOT place it.
3. THE SYSTEM SHALL provide bounded controls: facilityMW 1–500 (default 100), deltaTC 1–10 (default 4), mixRatio 0–5 (default 0), heatFraction 0.80–0.95 (default 0.88).
4. WHEN a control changes THE SYSTEM SHALL recompute the result in under 500 ms.
5. THE SYSTEM SHALL show heat to water (MW), required flow in m³/s and MGD, and a Brayton Point scale line (peak roughly 1 billion gallons/day, cited).

## Requirement 4: Screening plume
**User story:** As a planner, I want to see how far warm water spreads, so that I know which habitat is affected.

1. THE SYSTEM SHALL compute excess temperature on the 250 m fine sampling grid within R_REF_M, discarding land points, per `thermal-model.md` v2.1.
2. THE SYSTEM SHALL zero excess below NEGLIGIBLE_C before any threshold test.
3. THE SYSTEM SHALL apply the shallow-water rule and mark deep points "surface only" and null-depth points "depth unknown".
4. THE SYSTEM SHALL draw plume rings at labeled excess levels and show plume area (km²) and reach (km).
5. THE SYSTEM SHALL conserve heat under pre-mixing (lower ΔT, higher flow, same heat).
6. THE SYSTEM SHALL keep the AssumptionsBanner visible whenever results are shown.

## Requirement 5: Species thresholds
**User story:** As a fisher, I want to see where added heat pushes water past what key species tolerate.

1. THE SYSTEM SHALL load `species.json` entries with id, name, thresholdC, source, verified.
2. IF a species has no source THEN THE SYSTEM SHALL NOT display it.
3. THE SYSTEM SHALL show each threshold's source and an "unverified" badge when verified is false.
4. WHEN a species is selected THE SYSTEM SHALL style newly exceeded points distinctly from already exceeded points.

## Requirement 6: Score and comparison
**User story:** As a town board member, I want to compare candidate sites, so that I can see which deserves a closer look.

1. THE SYSTEM SHALL compute score = 100·(1 − exp(−newlyExceededKm2 / AREA_SCALE_KM2)) with levels Low < 10, Medium 10–30, High > 30.
2. IF coverage < MIN_COVERAGE THEN THE SYSTEM SHALL show "Insufficient data" with the score greyed out.
3. THE SYSTEM SHALL show AREA_SCALE_KM2 and other placeholder constants as assumptions.
4. THE SYSTEM SHALL compare up to 4 sites (inputs, flow, plume area, coverage, score per species), sorted lowest risk first.
5. WHEN newlyExceededKm2 is 0 with sufficient coverage THE SYSTEM SHALL say "Low impact at screening level".

## Requirement 7: Summary
**User story:** As a non-expert, I want a short written summary to share at a meeting.

1. THE SYSTEM SHALL generate a deterministic template summary for any site: inputs, flow, plume, species results, coverage, assumptions, sources, and the screening disclaimer.
2. THE SYSTEM SHALL support copy and Markdown download.
3. (stretch) THE SYSTEM SHALL show AI-written summaries for preset sites, generated at build time by `scripts/summaries.ts` via Amazon Bedrock; THE SYSTEM SHALL NOT call Bedrock from the browser, and custom sites SHALL use the template.

## Requirement 8 (stretch): Cumulative mode
1. WHEN enabled THE SYSTEM SHALL sum excess from all saved sites at each sample point (superposition) and recompute species areas.

## Requirement 9 (stretch): River-mouth flag
1. WHEN enabled THE SYSTEM SHALL show diadromous fish stations and flag any within a plume's reach in the comparison table. (Kit file lacks coordinates; fetch geometry or skip.)

## Requirement 10: Correctness properties
**User story:** As judges and users, we want the model's guarantees proven by property-based tests, not just examples.

Each criterion maps to a property (P#) in `thermal-model.md` v2.1 and to a fast-check test in `tests/model/`.

1. FOR ANY valid inputs, THE SYSTEM SHALL conserve heat: RHO·CP·totalFlowM3s·deltaTEffC equals heatW within relative error 1e-9. (P1)
2. FOR ANY distance r ≥ 0, THE SYSTEM SHALL return excessC(r) ≥ 0. (P2)
3. FOR ANY distances r1 < r2, THE SYSTEM SHALL return excessC(r2) ≤ excessC(r1). (P3)
4. FOR ANY valid inputs, THE SYSTEM SHALL return excessC(0) equal to deltaTEffC. (P4)
5. WHEN facilityMW doubles within bounds and all else is equal, THE SYSTEM SHALL double flowM3s. (P5)
6. WHEN mixRatio > 0, THE SYSTEM SHALL return deltaTEffC < deltaTC with heatW unchanged. (P6)
7. FOR ANY sample point with baseline data, THE SYSTEM SHALL return combinedC ≥ baselineC. (P7)
8. WHEN several sites are combined, THE SYSTEM SHALL return cumulative excess ≥ the largest individual excess at every point. (P8)
9. FOR ANY valid inputs, THE SYSTEM SHALL return 0 ≤ score ≤ 100, and WHEN facilityMW or heatFraction increases with all else equal THE SYSTEM SHALL NOT return a lower score. (P9)
10. FOR ANY non-negative x, THE SYSTEM SHALL return toMGD(fromMGD(x)) equal to x within floating-point tolerance. (P10)
11. FOR ANY valid inputs, THE SYSTEM SHALL return reachM ≤ R_REF_M. (P11)
12. FOR ANY sample point with depth > SHALLOW_DEPTH_M, THE SYSTEM SHALL return bottomExcessC = 0. (P12)
13. FOR ANY site, THE SYSTEM SHALL return 0 ≤ newlyExceededKm2 ≤ plumeAreaKm2 ≤ π·(R_REF_M/1000)², and newly + already exceeded area ≤ total water area with data. (P13)
14. WHEN newlyExceededKm2 is 0 THE SYSTEM SHALL return score 0, and FOR ANY site THE SYSTEM SHALL return coverage within [0, 1]. (P14)
15. FOR ANY site, THE SYSTEM SHALL retain no sample point inside LAND_MASK, and changing baselines of land points SHALL NOT change coverage or any area. (P15)
16. FOR ANY sample point, THE SYSTEM SHALL return bottomExcessC = 0 or bottomExcessC ≥ NEGLIGIBLE_C, and every newly exceeded point SHALL be a plume point. (P16)
17. FOR ANY validator input, THE SYSTEM SHALL keep rows inside bounds, drop rows outside bounds, and return rowCount + droppedCount equal to the input count. (tests/data)
18. THE SYSTEM SHALL pass the unit test: 90 MW at ΔT 5 °C ≈ 4.40 m³/s ≈ 100 MGD.
19. WHEN inputs are out of range THE SYSTEM SHALL throw InputRangeError; WHEN the outfall is on land THE SYSTEM SHALL throw OutfallOnLandError.
20. FOR ANY site and settings, IF maxSafeMW returns n THEN every selected species SHALL score < 10 at n, AND (n SHALL equal 500 OR some selected species SHALL score ≥ 10 at n + 1). (P17)
21. FOR ANY site and settings, maxSafeMW SHALL return null if and only if some selected species scores ≥ 10 at 1 MW, AND the result SHALL NOT depend on the facilityMW value passed in. (P18)
22. FOR ANY valid app state, decoding the encoded share URL SHALL return the same state (sites, sliders, species, cumulative flag), equal within display rounding. (P19, tests/data)
23. FOR ANY share URL, out-of-range or malformed values SHALL be replaced by defaults or clamped into bounds, and decoding SHALL never throw. (P20, tests/data)

## Requirement 11: Largest safe size
**User story:** As a town board member, I want to know the largest data center a site can host while staying at Low impact, so that I get a planning answer, not just a risk score.

1. WHEN a site is selected THE SYSTEM SHALL show "Largest size at Low impact: N MW" for the current temperature rise, mixing ratio, heat fraction, and selected species.
2. IF even 1 MW is not Low impact THEN THE SYSTEM SHALL show "No size is Low impact at this site".
3. IF the result is 500 MW THEN THE SYSTEM SHALL show "500+ MW (upper bound of the tool)".
4. IF coverage at the result is below MIN_COVERAGE THEN THE SYSTEM SHALL show "Insufficient data" instead of a size.
5. THE SYSTEM SHALL show the largest safe size for each site in the comparison table.
6. WHEN the user clicks "Use this size" THE SYSTEM SHALL set the facility size slider to the result.
7. WHEN any non-MW control changes THE SYSTEM SHALL update the result within 1 second.

## Requirement 12: Shareable scenario link
**User story:** As a planner, I want to send a colleague a link that opens exactly what I'm looking at.

1. THE SYSTEM SHALL encode the current state (saved sites with inputs, active site, selected species, cumulative flag) in the URL query string.
2. WHEN the user clicks "Copy link" THE SYSTEM SHALL copy the URL and confirm with "Link copied".
3. WHEN the app loads with state in the URL THE SYSTEM SHALL restore it before first render of results.
4. IF a URL value is missing, malformed, or out of range THEN THE SYSTEM SHALL use the default or clamp it into bounds and show a short notice, never an error page.
5. THE SYSTEM SHALL keep URLs under 2,000 characters for up to 4 sites.

## Requirement 13: Printable town board brief
**User story:** As a town board member, I want a clean one-page printout to bring to a meeting.

1. WHEN the user clicks "Print brief" or prints the page THE SYSTEM SHALL print one page with: title, date, site location, inputs, flow (m³/s and MGD), plume area and reach, species results, largest safe size, coverage, assumptions, data sources, the share link, and the screening disclaimer.
2. THE SYSTEM SHALL hide interactive controls in the printed output.
3. THE SYSTEM SHALL include a map snapshot with the plume, or a clear "map not included" note.
4. THE SYSTEM SHALL print legibly in black and white (risk levels as text, not color alone).

## Non-functional
- Static SPA; works at phone width; demo path offline except map tiles.
- SI units internally with unit-suffixed names; constants only in `src/model/constants.ts`.
- `.kiro/` committed at repo root, never gitignored.
