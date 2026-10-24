---
inclusion: fileMatch
fileMatchPattern: ["src/model/**", "tests/**"]
---
# Thermal screening model — equations and assumptions (v2.1)

Changes from v1: impacts are computed on a fine sampling grid (not 7 km cells); the site score
is based on newly exceeded AREA (fixes the score-monotonicity bug and divide-by-zero); bottom
effects are limited to shallow water; properties 11–14 added.

Changes from v2 (v2.1): sample points on land are discarded (fixes false "Insufficient data" at coastal
sites and plumes drawn over towns); excess below NEGLIGIBLE_C is zeroed before any threshold test
(fixes a counterexample to property 13); properties 15–16 added.

## Constants (define once in `src/model/constants.ts`)
- Seawater density RHO = 1025 kg/m³
- Seawater specific heat CP = 3990 J/(kg·K)
- 1 m³/s = 22.824 million US gallons per day (MGD)
- NEGLIGIBLE_C = 0.1 °C (excess below this is ignored)
- SAMPLE_SPACING_M = 250 (fine sampling grid spacing; each point represents 0.0625 km²)
- R_REF_M = 20000 (sampling radius around the outfall; max plume reach for valid inputs is ≈ 17.9 km)
- SHALLOW_DEPTH_M = 20 (ASSUMPTION: discharge is treated as reaching the bottom only at or above this depth)
- AREA_SCALE_KM2 = 5 (ASSUMPTION: score calibration constant, see Site score)
- MIN_COVERAGE = 0.5 (minimum share of plume points with baseline data for a valid score)
- LAND_MASK = `public/data/ma-land.geojson` (simplified Massachusetts land polygons, committed)

## Input bounds (validated; out-of-range inputs throw a typed error)
- facilityMW: 1–500 · deltaTC: 1–10 · mixRatio: 0–5 · heatFraction: 0.80–0.95

## Heat to water
- `heatW = facilityMW * 1e6 * heatFraction`
- Default `heatFraction = 0.88` (published estimates: a 100 MW data center dissipates ~85–90 MW to its cooling medium).

## Required seawater flow
- `flowM3s = heatW / (RHO * CP * deltaTC)`
- Sanity check: 90 MW at ΔT = 5 °C → ≈ 4.40 m³/s ≈ 100 MGD.
- Typical discharge rise: 3–5 °C above ambient. UI default 4.

## Pre-mixing (Hamina-style)
- Mixing ratio m ≥ 0: m parts of ambient seawater added per part of cooling water before discharge.
- `deltaTEffC = deltaTC / (1 + m)`; `totalFlowM3s = flowM3s * (1 + m)`.
- Heat is conserved: RHO·CP·totalFlowM3s·deltaTEffC == heatW.

## Screening plume
- Excess temperature at distance r (m) from outfall: `excessC(r) = deltaTEffC * exp(-r / L)`
- Decay length: `L = Lref * sqrt(totalFlowM3s / Qref)`, Lref = 1500 m, Qref = 4.4 m³/s (placeholder calibration — ASSUMPTION).
- Negligible radius: `reachM = L * ln(deltaTEffC / NEGLIGIBLE_C)` if deltaTEffC > NEGLIGIBLE_C, else 0.
- Distances use haversine.

## Fine sampling grid
- Generate sample points on a square grid with SAMPLE_SPACING_M spacing, centered on the outfall, keeping points with distance ≤ R_REF_M.
- Discard every point that falls inside LAND_MASK. All later counts (plume, coverage, areas) use water points only.
- The outfall itself must be in water; an outfall on land throws a typed error (the UI prevents it).
- Each point's baseline = the baseline cell that contains it (FIShBOT ~7 km cells), or null if none.
- Each point's depth = containing cell's depth if available, else null.

## Bottom effect (shallow-water rule)
- Negligible rule first: if `excessC(r) < NEGLIGIBLE_C` then `bottomExcessC = 0` (no further tests).
- Otherwise `bottomExcessC(point) = excessC(r)` if depth is null or depth ≤ SHALLOW_DEPTH_M; otherwise 0, and the point is flagged `deepSurfaceOnly = true`.
- Depth null is treated as shallow (conservative) and shown as "depth unknown".
- `combinedC(point) = baselineC + bottomExcessC` when baseline exists; otherwise null ("no data").

## Areas
- `plumeAreaKm2` = (count of points with excessC ≥ NEGLIGIBLE_C) × 0.0625
- For a species threshold T*:
  - NEWLY EXCEEDED point: baselineC < T* AND combinedC ≥ T*.
  - ALREADY EXCEEDED point: baselineC ≥ T*.
  - `newlyExceededKm2` = count(newly exceeded) × 0.0625; `alreadyExceededKm2` likewise.
- `coverage` = (plume points with baseline data) / (plume points), or 1 when the plume has no points. Plume points are water points only.

## Site score (per species)
- `score = 100 * (1 - exp(-newlyExceededKm2 / AREA_SCALE_KM2))`
- Levels: Low < 10, Medium 10–30, High > 30.
- IF coverage < MIN_COVERAGE THEN level = "Insufficient data" (score still computed but shown greyed out).
- Rationale: depends only on area the data center pushes past a limit; bounded 0–100; rises with heat; never divides by zero.

## Cumulative mode (stretch)
- Excess from multiple sites adds linearly at each sample point: `excessTotal = Σ excess_i` (superposition).

## UI assumptions banner (always visible)
Radially symmetric, no tides or currents, steady state, warm discharge assumed to reach the bottom only in
water ≤ 20 m deep, placeholder calibration constants. Screening heuristic, NOT a hydrodynamic model.

## Required properties (fast-check)
1. Energy conservation: RHO·CP·totalFlow·deltaTEff ≈ heatW (relative error < 1e-9) for all valid inputs.
2. Non-negative excess: excessC(r) ≥ 0 for all r ≥ 0.
3. Monotonic decay: r1 < r2 ⇒ excessC(r1) ≥ excessC(r2).
4. Boundary: excessC(0) == deltaTEffC.
5. Linearity: doubling MW doubles flowM3s (same ΔT, within bounds).
6. Mixing lowers temperature: m > 0 ⇒ deltaTEffC < deltaTC, heat unchanged.
7. Never colder: combinedC ≥ baselineC at every point with baseline data.
8. Superposition: cumulative excess ≥ max individual excess at every point.
9. Score bounds and monotonicity: 0 ≤ score ≤ 100; score is non-decreasing in MW and in heatFraction, all else equal.
10. Units round trip: toMGD(fromMGD(x)) ≈ x.
11. Reach bound: reachM ≤ R_REF_M for all valid inputs (the sampling disc always contains the whole plume).
12. Deep water rule: bottomExcessC == 0 at every point with depth > SHALLOW_DEPTH_M.
13. Area consistency: 0 ≤ newlyExceededKm2 ≤ plumeAreaKm2 ≤ π·(R_REF_M/1000)² and newly + already ≤ total area with data.
14. Zero-impact: if newlyExceededKm2 == 0 then score == 0; coverage is always within [0, 1].
15. Land rule: no retained sample point lies inside LAND_MASK; changing land-point baselines never changes coverage or any area.
16. Negligible rule: for every point, bottomExcessC == 0 or bottomExcessC ≥ NEGLIGIBLE_C; every newly exceeded point is also a plume point.
