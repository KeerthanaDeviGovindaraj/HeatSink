import { useCallback, useMemo, useState } from 'react';
import { AssumptionsBanner } from './components/AssumptionsBanner';
import { ErrorCard } from './components/ErrorCard';
import { Footer } from './components/Footer';
import { MapView } from './components/MapView';
import { PlumePanel } from './components/PlumePanel';
import {
  DEFAULT_SITE_PARAMS,
  SiteEditor,
  type SiteParams,
} from './components/SiteEditor';
import { SpeciesPicker } from './components/SpeciesPicker';
import {
  displayableSpecies,
  toModelSpecies,
} from './components/species';
import { evaluateOutfallPlacement } from './components/placement';
import type { PresetSite } from './model/presets';
import { plumeRings, type PlumeRing } from './model/plume';
import { runSite } from './model/runSite';
import { NEGLIGIBLE_C } from './model/constants';
import {
  InputRangeError,
  OutfallOnLandError,
  type BaselineCell,
  type SiteResult,
  type Species,
} from './model/types';
import { useSnapshots } from './data/useSnapshots';
import type { SourceMetas } from './data/useSnapshots';
import type { SpeciesEntry } from './data/types';
import type { FeatureCollection } from 'geojson';
import type { LatLon } from './model/grid';

/**
 * Labeled excess levels (°C) for the plume rings (R4.4). Only levels the plume
 * actually reaches are drawn (plumeRings filters radius 0); NEGLIGIBLE_C is the
 * outermost ring and coincides with the thermal reach.
 */
const RING_LEVELS_C = [2, 1, 0.5, NEGLIGIBLE_C] as const;

/**
 * App shell. Loads the committed snapshots once (useSnapshots) and shares them:
 * the MapView draws the FIShBOT baseline and the Footer shows each source and its
 * `fetchedAt` (R1.1, R1.6). A baseline-load failure renders the ErrorCard instead
 * of a blank map (R1.7). The AssumptionsBanner stays visible in every state.
 */
export function App() {
  const snapshots = useSnapshots();

  // Footer always shows whatever meta we have (empty until loaded / on error).
  const metas: SourceMetas = snapshots.status === 'ready' ? snapshots.metas : {};
  const land: FeatureCollection | null =
    snapshots.status === 'ready' ? snapshots.land : null;
  const cells: BaselineCell[] = snapshots.status === 'ready' ? snapshots.cells : [];

  // Species for the threshold overlay (R5.1). Filter to the DISPLAY rule
  // (R5.2/R5.3: non-empty source + finite threshold) so sourceless entries are
  // hidden but unverified ones still show (with a badge in the picker). This is
  // the display gate, deliberately NOT isUsableSpecies (which also requires
  // verified === true and would hide every current entry).
  const rawSpecies: SpeciesEntry[] =
    snapshots.status === 'ready' ? snapshots.species : [];
  const shownSpecies = useMemo(
    () => displayableSpecies(rawSpecies),
    [rawSpecies],
  );

  // Click-to-place state (R3.2): the current outfall and a transient land notice.
  const [outfall, setOutfall] = useState<LatLon | null>(null);
  const [landMessage, setLandMessage] = useState<string | null>(null);

  // Selected species id driving the map exceedance overlay (R5.4); null = none.
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);

  // Model-shaped species passed into runSite so per-species risks are computed.
  // Adapting only the displayable entries guarantees finite thresholds.
  const modelSpecies = useMemo<Species[]>(
    () => shownSpecies.map(toModelSpecies),
    [shownSpecies],
  );

  // The selected species entry (for the overlay threshold + legend), or null.
  const selectedSpecies = useMemo(
    () => shownSpecies.find((s) => s.id === selectedSpeciesId) ?? null,
    [shownSpecies, selectedSpeciesId],
  );

  // Facility parameters (R3.3 defaults), driven by the SiteEditor sliders. App
  // owns them so the full SiteInputs = outfall + params can be composed for
  // runSite.
  const [siteParams, setSiteParams] = useState<SiteParams>(DEFAULT_SITE_PARAMS);

  // Run the model whenever the outfall, params, baseline cells, or land change
  // (R4.4). Memoized so dragging a slider doesn't recompute until a dependency
  // actually changes. Returns { result, rings } with a friendly error message
  // when the model throws (shouldn't happen: outfall is water-validated in 6.1
  // and params are bounded by the sliders, but guard defensively — R3.2).
  const { result, rings, resultError } = useMemo((): {
    result: SiteResult | null;
    rings: PlumeRing[];
    resultError: string | null;
  } => {
    if (!outfall) return { result: null, rings: [], resultError: null };
    try {
      const run = runSite({ ...outfall, ...siteParams }, cells, modelSpecies, land);
      return {
        result: run,
        rings: plumeRings(run.thermal, RING_LEVELS_C),
        resultError: null,
      };
    } catch (err) {
      if (err instanceof OutfallOnLandError) {
        return {
          result: null,
          rings: [],
          resultError: 'That outfall is on land — place it in water.',
        };
      }
      if (err instanceof InputRangeError) {
        return {
          result: null,
          rings: [],
          resultError: 'Facility settings are out of range — adjust the sliders.',
        };
      }
      throw err;
    }
  }, [outfall, siteParams, cells, land, modelSpecies]);

  // Exceedance overlay payload for MapView (R5.4): the current result points and
  // the selected species threshold, or null when nothing is selected / no
  // result yet. thresholdC is finite because selectedSpecies comes from the
  // displayable set.
  const exceedance = useMemo(() => {
    if (!result || !selectedSpecies || selectedSpecies.thresholdC === null) {
      return null;
    }
    return {
      points: result.points,
      thresholdC: selectedSpecies.thresholdC,
      speciesName: selectedSpecies.name,
    };
  }, [result, selectedSpecies]);

  // Preset buttons set both location and facility params in one click (R3.1).
  const handleSelectPreset = useCallback((preset: PresetSite) => {
    const { lat, lon, facilityMW, deltaTC, mixRatio, heatFraction } = preset.inputs;
    setOutfall({ lat, lon });
    setLandMessage(null);
    setSiteParams({ facilityMW, deltaTC, mixRatio, heatFraction });
  }, []);

  // On a map click, let the pure helper decide: place in water (clearing any
  // prior land notice) or reject on land with a friendly message (R3.2).
  const handleMapClick = useCallback(
    (latlng: LatLon) => {
      const decision = evaluateOutfallPlacement(latlng, land);
      if (decision.placed) {
        setOutfall(decision.outfall);
        setLandMessage(null);
      } else {
        setLandMessage(decision.message);
      }
    },
    [land],
  );

  return (
    <>
      <header style={{ padding: '0.75rem 1rem', background: '#0b3d5c', color: '#fff' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>HeatSink</h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
          Where should AI's heat go? A screening tool for seawater-cooled data centers.
        </p>
      </header>

      <AssumptionsBanner />

      <main style={{ flex: 1, padding: '1rem' }}>
        {/* SiteEditor, SpeciesPicker, CompareTable, ReportPanel mount here (later tasks). */}
        {snapshots.status === 'loading' && (
          <div data-testid="map-view" style={{ padding: '1rem' }}>
            Loading baseline map…
          </div>
        )}
        {snapshots.status === 'error' && (
          <ErrorCard title="Could not load the baseline data" detail={snapshots.message} />
        )}
        {snapshots.status === 'ready' && (
          <>
            {landMessage && (
              <div
                role="alert"
                style={{
                  margin: '0 0 0.75rem',
                  padding: '0.6rem 0.8rem',
                  background: '#fdecea',
                  border: '1px solid #e0b4b0',
                  borderRadius: 6,
                  color: '#611a15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  fontSize: '0.9rem',
                }}
              >
                <span>{landMessage}</span>
                <button
                  type="button"
                  onClick={() => setLandMessage(null)}
                  aria-label="Dismiss"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    lineHeight: 1,
                    color: '#611a15',
                  }}
                >
                  ×
                </button>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: '2 1 20rem', minWidth: '18rem' }}>
                <MapView
                  rows={snapshots.baseline}
                  window={snapshots.metas.fishbot?.window ?? ''}
                  outfall={outfall}
                  onMapClick={handleMapClick}
                  rings={rings}
                  exceedance={exceedance}
                />
              </div>
              <div
                style={{
                  flex: '1 1 16rem',
                  minWidth: '15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <SiteEditor
                  params={siteParams}
                  onChange={setSiteParams}
                  outfall={outfall}
                  onSelectPreset={handleSelectPreset}
                />
                {resultError && (
                  <div
                    role="alert"
                    style={{
                      padding: '0.6rem 0.8rem',
                      background: '#fdecea',
                      border: '1px solid #e0b4b0',
                      borderRadius: 6,
                      color: '#611a15',
                      fontSize: '0.85rem',
                    }}
                  >
                    {resultError}
                  </div>
                )}
                {result && <PlumePanel result={result} />}
                <SpeciesPicker
                  species={shownSpecies}
                  selectedId={selectedSpeciesId}
                  onSelect={setSelectedSpeciesId}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <Footer metas={metas} />
    </>
  );
}
