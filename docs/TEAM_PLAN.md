# HeatSink — 2-person plan (deadline 5:00 PM, submit by 4:40)

Person A = Engine + Kiro showcase (owns: src/model, tests/model, .kiro/, deploy, write-up)
Person B = Data + UI + video (owns: scripts, src/data, public/data, src/components, README, video)

Rule: never edit the other person's folders. Shared files (package.json, App.tsx) — A owns package.json, B owns App.tsx.
Git: commit small, `git pull --rebase` before every push, push at least every 30 min.

## Hard times (do not move)
- 3:15 FEATURE FREEZE — only bug fixes after this
- 3:45 deployed link works on a phone
- 4:20 video uploaded (public)
- 4:40 submitted. 4:40–5:00 is buffer, not work time.

---

## Phase 0 — Setup (first 30 min, both)
- [ ] A: create public GitHub repo, push starter zip, add B as collaborator
- [ ] Both: install Kiro IDE, sign in, open repo, confirm Steering panel shows 5 files
- [ ] Both: install `uv` (for MCP fetch/aws-docs) and Node 20+; check MCP panel shows servers connected
- [ ] B: add GitHub MCP in USER config (~/.kiro/settings/mcp.json), never in the repo (token)
- [ ] A: create the 3 hooks (below); commit .kiro/hooks/
- [ ] A: run Kiro task 1 (scaffold), push; B pulls
- [ ] A: create src/model/types.ts from design.md interfaces FIRST and push — B builds UI against it
- [ ] Both: screenshot steering panel + MCP panel → docs/screens/

## Phase 1 — Build (until 3:15)

### Person A (Kiro IDE: specs + correctness)
- [ ] Task 2.0: types.ts — push FIRST
- [ ] Tasks 2.1–2.4: constants, units, computeThermal + property tests (P1, P5, P6, P10, P11)
- [ ] Tasks 3.1–3.4: grid (land mask), plume, risk, runSite + property tests (P2–P4, P7, P9, P12–P16)
- [ ] Use Kiro spec correctness / property tests; screenshot EVERY property failure + fix
- [ ] Export a `runSite(inputs, cells, species)` function for B (one call returns SiteResult)
- [ ] Deploy early (by 1 hour before freeze): Amplify, Netlify, or GitHub Pages
      (GitHub Pages needs `base: '/<repo-name>/'` in vite.config.ts)
- [ ] Log every Kiro action in docs/KIRO_PLAYBOOK.md section 6 as you go
- [ ] Stretch only if green: 8.2 AI summaries (build-time Bedrock script), 9.1 cumulative mode

### Person B (Kiro CLI for data, Kiro IDE for UI)
- [ ] FIRST 30 MIN: find citable thermal thresholds for American lobster + winter flounder → species.json, verified=true
- [ ] Task 4.1: confirm FIShBOT + eMOLT URLs using Kiro + fetch MCP; record in ocean-data.md
- [ ] Tasks 4.2–4.6 in Kiro CLI (note IDE vs CLI differences for write-up)
- [ ] If live data fails by +45 min: build snapshot from kit zip files and move on
- [ ] Task 4.5: ma-land.geojson (MassGIS, simplified). Fallback after 45 min: empty FeatureCollection, presets only
- [ ] Task 5.2: choose 4 preset sites; check coverage ≥ 0.5 with runSite
- [ ] Tasks 5.1, 5.3: map, legend, footer, MODELED/MEASURED label
- [ ] Tasks 6.2, 6.3: site editor, flow card + Brayton line, plume rings, AssumptionsBanner
- [ ] Tasks 7.1, 7.2: species overlay, compare table
- [ ] Task 8.1: template summary + copy/download
- [ ] Until A's model is ready, use a fake SiteResult so UI work isn't blocked
- [ ] Use Playwright MCP to check phone-width layout + capture screenshots

## Phase 2 — Integrate + polish (3:15–3:45)
- [ ] B wires runSite into UI; A fixes any model issues
- [ ] Run full demo path twice: preset site → sliders → species → compare → summary
- [ ] Phone check on the live link
- [ ] README TODOs: live link, problem, team names

## Phase 3 — Video (3:45–4:20) — B records, A reviews
Under 3:00, no copyrighted music, show the deployed app running.
- 0:00–0:25 Problem: drought → seawater cooling → heat into warming water; EO 658 guidance due Dec 31; Brayton Point
- 0:25–1:45 Demo: preset site, 100 MW → flow vs Brayton, plume, species area, compare 4 sites, one says "Low impact"
- 1:45–2:30 Kiro: spec → property test catching a bug → hook firing → steering rule in action
- 2:30–2:55 Who uses it (town boards, MassDEP, fishers), honest limits, next steps

## Phase 4 — Submit (4:20–4:40) — A
- [ ] KIRO_PLAYBOOK → final "How Kiro was used" write-up (all 7 prompts from the rules)
- [ ] Text description of features
- [ ] Repo public, .kiro/ at root, not gitignored, latest pushed
- [ ] Live demo link + video link + track (Climate Tech) + both team members
- [ ] Submit. Screenshot confirmation.

---

## Hooks (create in Kiro Hooks panel; keep credit cost low)
1. Model tests on save — files `src/model/**` → run `npm test -- tests/model`. Prefer a shell-command action if your Kiro version offers one (no agent credits); otherwise an agent hook scoped tightly to src/model.
2. Snapshot check on save — files `public/data/**` → run validators; report dropped rows + reasons; flag species with empty source.
3. Playbook logger — MANUAL trigger → "append a log row to docs/KIRO_PLAYBOOK.md section 6 from what we just did". Run it after each milestone.

## Credit budget (2000 each)
- A: ~60% on spec tasks 2–3 + property-test fixes, ~15% deploy, ~15% write-up, 10% reserve
- B: ~25% data pipeline, ~50% UI, ~10% report, 15% reserve
- Save credits: run spec tasks one at a time and review; don't regenerate whole specs; keep agent hooks narrow;
  use a cheaper/auto model for routine UI tweaks and the strongest model for physics bugs.
- Check remaining credits at 1:00 and at freeze.

## Write-up evidence to capture (screenshots → docs/screens/)
- [ ] Steering panel; agent answering "which steering applies to src/model/thermal.ts?"
- [ ] requirements.md with Requirement 10 properties; tasks.md linking to them
- [ ] A property-test failure + Kiro's analysis + the fix
- [ ] A hook firing automatically
- [ ] MCP in use: fetch reading ERDDAP; aws-docs answering a deploy/Bedrock question; Playwright screenshot
- [ ] Kiro CLI running a data task (IDE vs CLI comparison)
- [ ] Spec v1 → v2 change: score formula bug caught at spec review (more heat could lower the score)
