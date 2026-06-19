import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../lib/rag/vector-search";

describe("vector search math", () => {
  it("calculates exact cosine similarity for simple vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    expect(cosineSimilarity([3, 4], [3, 4])).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 0], [1, 1])).toBeCloseTo(0.7071, 4);
  });

  it("throws error for mismatching vector sizes", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });

  it("returns 0 for zero vectors", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});
