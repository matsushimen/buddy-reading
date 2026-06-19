import { describe, expect, it } from "vitest";
import { buildAnnotationChatPrompt } from "../lib/agent/chat-prompt-builder";
import type { AnnotationChatRequest } from "../lib/types";

describe("chat prompt builder with RAG", () => {
  it("injects retrievedChunks with correct [BOOK_SOURCE_n] bounds", () => {
    const mockRequest: AnnotationChatRequest = {
      bookId: "test_book",
      bookTitle: "Test Book",
      format: "pdf",
      location: { type: "pdf_page", page: 1 },
      visibleText: "Hello world page content",
      question: "What is this?",
      conversation: [],
      skillId: "default",
      userId: "default",
      options: { detailLevel: "standard", language: "ja" },
      retrievedChunks: ["Excerpt chunk number one", "Excerpt chunk number two"]
    };

    const prompt = buildAnnotationChatPrompt(
      mockRequest,
      "skill data",
      "memory data",
      "v1",
      "context data",
      "v1"
    );

    expect(prompt.user).toContain("[BOOK_SOURCE_1]\nExcerpt chunk number one\n[/BOOK_SOURCE_1]");
    expect(prompt.user).toContain("[BOOK_SOURCE_2]\nExcerpt chunk number two\n[/BOOK_SOURCE_2]");
  });

  it("omits RAG section if retrievedChunks is empty", () => {
    const mockRequest: AnnotationChatRequest = {
      bookId: "test_book",
      bookTitle: "Test Book",
      format: "pdf",
      location: { type: "pdf_page", page: 1 },
      visibleText: "Hello world page content",
      question: "What is this?",
      conversation: [],
      skillId: "default",
      userId: "default",
      options: { detailLevel: "standard", language: "ja" },
      retrievedChunks: []
    };

    const prompt = buildAnnotationChatPrompt(
      mockRequest,
      "skill data",
      "memory data",
      "v1",
      "context data",
      "v1"
    );

    expect(prompt.user).not.toContain("BOOK_SOURCE");
  });
});
