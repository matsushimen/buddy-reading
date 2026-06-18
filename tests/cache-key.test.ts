import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnnotationCacheKey } from "../lib/cache-key";
import type { AnnotationRequest } from "../lib/types";

const request: AnnotationRequest = {
  bookId: "book_001",
  bookTitle: "Sample Book",
  format: "epub",
  location: {
    type: "epub_cfi",
    cfi: "epubcfi(/6/2[chapter-1]!/4/2/14)"
  },
  visibleText: "Visible text from the page.",
  selectedText: "selected text",
  skillId: "default",
  userId: "default",
  options: {
    detailLevel: "standard",
    language: "ja"
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("annotation cache key", () => {
  it("produces a stable key when Web Crypto is available", async () => {
    const key = await createAnnotationCacheKey(request, {
      model: "server-env",
      memoryVersion: "memory-v1",
      bookContextVersion: "book-v1"
    });

    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("falls back when Web Crypto subtle digest is unavailable", async () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal(
      "crypto",
      { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) }
    );

    const key = await createAnnotationCacheKey(request, {
      model: "server-env",
      memoryVersion: "memory-v1",
      bookContextVersion: "book-v1"
    });

    expect(key).toMatch(/^[0-9a-f]{16}$/);
  });
});
