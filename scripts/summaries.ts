/**
 * STRETCH (task 8.2, requirement R7.3): build-time AI summaries via Amazon
 * Bedrock for the PRESET sites only.
 *
 * WHY THIS IS A NODE-ONLY SCRIPT (R7.3): the browser must NEVER call Bedrock.
 * This script runs at build time under `tsx` (`npm run summaries`), invokes
 * Bedrock once per preset, and writes the result to a committed JSON file
 * (public/data/summaries.json) that the browser reads like any other snapshot.
 * Custom sites always use the deterministic template (task 8.1) — the AI layer
 * is additive and preset-only.
 *
 * GROUNDING: we do not ask the model to invent anything. For each preset we run
 * the real screening model (runSite over the committed data) and build the
 * deterministic template markdown (buildSummaryMarkdown). That factual markdown
 * is handed to Bedrock as the ONLY source of facts, with an instruction to
 * rewrite it into a short, plain-English, meeting-ready paragraph and to not
 * invent numbers. This keeps the AI output tied to the real computed figures.
 *
 * GRACEFUL DEGRADATION (critical): Bedrock is optional. If AWS_REGION is unset,
 * credentials do not resolve, or SKIP_BEDROCK is set, the script logs a clear
 * message and returns WITHOUT throwing and WITHOUT writing a partial file. A
 * credential-less build stays green; this script is never part of `npm run
 * build`. Credentials come from the standard AWS provider chain and are never
 * logged or written (see .env.example).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { FeatureCollection } from 'geojson';

import { baselineCellsFromSnapshot } from '../src/data/loaders';
import type { OceanRow, Snapshot, SpeciesFile } from '../src/data/types';
import type { SourceMetas } from '../src/data/useSnapshots';
import { displayableSpecies, toModelSpecies } from '../src/components/species';
import { buildSummaryMarkdown } from '../src/components/report';
import { PRESET_SITES } from '../src/model/presets';
import { runSite } from '../src/model/runSite';
import type { BaselineCell, Species } from '../src/model/types';

/**
 * Default Bedrock model id. Anthropic Claude 3 Haiku on Bedrock — a fast, cheap
 * text model that is widely enabled, appropriate for a short rewrite task.
 * Override with the BEDROCK_MODEL_ID env var (see .env.example). The model must
 * be enabled in your Bedrock account/region for the call to succeed.
 */
export const DEFAULT_BEDROCK_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

/** Soft word budget for the rewritten paragraph (kept in the prompt + note). */
const MAX_WORDS = 120;

/** One AI summary record written to summaries.json, keyed by preset id. */
export interface PresetSummary {
  /** The preset's human-readable name (from PRESET_SITES). */
  name: string;
  /** The AI-rewritten, meeting-ready paragraph (grounded in the template). */
  text: string;
  /** Which Bedrock model produced it (provenance, shown/usable by the UI). */
  modelId: string;
  /** A short, non-timestamped provenance note (output stays deterministic-ish). */
  generatedAtNote: string;
}

/** The committed file shape: a map keyed by preset id. */
export type SummariesFile = Record<string, PresetSummary>;

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../public/data');
const outFile = resolve(dataDir, 'summaries.json');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, name), 'utf8')) as T;
}

/** A stable id for a preset, derived from its name (keys summaries.json). */
export function presetId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build the Bedrock prompt from the deterministic template markdown. PURE and
 * deterministic so it is unit-testable without any AWS call.
 *
 * The prompt instructs the model to rewrite the facts into a short plain-English
 * paragraph for a town meeting, to NOT invent numbers, and to make clear this is
 * a screening tool and not a permit decision.
 *
 * @param templateMarkdown The factual summary from buildSummaryMarkdown.
 * @param presetName The site's human-readable name.
 * @returns The prompt text sent to Bedrock.
 */
export function buildSummaryPrompt(templateMarkdown: string, presetName: string): string {
  return [
    `You are helping explain a coastal thermal-discharge SCREENING result for "${presetName}" to residents at a town meeting.`,
    '',
    `Rewrite the facts below into a single plain-English paragraph of at most ${MAX_WORDS} words.`,
    'Rules:',
    '- Use ONLY the numbers and facts given below. Do NOT invent numbers or add facts.',
    '- Make clear this is a screening heuristic, NOT a hydrodynamic model and NOT a permit decision.',
    '- Keep it calm, concrete, and readable for a non-technical audience.',
    '- Do not use Markdown headings or bullet points; return one paragraph of prose.',
    '',
    'FACTS (the only source of truth):',
    '"""',
    templateMarkdown,
    '"""',
  ].join('\n');
}

/** Resolved, non-secret configuration for a Bedrock run. */
export interface BedrockConfig {
  region: string;
  modelId: string;
}

/**
 * Resolve Bedrock config from the environment WITHOUT touching credentials.
 * Returns null (→ graceful skip) when summaries are disabled via SKIP_BEDROCK
 * or when no region is configured. Credentials are resolved later by the SDK's
 * default provider chain; a missing/invalid credential surfaces as a failed
 * call, which we also treat as a skip.
 *
 * @param env Environment variables (defaults to process.env; injectable for tests).
 * @returns The config, or null when Bedrock is not configured.
 */
export function resolveBedrockConfig(
  env: NodeJS.ProcessEnv = process.env,
): BedrockConfig | null {
  if (env.SKIP_BEDROCK && env.SKIP_BEDROCK !== '0' && env.SKIP_BEDROCK !== '') {
    return null;
  }
  const region = env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  if (!region || region.trim().length === 0) {
    return null;
  }
  const modelId =
    env.BEDROCK_MODEL_ID && env.BEDROCK_MODEL_ID.trim().length > 0
      ? env.BEDROCK_MODEL_ID.trim()
      : DEFAULT_BEDROCK_MODEL_ID;
  return { region: region.trim(), modelId };
}

/** Load the committed data and build model inputs shared across presets. */
function loadModelInputs(): {
  cells: BaselineCell[];
  land: FeatureCollection;
  modelSpecies: Species[];
  speciesEntries: ReturnType<typeof displayableSpecies>;
  metas: SourceMetas;
} {
  const snapshot = readJson<Snapshot<OceanRow>>('fishbot.json');
  const land = readJson<FeatureCollection>('ma-land.geojson');
  const speciesFile = readJson<SpeciesFile>('species.json');

  const cells = baselineCellsFromSnapshot(snapshot);
  const speciesEntries = displayableSpecies(speciesFile.species);
  const modelSpecies = speciesEntries.map(toModelSpecies);
  const metas: SourceMetas = { fishbot: snapshot.meta };

  return { cells, land, modelSpecies, speciesEntries, metas };
}

/**
 * Invoke Bedrock for one prompt and return the model's text. Isolated so it is
 * the only place that imports the AWS SDK dynamically — a credential-less build
 * never needs the SDK loaded. Throws on any failure; callers decide whether a
 * failure aborts or is logged and skipped.
 */
async function invokeBedrock(config: BedrockConfig, prompt: string): Promise<string> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    '@aws-sdk/client-bedrock-runtime'
  );

  const client = new BedrockRuntimeClient({ region: config.region });

  // Anthropic Messages API body shape (Claude on Bedrock).
  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 400,
    temperature: 0.2,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  });

  const command = new InvokeModelCommand({
    modelId: config.modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const response = await client.send(command);
  const raw = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(raw) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = (parsed.content ?? [])
    .map((c) => (typeof c.text === 'string' ? c.text : ''))
    .join('')
    .trim();
  if (text.length === 0) {
    throw new Error('Bedrock returned an empty completion');
  }
  return text;
}

/**
 * Generate build-time AI summaries for the preset sites and write them to
 * public/data/summaries.json (R7.3).
 *
 * Graceful skip: when Bedrock is not configured (no region / SKIP_BEDROCK) this
 * resolves without throwing and without writing a partial file. When a single
 * preset's Bedrock call fails, that preset is logged and skipped; the file is
 * only written if at least one summary was produced, and it is written once
 * atomically (full object → single write) so a partial failure never leaves a
 * corrupt file.
 *
 * @param env Environment variables (injectable for tests; defaults to process.env).
 */
export async function generateSummaries(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const config = resolveBedrockConfig(env);
  if (!config) {
    console.log(
      '[summaries] Bedrock not configured — skipping; presets will use the deterministic template.',
    );
    return;
  }

  console.log(
    `[summaries] Generating preset summaries via Bedrock (region=${config.region}, model=${config.modelId}) ...`,
  );

  const { cells, land, modelSpecies, speciesEntries, metas } = loadModelInputs();
  const generatedAtNote = `Rewritten from the deterministic screening template by ${config.modelId} (build-time); figures come from the committed FIShBOT baseline.`;

  const summaries: SummariesFile = {};
  let failures = 0;

  for (const preset of PRESET_SITES) {
    const id = presetId(preset.name);
    try {
      const result = runSite(preset.inputs, cells, modelSpecies, land);
      const templateMarkdown = buildSummaryMarkdown({
        result,
        species: speciesEntries,
        metas,
        siteLabel: preset.name,
      });
      const prompt = buildSummaryPrompt(templateMarkdown, preset.name);
      const text = await invokeBedrock(config, prompt);

      summaries[id] = {
        name: preset.name,
        text,
        modelId: config.modelId,
        generatedAtNote,
      };
      console.log(`[summaries] ok: ${preset.name}`);
    } catch (err) {
      failures += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[summaries] skipped "${preset.name}": ${message}`);
    }
  }

  const count = Object.keys(summaries).length;
  if (count === 0) {
    console.warn(
      '[summaries] No summaries produced (all preset calls failed) — not writing summaries.json; presets will use the deterministic template.',
    );
    return;
  }

  // Atomic in spirit: build the whole object, then write once.
  writeFileSync(outFile, `${JSON.stringify(summaries, null, 2)}\n`, 'utf8');
  console.log(
    `[summaries] Wrote ${count}/${PRESET_SITES.length} preset summaries to public/data/summaries.json` +
      (failures > 0 ? ` (${failures} skipped).` : '.'),
  );
}

// `npm run summaries` entry point (mirrors run-data.ts). A thrown error here is
// a genuine failure (e.g. unreadable committed data), NOT the graceful skip —
// the skip path returns normally above and exits 0.
const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  generateSummaries().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
