import { useCallback, useMemo, useState } from 'react';
import { AssumptionsBanner } from './components/AssumptionsBanner';
import { ErrorCard } from './components/ErrorCard';
import { Footer } from './components/Footer';
import { MapView } from './components/MapView';
import { PlumePanel } from './components/PlumePanel';
import { InsightsStrip } from './components/InsightsStrip';
import { ReportPanel } from './components/ReportPanel';
import {
  DEFAULT_SITE_PARAMS,
  SiteEditor,
  type SiteParams,
} from './components/SiteEditor';
import { SpeciesPicker } from './components/SpeciesPicker';
import { CompareTable } from './components/CompareTable';
import { CumulativePanel } from './components/CumulativePanel';
import type { SavedSite } from './components/compare';
import {
  displayableSpecies,
  toModelSpecies,
} from './components/species';
import { evaluateOutfallPlacement } from './components/placement';
import { PRESET_SITES, type PresetSite } from './model/presets';
import { plumeRings, type PlumeRing } from './model/plume';
import {
  cumulativeResult,
  type CumulativeResult,
  type CumulativeSite,
} from './model/cumulative';
import { samplePoints } from './model/grid';
import { runSite } from './model/runSite';
import { maxSafeMW, type MaxSafeResult } from './model/maxSafe';
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
import type { SpeciesEntry, Station } from './data/types';
import type { FeatureCollection } from 'geojson';
import type { LatLon } from './model/grid';

/**
 * Labeled excess levels (°C) for the plume rings (R4.4). Only levels the plume
 * actually reaches are drawn (plumeRings filters radius 0); NEGLIGIBLE_C is the
 * outermost ring and coincides with the thermal reach.
 */
const RING_LEVELS_C = [2, 1, 0.5, NEGLIGIBLE_C] as const;

/** Maximum number of sites the comparison table holds (R6.4). */
const MAX_COMPARE_SITES = 4;

/**
 * Preset selected on first load (R3.1) so the app opens on a real result
 * instead of an empty map. Falls back gracefully if the preset list changes.
 */
const DEFAULT_PRESET =
  PRESET_SITES.find((p) => p.name === 'Cape Cod Bay – central') ?? PRESET_SITES[0];

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
  const [outfall, setOutfall] = useState<LatLon | null>(
    DEFAULT_PRESET
      ? { lat: DEFAULT_PRESET.inputs.lat, lon: DEFAULT_PRESET.inputs.lon }
      : null,
  );
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
  const [siteParams, setSiteParams] = useState<SiteParams>(
    DEFAULT_PRESET
      ? {
          facilityMW: DEFAULT_PRESET.inputs.facilityMW,
          deltaTC: DEFAULT_PRESET.inputs.deltaTC,
          mixRatio: DEFAULT_PRESET.inputs.mixRatio,
          heatFraction: DEFAULT_PRESET.inputs.heatFraction,
        }
      : DEFAULT_SITE_PARAMS,
  );

  // Saved sites for the comparison table (R6.4): snapshots of computed results,
  // capped at MAX_COMPARE_SITES. `nextCustomSite` labels unnamed sites.
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [nextCustomSite, setNextCustomSite] = useState(1);

  // Cumulative mode (R8, stretch): when on, sum every saved site's screening
  // plume at each point on one shared grid and recompute areas/species. Off by
  // default so single-site behavior is unchanged.
  const [cumulativeMode, setCumulativeMode] = useState(false);

  // River-mouth flag (R9, stretch): when on, show the diadromous fish stations
  // on the map and flag, per saved site, any station within the site's plume
  // reach in the comparison table. Off by default so base behavior is
  // unchanged.
  const [riverMouthFlag, setRiverMouthFlag] = useState(false);

  // Diadromous fish stations from the committed snapshot (R9). Empty when the
  // file is absent/invalid (loadDiadromous degrades to []).
  const stations: Station[] =
    snapshots.status === 'ready' ? snapshots.stations : [];

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

  // Largest safe size for the insights strip (R11): the biggest facility (MW)
  // at this site/settings where every SELECTED species stays Low. If one
  // species is picked, require just that one; otherwise require all displayed
  // species. Null until an outfall is placed; guarded against model throws.
  const maxSafe = useMemo<MaxSafeResult | null>(() => {
    if (!outfall) return null;
    const ids = selectedSpeciesId
      ? [selectedSpeciesId]
      : modelSpecies.map((sp) => sp.id);
    try {
      return maxSafeMW({ ...outfall, ...siteParams }, cells, modelSpecies, land, ids);
    } catch {
      return null;
    }
  }, [outfall, siteParams, cells, modelSpecies, land, selectedSpeciesId]);

  // Cumulative-mode result (R8, stretch). DESIGN DECISION — shared grid:
  // sumImpacts needs an index-aligned grid, but saved sites have different
  // outfalls (different native grids). The correct superposition is over ONE
  // shared grid: we build samplePoints() centered on the FOCUSED outfall (or,
  // if none is placed, the first saved site's outfall), then cumulativeImpacts
  // evaluates each saved site's excess AT every shared point (distance from
  // that site's own outfall) and sums — never misusing sumImpacts on misaligned
  // native grids. Area/coverage/species reuse the single-site risk functions so
  // the numbers stay consistent. Only recomputed while the toggle is on, since
  // the shared grid is the heavy part (design.md "Performance").
  const cumulative = useMemo<CumulativeResult | null>(() => {
    if (!cumulativeMode || savedSites.length === 0) return null;

    const gridCenter = outfall ?? {
      lat: savedSites[0].result.inputs.lat,
      lon: savedSites[0].result.inputs.lon,
    };
    const sharedGrid = samplePoints(gridCenter, cells, land);

    const sites: CumulativeSite[] = savedSites.map((s) => ({
      outfall: { lat: s.result.inputs.lat, lon: s.result.inputs.lon },
      thermal: s.result.thermal,
    }));

    return cumulativeResult(sites, sharedGrid, modelSpecies);
  }, [cumulativeMode, savedSites, outfall, cells, land, modelSpecies]);

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

  // Snapshot the current result into the comparison table (R6.4). Disabled in
  // the UI when there is no valid result or the table is already full, so this
  // guards defensively and is otherwise a pure append. The label prefers the
  // matching preset name, falling back to a numbered "Custom site N".
  const handleSaveSite = useCallback(() => {
    if (!result) return;
    setSavedSites((prev) => {
      if (prev.length >= MAX_COMPARE_SITES) return prev;
      const { lat, lon } = result.inputs;
      const preset = PRESET_SITES.find(
        (p) => p.inputs.lat === lat && p.inputs.lon === lon,
      );
      const label = preset ? preset.name : `Custom site ${nextCustomSite}`;
      if (!preset) setNextCustomSite((n) => n + 1);
      const id = `site-${lat}-${lon}-${Date.now()}`;
      return [...prev, { id, label, result }];
    });
  }, [result, nextCustomSite]);

  const handleRemoveSite = useCallback((id: string) => {
    setSavedSites((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const compareFull = savedSites.length >= MAX_COMPARE_SITES;

  // Label for the summary (R7.1/R7.3): the matching preset name when the
  // current outfall sits on a preset, otherwise "Custom site" (custom sites use
  // the deterministic template).
  const siteLabel = useMemo(() => {
    if (!result) return 'Custom site';
    const { lat, lon } = result.inputs;
    const preset = PRESET_SITES.find(
      (p) => p.inputs.lat === lat && p.inputs.lon === lon,
    );
    return preset ? preset.name : 'Custom site';
  }, [result]);

  return (
    <>
      <header style={{ padding: '0.75rem 1rem', background: '#0b3d5c', color: '#fff' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>HeatSink</h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.95rem', fontWeight: 700 }}>
          Smart siting for seawater-cooled AI data centers.
        </p>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
          Find where a data center's heat does the least harm to the ocean, before
          it's built.
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
            {result && (
              <InsightsStrip result={result} siteLabel={siteLabel} maxSafe={maxSafe} />
            )}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'flex-start',
              }}
            >
              <div className="map-sticky" style={{ flex: '2 1 20rem', minWidth: '18rem' }}>
                <MapView
                  rows={snapshots.baseline}
                  window={snapshots.metas.fishbot?.window ?? ''}
                  outfall={outfall}
                  onMapClick={handleMapClick}
                  rings={rings}
                  exceedance={exceedance}
                  stations={riverMouthFlag ? stations : null}
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
                {result && (
                  <div>
                    <button
                      type="button"
                      onClick={handleSaveSite}
                      disabled={compareFull}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.8rem',
                        background: compareFull ? '#cfd8dc' : '#0b3d5c',
                        color: compareFull ? '#607d8b' : '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: compareFull ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                      }}
                    >
                      Save site to compare
                    </button>
                    <p
                      style={{
                        margin: '0.3rem 0 0',
                        fontSize: '0.72rem',
                        color: compareFull ? '#c62828' : '#78909c',
                        lineHeight: 1.4,
                      }}
                    >
                      {compareFull
                        ? `Comparison is full (${MAX_COMPARE_SITES} sites) — remove one to add another.`
                        : `${savedSites.length} of ${MAX_COMPARE_SITES} sites saved.`}
                    </p>
                  </div>
                )}
                <SpeciesPicker
                  species={shownSpecies}
                  selectedId={selectedSpeciesId}
                  onSelect={setSelectedSpeciesId}
                  risksById={
                    new Map((result?.risks ?? []).map((r) => [r.speciesId, r]))
                  }
                />
                {result && (
                  <ReportPanel
                    result={result}
                    species={shownSpecies}
                    metas={metas}
                    siteLabel={siteLabel}
                  />
                )}
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <CompareTable
                sites={savedSites}
                species={shownSpecies}
                onRemove={handleRemoveSite}
                stations={stations}
                showRiverMouthFlag={riverMouthFlag}
              />
            </div>

            {/* Cumulative mode (R8, stretch): toggle + superposed results. */}
            <div style={{ marginTop: '1rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.6rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: savedSites.length === 0 ? '#90a4ae' : '#0b3d5c',
                  cursor: savedSites.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={cumulativeMode}
                  disabled={savedSites.length === 0}
                  onChange={(e) => setCumulativeMode(e.target.checked)}
                />
                Cumulative mode (sum all saved sites)
              </label>
              {cumulativeMode && (
                <CumulativePanel
                  result={cumulative}
                  species={shownSpecies}
                  savedCount={savedSites.length}
                />
              )}
            </div>

            {/* River-mouth flag (R9, stretch): toggle the diadromous station
                overlay + per-site reach flag in the comparison table. */}
            <div style={{ marginTop: '1rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.4rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: stations.length === 0 ? '#90a4ae' : '#0b3d5c',
                  cursor: stations.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={riverMouthFlag}
                  disabled={stations.length === 0}
                  onChange={(e) => setRiverMouthFlag(e.target.checked)}
                />
                River-mouth flag (diadromous fish stations)
              </label>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.72rem',
                  color: '#78909c',
                  lineHeight: 1.5,
                }}
              >
                {stations.length === 0
                  ? 'No diadromous station data loaded.'
                  : riverMouthFlag
                    ? `Showing ${stations.length} MassGIS/DMF diadromous fish sampling stations (MEASURED). The comparison table flags any station within each saved site's plume reach.`
                    : `Enable to overlay ${stations.length} MassGIS/DMF diadromous fish stations and flag those within each saved site's plume reach.`}
              </p>
            </div>
          </>
        )}
      </main>

      <Footer metas={metas} />
    </>
  );
}
