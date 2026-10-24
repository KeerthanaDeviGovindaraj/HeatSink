import { AssumptionsBanner } from './components/AssumptionsBanner';
import { Footer } from './components/Footer';
import { MapView } from './components/MapView';

/**
 * App shell. Layout and panels are wired up in later tasks; this is the scaffold
 * that mounts the always-visible honesty UI (assumptions banner + footer).
 */
export function App() {
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
        <MapView />
      </main>

      <Footer />
    </>
  );
}
