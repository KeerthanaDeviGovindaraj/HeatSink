import { describe, it, expect } from 'vitest';
import {
  LAYER_LABELS,
  type LayerId,
  layerKind,
  layerLabel,
} from '../../src/components/layerLabels';

const ALL_IDS: LayerId[] = ['fishbot', 'emolt', 'ndbc', 'plume', 'score'];

describe('layerLabels (R1.3)', () => {
  it('labels FIShBOT exactly "MEASURED (gridded daily average)"', () => {
    expect(layerLabel('fishbot')).toBe('MEASURED (gridded daily average)');
    expect(layerKind('fishbot')).toBe('MEASURED');
  });

  it('labels the instrument layers MEASURED', () => {
    expect(layerKind('fishbot')).toBe('MEASURED');
    expect(layerKind('emolt')).toBe('MEASURED');
    expect(layerKind('ndbc')).toBe('MEASURED');
    expect(layerLabel('emolt')).toBe('MEASURED');
    expect(layerLabel('ndbc')).toBe('MEASURED (surface)');
  });

  it('labels the computed layers MODELED', () => {
    expect(layerKind('plume')).toBe('MODELED');
    expect(layerKind('score')).toBe('MODELED');
  });

  it('every layer is exactly MEASURED or MODELED and every label begins with its kind', () => {
    for (const id of ALL_IDS) {
      const { kind, label } = LAYER_LABELS[id];
      expect(kind === 'MEASURED' || kind === 'MODELED').toBe(true);
      expect(label.startsWith(kind)).toBe(true);
    }
  });
});
