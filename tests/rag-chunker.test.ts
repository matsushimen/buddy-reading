import { describe, expect, it } from "vitest";
import { chunkText } from "../lib/rag/chunker";

describe("rag chunker", () => {
  it("returns single chunk if text is smaller than targetSize", () => {
    const text = "こんにちは。これはテストテキストです。";
    const chunks = chunkText(text, 100);
    expect(chunks).toEqual([text]);
  });

  it("splits text into chunks at sentence boundaries if available", () => {
    const text = "こんにちは。これは1つ目の文章です。そして、これが2つ目の文章です。最後にこれが3つ目の文章です。";
    const chunks = chunkText(text, 40, 10);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain("こんにちは。これは1つ目の文章です。");
  });

  it("handles empty strings", () => {
    const chunks = chunkText("", 100);
    expect(chunks).toEqual([]);
  });
});
