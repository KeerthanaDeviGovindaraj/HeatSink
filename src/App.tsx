// App shell — owned by Person B per TEAM_PLAN.md.
// Placeholder until UI tasks (5–8) land. Person B builds the real app here.
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 720 }}>
      <h1>HeatSink</h1>
      <p>
        Where should AI's heat go? A screening tool for Massachusetts towns evaluating
        seawater-cooled data centers.
      </p>
      <p style={{ color: '#a15c00' }}>
        Screening tool only — not a hydrodynamic model or a permit decision.
      </p>
      <p>Scaffold is up. UI components land with tasks 5–8.</p>
    </main>
  );
}
