/**
 * NOAA NDBC buoy 44013 surface water temperature context near Boston.
 * Missing values ("MM") become null, never 0.
 * Writes a snapshot with a meta block to public/data. Implemented in a later task.
 */
export async function fetchNdbc(): Promise<void> {
  console.log('  [ndbc] not implemented yet — committed snapshot is used.');
}
