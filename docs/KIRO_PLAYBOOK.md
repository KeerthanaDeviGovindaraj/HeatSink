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
