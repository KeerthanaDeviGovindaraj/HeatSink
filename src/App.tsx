import { useCallback, useState } from 'react';
import { AssumptionsBanner } from './components/AssumptionsBanner';
import { ErrorCard } from './components/ErrorCard';
import { Footer } from './components/Footer';
import { MapView } from './components/MapView';
import { evaluateOutfallPlacement } from './components/placement';
import { useSnapshots } from './data/useSnapshots';
import type { SourceMetas } from './data/useSnapshots';
import type { FeatureCollection } from 'geojson';
import type { LatLon } from './model/grid';

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

  // Click-to-place state (R3.2): the current outfall and a transient land notice.
  const [outfall, setOutfall] = useState<LatLon | null>(null);
  const [landMessage, setLandMessage] = useState<string | null>(null);

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
            <MapView
              rows={snapshots.baseline}
              window={snapshots.metas.fishbot?.window ?? ''}
              outfall={outfall}
              onMapClick={handleMapClick}
            />
          </>
        )}
      </main>

      <Footer metas={metas} />
    </>
  );
}
