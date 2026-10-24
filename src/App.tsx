import { AssumptionsBanner } from './components/AssumptionsBanner';
import { ErrorCard } from './components/ErrorCard';
import { Footer } from './components/Footer';
import { MapView } from './components/MapView';
import { useSnapshots } from './data/useSnapshots';
import type { SourceMetas } from './data/useSnapshots';

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
          <MapView rows={snapshots.baseline} window={snapshots.metas.fishbot?.window ?? ''} />
        )}
      </main>

      <Footer metas={metas} />
    </>
  );
}
