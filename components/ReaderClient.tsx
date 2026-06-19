"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { AiSidebar } from "@/components/AiSidebar";
import { EpubViewer } from "@/components/EpubViewer";
import { SelectionPopover, type SelectionPopoverState } from "@/components/SelectionPopover";
import { PdfViewer } from "@/components/PdfViewer";
import { requestAnnotations } from "@/lib/agent-client";
import { buildReaderAnnotationRequest } from "@/lib/annotation-request";
import { db, getBookFile, getProgress, getSettings, saveAnnotation } from "@/lib/db";
import { indexBookIfMissing } from "@/lib/rag/indexer";
import type { AnnotationResponse, AppSettings, ReadingProgress, StoredBook } from "@/lib/types";

type ReaderClientProps = {
  bookId: string;
};

type ReaderLocation = { type: "pdf_page"; page: number } | { type: "epub_cfi"; cfi?: string };
type ReaderJumpRequest = {
  location: ReaderLocation;
  token: string;
};

export function ReaderClient({ bookId }: ReaderClientProps): React.ReactElement {
  const [book, setBook] = useState<StoredBook | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [visibleText, setVisibleText] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [selectionState, setSelectionState] = useState<SelectionPopoverState | null>(null);
  const [selectionResponse, setSelectionResponse] = useState<AnnotationResponse | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isSelectionLoading, setIsSelectionLoading] = useState(false);
  const [annotationRefreshToken, setAnnotationRefreshToken] = useState(0);
  const [jumpRequest, setJumpRequest] = useState<ReaderJumpRequest | null>(null);
  const [location, setLocation] = useState<ReaderLocation>({ type: "pdf_page", page: 1 });
  const [readingPositionLabel, setReadingPositionLabel] = useState<string>("P.1");
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<number | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    void (async () => {
      if (!document.fullscreenElement) {
        try {
          if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          } else {
            setIsFullscreen((prev) => !prev);
          }
        } catch {
          setIsFullscreen((prev) => !prev);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    })();
  }, []);

  useEffect(() => {
    async function loadBook(): Promise<void> {
      const found = await db.books.get(bookId);
      if (!found) {
        setError("本が見つかりません。");
        setIsLoading(false);
        return;
      }

      const file = await getBookFile(found);
      if (!file) {
        setError("本のファイルが見つかりません。");
        setIsLoading(false);
        return;
      }

      const [savedProgress, savedSettings] = await Promise.all([getProgress(found.id), getSettings()]);
      setBook(found);
      setBlob(file);
      setProgress(savedProgress);
      setSettings(savedSettings);
      setLocation(
        found.format === "pdf"
          ? { type: "pdf_page", page: savedProgress?.pdfPage ?? 1 }
          : { type: "epub_cfi" }
      );
      setReadingPositionLabel(found.format === "pdf" ? `P.${savedProgress?.pdfPage ?? 1}` : "P.1");
      setIsLoading(false);

      // Trigger indexing in the background
      void indexBookIfMissing(found.id, found.title, found.format, file, (progress) => {
        setIndexingProgress(progress);
      }).catch((cause: unknown) => {
        console.warn("Index creation failed for book", found.title, cause);
      });
    }

    void loadBook().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Readerの初期化に失敗しました。");
      setIsLoading(false);
    });
  }, [bookId]);

  const handleTextChange = useCallback((text: string) => {
    setVisibleText(text);
  }, []);

  const handleSelectionChange = useCallback((text: string, rect: DOMRect | null) => {
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      setSelectedText(trimmed);
      setSelectionState({ text: trimmed, rect });
      setSelectionResponse(null);
      setSelectionError(null);
    }
  }, []);

  useEffect(() => {
    setSelectedText("");
    setSelectionState(null);
    setSelectionResponse(null);
    setSelectionError(null);
  }, [bookId]);

  const handlePdfLocationChange = useCallback((nextLocation: { type: "pdf_page"; page: number }) => {
    setLocation(nextLocation);
  }, []);

  const handlePdfPositionChange = useCallback((position: { label: string }) => {
    setReadingPositionLabel(position.label);
  }, []);

  const handleEpubLocationChange = useCallback((nextLocation: { type: "epub_cfi"; cfi?: string }) => {
    setLocation(nextLocation);
  }, []);

  const handleEpubPositionChange = useCallback((position: { label: string }) => {
    if (position.label.trim().length > 0) {
      setReadingPositionLabel(position.label);
    }
  }, []);

  const handleNavigateLocation = useCallback((nextLocation: ReaderLocation) => {
    setLocation(nextLocation);
    setJumpRequest({
      location: nextLocation,
      token: globalThis.crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`
    });
  }, []);

  if (isLoading) {
    return <ReaderShell title="読み込み中..." isFullscreen={isFullscreen} />;
  }

  if (error || !book || !blob || !settings) {
    return (
      <ReaderShell title="Reader" isFullscreen={isFullscreen}>
        <div className="flex min-h-[60dvh] items-center justify-center p-4">
          <div className="rounded-lg border border-line bg-white p-6 text-center shadow-sm">
            <FileQuestion className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
            <p className="mt-3 text-sm text-slate-600">{error ?? "本を開けませんでした。"}</p>
            <Link href="/bookshelf" className="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
              本棚へ戻る
            </Link>
          </div>
        </div>
      </ReaderShell>
    );
  }

  return (
    <ReaderShell title={book.title} format={book.format} isFullscreen={isFullscreen}>
      <div className={`flex ${isFullscreen ? "h-dvh" : "h-[calc(100dvh-4rem)]"} min-h-0 flex-col lg:flex-row`}>
        {book.format === "pdf" ? (
          <PdfViewer
            bookId={book.id}
            blob={blob}
            initialPage={progress?.pdfPage ?? 1}
            jumpRequest={jumpRequest}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onTextChange={handleTextChange}
            onSelectionChange={handleSelectionChange}
            onLocationChange={handlePdfLocationChange}
            onPositionChange={handlePdfPositionChange}
          />
        ) : (
          <EpubViewer
            bookId={book.id}
            blob={blob}
            initialCfi={progress?.epubCfi}
            jumpRequest={jumpRequest}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onTextChange={handleTextChange}
            onSelectionChange={handleSelectionChange}
            onLocationChange={handleEpubLocationChange}
            onPositionChange={handleEpubPositionChange}
          />
        )}
        <AiSidebar
          bookId={book.id}
          bookTitle={book.title}
          format={book.format}
          location={location}
          visibleText={visibleText}
          selectedText={selectedText}
          settings={settings}
          readingPositionLabel={readingPositionLabel}
          annotationRefreshToken={annotationRefreshToken}
          onAnnotationSaved={() => {
            setAnnotationRefreshToken((current) => current + 1);
          }}
          onNavigateLocation={handleNavigateLocation}
          indexingProgress={indexingProgress}
        />
        <SelectionPopover
          state={selectionState}
          response={selectionResponse}
          error={selectionError}
          isLoading={isSelectionLoading}
          onClose={() => {
            setSelectionState(null);
            setSelectedText("");
            setSelectionResponse(null);
            setSelectionError(null);
          }}
          onExplain={() => {
            if (!book || !settings || !selectionState?.text.trim()) {
              return;
            }

            setIsSelectionLoading(true);
            setSelectionError(null);
            const annotationId = createSelectionAnnotationId();
            const request = buildReaderAnnotationRequest({
              bookId: book.id,
              bookTitle: book.title,
              format: book.format,
              location,
              visibleText,
              selectedText: selectionState.text,
              settings
            });

            void requestAnnotations(request)
              .then(async (response) => {
                setSelectionResponse(response);
                const now = new Date().toISOString();
                await saveAnnotation({
                  id: annotationId,
                  cacheKey: annotationId,
                  bookId: book.id,
                  location,
                  locationKey: createLocationKey(book.id, location),
                  selectedText: selectionState.text,
                  skillId: settings.skillId,
                  userId: settings.userId,
                  model: settings.model,
                  language: settings.language,
                  detailLevel: settings.detailLevel,
                  memoryVersion: "none",
                  bookContextVersion: "none",
                  readingPositionLabel,
                  response,
                  createdAt: now,
                  updatedAt: now
                });
                setAnnotationRefreshToken((current) => current + 1);
              })
              .catch((cause: unknown) => {
                setSelectionError(cause instanceof Error ? cause.message : "選択語の説明に失敗しました。");
              })
              .finally(() => {
                setIsSelectionLoading(false);
              });
          }}
        />
      </div>
    </ReaderShell>
  );
}

function createSelectionAnnotationId(): string {
  return globalThis.crypto.randomUUID?.() ?? `selection_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createLocationKey(bookId: string, location: ReaderLocation): string {
  if (location.type === "pdf_page") {
    return `book:${bookId}:pdf:page:${location.page ?? 1}`;
  }
  return `book:${bookId}:epub:cfi:${location.cfi ?? "unknown"}`;
}

function ReaderShell({
  title,
  format,
  isFullscreen,
  children
}: Readonly<{
  title: string;
  format?: string;
  isFullscreen: boolean;
  children?: React.ReactNode;
}>): React.ReactElement {
  return (
    <main className="min-h-dvh bg-paper">
      {!isFullscreen && (
        <header className="flex h-16 items-center justify-between gap-3 border-b border-line bg-white px-4">
          <div className="min-w-0">
            <Link href="/bookshelf" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              本棚
            </Link>
            <h1 className="truncate text-sm font-semibold text-ink sm:text-base">{title}</h1>
          </div>
          {format ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold uppercase text-blue-700">{format}</span> : null}
        </header>
      )}
      {children}
    </main>
  );
}
