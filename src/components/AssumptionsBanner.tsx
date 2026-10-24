/**
 * Always-visible honesty banner (thermal-model.md "UI assumptions banner").
 * HeatSink is a SCREENING tool, not a hydrodynamic model or a permit decision.
 *
 * The headline is plain-English; the full technical assumptions are kept behind
 * a "How it works" toggle (hidden by default) so the message stays approachable
 * without losing the detailed caveats.
 */
import { useState } from 'react';

export function AssumptionsBanner() {
  const [showTechnical, setShowTechnical] = useState(false);

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
      <strong>A first look, not a final answer.</strong> HeatSink screens sites
      quickly so towns know where to look closer. It isn&rsquo;t a full ocean model
      or a permit decision.{' '}
      <button
        type="button"
        onClick={() => setShowTechnical((v) => !v)}
        aria-expanded={showTechnical}
        style={{
          border: '1px solid #d6b461',
          background: '#fdeccb',
          color: '#5a4300',
          borderRadius: 999,
          padding: '0.1rem 0.6rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {showTechnical ? 'Hide details' : 'How it works'}
      </button>
      {showTechnical && (
        <p style={{ margin: '0.5rem 0 0', lineHeight: 1.5 }}>
          <strong>Screening heuristic, not a hydrodynamic model.</strong> Radially
          symmetric, no tides or currents, steady state, warm discharge assumed to
          reach the bottom only in water ≤ 20 m deep, placeholder calibration
          constants. Not a permit decision.
        </p>
      )}
    </div>
  );
}
