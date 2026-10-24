# HeatSink — Kiro prompts for 2 people

Put this file in the repo at `docs/KIRO_PROMPTS.md`.

**Person A = Keerthana** (engine + Kiro showcase): `src/model/`, `tests/model/`, `.kiro/`, deploy, write-up. Kiro **IDE**.
**Person B = teammate** (data + UI + video): `scripts/`, `src/data/`, `public/data/`, `src/components/`, README, video. Kiro **CLI** for data, **IDE** for UI.

How to use each step:
- **Button** = Specs → heatsink → Tasks → click "Start task" above that task, then paste the prompt into the chat as extra instructions.
- **Chat** = paste the prompt into a new Kiro IDE chat session.
- **CLI** = run `kiro-cli` in the repo folder (or `kiro-cli chat` if that's what your version needs) and paste the prompt.
- After each step: run the **Check**, then **Commit**. Log one line in `docs/log-<name>.md`: time · task · Kiro feature · result.

---

## Branch workflow (both)

```bash
# once
git checkout main && git pull
git checkout -b <your-name>
git push -u origin <your-name>

# after each step
git add -A && git commit -m "<task id>: <what>" && git push

# merge to main (at handoffs, at least hourly, and by 3:15)
git checkout main && git pull && git merge <your-name> && git push
git checkout <your-name> && git merge main
```

Conflicts in `tasks.md`: keep both people's checkmarks.

---

## Session starter (paste at the start of EVERY new Kiro chat, both people)

> You are working on HeatSink. Follow all steering files in .kiro/steering and the spec in .kiro/specs/heatsink. I am Person [A/B]. Only create or edit files in my folders: [A: src/model/, tests/model/, .kiro/, deploy config] [B: scripts/, src/data/, public/data/, src/components/, src/App.tsx, README.md]. Do not modify the other person's folders, the spec files, or steering unless I ask. Keep changes small, run the tests after changes, and tell me which requirement each change satisfies. When a task is done, mark it complete in tasks.md.

---

# PERSON A — Keerthana

### A1 · Task 1.1–1.2 Scaffold · Button (Autopilot on)
> Scaffold the Vite + React + TypeScript (strict) app in the repo root, not a subfolder. Keep the existing README.md, LICENSE, .gitignore, .kiro/, docs/ and public/data/ unchanged; only append to .gitignore if needed and never add .kiro to it. Install react-leaflet, leaflet, @types/leaflet, recharts, vitest, fast-check, tsx. Add npm scripts: dev, build, test (vitest run), data (tsx scripts/run-data.ts, can be a stub for now). Create the folders listed in structure.md. Add a trivial passing test so `npm test` runs.

**Check:** `npm run dev` opens localhost · `npm test` passes · `git status` shows README/.kiro not deleted · `grep -n kiro .gitignore` prints only the comment.
**Commit:** `Task 1: scaffold`

### A2 · Task 2.0 types.ts · Button
> Create src/model/types.ts exactly as specified in design.md (all interfaces, the Level type, InputRangeError and OutfallOnLandError). No logic, no other files. Make sure it compiles with strict mode.

**Check:** `npx tsc --noEmit` passes.
**Commit + merge to main immediately**, then tell B: "types.ts is on main."

### A3 · Hooks · Agent Hooks panel → + (describe in plain English)
1. **Model tests on save**
   > When any file under src/model/ is saved, run `npm test -- tests/model` and report only failing tests with the counterexample. Do not change any code.
2. **Snapshot check on save**
   > When any file under public/data/ is saved, check every JSON file has a meta block with source, url, fetchedAt, window, rowCount, droppedCount, and that every species in species.json has a non-empty source. Report problems only; do not change files.
3. **Playbook logger (manual trigger)**
   > Append one row to docs/log-keerthana.md describing what we just did: time, task id, Kiro feature used (spec task, steering, hook, MCP, property test, CLI), and the outcome. Keep it to one line.

If your Kiro offers a "run command" hook action, use it for hook 1 instead of an agent prompt (saves credits).
**Commit:** `Hooks: model tests, snapshot check, playbook logger` · screenshot the Hooks panel.

### A4 · Tasks 2.1–2.2 constants, units, P10 · Button
> Implement src/model/constants.ts with every constant from thermal-model.md (and only there), and src/model/units.ts (toMGD, fromMGD, cToF). Write the fast-check property test for P10 (units round trip) in tests/model/units.test.ts, linked to Requirement 10.10. Use unit-suffixed names.

**Check:** `npm test -- tests/model` · **Commit:** `Task 2.1-2.2`

### A5 · Tasks 2.3–2.4 computeThermal + properties · Button (Autopilot OFF — review each change)
> Implement computeThermal in src/model/thermal.ts per thermal-model.md: validate input bounds (throw InputRangeError), heatW, flowM3s, flowMGD, mixing (deltaTEffC, totalFlowM3s), decay length L, reachM. Then write fast-check property tests for P1, P5, P6, P11, the unit test 90 MW at 5 °C ≈ 4.40 m³/s ≈ 100 MGD, and InputRangeError tests. Generate inputs only within the valid bounds. If a property fails, do NOT weaken the property: show me the counterexample and explain whether the code or the spec is wrong.

**Check:** all tests pass · **Screenshot any property failure + fix** → docs/screens/
**Commit:** `Task 2.3-2.4: computeThermal + P1 P5 P6 P11`

### A6 · Task 3.1 grid · Button
> Implement src/model/grid.ts: haversineM, and samplePoints(outfall, cells, land) that builds a 250 m square grid within R_REF_M of the outfall, drops points inside the land polygons (ray casting with a bounding-box precheck per polygon), and attaches the containing baseline cell's tempC and depthM (or null). Land may be an empty FeatureCollection; handle that. Keep it pure.

### A7 · Task 3.2 plume · Button
> Implement src/model/plume.ts: excessAt(r, thermal), impacts(points, thermal) applying the negligible rule FIRST and then the shallow-water rule exactly as in thermal-model.md v2.1, and sumImpacts(list) for superposition. Pure functions only.

### A8 · Task 3.3 risk + runSite · Button
> Implement src/model/risk.ts (plumeAreaKm2, coverage, speciesRisk with the area-based score and levels including "Insufficient data") and src/model/runSite.ts: runSite(inputs, cells, species, land): SiteResult, throwing OutfallOnLandError when the outfall is inside land. runSite is the only function the UI will call.

### A9 · Task 3.4 property tests · Button (Autopilot OFF)
> Write fast-check property tests for P2, P3, P4, P7, P9, P12, P13, P14, P15, P16 in tests/model/, each test named with its property number and Requirement 10 criterion. Use small synthetic baseline grids and land polygons as generators. If any property fails, stop and show me the shrunk counterexample, then propose whether to fix code or spec.

**Check:** all 16 properties pass. **Commit + merge to main**, tell B: "runSite is on main."

### A10 · Task 10.1 Deploy · Chat
> Help me deploy this static Vite app. Option 1: AWS Amplify Hosting connected to the GitHub repo's main branch — use the aws-docs MCP server to get the current steps and build settings. Option 2 if Amplify is blocked: Netlify (build command npm run build, publish directory dist). Give me exact steps and any config file needed. Do not add secrets to the repo.

**Check:** live link loads on your phone · put it in README (tell B).

### A11 · (stretch) Task 8.2 AI summaries · Button
> Implement scripts/summaries.ts: for each preset site, run runSite, then call Amazon Bedrock (credentials from the environment, model id from BEDROCK_MODEL_ID) with only the computed numbers, and write public/data/summaries.json. Each summary must end with the data sources and "Screening result, not a permit decision." Use the aws-docs MCP for the current Bedrock Runtime API. Never call Bedrock from the browser.

### A12 · Task 10.4 Write-up · Chat
> Using docs/KIRO_PLAYBOOK.md, docs/log-keerthana.md, docs/log-<teammate>.md, the git log, and the spec history, write the "How Kiro was used" section for our submission. Answer each prompt from the hackathon rules: Kiro tools used (IDE, CLI) and how they differed; how we structured the spec and how spec-driven compared to vibe coding (include the v1→v2 score bug and v2→v2.1 land/negligible fixes); agent hooks; steering strategy (always vs fileMatch); MCP (fetch, aws-docs, playwright); property-based testing (which properties, any bugs caught); powers if used. Be specific and honest; no claims we can't show.

---

# PERSON B — teammate

### B0 · Setup (terminal)
```bash
git clone https://github.com/KeerthanaDeviGovindaraj/HeatSink.git && cd HeatSink
brew install uv node
npx playwright install chromium
curl -fsSL https://cli.kiro.dev/install | bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
kiro-cli login
which uvx   # if not /opt/homebrew/bin/uvx, put your path in Kiro USER config, not the repo file
git checkout -b <your-name> && git push -u origin <your-name>
```
Open the folder in Kiro IDE → trust it → check Specs, Steering (5), MCP (3 green).

### B1 · Task 4.6 species thresholds · Chat (uses fetch MCP)
> Using the fetch MCP, find published thermal tolerance / stress thresholds (in °C) for American lobster (Homarus americanus) and winter flounder (Pseudopleuronectes americanus) from government, peer-reviewed, or fisheries-agency sources. For each, give the value, what it means (e.g., stress onset, avoidance), the exact source title and URL, and the quote location. Do NOT invent or estimate numbers. Then update public/data/species.json with thresholdC and source, keeping verified=false.

**You** open each source and confirm the number; then set `verified: true` yourself.
**Commit:** `Task 4.6: species thresholds with sources`

### B2 · Task 4.5 land mask · CLI
> Find a MassGIS (or other public, citable) Massachusetts land or coastline polygon layer I can download as GeoJSON using the fetch MCP. Write scripts/build-land.ts that downloads it, keeps only polygons within the Massachusetts coastal box, simplifies it to a few thousand vertices (use mapshaper via npx if helpful), and writes public/data/ma-land.geojson with a citation in a top-level "source" property. If no source works within a few attempts, write an empty FeatureCollection with source "none — fallback" and tell me.

**Time box: 45 min.** Then move on regardless.
**Commit:** `Task 4.5: land mask`

### B3 · Task 4.1 confirm data URLs · CLI
> Using the fetch MCP, confirm working ERDDAP query URLs for (1) FIShBOT bottom temperature from the Commercial Fisheries Research Foundation ERDDAP and (2) eMOLT bottom temperature (the kit URL erddap.ondeckdata.com/.../emolt_data.csv redirected to erddap.emolt.net/.../eMOLT_RT.csv and errored — find the current one). For each, inspect the real column names, units, and whether depth is included. Record the confirmed URLs and columns under "Confirmed URLs" in .kiro/steering/ocean-data.md. Do not write fetch scripts yet.

(Editing ocean-data.md is the one steering change B is allowed to make.)
**Commit:** `Task 4.1: confirmed data URLs`

### B4 · Task 4.2 validators + property tests · CLI
> Implement validators in src/data/validate.ts that return { rows, dropped, reasons } per Requirement 2.2–2.3: drop temperature outside -2 to 35 °C, coordinates outside the MA coastal box, unparseable timestamps; convert missing values including "MM" to null, never 0. Write fast-check property tests in tests/data/: rows inside bounds are kept, rows outside are dropped, rowCount + droppedCount equals input count.

**Check:** `npm test -- tests/data` · **Commit:** `Task 4.2: validators + PBT`

### B5 · Tasks 4.3–4.4 snapshots · CLI
> Write scripts/fetch-fishbot.ts using the confirmed URL in ocean-data.md: pull a multi-day window for the Massachusetts coastal box, validate rows, aggregate to grid cells (mean tempC, nObs, depthM if present), and write public/data/fishbot.json with the meta block. If the live URL fails, build the same snapshot from the hackathon kit files and set meta.source accordingly. Then do the same for scripts/fetch-emolt.ts and scripts/fetch-ndbc.ts (NDBC 44013, "MM" → null). Wire them into `npm run data`.

**Check:** JSON files in public/data with meta; snapshot hook reports no problems.
**Commit + merge to main**, tell A: "snapshots are on main."

### B6 · Fake result for UI work · Chat (IDE)
> Create src/data/fakeSiteResult.ts exporting a realistic SiteResult (matching src/model/types.ts) for a site in Massachusetts Bay, with a few hundred PointImpact entries, two species risks, and coverage 0.8. It's a temporary stand-in until runSite is ready.

### B7 · Tasks 5.1, 5.3 map · Button (IDE)
> Build MapView with react-leaflet: baseline cells from public/data/fishbot.json as rectangles with a colorblind-safe scale, legend in °C and °F, "no data" styling without interpolation, tooltip with temperature, observation count, depth and date window. Label the layer "MEASURED (gridded daily average)" and note the ~7 km cell size. Add the Footer with each source and fetchedAt, and an error card if a snapshot fails to load.

### B8 · Tasks 6.1–6.3 site editor + plume · Button (IDE)
> Build SiteEditor: 4 preset buttons plus click-to-place (show a friendly message on OutfallOnLandError), bounded sliders for facilityMW, deltaTC, mixRatio, heatFraction with the spec defaults, and a result card showing heat to water (MW), flow in m³/s and MGD, and a Brayton Point scale line (~1 billion gallons/day). Draw plume rings at labeled excess levels with plume area and reach, style deep points "surface only" and null depth "depth unknown", and show AssumptionsBanner whenever results are visible. Use fakeSiteResult until runSite is on main; debounce sliders 100 ms.

### B9 · Tasks 5.2, 7.1, 7.2 presets, species, compare · Button (IDE)
> Choose 4 preset sites spread along the Massachusetts coast near baseline data. Build SpeciesPicker (source shown, "unverified" badge, hide species with no source) and the exceedance overlay (solid = newly exceeded, hatched = already exceeded). Build CompareTable for up to 4 saved sites (inputs, flow, plume area, coverage, score per species), sorted lowest risk first, "Insufficient data" last, "Low impact at screening level" when newly exceeded area is 0 with sufficient coverage, and placeholder constants listed as assumptions.

### B10 · Integrate runSite · Chat (after A merges it)
> Replace fakeSiteResult with the real runSite from src/model/runSite.ts, loading cells, species and land from public/data. Cache results by input key. Then use the playwright MCP to open the dev server, run the demo path (preset site → sliders → species → compare), and verify each preset has coverage ≥ 0.5. Report anything broken.

### B11 · Task 8.1 summary · Button (IDE)
> Build ReportPanel: deterministic Markdown summary for the current site with inputs, flow, plume, species results, coverage, assumptions, sources, and the screening disclaimer. Add copy-to-clipboard and Markdown download. If public/data/summaries.json has an AI summary for a preset site, show it labeled "AI-written" with the template as fallback.

### B12 · Phone check + screenshots · Chat (playwright MCP)
> Using the playwright MCP, open the app at phone width (390×844) and desktop width, run the demo path, and save screenshots to docs/screens/. List any layout problems and fix only those in src/components/.

### B13 · Task 10.2 README · Chat
> Fill in README.md: one-paragraph problem (drought → seawater cooling → heat into warm coastal water; EO 658 guidance due Dec 31, 2026; Brayton Point precedent), features, how to run, model assumptions, data sources with citations, team names, live link (from Person A). Keep it under one screen plus sections.

### B14 · Task 10.3 Video (no Kiro)
Script in docs/TEAM_PLAN.md. Under 3:00, no copyrighted music, show the live app running. Upload public on YouTube/Vimeo.

---

## Handoffs

| ~Time | Who | Message |
|---|---|---|
| 11:50 | A → B | "types.ts is on main" |
| 1:30 | B → A | "snapshots are on main" |
| 2:15 | A → B | "runSite is on main" |
| 2:45 | A → B | "live link: …" |
| 3:15 | Both | Everything merged to main — freeze |
| 4:20 | B → A | "video link: …" |
| 4:40 | A | Submitted |
