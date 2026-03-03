/**
 * Very small, dependency-free token estimate.
 * Default heuristic: ~4 chars per token.
 * Callers can override with a custom estimator.
 */
export function estimateTokensFromJson(value: unknown): number {
  const json = JSON.stringify(value);
  return Math.ceil(json.length / 4);
}
