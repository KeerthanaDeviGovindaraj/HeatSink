/**
 * Entry point for `npm run data`. Refreshes committed JSON snapshots in /public/data.
 * Start from the hackathon kit zip files; live URLs are optional refreshes (ocean-data.md).
 * Individual fetchers are implemented in later tasks.
 */
import { fetchFishbot } from './fetch-fishbot';
import { fetchEmolt } from './fetch-emolt';
import { fetchNdbc } from './fetch-ndbc';

async function main(): Promise<void> {
  console.log('Refreshing ocean-data snapshots into public/data ...');
  await fetchFishbot();
  await fetchEmolt();
  await fetchNdbc();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
