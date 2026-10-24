/**
 * MEASURED / MODELED layer labels (R1.3).
 *
 * Every layer HeatSink draws is either MEASURED (derived directly from
 * instruments) or MODELED (computed by HeatSink). The glossary in
 * requirements.md fixes the wording; this module is the single source of truth
 * so the Footer, MapView, and later overlays all name a layer the same way
 * (wire the constant in rather than hardcoding strings).
 *
 * Pure data; no DOM, no I/O — safe to unit-test in a node env.
 */

/** Provenance kind every layer must declare (R1.3). */
export type LayerKind = 'MEASURED' | 'MODELED';

/** Identifier for each layer HeatSink can draw. */
export type LayerId = 'fishbot' | 'emolt' | 'ndbc' | 'plume' | 'score';

export interface LayerLabel {
  /** MEASURED for instrument data, MODELED for HeatSink computations. */
  kind: LayerKind;
  /** Full badge text shown next to the layer (e.g. "MEASURED (gridded daily average)"). */
  label: string;
}

/**
 * The canonical label for every layer. FIShBOT carries the exact wording the
 * requirements call out; plume/score layers are MODELED and used by later tasks.
 */
export const LAYER_LABELS: Record<LayerId, LayerLabel> = {
  fishbot: { kind: 'MEASURED', label: 'MEASURED (gridded daily average)' },
  emolt: { kind: 'MEASURED', label: 'MEASURED' },
  ndbc: { kind: 'MEASURED', label: 'MEASURED (surface)' },
  plume: { kind: 'MODELED', label: 'MODELED' },
  score: { kind: 'MODELED', label: 'MODELED' },
};

/** Look up a layer's badge text (R1.3). */
export function layerLabel(id: LayerId): string {
  return LAYER_LABELS[id].label;
}

/** Look up whether a layer is MEASURED or MODELED (R1.3). */
export function layerKind(id: LayerId): LayerKind {
  return LAYER_LABELS[id].kind;
}
