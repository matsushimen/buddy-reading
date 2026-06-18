import { describe, expect, it } from "vitest";
import { buildReaderAnnotationChatRequest, buildReaderAnnotationRequest } from "../lib/annotation-request";
import type { ReaderContext } from "../lib/annotation-request";

const context: ReaderContext = {
  bookId: "book_001",
  bookTitle: "Sample Book",
  format: "epub",
  location: {
    type: "epub_cfi",
    cfi: "epubcfi(/6/2[chapter-1]!/4/2/14)"
  },
  visibleText: "Visible text from the page.",
  selectedText: "selected text",
  settings: {
    userId: "default",
    skillId: "default",
    model: "server-env",
    language: "ja",
    detailLevel: "standard"
  }
};

describe("reader annotation request builders", () => {
  it("prioritizes the selected text and omits page text when a selection exists", () => {
    const request = buildReaderAnnotationRequest(context);

    expect(request.selectedText).toBe("selected text");
    expect(request.visibleText).toBe("");
  });

  it("prioritizes the selected text in follow-up chat requests", () => {
    const request = buildReaderAnnotationChatRequest(context, "詳しく", []);

    expect(request.selectedText).toBe("selected text");
    expect(request.visibleText).toBe("");
  });
});
