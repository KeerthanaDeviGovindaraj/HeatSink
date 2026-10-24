/**
 * STRETCH: build-time AI summaries via Amazon Bedrock. Output JSON to public/data.
 * Never call Bedrock from the browser; never commit credentials (reads AWS_REGION /
 * BEDROCK_MODEL_ID from the environment, see .env.example). Implemented in a later task.
 */
export async function generateSummaries(): Promise<void> {
  throw new Error('generateSummaries not implemented yet');
}
