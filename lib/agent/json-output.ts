import { annotationResponseSchema } from "../schemas";
import { annotationChatResponseSchema, bookContextProposalResponseSchema, memoryProposalResponseSchema } from "../schemas";
import type {
  Annotation,
  AnnotationChatResponse,
  AnnotationKind,
  AnnotationResponse,
  BookContextProposalResponse,
  MemoryProposalResponse
} from "../types";

const annotationKinds: AnnotationKind[] = ["term", "person", "organization", "place", "technology", "concept", "claim", "citation", "unknown"];

export function parseAnnotationJson(content: string): AnnotationResponse {
  const direct = parseJson(content);
  if (direct.ok) {
    return parseOrNormalize(direct.value);
  }

  const extracted = extractFirstJsonObject(content);
  if (extracted) {
    const parsed = parseJson(extracted);
    if (parsed.ok) {
      return parseOrNormalize(parsed.value);
    }
  }

  throw new Error("LLM response did not contain valid annotation JSON");
}

function parseOrNormalize(value: unknown): AnnotationResponse {
  const strict = annotationResponseSchema.safeParse(value);
  if (strict.success) {
    return strict.data;
  }

  return annotationResponseSchema.parse(normalizeAnnotationResponse(value));
}

function normalizeAnnotationResponse(value: unknown): AnnotationResponse {
  const object = isRecord(value) ? value : {};
  const sourceAnnotations = Array.isArray(object.annotations) ? object.annotations : [];
  const annotations = sourceAnnotations.slice(0, 8).map((annotation, index) => normalizeAnnotation(annotation, index));

  return {
    annotations:
      annotations.length > 0
        ? annotations
        : [
            {
              id: "annotation_1",
              title: "説明",
              kind: "unknown",
              short: "AI応答から注釈を抽出しました。",
              details: ["ローカルLLMの応答をアプリの構造化JSON形式へ正規化しています。"],
              whyRelevantHere: "現在の本文または選択テキストへの説明として返されました。",
              related: [],
              confidence: "low"
            }
          ],
    followupQuestions: normalizeStringArray(object.followupQuestions, 4, 200),
    warnings: normalizeStringArray(object.warnings, 4, 240)
  };
}

function normalizeAnnotation(value: unknown, index: number): Annotation {
  const object = isRecord(value) ? value : {};
  const title = normalizeString(object.title, `注釈 ${index + 1}`, 160);
  const short = normalizeString(object.short ?? object.summary ?? object.description, title, 280);
  const details = normalizeDetails(object.details ?? object.detail ?? object.explanation);

  return {
    id: normalizeString(object.id, `annotation_${index + 1}`, 80),
    title,
    kind: normalizeKind(object.kind),
    short,
    details,
    whyRelevantHere: normalizeString(object.whyRelevantHere ?? object.relevance ?? object.context, "この箇所の理解を助ける説明です。", 320),
    related: normalizeStringArray(object.related, 6, 80),
    confidence: normalizeConfidence(object.confidence)
  };
}

function normalizeDetails(value: unknown): string[] {
  if (Array.isArray(value)) {
    const details = normalizeStringArray(value, 5, 400);
    return details.length > 0 ? details : ["追加説明はありません。"];
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return [truncate(value.trim(), 400)];
  }

  return ["追加説明はありません。"];
}

function normalizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => truncate(item.trim(), maxLength));
}

function normalizeKind(value: unknown): AnnotationKind {
  if (typeof value === "string" && annotationKinds.includes(value as AnnotationKind)) {
    return value as AnnotationKind;
  }
  return "unknown";
}

function normalizeConfidence(value: unknown): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "low";
}

function normalizeString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return truncate(value.trim(), maxLength);
  }
  return truncate(fallback, maxLength);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createFallbackAnnotationResponse(message: string): AnnotationResponse {
  return {
    annotations: [
      {
        id: "fallback_annotation",
        title: "注釈を生成できませんでした",
        kind: "unknown",
        short: "AI応答を構造化JSONとして処理できませんでした。",
        details: [message.slice(0, 400)],
        whyRelevantHere: "Agent APIが安全なfallback応答を返しています。",
        related: [],
        confidence: "low"
      }
    ],
    followupQuestions: [],
    warnings: ["AI応答の検証に失敗したため、fallback注釈を表示しています。"]
  };
}

export function parseAnnotationChatJson(content: string): AnnotationChatResponse {
  const direct = parseJson(content);
  if (direct.ok) {
    return parseChatOrNormalize(direct.value);
  }

  const extracted = extractFirstJsonObject(content);
  if (extracted) {
    const parsed = parseJson(extracted);
    if (parsed.ok) {
      return parseChatOrNormalize(parsed.value);
    }
  }

  throw new Error("LLM response did not contain valid chat JSON");
}

export function createFallbackAnnotationChatResponse(message: string): AnnotationChatResponse {
  return {
    answer: "うまく応答を生成できませんでした。",
    followupQuestions: [],
    warnings: [truncate(`AI応答の検証に失敗したため、fallback応答を表示しています。${message}`, 240)]
  };
}

export function parseMemoryProposalJson(content: string): MemoryProposalResponse {
  const direct = parseJson(content);
  if (direct.ok) {
    return parseMemoryProposalOrNormalize(direct.value);
  }

  const extracted = extractFirstJsonObject(content);
  if (extracted) {
    const parsed = parseJson(extracted);
    if (parsed.ok) {
      return parseMemoryProposalOrNormalize(parsed.value);
    }
  }

  throw new Error("LLM response did not contain valid memory proposal JSON");
}

export function createFallbackMemoryProposalResponse(message: string): MemoryProposalResponse {
  return {
    proposedMemory: "",
    reason: "メモリ提案を生成できませんでした。",
    warnings: [truncate(`AI応答の検証に失敗したため、fallback応答を表示しています。${message}`, 240)]
  };
}

export function parseBookContextProposalJson(content: string): BookContextProposalResponse {
  const direct = parseJson(content);
  if (direct.ok) {
    return parseBookContextProposalOrNormalize(direct.value);
  }

  const extracted = extractFirstJsonObject(content);
  if (extracted) {
    const parsed = parseJson(extracted);
    if (parsed.ok) {
      return parseBookContextProposalOrNormalize(parsed.value);
    }
  }

  throw new Error("LLM response did not contain valid book context proposal JSON");
}

export function createFallbackBookContextProposalResponse(message: string): BookContextProposalResponse {
  return {
    proposedBookContext: "",
    reason: "BOOK_CONTEXT提案を生成できませんでした。",
    warnings: [truncate(`AI応答の検証に失敗したため、fallback応答を表示しています。${message}`, 240)]
  };
}

type ParseJsonResult = { ok: true; value: unknown } | { ok: false };

function parseJson(content: string): ParseJsonResult {
  try {
    return { ok: true, value: JSON.parse(content) as unknown };
  } catch {
    return { ok: false };
  }
}

function extractFirstJsonObject(content: string): string | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return content.slice(start, end + 1);
}

function parseChatOrNormalize(value: unknown): AnnotationChatResponse {
  const strict = annotationChatResponseSchema.safeParse(value);
  if (strict.success) {
    return strict.data;
  }

  return annotationChatResponseSchema.parse(normalizeChatResponse(value));
}

function normalizeChatResponse(value: unknown): AnnotationChatResponse {
  const object = isRecord(value) ? value : {};
  return {
    answer: normalizeString(object.answer ?? object.reply ?? object.content ?? object.message, "短い追質問応答です。", 1200),
    followupQuestions: normalizeStringArray(object.followupQuestions, 4, 200),
    warnings: normalizeStringArray(object.warnings, 4, 240)
  };
}

function parseMemoryProposalOrNormalize(value: unknown): MemoryProposalResponse {
  const strict = memoryProposalResponseSchema.safeParse(value);
  if (strict.success) {
    return strict.data;
  }

  return memoryProposalResponseSchema.parse(normalizeMemoryProposalResponse(value));
}

function normalizeMemoryProposalResponse(value: unknown): MemoryProposalResponse {
  const object = isRecord(value) ? value : {};
  const proposedMemory = normalizeString(object.proposedMemory ?? object.content ?? object.memory, "", 20000);

  return {
    proposedMemory,
    reason: normalizeString(object.reason ?? object.explanation ?? object.message, "メモリ更新案です。", 1200),
    warnings: normalizeStringArray(object.warnings, 4, 240)
  };
}

function parseBookContextProposalOrNormalize(value: unknown): BookContextProposalResponse {
  const strict = bookContextProposalResponseSchema.safeParse(value);
  if (strict.success) {
    return strict.data;
  }

  return bookContextProposalResponseSchema.parse(normalizeBookContextProposalResponse(value));
}

function normalizeBookContextProposalResponse(value: unknown): BookContextProposalResponse {
  const object = isRecord(value) ? value : {};
  const proposedBookContext = normalizeString(object.proposedBookContext ?? object.content ?? object.memory, "", 20000);

  return {
    proposedBookContext,
    reason: normalizeString(object.reason ?? object.explanation ?? object.message, "BOOK_CONTEXT更新案です。", 1200),
    warnings: normalizeStringArray(object.warnings, 4, 240)
  };
}
