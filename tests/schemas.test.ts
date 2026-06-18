import { describe, expect, it } from "vitest";
import { annotationChatRequestSchema, annotationChatResponseSchema, annotationRequestSchema, annotationResponseSchema } from "../lib/schemas";

describe("annotation schemas", () => {
  it("accepts a valid structured annotation response", () => {
    const result = annotationResponseSchema.safeParse({
      annotations: [
        {
          id: "ann_1",
          title: "Reader",
          kind: "concept",
          short: "ReaderからAgentへ送る構造を表す。",
          details: ["UIはLLMを直接呼ばない。"],
          whyRelevantHere: "Phase1の主要な制約だから。",
          related: ["Agent", "LLM"],
          confidence: "high"
        }
      ],
      followupQuestions: ["詳しく説明する？"],
      warnings: []
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown response properties", () => {
    const result = annotationResponseSchema.safeParse({
      annotations: [],
      followupQuestions: [],
      warnings: [],
      markdown: "not allowed"
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsafe identifiers in annotation requests", () => {
    const result = annotationRequestSchema.safeParse({
      bookId: "../book",
      bookTitle: "Sample",
      format: "pdf",
      location: {
        type: "pdf_page",
        page: 1
      },
      visibleText: "sample text",
      skillId: "default",
      userId: "default",
      options: {
        detailLevel: "standard",
        language: "ja"
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects annotation requests without reader text", () => {
    const result = annotationRequestSchema.safeParse({
      bookId: "book_1",
      bookTitle: "Sample",
      format: "pdf",
      location: {
        type: "pdf_page",
        page: 1
      },
      visibleText: "   ",
      selectedText: "",
      skillId: "default",
      userId: "default",
      options: {
        detailLevel: "standard",
        language: "ja"
      }
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid structured annotation chat response", () => {
    const result = annotationChatResponseSchema.safeParse({
      answer: "この用語は技術基盤の名前です。",
      followupQuestions: ["もっと短く説明する？"],
      warnings: []
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid annotation chat request", () => {
    const result = annotationChatRequestSchema.safeParse({
      bookId: "book_1",
      bookTitle: "Sample",
      format: "pdf",
      location: {
        type: "pdf_page",
        page: 1
      },
      visibleText: "sample text",
      selectedText: "sample",
      question: "この意味は？",
      conversation: [
        {
          role: "user",
          content: "これは何？"
        }
      ],
      skillId: "default",
      userId: "default",
      options: {
        detailLevel: "standard",
        language: "ja"
      }
    });

    expect(result.success).toBe(true);
  });
});
