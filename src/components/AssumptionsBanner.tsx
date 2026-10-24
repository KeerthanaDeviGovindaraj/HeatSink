/**
 * Always-visible honesty banner (thermal-model.md "UI assumptions banner").
 * HeatSink is a SCREENING tool, not a hydrodynamic model or a permit decision.
 */
export function AssumptionsBanner() {
  return (
    <div
      role="note"
      style={{
        background: '#fff6e5',
        borderBottom: '1px solid #e0c48a',
        color: '#5a4300',
        padding: '0.5rem 1rem',
        fontSize: '0.85rem',
      }}
    >
      <strong>Screening heuristic, not a hydrodynamic model.</strong> Radially symmetric, no
      tides or currents, steady state, warm discharge assumed to reach the bottom only in water
      ≤ 20 m deep, placeholder calibration constants. Not a permit decision.
    </div>
  );
}
