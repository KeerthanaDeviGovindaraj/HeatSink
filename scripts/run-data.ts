// Entry point for `npm run data`. Person B fills in the fetch-* steps (tasks 4.3–4.4).
// Committed snapshots in public/data work offline, so this is optional to run.
async function main() {
  console.log('[data] No fetch steps wired yet. Committed snapshots in public/data are used.');
  console.log('[data] See tasks 4.3–4.4: fetch-fishbot.ts, fetch-emolt.ts, fetch-ndbc.ts.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
