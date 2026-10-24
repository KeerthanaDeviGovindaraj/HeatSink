# Kiro Playbook — how we use Kiro on HeatSink

Fill this in AS YOU GO. It becomes the "How Kiro was used" write-up required by the submission rules.

## 0. Setup (first 15 minutes after pitching)
1. Create the repo, copy this `.kiro/` folder and `docs/` into the root, commit, push (public).
2. Open the repo in Kiro IDE. Check the Steering panel shows: product, tech, structure (always), ocean-data and thermal-model (file-matched).
3. Open `.kiro/specs/heatsink/`. Run "Analyze Requirements" on `requirements.md` and fix anything it flags. Note what it caught below.
4. Run tasks wave by wave from `tasks.md`. Waves 2, 3 and 4 can run in parallel across teammates.

## 1. Agent hooks to create (Kiro panel → Hooks → +, describe in plain English)
| Hook | Trigger | What it does | Why it helps |
|---|---|---|---|
| Model tests on save | File saved in `src/model/**` | Run `npm test -- tests/model` and report failures | Physics regressions caught instantly |
| Validate snapshot | File saved in `public/data/**` | Run validators; report dropped rows and reasons | Bad data never reaches the demo |
| Units guard | File saved in `src/**/*.ts` | Check new numeric variables include a unit suffix (W, M3s, C, M) and SI units per `tech.md` | Prevents unit bugs (the #1 physics bug) |
| Playbook logger | Agent stops (or manual, if no spec-task trigger exists) | Append a one-line entry to section 6 of this file: task, Kiro feature used, outcome | Write-up writes itself |

## 2. MCP servers to try
- A fetch/HTTP MCP server to let Kiro query ERDDAP directly while writing `scripts/fetch-*.ts` (inspect real column names instead of guessing).
- GitHub MCP server for issues/PRs if multiple teammates work in parallel.
Record: what MCP let us do that would have been hard otherwise.

## 3. Property-based testing (Correctness)
Our model is physics, which has natural invariants — ideal for PBT. The 16 properties live in `.kiro/steering/thermal-model.md` and as EARS criteria in Requirement 10. v1 of the spec had a score formula that violated property 9 (more heat could lower the score); record how this was found and fixed. v2 → v2.1 added the land mask and the negligible-first rule after a counterexample to property 13; record that too. Record any bug PBT found that a unit test missed (e.g., negative excess from a sign error, energy not conserved when mixing ratio > 0).

## 4. Steering strategy
- `always` files hold product honesty rules and stack conventions so every generation respects them.
- `fileMatch` files load ocean-data rules only when touching data code, and the thermal equations only when touching model code — keeps context focused.
Record: which steering rule changed Kiro's output most (likely the "pure functions + SI units" rule, or the "screening tool disclaimer" rule).

## 5. Kiro surfaces used
Note every surface tried (IDE, CLI, Web, Crew) and how they differed. Ideas: IDE for specs and UI; CLI headless to run the data refresh; Web agent to open a PR for a stretch task in parallel.

## 6. Log (fill during the day)
| Time | Task | Kiro feature | What happened |
|---|---|---|---|
| | | | |
| 12:23 | Scaffold Vite+React+TS app, deps, scripts, folders | scaffold | npm test/build/dev all pass; repaired corrupted scaffold files, .kiro not gitignored |
| 12:27 | Commit Task 1 scaffold | spec task | Committed scaffold (13 files) excluding mcp.json which held a leaked GitHub token |
| 12:29 | Task 2.0 types.ts per design.md | spec task | Rewrote src/model/types.ts to exact design.md shapes (R10); tsc strict clean on the file |
| 12:36 | Task 2.1 constants + units (+cToF); unblock build | spec task | Verified constants, added cToF, stubbed stale files with TODOs; npm run build + test green |
| 12:40 | Commit + merge Tasks 2.0-2.1 to main | spec task | types.ts, constants, units on main (ba6b9fa); build+test green; mcp.json token excluded |
| 12:49 | Task 2.2 property test P10 (units round trip) | property test | Added fast-check P10 test in tests/model/units.test.ts; npm test -- tests/model passes (R10.1) |
| 12:53 | Task 2.3 thermal.ts computeThermal (bounds, mixing, L, reach) | spec task | Implemented pure computeThermal; added W_PER_MW; tsc + tests green; sanity 90 MW/5 C ~4.40 m3/s ~100 MGD, P11 reach <= R_REF_M (R3.3, R3.5, R4.5) |
| 12:56 | Task 2.4 property tests P1/P5/P6/P11, 90 MW unit test, InputRangeError tests | property test | Added fast-check suite in tests/model/thermal.test.ts; 19 tests pass; P6 denormal counterexample triaged (generator fixed, property kept) (R10.1, R10.3, R10.4) |
| 13:06 | Task 3 grid/plume/risk + runSite + property tests P2-P4,P7,P9,P12-P16 | spec task | Implemented pure grid.ts, plume.ts, risk.ts, runSite.ts and 10 fast-check properties; 31 model tests pass, tsc strict clean (R4.1-R4.3, R6.1-R6.2, R3.2, R10.1) |
| 13:08 | Commit + push Task 3 engine (grid/plume/risk/runSite + property tests) | spec task | Pushed c583488 to keerthana (14 files, 31 tests green); excluded mcp.json which holds a leaked GitHub PAT |
| 15:14 | Verify main has tasks 1-9 + check Pages deploy setup | other | Built origin/main in clean worktree (107 modules, green); deploy.yml + vite base /HeatSink/ correct; Pages enable + phone check remain manual (admin) |
| 15:16 | Reconcile tasks.md to match merged main (B did 4-10.2) | spec task | Marked sections 1-9 + 10.2 complete; left 10.1 (manual Pages/phone), 10.3 video, 10.4 write-up open |
| 15:18 | Install GitHub CLI to enable Pages | other | brew installed gh 2.103.2; Pages enable blocked on gh auth login (interactive admin step), command staged |
| 15:24 | Enable Pages + deploy live site (gh CLI) | other | gh auth confirmed admin; re-ran deploy.yml (build+deploy green); live at https://keerthanadevigovindaraj.github.io/HeatSink/ (200, correct base); phone check still manual |
| 15:29 | Fix live Pages data 404 (loaders BASE_URL) | spec task | PR #12: DATA_BASE now uses import.meta.env.BASE_URL so data serves at /HeatSink/data/*; merged, redeployed green, live map loads (200), 150 tests pass |
| 15:31 | Commit + push tracker/playbook progress | spec task | Pushed 920d05f to keerthana (tasks.md, tasks.meta.json, playbook); excluded mcp.json (leaked PAT) |
| 15:35 | Merge main into keerthana to catch up branch | other | Merged origin/main (29 commits) into keerthana, no conflicts; tsc + 150 tests green; pushed 69b1480 |
| 15:37 | Update spec to v2.2 (maxSafeMW, share link, print brief) | spec task | Added-only edits to thermal-model, requirements (R11-13, P17-18+22-23), design, tasks (sections 11-13); no existing content/checkmarks changed |
| 15:38 | Commit + push spec v2.2, open PR #13 to main | spec task | Pushed 81258c0 to keerthana; PR #13 (keerthana->main) open and MERGEABLE; excluded mcp.json (leaked PAT) |
| 15:44 | Tasks 11.1-11.2: maxSafeMW engine + P17/P18 property tests | property test | maxSafe.ts binary search reusing sample points; P17/P18 pass (null case + facilityMW independence); 153 tests green; pushed c50fd10 |
| 15:48 | PR #14 (maxSafe), submission-rules audit, 10.4 write-up | spec task | Opened PR #14; audited vs Hackachusetts rules (repo/.kiro/PBT/license OK, video 10.3 still TODO); wrote docs/HOW_KIRO_WAS_USED.md, pushed 699250a |
| 15:55 | README track + write-up link, mark 10.4, merge PR #13/#14, clean 38 dup files | other | README track->ClimaTech & Clean Energy + write-up link; 10.4 done; PRs #13/#14 merged; removed 38 untracked " 2." sync dupes; 153 tests green; pushed c2e799f |
| 15:58 | Diagnose + fix failed CI build (maxSafe literal types) | other | tsc -b failed on MIN_MW/MAX_MW literal types (fixed on main by 49bca6e); merged fix, clean npm ci cleared stray @types " 2" dirs; build + 153 tests green; pushed 1eeae86 |
| 16:01 | Harden build against folder-sync " 2" duplicates | other | tsconfig.app types:[] (no @types auto-scan) + .gitignore "* N.*" guard; verified build passes with stray @types/react 2 present; 153 tests green; pushed 04466c9 |
| 16:06 | Fix blank basemap (OSM tile URL {z}/{x}/{y}) | MCP | Playwright MCP found tiles 400ing (wrong x/y/z order, zoom 77); fixed template, all 12 tiles load (naturalWidth 256); build + 153 tests green; pushed 53f2633 |
| 16:09 | Merge PR #15 to main + redeploy; verify live map | MCP | Merged keerthana->main (map fix, build hardening, maxSafe, v2.2, polish); deploy green; Playwright confirms all 12 basemap tiles load live |
| 16:13 | Add judge-facing InsightsStrip UI | MCP | At-a-glance verdict + 4 stat cards (newly-exceeded, reach, flow vs Brayton, coverage) from computed SiteResult; Playwright-verified live; build + 153 tests green; pushed 800c071 |
| 16:18 | Map default framing to MA coast + merge PR #16, redeploy | MCP | Map opens on Cape Cod/Mass Bay (center 42,-70.4 zoom 9); PR #16 merged, deploy green; Playwright confirms insights strip + tiles live |
| 16:22 | Show selected preset/site in SiteEditor | MCP | Active preset highlights (checkmark + aria-pressed) and editor shows "Selected: <site>"; Playwright-verified; build + 153 tests green; pushed 9e40948 |
| 16:25 | Confirm PR #17 merge + deploy of selected-preset UI | MCP | Earlier merge/deploy was interrupted mid-run (still building); deploy now succeeded, Playwright confirms selected highlight + "Selected: <site>" live |
| 16:32 | Fit MA coast, default preset, ~7km square cells, Nantucket Sound preset | MCP | fitBounds(animate:false) fixed a synthesized-click bug; cells now true-size squares; added low-coverage warm-cell preset (cov 0.416, lobster Insufficient data, maxSafe 83MW); window 2024-08-01/08 across 6 daily dates; 155 tests green; pushed 26b1ad4 |
| 16:36 | Merge PR #18 to main + redeploy; verify live | MCP | Merged keerthana->main (fit bounds, default preset, square cells, Nantucket preset); deploy green; Playwright confirms default preset stable + 5 presets + square cells live |
| 16:38 | Two-line header tagline + page title | other | Header now bold "Smart siting for seawater-cooled AI data centers." + sub-line; <title> updated to match; Playwright-verified; 155 tests green; pushed 82ca6b6 |

## 7. Spec-driven vs vibe coding (write at the end)
- How the spec structured the work:
- Where it saved time:
- One thing we vibe-coded and how it compared:

## 8. Submission checklist
- [ ] Public GitHub repo with `.kiro/` at root (not gitignored)
- [ ] Live demo link in README
- [ ] Text description of features
- [ ] Video < 3 min, public on YouTube/Vimeo, no copyrighted music
- [ ] Track: Climate Tech
- [ ] This playbook turned into the "How Kiro was used" write-up
- [ ] All team members added (max 4)
