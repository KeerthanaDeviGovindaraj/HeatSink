/**
 * Loads the committed ocean snapshots once and shares them across the app so
 * the MapView (baseline points) and Footer (source meta / fetchedAt) use the
 * same data (R1.1, R1.6). On a baseline-load failure the state goes to 'error'
 * so App can render the ErrorCard instead of a blank map (R1.7).
 *
 * The FIShBOT baseline is required — if it fails, the whole view errors. eMOLT
 * and NDBC are context-only: their meta feeds the Footer, and a failure for
 * either leaves its meta undefined (Footer shows "unavailable") without blocking
 * the map.
 *
 * The land mask (R3.2) is loaded alongside the snapshots so the browser has the
 * polygons for the click-to-place land test. It is optional-ish: a failure
 * yields `land: null` (the UI can still place points, but notes the land check
 * is unavailable) rather than blanking the baseline map.
 */
import { useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { loadEmolt, loadFishbot, loadLandMask, loadNdbc } from './loaders';
import type { OceanRow, SnapshotMeta } from './types';

/** Snapshot meta blocks the Footer renders, keyed by source. */
export interface SourceMetas {
  fishbot?: SnapshotMeta;
  emolt?: SnapshotMeta;
  ndbc?: SnapshotMeta;
}

export type SnapshotsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      baseline: OceanRow[];
      metas: SourceMetas;
      /** MA land polygons for the click-to-place land test; null if unavailable. */
      land: FeatureCollection | null;
    };

export function useSnapshots(): SnapshotsState {
  const [state, setState] = useState<SnapshotsState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    // Baseline (FIShBOT) is required; eMOLT/NDBC and the land mask are optional.
    // Use allSettled so one optional miss doesn't blank the map.
    Promise.allSettled([loadFishbot(), loadEmolt(), loadNdbc(), loadLandMask()])
      .then(([fishbot, emolt, ndbc, land]) => {
        if (!active) return;

        if (fishbot.status === 'rejected') {
          const err = fishbot.reason;
          const message = err instanceof Error ? err.message : 'Unknown error';
          setState({ status: 'error', message });
          return;
        }

        const metas: SourceMetas = { fishbot: fishbot.value.meta };
        if (emolt.status === 'fulfilled') metas.emolt = emolt.value.meta;
        if (ndbc.status === 'fulfilled') metas.ndbc = ndbc.value.meta;

        setState({
          status: 'ready',
          baseline: fishbot.value.rows,
          metas,
          land: land.status === 'fulfilled' ? land.value : null,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setState({ status: 'error', message });
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
