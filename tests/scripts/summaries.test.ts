// tests/scripts/summaries.test.ts — Task 8.2 (requirement R7.3).
//
// Covers the two things we can verify WITHOUT a live Bedrock call (Bedrock is
// intentionally not configured in this environment — no AWS credentials):
//
//   1. GRACEFUL SKIP: generateSummaries() with Bedrock unconfigured resolves
//      (does not throw) and does NOT create or corrupt public/data/summaries.json.
//   2. The pure prompt builder grounds the model in the template facts and
//      carries the "do not invent numbers" + screening (not a permit) guardrails.
//
// We never exercise the live generation path here — only the skip + pure helpers.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  buildSummaryPrompt,
  generateSummaries,
  presetId,
  resolveBedrockConfig,
  DEFAULT_BEDROCK_MODEL_ID,
} from '../../scripts/summaries';

const here = dirname(fileURLToPath(import.meta.url));
const summariesPath = resolve(here, '../../public/data/summaries.json');

/** Snapshot the committed file state so we can assert the skip path leaves it alone. */
function snapshotSummaries(): string | null {
  return existsSync(summariesPath) ? readFileSync(summariesPath, 'utf8') : null;
}

describe('resolveBedrockConfig (R7.3)', () => {
  it('returns null when no region is configured (→ graceful skip)', () => {
    expect(resolveBedrockConfig({})).toBeNull();
  });

  it('returns null when SKIP_BEDROCK is set even with a region', () => {
    expect(resolveBedrockConfig({ AWS_REGION: 'us-east-1', SKIP_BEDROCK: '1' })).toBeNull();
  });

  it('resolves region and defaults the model id when only a region is set', () => {
    const cfg = resolveBedrockConfig({ AWS_REGION: 'us-east-1' });
    expect(cfg).toEqual({ region: 'us-east-1', modelId: DEFAULT_BEDROCK_MODEL_ID });
  });

  it('accepts AWS_DEFAULT_REGION and an explicit model id', () => {
    const cfg = resolveBedrockConfig({
      AWS_DEFAULT_REGION: 'us-west-2',
      BEDROCK_MODEL_ID: 'my.model-id',
    });
    expect(cfg).toEqual({ region: 'us-west-2', modelId: 'my.model-id' });
  });
});

describe('generateSummaries graceful skip (R7.3)', () => {
  it('resolves without throwing and does not touch summaries.json when Bedrock is unconfigured', async () => {
    const before = snapshotSummaries();

    // Explicitly unconfigured env (no AWS_REGION) → must skip, not throw.
    await expect(generateSummaries({ SKIP_BEDROCK: '1' })).resolves.toBeUndefined();

    const after = snapshotSummaries();
    // File state is unchanged: still absent, or byte-identical if it existed.
    expect(after).toEqual(before);
  });
});

describe('buildSummaryPrompt (R7.3)', () => {
  const template = '# HeatSink screening summary — Test Site\n\n- Plume area: 1.23 km²';

  it('embeds the grounding facts verbatim', () => {
    const prompt = buildSummaryPrompt(template, 'Test Site');
    expect(prompt).toContain('1.23 km²');
    expect(prompt).toContain(template);
    expect(prompt).toContain('Test Site');
  });

  it('carries the no-invented-numbers and screening (not a permit) guardrails', () => {
    const prompt = buildSummaryPrompt(template, 'Test Site').toLowerCase();
    expect(prompt).toContain('do not invent numbers');
    expect(prompt).toContain('screening');
    expect(prompt).toContain('permit');
  });
});

describe('presetId (R7.3)', () => {
  it('slugifies a preset name into a stable key', () => {
    expect(presetId('Cape Cod Bay – central')).toBe('cape-cod-bay-central');
    expect(presetId('Massachusetts Bay – Boston approach')).toBe(
      'massachusetts-bay-boston-approach',
    );
  });
});
