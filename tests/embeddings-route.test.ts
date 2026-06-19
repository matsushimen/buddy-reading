import { describe, expect, it } from "vitest";
import { embeddingRequestSchema, embeddingResponseSchema } from "../lib/schemas";
import { callMockEmbeddings } from "../lib/agent/mock-llm";

describe("embeddings api schemas & mock", () => {
  it("validates request payload schema correctly", () => {
    const validSingle = { input: "hello" };
    const validArray = { input: ["hello", "world"] };
    const invalidEmpty = {};
    const invalidType = { input: 123 };

    expect(embeddingRequestSchema.safeParse(validSingle).success).toBe(true);
    expect(embeddingRequestSchema.safeParse(validArray).success).toBe(true);
    expect(embeddingRequestSchema.safeParse(invalidEmpty).success).toBe(false);
    expect(embeddingRequestSchema.safeParse(invalidType).success).toBe(false);
  });

  it("validates response payload schema correctly", () => {
    const validResponse = {
      embeddings: [
        [0.1, 0.2, 0.3],
        [-0.1, -0.2, 0.5]
      ]
    };
    const invalidResponse = {
      embeddings: "invalid"
    };

    expect(embeddingResponseSchema.safeParse(validResponse).success).toBe(true);
    expect(embeddingResponseSchema.safeParse(invalidResponse).success).toBe(false);
  });

  it("generates valid unit-length mock embeddings", () => {
    const input = "test embedding generation";
    const embeddings = callMockEmbeddings(input);
    
    expect(embeddings.length).toBe(1);
    expect(embeddings[0].length).toBe(1536);

    for (const val of embeddings[0]) {
      expect(val).toBeGreaterThanOrEqual(-1.0);
      expect(val).toBeLessThanOrEqual(1.0);
    }

    const norm = Math.sqrt(embeddings[0].reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });
});
