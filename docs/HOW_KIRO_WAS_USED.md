# How Kiro was used — HeatSink

HeatSink is a screening tool that asks: if a seawater-cooled AI data center sat on the
Massachusetts coast, where would its waste heat do the least ecological harm? This document
is our submission write-up on how we used Kiro to build it. It answers each prompt in the
Hackachusetts rules and points to evidence in the repo (`.kiro/`, `docs/KIRO_PLAYBOOK.md`,
the git history, and the spec revision trail).

Everything below is traceable in the repository; we have tried to be specific and honest and
to avoid claims we cannot show.

## Which Kiro tools did you use (IDE, CLI, Web, Crew) and how did they differ?

We used **Kiro IDE** and **Kiro CLI**, split along a clean ownership line between two people:

- **Kiro IDE** drove the engine, the UI, and all spec/steering/hook work. The IDE's spec and
  task views let us run one task at a time with the surrounding requirements and design loaded
  as context, and its agent hooks and steering panels kept the project's rules in front of the
  model on every change.
- **Kiro CLI** drove the data pipeline (the ERDDAP fetch scripts, validators, and snapshot
  generation). The CLI was the better fit there because that work is batch-shaped — run a
  script, inspect JSON, iterate — and it kept the data person unblocked without competing for
  the IDE session.

The practical difference: the IDE was strongest where tight spec/test/steering context mattered
(the physics model, where one wrong constant breaks a property); the CLI was strongest for
repeatable, file-producing data tasks. We deliberately divided folders (engine + `.kiro/` +
deploy for Person A; `scripts/`, `src/data/`, `public/data/`, `src/components/` for Person B)
so two Kiro sessions could run in parallel on branches without stepping on each other.

## Spec-driven development: how did you structure the spec, and how did it compare to vibe coding?

We used Kiro's three-document spec in `.kiro/specs/heatsink/`: **requirements.md** (EARS-style
acceptance criteria), **design.md** (architecture, types, module table), and **tasks.md** (a
numbered implementation plan mapping each task to the requirements it satisfies). A single
steering file, `thermal-model.md`, holds every equation, constant, and correctness property and
is cited as the one source of truth so numbers are never duplicated across documents.

The biggest payoff was that the spec *caught design bugs before code existed*, and the spec
itself went through real, documented revisions (see the change log in `thermal-model.md`):

- **v1 → v2:** the original site score could *decrease* when heat *increased* — a
  monotonicity bug — and could divide by zero. v2 rebased the score on "newly exceeded area,"
  which fixed both. We only noticed because we had written the score as a property
  ("more heat never lowers the score," now property 9) and reasoned about it in the spec.
- **v2 → v2.1:** a property-based counterexample showed sample points landing on land and a
  tiny-but-nonzero excess tripping a threshold. v2.1 discards land points and zeroes excess
  below a negligible floor *before* any threshold test (properties 15–16).
- **v2.1 → v2.2:** we added a "largest safe size" search (`maxSafeMW`) and the shareable-link
  and print-brief requirements, with new properties 17–18.

Compared with vibe coding, the spec-driven approach traded a slower start for far less rework:
each task arrived with its acceptance criteria and the physics rules already pinned, so the
model implemented against a fixed target instead of guessing. When we did move fast and loose
(early UI scaffolding), it was fine for throwaway layout but would have been dangerous for the
model, where correctness is the whole point.

## Agent hooks: what did you automate, and how did it help?

We committed three hooks in `.kiro/hooks/`:

1. **`model-tests-on-save`** — runs the model property tests whenever anything under
   `src/model/**` is saved, and reports only failing tests with the counterexample. This made
   the physics tests a live guardrail: a bad edit to a constant or a decay equation surfaced
   immediately with a shrunk counterexample instead of hours later.
2. **`snapshot-check-on-save`** — when any file under `public/data/` changes, it checks every
   JSON snapshot has a complete meta block (source, url, fetchedAt, window, rowCount,
   droppedCount) and that every species has a non-empty source. This enforced our honesty rules
   (every number names its source; missing values are null, never 0) mechanically.
3. **`playbook-logger`** — appends a one-line row to the playbook log for each step, which is
   how `docs/KIRO_PLAYBOOK.md` accumulated a timestamped, feature-tagged record of the build
   (20+ rows) that this write-up draws on.

The hooks mattered most for discipline: tests and data-integrity checks ran without us
remembering to, and the log gave us a reliable paper trail.

## Steering docs: how did you leverage steering, and what strategy helped most?

We used two kinds of steering:

- **Always-on** (`product.md`, `tech.md`, `structure.md`): product honesty rules ("screening
  tool, not a permit decision"; label every layer MEASURED or MODELED; show gaps, never
  interpolate), the stack and unit conventions (SI internally, unit-suffixed names, constants
  in one file), and the repository layout. These shaped every response.
- **File-matched** (`thermal-model.md` on `src/model/**` and `tests/**`; `ocean-data.md` on
  data work): physics equations and properties load only when touching model or test code;
  data-source rules load only for data work.

The strategy that made the biggest difference was **file-matched steering for the physics
model**. By loading the equations and the full property list exactly when model code was in
play — and nowhere else — Kiro implemented `thermal.ts`, `grid.ts`, `plume.ts`, `risk.ts`,
`runSite.ts`, and `maxSafe.ts` straight against the single source of truth, so constants and
rules stayed consistent across six modules and 18 properties without drift.

## MCP: how did extending Kiro help, and what would have been hard without it?

We configured three MCP servers in `.kiro/settings/mcp.json`:

- **fetch** — reading real ERDDAP endpoints and public pages to confirm the FIShBOT and eMOLT
  data URLs, inspect actual column names/units, and locate a citable Massachusetts land polygon
  source. Without it, confirming live data schemas would have been copy-paste guesswork.
- **aws-docs** — pulling current GitHub Pages / deployment steps and build settings while we set
  up hosting, and (for the stretch Bedrock summaries) the current Bedrock Runtime API shape.
- **playwright** — driving the running dev server to walk the demo path and capture phone- and
  desktop-width screenshots for layout checks.

MCP turned "go read three websites and come back" into in-session actions, which is what let a
two-person team confirm real datasets, deploy, and check the UI without leaving the workflow.

## Property-based testing: did it catch issues unit tests would miss, and for what requirements?

Yes — PBT is central to this project and caught real problems. We enabled property-based testing
(fast-check) for the entire physics and scoring model: **18 properties**, each tied to an EARS
criterion in Requirement 10. Examples: energy conservation (heat in equals heat out within 1e-9),
monotonic plume decay, "never colder than baseline," score bounds and monotonicity in heat, the
land rule, and the new max-safe-size correctness/independence properties (17–18).

What PBT caught that example-based unit tests would not have:

- The **v1 score monotonicity bug** — property 9 ("more heat never lowers the score") is exactly
  the kind of universal claim a handful of hand-picked examples would have passed over.
- A **counterexample to the area property (13)** from a negligible-but-nonzero excess tripping a
  threshold, which drove the v2.1 negligible-first rule.
- A **land-rule violation** where sample points fell on land, driving the land-mask discard.

We also used PBT as a deliberate design check for the max-safe search: property 18 asserts the
result never depends on the incoming `facilityMW`, which forced the implementation to always
search the full range rather than anchor on the current slider value. During that work a property
failure turned out to be a wrong *test* assumption (a land-buried baseline cell placed too close
to retained water points); we fixed the test setup rather than weakening the property — the code's
rule was correct.

The whole suite (153 tests, including validator and component tests) runs in a few seconds and is
wired to the on-save hook, so the properties are checked continuously, not just in CI.

## Kiro powers / third-party tooling

We did not install Kiro "powers" bundles for this project. Our third-party leverage came through
MCP (fetch, aws-docs, playwright) and standard open-source libraries (React, Vite, Leaflet,
react-leaflet, Vitest, fast-check), each used under its own license and credited in the README.

## Summary

Kiro's spec-driven workflow, file-matched steering on a single physics source of truth, and
property-based testing worked together to keep a correctness-heavy model honest while two people
built engine, data, and UI in parallel across IDE and CLI. The spec's documented v1 → v2 → v2.1 →
v2.2 evolution — each revision driven by a property or a counterexample — is the clearest evidence
that the approach improved the work rather than just describing it.
