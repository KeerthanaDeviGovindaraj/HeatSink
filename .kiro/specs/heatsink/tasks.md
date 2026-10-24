# Implementation Plan: HeatSink (v2.1)

Numbering matches TEAM_PLAN.md. A = Engine + Kiro (src/model, tests/model, .kiro, deploy, write-up). B = Data + UI + video (scripts, src/data, public/data, src/components, README, video). Stretch tasks marked (stretch).

- [x] 1. Scaffold (A)
  - [x] 1.1 Vite + React + TS strict; add react-leaflet, leaflet, recharts, vitest, fast-check, tsx. Scripts: dev, test, data, build. _NFR_
  - [x] 1.2 Create folders per structure.md; verify `.kiro/` not in .gitignore. _NFR_

- [x] 2. Model core (A)
  - [x] 2.0 Create `src/model/types.ts` exactly as in design.md; push before anything else. _R10_
  - [x] 2.1 `constants.ts` and `units.ts`. _R3.5_
  - [x] 2.2 Property test P10 (units round trip). _R10.1_
  - [x] 2.3 `thermal.ts` computeThermal with bounds validation, mixing, L, reach. _R3.3, R3.5, R4.5_
  - [x] 2.4 Property tests P1, P5, P6, P11; unit test 90 MW/5 °C ≈ 4.40 m³/s ≈ 100 MGD; InputRangeError tests. _R10.1, R10.3, R10.4_

- [x] 3. Grid, plume, risk (A)
  - [x] 3.1 `grid.ts`: haversineM, samplePoints with land mask and containing-cell baseline/depth. _R4.1_
  - [x] 3.2 `plume.ts`: excessAt, impacts (negligible rule then shallow rule), sumImpacts. _R4.2, R4.3, R8_
  - [x] 3.3 `risk.ts` (area-based score, coverage, levels) and `runSite.ts` with OutfallOnLandError. _R6.1, R6.2, R3.2_
  - [x] 3.4 Property tests P2–P4, P7, P9, P12–P16. _R10.1_

- [x] 4. Data (B, Kiro CLI)
  - [x] 4.1 Confirm FIShBOT and eMOLT URLs with fetch MCP; record in ocean-data.md. _R2.1_
  - [x] 4.2 Validators in src/data + property tests in tests/data. _R2.2, R2.3, R10.2_
  - [x] 4.3 `fetch-fishbot.ts` → bottom-temp snapshot with meta (fallback: kit files). _R2.1_
  - [x] 4.4 `fetch-emolt.ts` and `fetch-ndbc.ts` → snapshots with meta. _R2.1, R2.3, R2.5_
  - [x] 4.5 Commit simplified `ma-land.geojson` with citation. _R3.2, R4.1_
  - [x] 4.6 `species.json` (lobster, winter flounder) with sources and verified flags. _R5.1–R5.3_

- [x] 5. Map (B)
  - [x] 5.1 MapView baseline, colorblind scale, °C/°F legend, no-data styling, tooltip. _R1.1, R1.2, R1.4, R1.5_
  - [x] 5.2 Choose 4 preset sites; verify each has coverage ≥ 0.5 with runSite. _R3.1, R6.2_
  - [x] 5.3 Footer, MEASURED/MODELED labels, error card. _R1.3, R1.6, R1.7_

- [x] 6. Site editor and plume (B)
  - [x] 6.1 Click-to-place with land message. _R3.2_
  - [x] 6.2 SiteEditor sliders, flow card (MW, m³/s, MGD) and Brayton line. _R3.3–R3.5_
  - [x] 6.3 Plume rings, area/reach, deep/unknown-depth styling, AssumptionsBanner. _R4.3, R4.4, R4.6_

- [x] 7. Species and compare (B)
  - [x] 7.1 SpeciesPicker + exceedance overlay (newly vs already). _R5.2–R5.4_
  - [x] 7.2 CompareTable (≤ 4 sites, lowest risk first, coverage, "Low impact at screening level", assumptions). _R6.2–R6.5_

- [x] 8. Summary
  - [x] 8.1 (B) ReportPanel template summary; copy + download. _R7.1, R7.2_
  - [x] 8.2 (A, stretch) `scripts/summaries.ts` build-time Bedrock summaries for presets. _R7.3_

- [x] 9. Stretch (A)
  - [x] 9.1 (stretch) Cumulative mode UI using sumImpacts; P8 test. _R8_
  - [x] 9.2 (stretch) Diadromous stations layer and reach flag. _R9_

- [ ] 11. Largest safe size (A, then B for UI)
  - [ ] 11.1 (A) src/model/maxSafe.ts: maxSafeMW binary search reusing sample points. _R11.1–R11.4_
  - [ ] 11.2 (A) Property tests P17, P18. _R10.20, R10.21_
  - [ ] 11.3 (B) UI: result line in SiteEditor with "Use this size", column in CompareTable. _R11.1–R11.7_

- [ ] 12. Shareable link (B)
  - [ ] 12.1 (B) src/data/urlState.ts encode/decode with clamping and notices. _R12.1, R12.4, R12.5_
  - [ ] 12.2 (B) Property tests P19, P20 in tests/data. _R10.22, R10.23_
  - [ ] 12.3 (B) Wire into App: restore on load, replaceState on change, "Copy link" button. _R12.2, R12.3_

- [ ] 13. Print brief (B)
  - [ ] 13.1 (B) PrintBrief component + print.css; hide controls; black-and-white legible. _R13.1, R13.2, R13.4_
  - [ ] 13.2 (B) Map snapshot or "map not included" fallback; "Print brief" button. _R13.1, R13.3_

- [ ] 10. Ship
  - [~] 10.1 (A) Deploy; phone check on live link. _NFR_
  - [x] 10.2 (B) README: live link, problem, data sources, assumptions, team. _Submission_
  - [~] 10.3 (B) Video < 3 min, public. _Submission_
  - [~] 10.4 (A) KIRO_PLAYBOOK → "How Kiro was used" write-up; submit. _Submission_
