---
inclusion: always
---
# Repository structure

```
.kiro/steering/        product, tech, structure (always); ocean-data, thermal-model (fileMatch)
.kiro/specs/heatsink/  requirements.md, design.md, tasks.md
.kiro/hooks/           agent hooks (commit them)
.kiro/settings/        mcp.json
docs/                  KIRO_PLAYBOOK.md (write-up source), screens/ (screenshots for write-up)
public/data/           committed JSON snapshots, species.json, ma-land.geojson (land mask)
scripts/               fetch-fishbot.ts, fetch-emolt.ts, fetch-ndbc.ts, summaries.ts (stretch)
src/model/             types, constants, units, thermal, grid, plume, risk, runSite (pure functions)
src/data/              validators and loaders
src/components/        MapView, SiteEditor, SpeciesPicker, CompareTable, ReportPanel, AssumptionsBanner, Footer
tests/model/           property + unit tests for src/model
tests/data/            property tests for validators
```
