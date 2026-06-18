"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, MessageSquareText, RefreshCw, X } from "lucide-react";
import {
  approveBookContextUpdate,
  approveMemoryUpdate,
  requestAnnotationChat,
  requestAnnotations,
  requestBookContextProposal,
  requestBookContextSnapshot,
  requestMemoryProposal,
  requestMemorySnapshot
} from "@/lib/agent-client";
import { createAnnotationCacheKey } from "@/lib/cache-key";
import { deleteAnnotation, getAnnotationByCacheKey, getAnnotationsByBookId, saveAnnotation } from "@/lib/db";
import { buildReaderAnnotationChatRequest, buildReaderAnnotationRequest } from "@/lib/annotation-request";
import type {
  AnnotationResponse,
  AnnotationRecord,
  AppSettings,
  BookFormat,
  BookContextProposalResponse,
  BookContextSnapshot,
  MemoryProposalResponse,
  MemorySnapshot
} from "@/lib/types";

type AiSidebarProps = {
  bookId: string;
  bookTitle: string;
  format: BookFormat;
  location: ReaderLocation;
  visibleText: string;
  selectedText: string;
  settings: AppSettings;
  readingPositionLabel: string;
  annotationRefreshToken: number;
  onAnnotationSaved: () => void;
  onNavigateLocation: (location: AnnotationRecord["location"]) => void;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ReaderLocation = AnnotationRecord["location"];

export function AiSidebar(props: AiSidebarProps): React.ReactElement {
  const {
    bookId,
    bookTitle,
    format,
    annotationRefreshToken,
    onAnnotationSaved,
    onNavigateLocation,
    selectedText,
    readingPositionLabel,
    settings,
    visibleText
  } = props;
  const [response, setResponse] = useState<AnnotationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [memorySnapshot, setMemorySnapshot] = useState<MemorySnapshot | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [isMemoryLoading, setIsMemoryLoading] = useState(false);
  const [memoryProposal, setMemoryProposal] = useState<MemoryProposalResponse | null>(null);
  const [memoryProposalError, setMemoryProposalError] = useState<string | null>(null);
  const [isMemoryProposing, setIsMemoryProposing] = useState(false);
  const [isMemorySaving, setIsMemorySaving] = useState(false);
  const [bookContextSnapshot, setBookContextSnapshot] = useState<BookContextSnapshot | null>(null);
  const [bookContextError, setBookContextError] = useState<string | null>(null);
  const [isBookContextLoading, setIsBookContextLoading] = useState(false);
  const [bookContextProposal, setBookContextProposal] = useState<BookContextProposalResponse | null>(null);
  const [bookContextProposalError, setBookContextProposalError] = useState<string | null>(null);
  const [isBookContextProposing, setIsBookContextProposing] = useState(false);
  const [isBookContextSaving, setIsBookContextSaving] = useState(false);
  const [isContextManagementOpen, setIsContextManagementOpen] = useState(false);
  const [annotationHistory, setAnnotationHistory] = useState<AnnotationRecord[]>([]);
  const [expandedAnnotationId, setExpandedAnnotationId] = useState<string | null>(null);
  const [deletingAnnotationId, setDeletingAnnotationId] = useState<string | null>(null);
  const selectedTextTrimmed = selectedText.trim();
  const visibleTextTrimmed = visibleText.trim();
  const hasContext = selectedTextTrimmed.length > 0 || visibleTextTrimmed.length > 0;

  useEffect(() => {
    setChatMessages([]);
    setChatInput("");
    setChatError(null);
    setMemoryProposal(null);
    setMemoryProposalError(null);
    setBookContextProposal(null);
    setBookContextProposalError(null);
    setExpandedAnnotationId(null);
    setDeletingAnnotationId(null);
  }, [bookId, annotationRefreshToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadAnnotationHistory(): Promise<void> {
      try {
        const items = await getAnnotationsByBookId(bookId);
        if (!cancelled) {
          setAnnotationHistory(items);
        }
      } catch {
        if (!cancelled) {
          setAnnotationHistory([]);
        }
      }
    }

    void loadAnnotationHistory();

    return () => {
      cancelled = true;
    };
  }, [bookId, annotationRefreshToken]);

  useEffect(() => {
    let cancelled = false;

    async function loadMemory(): Promise<void> {
      setIsMemoryLoading(true);
      setMemoryError(null);

      try {
        const snapshot = await requestMemorySnapshot(settings.userId);
        if (!cancelled) {
          setMemorySnapshot(snapshot);
        }
      } catch (cause) {
        if (!cancelled) {
          setMemoryError(cause instanceof Error ? cause.message : "MEMORY.mdの読み込みに失敗しました。");
          setMemorySnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setIsMemoryLoading(false);
        }
      }
    }

    void loadMemory();

    return () => {
      cancelled = true;
    };
  }, [settings.userId]);

  useEffect(() => {
    let cancelled = false;

    async function loadBookContext(): Promise<void> {
      setIsBookContextLoading(true);
      setBookContextError(null);
      setBookContextSnapshot(null);

      try {
        const snapshot = await requestBookContextSnapshot(bookId);
        if (!cancelled) {
          setBookContextSnapshot(snapshot);
        }
      } catch (cause) {
        if (!cancelled) {
          setBookContextError(cause instanceof Error ? cause.message : "BOOK_CONTEXT.mdの読み込みに失敗しました。");
          setBookContextSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setIsBookContextLoading(false);
        }
      }
    }

    void loadBookContext();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  async function explain(forceRefresh: boolean): Promise<void> {
    setIsOpen(true);
    setIsLoading(true);
    setError(null);

    try {
      if (!hasContext) {
        setResponse(null);
        setIsCached(false);
        setError("説明対象の本文をまだ取得できていません。ページの読み込み完了後にもう一度試してください。");
        return;
      }

      const request = buildReaderAnnotationRequest(props);
      const cacheKey = await createAnnotationCacheKey(request, {
        model: settings.model,
        memoryVersion: memorySnapshot?.version ?? "none",
        bookContextVersion: bookContextSnapshot?.version ?? "none"
      });

      if (!forceRefresh) {
        const cached = await getAnnotationByCacheKey(cacheKey);
        if (cached && !isFallbackResponse(cached.response)) {
          setResponse(cached.response);
          setIsCached(true);
          return;
        }
      }

      const result = await requestAnnotations(request);
      if (!isFallbackResponse(result)) {
        const now = new Date().toISOString();
        await saveAnnotation({
          id: cacheKey,
          cacheKey,
          bookId: props.bookId,
          location: props.location,
          locationKey: createLocationKey(props.bookId, props.location),
          selectedText: selectedTextTrimmed || undefined,
          skillId: props.settings.skillId,
          userId: props.settings.userId,
          model: props.settings.model,
          language: props.settings.language,
          detailLevel: props.settings.detailLevel,
          memoryVersion: memorySnapshot?.version ?? "none",
          bookContextVersion: bookContextSnapshot?.version ?? "none",
          readingPositionLabel,
          response: result,
          createdAt: now,
          updatedAt: now
        });
        setAnnotationHistory((current) => [
          {
            id: cacheKey,
            cacheKey,
            bookId: props.bookId,
            location: props.location,
            locationKey: createLocationKey(props.bookId, props.location),
            selectedText: selectedTextTrimmed || undefined,
            skillId: props.settings.skillId,
            userId: props.settings.userId,
            model: props.settings.model,
            language: props.settings.language,
            detailLevel: props.settings.detailLevel,
            memoryVersion: memorySnapshot?.version ?? "none",
            bookContextVersion: bookContextSnapshot?.version ?? "none",
            readingPositionLabel,
            response: result,
            createdAt: now,
            updatedAt: now
          },
          ...current.filter((item) => item.cacheKey !== cacheKey)
        ]);
        onAnnotationSaved();
      }
      setResponse(result);
      setIsCached(false);
      setSuggestedQuestions(result.followupQuestions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Agent APIの呼び出しに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }

  async function askQuestion(questionText?: string): Promise<void> {
    const question = (questionText ?? chatInput).trim();
    if (!question || !hasContext) {
      return;
    }

    setIsOpen(true);
    setIsChatLoading(true);
    setChatError(null);

    try {
      const conversation = chatMessages.slice(-6);
      const request = buildReaderAnnotationChatRequest(props, question, conversation);
      const result = await requestAnnotationChat(request);
      setChatMessages([
        ...conversation,
        {
          id: createClientId(),
          role: "user",
          content: question
        },
        {
          id: createClientId(),
          role: "assistant",
          content: result.answer
        }
      ]);
      setChatInput("");
      setSuggestedQuestions(result.followupQuestions);
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : "追質問の送信に失敗しました。");
    } finally {
      setIsChatLoading(false);
    }
  }

  async function proposeMemoryUpdate(): Promise<void> {
    if (!memorySnapshot) {
      return;
    }

    setIsMemoryProposing(true);
    setMemoryProposalError(null);

    try {
      const proposal = await requestMemoryProposal({
        userId: settings.userId,
        currentMemory: memorySnapshot.content || memorySnapshot.template,
        bookTitle,
        format,
        selectedText: selectedTextTrimmed || undefined,
        visibleText: visibleTextTrimmed,
        explanationSummary: response?.annotations.map((annotation) => `${annotation.title}: ${annotation.short}`).join("\n") ?? "",
        followupSummary: [
          ...suggestedQuestions,
          ...chatMessages.filter((message) => message.role === "assistant").map((message) => message.content)
        ]
          .slice(-6)
          .join("\n")
      });
      setMemoryProposal(proposal);
    } catch (cause) {
      setMemoryProposalError(cause instanceof Error ? cause.message : "メモリ提案の作成に失敗しました。");
    } finally {
      setIsMemoryProposing(false);
    }
  }

  async function approveMemoryProposal(): Promise<void> {
    if (!memoryProposal?.proposedMemory.trim()) {
      return;
    }

    setIsMemorySaving(true);
    setMemoryProposalError(null);

    try {
      const snapshot = await approveMemoryUpdate({
        userId: settings.userId,
        content: memoryProposal.proposedMemory
      });
      setMemorySnapshot(snapshot);
      setMemoryProposal(null);
    } catch (cause) {
      setMemoryProposalError(cause instanceof Error ? cause.message : "メモリ保存に失敗しました。");
    } finally {
      setIsMemorySaving(false);
    }
  }

  async function proposeBookContextUpdate(): Promise<void> {
    if (!bookContextSnapshot) {
      return;
    }

    setIsBookContextProposing(true);
    setBookContextProposalError(null);

    try {
      const proposal = await requestBookContextProposal({
        bookId,
        currentBookContext: bookContextSnapshot.content || bookContextSnapshot.template,
        bookTitle,
        format,
        selectedText: selectedTextTrimmed || undefined,
        visibleText: visibleTextTrimmed,
        explanationSummary: response?.annotations.map((annotation) => `${annotation.title}: ${annotation.short}`).join("\n") ?? "",
        followupSummary: [
          ...suggestedQuestions,
          ...chatMessages.filter((message) => message.role === "assistant").map((message) => message.content)
        ]
          .slice(-6)
          .join("\n")
      });
      setBookContextProposal(proposal);
    } catch (cause) {
      setBookContextProposalError(cause instanceof Error ? cause.message : "BOOK_CONTEXT提案の作成に失敗しました。");
    } finally {
      setIsBookContextProposing(false);
    }
  }

  async function approveBookContextProposal(): Promise<void> {
    if (!bookContextProposal?.proposedBookContext.trim()) {
      return;
    }

    setIsBookContextSaving(true);
    setBookContextProposalError(null);

    try {
      const snapshot = await approveBookContextUpdate({
        bookId,
        content: bookContextProposal.proposedBookContext
      });
      setBookContextSnapshot(snapshot);
      setBookContextProposal(null);
    } catch (cause) {
      setBookContextProposalError(cause instanceof Error ? cause.message : "BOOK_CONTEXT保存に失敗しました。");
    } finally {
      setIsBookContextSaving(false);
    }
  }

  async function handleDeleteAnnotation(annotationId: string): Promise<void> {
    setDeletingAnnotationId(annotationId);

    try {
      await deleteAnnotation(annotationId);
      setAnnotationHistory((current) => current.filter((item) => item.id !== annotationId));
      setExpandedAnnotationId((current) => (current === annotationId ? null : current));
      onAnnotationSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "注釈の削除に失敗しました。");
    } finally {
      setDeletingAnnotationId((current) => (current === annotationId ? null : current));
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-20 right-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-panel lg:hidden"
        aria-label="AI注釈を開く"
        onClick={() => setIsOpen(true)}
      >
        <Bot className="h-5 w-5" aria-hidden />
      </button>

      <aside
        className={[
          "fixed inset-x-0 bottom-0 z-40 flex h-[78dvh] max-h-[78dvh] flex-col overflow-hidden rounded-t-lg border border-line bg-white shadow-panel transition-transform lg:static lg:h-[calc(100dvh-5rem)] lg:max-h-none lg:w-96 lg:shrink-0 lg:translate-y-0 lg:rounded-none lg:border-y-0 lg:border-r-0",
          isOpen ? "translate-y-0" : "translate-y-[calc(100%+1rem)]"
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-accent" aria-hidden />
            <h2 className="text-sm font-semibold text-ink">AI Annotations</h2>
          </div>
          <button type="button" className="rounded-md p-2 text-slate-500 lg:hidden" aria-label="閉じる" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <button
            type="button"
            className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading || !hasContext}
            onClick={() => {
              void explain(false);
            }}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MessageSquareText className="h-4 w-4" aria-hidden />}
            {selectedTextTrimmed ? "選択範囲を説明" : hasContext ? "表示中の内容を説明" : "本文を読み込み中"}
          </button>

          {response ? (
            <button
              type="button"
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={() => {
                void explain(true);
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              再生成
            </button>
          ) : null}

          {selectedTextTrimmed ? (
            <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-800">選択中のテキスト</p>
              <p className="mt-1 text-sm text-blue-950">{selectedTextTrimmed}</p>
              <p className="mt-2 text-xs leading-5 text-blue-700">選択部分を優先して説明します。</p>
            </div>
          ) : null}

          {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

          {!response && !error ? <p className="text-sm leading-6 text-slate-600">ボタンを押すと、Agent APIが構造化JSONの注釈を返します。</p> : null}

          {response ? (
            <div className="space-y-4">
              {isCached ? <p className="rounded-md bg-slate-50 p-3 text-xs font-medium text-slate-600">保存済みの注釈を表示しています。</p> : null}

              {response.warnings.map((warning) => (
                <p key={warning} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {warning}
                </p>
              ))}

              {response.annotations.map((annotation) => (
                <article key={annotation.id} className="rounded-lg border border-line bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-ink">{annotation.title}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{annotation.kind}</span>
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{annotation.short}</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {annotation.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm font-medium text-slate-700">{annotation.whyRelevantHere}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {annotation.related.map((item) => (
                      <span key={item} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-lg border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">注釈履歴</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">この本で生成した注釈を逆引きできます。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{annotationHistory.length}</span>
            </div>

            <div className="mt-3 space-y-2">
              {annotationHistory.length === 0 ? <p className="text-sm leading-6 text-slate-500">まだ注釈がありません。</p> : null}
              {annotationHistory.map((record) => (
                <div key={record.id} className="rounded-md border border-line bg-white">
                  <div className="flex items-start justify-between gap-3 p-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setExpandedAnnotationId((current) => (current === record.id ? null : record.id));
                      }}
                    >
                      <p className="text-sm font-semibold text-ink">{record.response.annotations[0]?.title ?? "注釈"}</p>
                      <p
                        className={[
                          "mt-1 text-sm leading-6 text-slate-600",
                          expandedAnnotationId === record.id ? "whitespace-pre-wrap" : "line-clamp-2"
                        ].join(" ")}
                      >
                        {record.response.annotations[0]?.short ?? "注釈を保存しました。"}
                      </p>
                    </button>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                        {record.readingPositionLabel ?? formatAnnotationLocationLabel(record.location)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-ink transition hover:bg-slate-50"
                          onClick={() => {
                            setExpandedAnnotationId((current) => (current === record.id ? null : record.id));
                          }}
                        >
                          {expandedAnnotationId === record.id ? "閉じる" : "詳細"}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={deletingAnnotationId === record.id}
                          onClick={() => {
                            void handleDeleteAnnotation(record.id);
                          }}
                        >
                          {deletingAnnotationId === record.id ? "削除中..." : "削除"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {expandedAnnotationId === record.id ? (
                    <div className="border-t border-line p-3">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">詳細</p>
                          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                            {record.response.annotations[0]?.details.map((detail) => (
                              <li key={detail}>{detail}</li>
                            )) ?? null}
                          </ul>
                        </div>

                        {record.response.annotations[0]?.whyRelevantHere ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">この場所で重要な理由</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{record.response.annotations[0].whyRelevantHere}</p>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          {record.response.annotations[0]?.related.map((item) => (
                            <span key={item} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                              {item}
                            </span>
                          )) ?? null}
                        </div>

                        {isAnnotationLocation(record.location) ? (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-slate-50"
                            onClick={() => {
                              onNavigateLocation(record.location);
                              setIsOpen(true);
                            }}
                          >
                            この場所へ移動
                          </button>
                        ) : (
                          <p className="text-xs text-slate-500">保存時の位置情報がありません。</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {response ? (
            <>
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-semibold text-ink">Follow-up</h3>
                <div className="space-y-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="block w-full rounded-md bg-slate-50 p-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                      onClick={() => {
                        setChatInput(question);
                        void askQuestion(question);
                      }}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-white p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-ink">追質問</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">今見ている本文に限定して、短い質問を送れます。</p>
                </div>

                <div className="space-y-3">
                  {chatMessages.length === 0 ? (
                    <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">注釈に対して、短く聞き返せます。</p>
                  ) : (
                    chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={[
                          "max-w-[95%] rounded-md px-3 py-2 text-sm leading-6",
                          message.role === "user" ? "ml-auto bg-blue-50 text-blue-950" : "bg-slate-50 text-slate-700"
                        ].join(" ")}
                      >
                        {message.content}
                      </div>
                    ))
                  )}

                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void askQuestion();
                    }}
                  >
                    <textarea
                      className="min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-0 placeholder:text-slate-400 focus:border-blue-300"
                      value={chatInput}
                      placeholder="この部分をもっと短く言うと？"
                      onChange={(event) => {
                        setChatInput(event.currentTarget.value);
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isChatLoading || !chatInput.trim() || !hasContext}
                      >
                        {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                        送信
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isChatLoading || !chatInput.trim()}
                        onClick={() => {
                          setChatInput("");
                        }}
                      >
                        クリア
                      </button>
                    </div>
                  </form>

                  {chatError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{chatError}</p> : null}
                </div>
              </div>

              <div className="rounded-lg border border-line bg-white p-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => {
                    setIsContextManagementOpen((current) => !current);
                  }}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-ink">管理パネル</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">MEMORY.md と BOOK_CONTEXT.md の確認・更新はここにまとめます。</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {isContextManagementOpen ? "閉じる" : "開く"}
                  </span>
                </button>

                {isContextManagementOpen ? (
                  <div className="mt-4 space-y-4">
                    <section className="rounded-md border border-line bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-ink">MEMORY.md</h4>
                          <p className="mt-1 text-xs text-slate-500">ユーザーごとの永続メモリです。</p>
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isMemoryLoading || isMemoryProposing || !memorySnapshot}
                          onClick={() => {
                            void proposeMemoryUpdate();
                          }}
                        >
                          {isMemoryProposing ? "提案中..." : "更新案を作成"}
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {memoryError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{memoryError}</p> : null}
                        {memorySnapshot ? (
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                            {memorySnapshot.exists ? memorySnapshot.content : memorySnapshot.template}
                          </pre>
                        ) : null}
                        {isMemoryLoading ? <p className="text-sm text-slate-500">MEMORY.md を読み込み中...</p> : null}

                        {memoryProposal ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-800">更新案</p>
                            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-amber-950">
                              {memoryProposal.proposedMemory || "更新不要"}
                            </pre>
                            <p className="mt-2 text-xs text-amber-800">{memoryProposal.reason}</p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isMemorySaving || !memoryProposal.proposedMemory.trim()}
                                onClick={() => {
                                  void approveMemoryProposal();
                                }}
                              >
                                {isMemorySaving ? "保存中..." : "承認して保存"}
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink"
                                onClick={() => {
                                  setMemoryProposal(null);
                                }}
                              >
                                破棄
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {memoryProposalError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{memoryProposalError}</p> : null}
                      </div>
                    </section>

                    <section className="rounded-md border border-line bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-ink">BOOK_CONTEXT.md</h4>
                          <p className="mt-1 text-xs text-slate-500">本ごとの文脈と既出語です。</p>
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isBookContextLoading || isBookContextProposing || !bookContextSnapshot}
                          onClick={() => {
                            void proposeBookContextUpdate();
                          }}
                        >
                          {isBookContextProposing ? "提案中..." : "更新案を作成"}
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {bookContextError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{bookContextError}</p> : null}
                        {bookContextSnapshot ? (
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                            {bookContextSnapshot.exists ? bookContextSnapshot.content : bookContextSnapshot.template}
                          </pre>
                        ) : null}
                        {isBookContextLoading ? <p className="text-sm text-slate-500">BOOK_CONTEXT.md を読み込み中...</p> : null}

                        {bookContextProposal ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-800">更新案</p>
                            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-amber-950">
                              {bookContextProposal.proposedBookContext || "更新不要"}
                            </pre>
                            <p className="mt-2 text-xs text-amber-800">{bookContextProposal.reason}</p>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isBookContextSaving || !bookContextProposal.proposedBookContext.trim()}
                                onClick={() => {
                                  void approveBookContextProposal();
                                }}
                              >
                                {isBookContextSaving ? "保存中..." : "承認して保存"}
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink"
                                onClick={() => {
                                  setBookContextProposal(null);
                                }}
                              >
                                破棄
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {bookContextProposalError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{bookContextProposalError}</p> : null}
                      </div>
                    </section>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}

type SidebarRequestProps = AiSidebarProps;

function createLocationKey(bookId: string, location: SidebarRequestProps["location"]): string {
  if (location.type === "pdf_page") {
    return `book:${bookId}:pdf:page:${location.page ?? 1}`;
  }
  return `book:${bookId}:epub:cfi:${location.cfi ?? "unknown"}`;
}

function isFallbackResponse(response: AnnotationResponse): boolean {
  return response.annotations.some((annotation) => annotation.id === "fallback_annotation");
}

function createClientId(): string {
  return globalThis.crypto.randomUUID?.() ?? `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatAnnotationLocationLabel(location: ReaderLocation | undefined): string {
  if (!location) {
    return "不明";
  }

  switch (location.type) {
    case "pdf_page":
      return `P.${location.page}`;
    case "epub_cfi":
      return "P.?";
  }
}

function isAnnotationLocation(location: AnnotationRecord["location"] | undefined): location is AnnotationRecord["location"] {
  return Boolean(location && typeof location === "object" && "type" in location);
}
