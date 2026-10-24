import { describe, it, expect } from 'vitest';

/**
 * Trivial scaffold smoke test (Task 1.1). Confirms the Vitest runner is wired up
 * and `npm test` executes. Real model/data tests live in tests/model and tests/data.
 */
describe('scaffold', () => {
  it('runs the test suite', () => {
    expect(1 + 1).toBe(2);
  });
});
