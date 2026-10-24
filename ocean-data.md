---
inclusion: fileMatch
fileMatchPattern: ["scripts/**", "src/data/**", "public/data/**"]
---
# Ocean data sources

Start from the hackathon kit zip files; live URLs are optional refreshes. Record working URLs here once confirmed (task 4.1).

| Source | Use | Citation | Notes |
|---|---|---|---|
| FIShBOT, Commercial Fisheries Research Foundation ERDDAP | Gridded bottom temperature baseline (~7 km cells) | Cite the foundation | Read the README; keep mean, variability, observation count, depth if present. Blended grid = MODELED. |
| eMOLT bottom temperature (ERDDAP) | Measured boat points | Cite the eMOLT program and the fishing vessels that collected it | Kit URL `erddap.ondeckdata.com/.../emolt_data.csv` redirected to `erddap.emolt.net/.../eMOLT_RT.csv` and errored; confirm before relying on it. Kit slice is one week (Aug 2024): no trends from it. |
| NOAA NDBC buoy 44013 | Surface water temperature context near Boston | Cite NOAA NDBC | Missing values ("MM") → null. |
| MassGIS diadromous fish stations (stretch) | River-mouth sensitivity flag | Cite MassGIS; confirm layer terms | No coordinates in kit file. |

## Rules
- Every snapshot has a meta block: source, url, fetchedAt, window, rowCount, droppedCount.
- Drop rows outside -2 to 35 °C, outside the MA coastal box, or with bad timestamps; record reasons.
- Confirmed URLs:
  - FIShBOT: TODO
  - eMOLT: TODO
