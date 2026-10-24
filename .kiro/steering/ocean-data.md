---
inclusion: fileMatch
fileMatchPattern: ["scripts/**", "src/data/**", "public/data/**"]
---
# Ocean data sources

Start from the hackathon kit zip files; live URLs are optional refreshes. Working URLs confirmed in the "Confirmed URLs" section below (task 4.1).

| Source | Use | Citation | Notes |
|---|---|---|---|
| FIShBOT, Commercial Fisheries Research Foundation ERDDAP | Gridded bottom temperature baseline (~7 km cells) | Cite the foundation | CONFIRMED live on NEFSC ERDDAP, dataset `ondeckdata_erddap_4319_ff7a_72eb` (see Confirmed URLs). Read the README; keep mean, variability, observation count, depth if present. Label as "MEASURED (gridded daily average)"; show the ~7 km cell size. |
| eMOLT bottom temperature (ERDDAP) | Measured boat points | Cite the eMOLT program and the fishing vessels that collected it | CONFIRMED live: `erddap.emolt.net/erddap/tabledap/eMOLT_RT` (see Confirmed URLs). Kit's `erddap.ondeckdata.com/.../emolt_data.csv` is dead. Kit slice is one week (Aug 2024): no trends from it. |
| NOAA NDBC buoy 44013 | Surface water temperature context near Boston | Cite NOAA NDBC | Missing values ("MM") → null. |
| Simplified MA land polygons (`public/data/ma-land.geojson`) | Land mask for sample points and outfall check | Cite the source used (e.g., MassGIS) | Simplify to a few thousand vertices (e.g., mapshaper) so 20k point-in-polygon tests stay fast. |
| MassGIS diadromous fish stations (stretch) | River-mouth sensitivity flag | Cite MassGIS; confirm layer terms | No coordinates in kit file. |

## Rules
- Every snapshot has a meta block: source, url, fetchedAt, window, rowCount, droppedCount.
- Drop rows outside -2 to 35 °C, outside the MA coastal box, or with bad timestamps; record reasons.

## Confirmed URLs

Checked 2025-02-14 via web fetch. Both live fetches returned real data over the MA coastal box, so live refresh is viable; the committed kit snapshots remain the offline fallback for the demo (tech.md: browser reads only `/public/data/*.json`).

Shared request params (used in the per-source queries below):
- MA coastal box: `latitude 41.2–43.0`, `longitude -71.2 to -69.8` (degrees_east).
- Time window: ISO 8601, e.g. `time>=2024-08-01T00:00:00Z&time<=2024-08-08T00:00:00Z` (the kit's one-week Aug 2024 slice; widen for refresh, but see the no-trend rule for eMOLT).
- ERDDAP filter operators must be URL-encoded: `>=` → `%3E=`, `<=` → `%3C=`.

### FIShBOT (gridded bottom temperature) — CONFIRMED, live fetch viable
- Server: NEFSC ERDDAP `https://comet.nefsc.noaa.gov/erddap` (Commercial Fisheries Research Foundation / NEFSC / GOMLF).
- Protocol: **tabledap** (Point), dataset ID `ondeckdata_erddap_4319_ff7a_72eb`.
- Base URL: `https://comet.nefsc.noaa.gov/erddap/tabledap/ondeckdata_erddap_4319_ff7a_72eb`
- Working CSV query form:
  `.../ondeckdata_erddap_4319_ff7a_72eb.csv?time,latitude,longitude,temperature,temperature_count,depth&time%3E=2024-08-01T00:00:00Z&time%3C=2024-08-08T00:00:00Z&latitude%3E=41.2&latitude%3C=43.0&longitude%3E=-71.2&longitude%3C=-69.8`
- Fields available: `temperature` (daily mean, degree_C), `temperature_min/max/std`, `temperature_count` (obs count), `depth` (inferred, m), `grid_id`, `stat_area`, `latitude`/`longitude` (grid centroid). Keep mean, count, and depth per R1.5; label "MEASURED (gridded daily average)".
- Notes: use `.json` instead of `.csv` for JSON output. README/citation: https://github.com/CommercialFisheriesResearchFoundation/fishbot

### eMOLT (bottom-temperature points) — CONFIRMED, live fetch viable
- Server: eMOLT ERDDAP `https://erddap.emolt.net/erddap` (the kit's `erddap.ondeckdata.com/.../emolt_data.csv` is dead; this is the live replacement).
- Protocol: **tabledap** (Point). Use `eMOLT_RT` (QC/QA applied, only flagged-good rows). A fuller `eMOLT_RT_QAQC` variant with per-test QC flag columns also exists.
- Base URL: `https://erddap.emolt.net/erddap/tabledap/eMOLT_RT`
- Working CSV query form:
  `.../eMOLT_RT.csv?time,latitude,longitude,depth,temperature&time%3E=2024-08-01T00:00:00Z&time%3C=2024-08-08T00:00:00Z&latitude%3E=41.2&latitude%3C=43.0&longitude%3E=-71.2&longitude%3C=-69.8`
- Fields: `time`, `latitude`, `longitude`, `depth` (m), `temperature` (degree_C); plus `sensor_type`, `model`, `data_provider`. Returns hourly points, not daily.
- Notes: kit slice is one week (Aug 2024) — do NOT present a warming trend from it (R2.5). Cite the eMOLT program and the fishing vessels; https://emolt.org

### NDBC buoy 44013 (surface context) — NOAA, not re-checked here (task 4.4)
- Standard realtime text feed: `https://www.ndbc.noaa.gov/data/realtime2/44013.txt`; missing values are `MM` → null (R2.3).

### MA land mask (`public/data/ma-land.geojson`) — CONFIRMED, committed (task 4.5)
- Source: **Natural Earth** 1:10m Admin 1 – States, Provinces (`ne_10m_admin_1_states_provinces`), filtered to the Massachusetts feature.
- Download page: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
- License: **public domain** (Natural Earth terms of use); attribution "Made with Natural Earth." The source and license are also recorded in the file's top-level `metadata` member (GeoJSON has no comments).
- Processing: coordinates rounded to 5 decimal places (~1 m); no other simplification needed (the 10m feature is already ~670 vertices / 8 polygons, ~15 KB — well under a few thousand vertices, keeps 20k point-in-polygon tests fast).
- Verified land/water boundary near the demo area: downtown Boston (42.3601, -71.0589) is inside (land → outfall rejected, R3.2); Massachusetts Bay (42.3, -70.5) and Cape Cod Bay (41.9, -70.3) are outside (water → kept, R4.1).
