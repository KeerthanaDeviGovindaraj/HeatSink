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
 *
 * species.json (R5.1) is loaded the same way for the threshold overlay; a
 * failure yields an empty `species` array rather than blanking the map.
 */
import { useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import {
  baselineCellsFromSnapshot,
  loadEmolt,
  loadFishbot,
  loadLandMask,
  loadNdbc,
  loadSpecies,
} from './loaders';
import type { OceanRow, SnapshotMeta, SpeciesEntry } from './types';
import type { BaselineCell } from '../model/types';

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
      /** Baseline adapted to model cells for runSite (R4.1, R4.4). */
      cells: BaselineCell[];
      metas: SourceMetas;
      /** MA land polygons for the click-to-place land test; null if unavailable. */
      land: FeatureCollection | null;
      /**
       * Species entries from species.json for the threshold overlay (R5.1).
       * Empty array if species.json fails to load — a species-load miss must
       * not blank the map. Unfiltered here; the picker applies the display
       * rule (isDisplayableSpecies) so it can distinguish "none configured"
       * from "none displayable".
       */
      species: SpeciesEntry[];
    };

export function useSnapshots(): SnapshotsState {
  const [state, setState] = useState<SnapshotsState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    // Baseline (FIShBOT) is required; eMOLT/NDBC, the land mask and species are
    // optional. Use allSettled so one optional miss doesn't blank the map.
    Promise.allSettled([
      loadFishbot(),
      loadEmolt(),
      loadNdbc(),
      loadLandMask(),
      loadSpecies(),
    ])
      .then(([fishbot, emolt, ndbc, land, species]) => {
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
          cells: baselineCellsFromSnapshot(fishbot.value),
          metas,
          land: land.status === 'fulfilled' ? land.value : null,
          species: species.status === 'fulfilled' ? species.value.species : [],
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
