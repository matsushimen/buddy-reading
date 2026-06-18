import type { AnnotationChatRequest, AnnotationChatResponse, AnnotationRequest, AnnotationResponse } from "../types";

export function callMockLlm(request: AnnotationRequest): AnnotationResponse {
  const selected = request.selectedText?.trim();
  const visible = request.visibleText.trim();
  const target = selected && selected.length > 0 ? selected : firstPhrase(visible);
  const title = target || request.bookTitle;

  return {
    annotations: [
      {
        id: "mock_annotation_1",
        title,
        kind: selected ? "term" : "concept",
        short: "これはPhase3のモックAgentが返す注釈です。",
        details: [
          "ReaderからAgent APIを経由して構造化JSONを受け取る流れを維持しています。",
          "OpenAI API、MEMORY、RAGにはまだ接続していません。"
        ],
        whyRelevantHere: "現在表示中の本文または選択テキストを入力として受け取ったためです。",
        related: ["Reader", "Agent", "structured JSON"],
        confidence: "medium"
      }
    ],
    followupQuestions: ["この箇所の背景をもう少し説明する？", "関連する用語だけ抽出する？"],
    warnings: visible.length === 0 ? ["本文テキストを抽出できなかったため、表示位置の情報だけで返しています。"] : []
  };
}

export function callMockAnnotationChat(request: AnnotationChatRequest): AnnotationChatResponse {
  const selected = request.selectedText?.trim();
  const target = selected && selected.length > 0 ? selected : firstPhrase(request.visibleText);
  const question = request.question.trim();

  return {
    answer: question.length > 0
      ? `質問「${truncate(question, 40)}」に対するモック応答です。${target ? `対象は「${target}」です。` : ""}`
      : "追質問を受け付けました。",
    followupQuestions: ["もう少し短く言い換える？", "関連する用語も見る？"],
    warnings: []
  };
}

function firstPhrase(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 60) {
    return normalized;
  }
  return `${normalized.slice(0, 60)}...`;
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}
