import type { AnnotationChatRequest, AnnotationRequest, AppSettings, BookFormat } from "./types";

const maxVisibleTextLength = 4000;
const maxSelectedTextLength = 1000;

export type ReaderContext = {
  bookId: string;
  bookTitle: string;
  format: BookFormat;
  location: {
    type: "pdf_page" | "epub_cfi";
    page?: number;
    cfi?: string;
  };
  visibleText: string;
  selectedText: string;
  settings: AppSettings;
};

export function buildReaderAnnotationRequest(context: ReaderContext): AnnotationRequest {
  const selectedText = context.selectedText.trim();
  const visibleText = truncateForRequest(context.visibleText, maxVisibleTextLength);
  return {
    bookId: context.bookId,
    bookTitle: context.bookTitle,
    format: context.format,
    location: context.location,
    visibleText: selectedText ? "" : visibleText,
    selectedText: selectedText ? truncateForRequest(selectedText, maxSelectedTextLength) : undefined,
    skillId: context.settings.skillId,
    userId: context.settings.userId,
    options: {
      detailLevel: context.settings.detailLevel,
      language: context.settings.language
    }
  };
}

export function buildReaderAnnotationChatRequest(
  context: ReaderContext,
  question: string,
  conversation: Array<{ role: "user" | "assistant"; content: string }>
): AnnotationChatRequest {
  const selectedText = context.selectedText.trim();
  const visibleText = truncateForRequest(context.visibleText, maxVisibleTextLength);
  return {
    bookId: context.bookId,
    bookTitle: context.bookTitle,
    format: context.format,
    location: context.location,
    visibleText: selectedText ? "" : visibleText,
    selectedText: selectedText ? truncateForRequest(selectedText, maxSelectedTextLength) : undefined,
    question: truncateForRequest(question, 400),
    conversation: conversation.slice(-6).map((message) => ({
      role: message.role,
      content: truncateForRequest(message.content, 600)
    })),
    skillId: context.settings.skillId,
    userId: context.settings.userId,
    options: {
      detailLevel: context.settings.detailLevel,
      language: context.settings.language
    }
  };
}

function truncateForRequest(value: string, maxLength: number): string {
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
}
