"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Menu, Minimize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import ePub, { type Book, type Rendition } from "epubjs";
import { saveProgress } from "@/lib/db";
import { epubContentPadding } from "@/lib/epub-layout";
import {
  formatEpubPageLabel,
  isEpubGlobalPaginationReady,
  readEpubDisplayedPage,
  resolveEpubGlobalPage,
  resolveEpubStartTarget,
  type EpubSectionPageCount
} from "@/lib/epub-pagination";

const minFontSize = 90;
const maxFontSize = 130;
const fontSizeStep = 10;

type EpubViewerProps = {
  bookId: string;
  blob: Blob;
  initialCfi?: string;
  jumpRequest?: {
    location: { type: "pdf_page"; page: number } | { type: "epub_cfi"; cfi?: string };
    token: string;
  } | null;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onTextChange: (text: string) => void;
  onSelectionChange: (text: string, rect: DOMRect | null) => void;
  onLocationChange: (location: { type: "epub_cfi"; cfi?: string }) => void;
  onPositionChange: (position: { label: string; page?: number; total?: number }) => void;
};

type EpubSpineItemLike = {
  href: string;
  cfiBase?: string;
  title?: string;
  linear?: boolean;
  index?: number;
  properties?: string[];
  next?: string | null;
  prev?: string | null;
};

type EpubTocItem = {
  id?: string;
  href: string;
  label: string;
  subitems?: EpubTocItem[];
};

type EpubRenderedSectionLike = {
  href?: string;
  title?: string;
  properties?: string[];
  linear?: boolean;
  index?: number;
  next?: string | null;
  prev?: string | null;
};

type EpubRenderedViewLike = {
  document?: Document | null;
  iframe?: HTMLIFrameElement | null;
  section?: EpubRenderedSectionLike | null;
};

type EpubRelocatedLocationLike = {
  start?: {
    index?: number;
    href?: string;
    cfi?: string;
    location?: number;
    percentage?: number;
    displayed?: {
      page?: number;
      total?: number;
    };
  };
};

type EpubBookLike = Book & {
  loaded: {
    navigation: Promise<{
      toc: EpubTocItem[];
    }>;
  };
  spine: {
    spineItems: EpubSpineItemLike[];
    get(target?: string | number): EpubSpineItemLike | null;
    first(): EpubSpineItemLike | undefined;
  };
  navigation: {
    toc: EpubTocItem[];
  };
};

type EpubRenditionLike = Rendition & {
  currentLocation(): EpubRelocatedLocationLike;
  display(target?: string): Promise<unknown>;
  next(): Promise<unknown>;
  prev(): Promise<unknown>;
  resize(width?: number | string, height?: number | string, epubcfi?: string): void;
  location?: EpubRelocatedLocationLike;
};

type EpubRenderOptions = NonNullable<Parameters<Book["renderTo"]>[1]> & {
  gap?: number;
};

type EpubMeasuredPagination = {
  sectionPageCounts: EpubSectionPageCount[];
  expectedSectionIndexes: number[];
};

type EpubContentInset = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function EpubViewer({
  bookId,
  blob,
  initialCfi,
  jumpRequest,
  isFullscreen = false,
  onToggleFullscreen,
  onTextChange,
  onSelectionChange,
  onLocationChange,
  onPositionChange
}: EpubViewerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderViewportRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<EpubBookLike | null>(null);
  const renditionRef = useRef<EpubRenditionLike | null>(null);
  const currentSectionRef = useRef<EpubRenderedSectionLike | null>(null);
  const currentCfiRef = useRef<string | undefined>(undefined);
  const currentSectionPageRef = useRef<{ page?: number; total?: number; sectionIndex?: number }>({});
  const sectionPageCountsRef = useRef<EpubSectionPageCount[]>([]);
  const expectedSectionIndexesRef = useRef<number[]>([]);
  const paginationRunRef = useRef(0);
  const selectionCleanupRef = useRef<(() => void) | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const selectionFrameRef = useRef<number | null>(null);
  const fontSizeRef = useRef(90);
  const [locationLabel, setLocationLabel] = useState("EPUB");
  const [fontSize, setFontSize] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [tocItems, setTocItems] = useState<EpubTocItem[]>([]);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const syncLocation = useCallback(
    (location: EpubRelocatedLocationLike): void => {
      const cfi = location.start?.cfi;
      currentCfiRef.current = cfi;
      const displayedPage = readEpubDisplayedPage(location.start);
      const sectionIndex = location.start?.index ?? currentSectionRef.current?.index;
      currentSectionPageRef.current = { ...displayedPage, sectionIndex };
      const globalPage = isEpubGlobalPaginationReady(sectionPageCountsRef.current, expectedSectionIndexesRef.current)
        ? resolveEpubGlobalPage({
            sectionIndex,
            displayedPage,
            sectionPageCounts: sectionPageCountsRef.current,
            expectedSectionIndexes: expectedSectionIndexesRef.current
          })
        : {};
      const pageLabel = formatEpubPageLabel(globalPage.page, globalPage.total);
      const label = formatLocationLabel(currentSectionRef.current, pageLabel);
      setLocationLabel(label);
      onPositionChange({
        label: pageLabel,
        page: globalPage.page,
        total: globalPage.total
      });
      onLocationChange({ type: "epub_cfi", cfi });
      void saveProgress({
        bookId,
        format: "epub",
        epubCfi: cfi,
        updatedAt: new Date().toISOString()
      });
    },
    [bookId, onLocationChange, onPositionChange]
  );

  const displayTarget = useCallback(
    async (rendition: EpubRenditionLike, target: string): Promise<void> => {
      try {
        await rendition.display(target);
        syncLocation(rendition.currentLocation());
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : "EPUBの移動に失敗しました。");
      }
    },
    [syncLocation]
  );

  const displayInitialTarget = useCallback(
    async (rendition: EpubRenditionLike, startTarget?: string): Promise<void> => {
      if (startTarget) {
        try {
          await rendition.display(startTarget);
          return;
        } catch (cause: unknown) {
          console.warn("Failed to display initial EPUB target", startTarget, cause);
        }
      }

      await rendition.display();
    },
    []
  );

  const syncViewportSize = useCallback((): { width: number; height: number } | null => {
    const renderViewport = renderViewportRef.current;
    if (!renderViewport) {
      return null;
    }
    renderViewport.style.width = "";
    renderViewport.style.height = "";

    const rect = renderViewport.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    renderViewport.style.width = `${width}px`;
    renderViewport.style.height = `${height}px`;

    return { width, height };
  }, []);

  const measureGlobalPagination = useCallback((): void => {
    const renderViewport = renderViewportRef.current;
    const container = containerRef.current;
    if (!renderViewport || !container) {
      return;
    }

    const size = syncViewportSize();
    if (!size || size.width <= 0 || size.height <= 0) {
      return;
    }

    const book = bookRef.current;
    if (!book) {
      return;
    }

    const expectedSectionIndexes = getSpineSectionIndexes(book.spine.spineItems);
    if (expectedSectionIndexes.length === 0) {
      return;
    }

    const runId = paginationRunRef.current + 1;
    paginationRunRef.current = runId;
    expectedSectionIndexesRef.current = expectedSectionIndexes;

    const inset = readElementContentInset(container);
    const currentFontSize = fontSizeRef.current;

    void measureEpubBookPagination({
      blob,
      viewport: {
        width: size.width,
        height: size.height
      },
      containerInset: inset,
      fontSize: currentFontSize,
      isCurrentRun: () => paginationRunRef.current === runId
    })
      .then((pagination) => {
        if (!pagination || paginationRunRef.current !== runId) {
          return;
        }

        sectionPageCountsRef.current = pagination.sectionPageCounts;
        expectedSectionIndexesRef.current = pagination.expectedSectionIndexes;
        const currentLocation = renditionRef.current?.currentLocation();
        if (currentLocation) {
          syncLocation(currentLocation);
        }
      })
      .catch((cause: unknown) => {
        if (paginationRunRef.current === runId) {
          console.warn("Failed to measure EPUB pagination", cause);
        }
      });
  }, [blob, syncLocation, syncViewportSize]);

  useEffect(() => {
    const renderViewport = renderViewportRef.current;
    if (!renderViewport) {
      return;
    }

    const resizeRendition = (): void => {
      const rendition = renditionRef.current;
      if (!rendition) {
        return;
      }

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        const size = syncViewportSize();
        if (!size) {
          return;
        }
        const currentCfi = currentCfiRef.current;
        rendition.resize(size.width, size.height, currentCfi);
        measureGlobalPagination();
      });
    };

    const observer = new ResizeObserver(() => {
      resizeRendition();
    });
    observer.observe(renderViewport);
    window.addEventListener("resize", resizeRendition);

    return () => {
      window.removeEventListener("resize", resizeRendition);
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      observer.disconnect();
    };
  }, [measureGlobalPagination, syncViewportSize]);

  useEffect(() => {
    let cancelled = false;

    async function loadBook(): Promise<void> {
      const container = containerRef.current;
      const renderViewport = renderViewportRef.current;
      if (!container || !renderViewport) {
        return;
      }

      setError(null);
      currentSectionRef.current = null;
      currentCfiRef.current = undefined;
      currentSectionPageRef.current = {};
      sectionPageCountsRef.current = [];
      expectedSectionIndexesRef.current = [];
      paginationRunRef.current += 1;
      selectionCleanupRef.current?.();
      selectionCleanupRef.current = null;
      renderViewport.replaceChildren();
      syncViewportSize();
      const data = await blob.arrayBuffer();
      const book = ePub(undefined, { replacements: "blobUrl" });
      await book.open(data, "binary");
      await book.opened;
      await book.ready;
      const epubBook = book as EpubBookLike;

      if (cancelled) {
        book.destroy();
        return;
      }

      const rendition = book.renderTo(renderViewport, createEpubRenderOptions()) as EpubRenditionLike;

      applyEpubTheme(rendition, fontSizeRef.current);

      rendition.on("rendered", (section, view) => {
        currentSectionRef.current = section as EpubRenderedSectionLike | null;
        const renderedView = view as EpubRenderedViewLike;
        const renderedDocument = renderedView.document;
        const text = renderedDocument?.body?.innerText?.replace(/\s+/g, " ").trim() ?? "";
        onTextChange(text);

        selectionCleanupRef.current?.();
        if (!renderedDocument) {
          onSelectionChange("", null);
          return;
        }

        const iframe = getRenderedIframe(renderedView);
        const updateSelection = (): void => {
          const selection = renderedDocument.getSelection();
          if (!selection || selection.rangeCount === 0) {
            onSelectionChange("", null);
            return;
          }

          const selectedText = selection.toString().trim();
          if (!selectedText) {
            onSelectionChange("", null);
            return;
          }

          const range = selection.getRangeAt(0);
          onSelectionChange(selectedText, toAbsoluteRect(range.getBoundingClientRect(), iframe));
        };

        const scheduleSelectionUpdate = (): void => {
          if (selectionFrameRef.current !== null) {
            window.cancelAnimationFrame(selectionFrameRef.current);
          }
          selectionFrameRef.current = window.requestAnimationFrame(() => {
            selectionFrameRef.current = null;
            updateSelection();
          });
        };

        const selectWordAtPointer = (event: PointerEvent): void => {
          const selection = renderedDocument.getSelection();
          if (selection && selection.toString().trim().length > 0) {
            scheduleSelectionUpdate();
            return;
          }

          const rect = iframe?.getBoundingClientRect();
          if (!rect) {
            return;
          }

          const pointRange = rangeFromPoint(renderedDocument, event.clientX - rect.left, event.clientY - rect.top);
          if (!pointRange) {
            onSelectionChange("", null);
            return;
          }

          const wordRange = expandRangeToWord(pointRange);
          const selectedWord = wordRange.toString().trim();
          if (!selectedWord) {
            onSelectionChange("", null);
            return;
          }

          selection?.removeAllRanges();
          selection?.addRange(wordRange);
          onSelectionChange(selectedWord, toAbsoluteRect(wordRange.getBoundingClientRect(), iframe));
        };

        const handleIframeClick = (event: PointerEvent): void => {
          const target = event.target as HTMLElement;
          if (target.closest("a") || target.closest("button")) {
            return;
          }
          const selection = renderedDocument.getSelection();
          if (selection && selection.toString().trim().length > 0) {
            return;
          }
          if (window.innerWidth < 640) {
            setShowControls((current) => !current);
          }
        };

        renderedDocument.addEventListener("selectionchange", scheduleSelectionUpdate);
        renderedDocument.addEventListener("pointerup", selectWordAtPointer);
        renderedDocument.addEventListener("touchend", scheduleSelectionUpdate);
        renderedDocument.addEventListener("mouseup", scheduleSelectionUpdate);
        renderedDocument.addEventListener("click", selectWordAtPointer);
        renderedDocument.addEventListener("pointerup", handleIframeClick);
        selectionCleanupRef.current = () => {
          renderedDocument.removeEventListener("selectionchange", scheduleSelectionUpdate);
          renderedDocument.removeEventListener("pointerup", selectWordAtPointer);
          renderedDocument.removeEventListener("touchend", scheduleSelectionUpdate);
          renderedDocument.removeEventListener("mouseup", scheduleSelectionUpdate);
          renderedDocument.removeEventListener("click", selectWordAtPointer);
          renderedDocument.removeEventListener("pointerup", handleIframeClick);
        };
        updateSelection();
      });

      rendition.on("relocated", (location: EpubRelocatedLocationLike) => {
        syncLocation(location);
      });

      bookRef.current = epubBook;
      renditionRef.current = rendition;
      expectedSectionIndexesRef.current = getSpineSectionIndexes(epubBook.spine.spineItems);

      if (!cancelled) {
        void epubBook.loaded.navigation.then((navigation: { toc: EpubTocItem[] }) => {
          if (!cancelled) {
            setTocItems(navigation.toc ?? []);
          }
        });
        const startTarget = resolveEpubStartTarget({
          initialCfi,
          spineHrefs: epubBook.spine.spineItems.map((item) => item.href).filter(isNonEmptyString),
          tocHrefs: flattenTocHrefs(epubBook.navigation.toc),
          firstLinearHref: epubBook.spine.first()?.href
        });
        await displayInitialTarget(rendition, startTarget);
        measureGlobalPagination();
      }
    }

    void loadBook().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "EPUBの読み込みに失敗しました。");
    });

    return () => {
      cancelled = true;
      selectionCleanupRef.current?.();
      selectionCleanupRef.current = null;
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      if (selectionFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionFrameRef.current);
        selectionFrameRef.current = null;
      }
      paginationRunRef.current += 1;
      renditionRef.current?.destroy();
      renditionRef.current = null;
      bookRef.current?.destroy();
      bookRef.current = null;
    };
  }, [blob, bookId, displayInitialTarget, initialCfi, measureGlobalPagination, onLocationChange, onPositionChange, onSelectionChange, onTextChange, syncLocation, syncViewportSize]);

  useEffect(() => {
    fontSizeRef.current = fontSize;
    const rendition = renditionRef.current;
    if (!rendition) {
      return;
    }

    applyThemeFontSize(rendition, fontSize);
    const currentCfi = currentCfiRef.current;
    if (currentCfi) {
      void rendition
        .display(currentCfi)
        .then(() => {
          measureGlobalPagination();
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "EPUBの文字サイズ変更に失敗しました。");
        });
    } else {
      measureGlobalPagination();
    }
  }, [fontSize, measureGlobalPagination]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !jumpRequest || jumpRequest.location.type !== "epub_cfi") {
      return;
    }

    if (jumpRequest.location.cfi) {
      void displayTarget(rendition, jumpRequest.location.cfi);
    }
  }, [displayTarget, jumpRequest, jumpRequest?.token]);

  function goPrevious(): void {
    const rendition = renditionRef.current;
    if (!rendition) {
      return;
    }
    if (shouldDisplayAdjacentSpine(-1)) {
      return;
    }
    void navigateRendition(rendition, "prev");
  }

  function goNext(): void {
    const rendition = renditionRef.current;
    if (!rendition) {
      return;
    }
    if (shouldDisplayAdjacentSpine(1)) {
      return;
    }
    void navigateRendition(rendition, "next");
  }

  function jumpToTocHref(href: string): void {
    const rendition = renditionRef.current;
    if (!rendition) {
      return;
    }

    void (async () => {
      await displayTarget(rendition, href);
      setIsTocOpen(false);
    })();
  }

  async function navigateRendition(rendition: EpubRenditionLike, direction: "next" | "prev"): Promise<void> {
    try {
      if (direction === "next") {
        await rendition.next();
      } else {
        await rendition.prev();
      }
      syncLocation(rendition.currentLocation());
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "EPUBページの移動に失敗しました。");
    }
  }

  function shouldDisplayAdjacentSpine(direction: -1 | 1): boolean {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    const section = currentSectionRef.current;
    if (!book || !rendition || typeof section?.index !== "number") {
      return false;
    }

    const pagination = currentSectionPageRef.current;
    if (direction > 0 && typeof pagination.page === "number" && typeof pagination.total === "number" && pagination.page < pagination.total) {
      return false;
    }
    if (direction < 0 && typeof pagination.page === "number" && pagination.page > 1) {
      return false;
    }

    const adjacentSection = book.spine.get(section.index + direction);
    if (!adjacentSection?.href) {
      return false;
    }

    void displayTarget(rendition, adjacentSection.href);
    return true;
  }

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div
        className={[
          "z-30 border-b border-line bg-white px-3 py-2 transition-all duration-300",
          "absolute left-2 right-2 top-2 rounded-lg border bg-white/95 shadow-md sm:static sm:left-auto sm:right-auto sm:top-auto sm:rounded-none sm:border-0 sm:border-b sm:bg-white sm:shadow-none",
          showControls ? "translate-y-0 opacity-100" : "-translate-y-16 opacity-0 pointer-events-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto"
        ].join(" ")}
      >
        {/* Mobile Settings Top Bar */}
        <div className="flex items-center justify-between gap-2 sm:hidden">
          <div className="flex items-center gap-1 rounded-md border border-line bg-white p-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink"
              onClick={() => setFontSize((current) => Math.max(minFontSize, current - fontSizeStep))}
              aria-label="文字を小さくする"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="min-w-12 px-1 text-center text-xs font-semibold text-slate-600">{fontSize}%</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink"
              onClick={() => setFontSize((current) => Math.min(maxFontSize, current + fontSizeStep))}
              aria-label="文字を大きくする"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink"
              onClick={() => setFontSize(100)}
              aria-label="文字サイズを標準に戻す"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {onToggleFullscreen && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-line bg-white p-2 text-ink hover:bg-slate-50"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? "全画面表示を解除" : "全画面表示"}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-line bg-white p-2 text-ink hover:bg-slate-50"
              onClick={() => setShowControls(false)}
              aria-label="メニューを非表示"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Desktop Settings Top Bar */}
        <div className="hidden items-center justify-between gap-3 sm:flex">
          <div className="flex items-center gap-1 rounded-md border border-line bg-white p-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink"
              onClick={() => setFontSize((current) => Math.max(minFontSize, current - fontSizeStep))}
              aria-label="文字を小さくする"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="min-w-12 px-1 text-center text-xs font-semibold text-slate-600">{fontSize}%</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink"
              onClick={() => setFontSize((current) => Math.min(maxFontSize, current + fontSizeStep))}
              aria-label="文字を大きくする"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink"
              onClick={() => setFontSize(100)}
              aria-label="文字サイズを標準に戻す"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {onToggleFullscreen && (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-line bg-white p-2 text-ink hover:bg-slate-50"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? "全画面表示を解除" : "全画面表示"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <div
        className="min-w-0 min-h-0 flex-1 overflow-hidden bg-white"
        onClick={() => {
          if (window.innerWidth < 640) {
            setShowControls((current) => !current);
          }
        }}
      >
        <div className="flex h-full min-h-0 flex-col lg:flex-row">
          {isTocOpen ? (
            <aside
              id="epub-toc-panel"
              className={[
                "z-40 min-w-0 bg-slate-50 p-3 shadow-lg border-line transition-all duration-300",
                "absolute bottom-16 left-2 right-2 top-16 rounded-lg border lg:static lg:bottom-auto lg:left-auto lg:right-auto lg:top-auto lg:h-full lg:w-80 lg:flex-none lg:rounded-none lg:border-y-0 lg:border-r lg:shadow-none"
              ].join(" ")}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">目次</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-xs font-medium"
                  onClick={() => setIsTocOpen(false)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  閉じる
                </button>
              </div>
              <div className="max-h-56 overflow-auto pr-1 text-sm text-slate-700 lg:max-h-[calc(100dvh-12rem)]">
                {tocItems.length > 0 ? renderTocTree(tocItems, (href) => jumpToTocHref(href), 0) : <p className="text-slate-500">目次を読み込み中です。</p>}
              </div>
            </aside>
          ) : null}
          <div className={`min-w-0 min-h-0 flex-1 overflow-hidden ${isFullscreen ? "p-0" : "p-4"}`}>
            {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
            <div
              ref={containerRef}
              className={`box-border flex h-full min-h-[70dvh] w-full max-w-full overflow-hidden bg-white ${
                isFullscreen ? "rounded-none border-0" : "rounded-md border border-line"
              }`}
              style={{ padding: epubContentPadding.css }}
            >
              <div ref={renderViewportRef} className="h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-white" />
            </div>
          </div>
        </div>
      </div>

      <div
        className={[
          "z-30 border-t border-line bg-white px-3 py-2 transition-all duration-300",
          "absolute bottom-2 left-2 right-2 rounded-lg border bg-white/95 shadow-md sm:static sm:bottom-auto sm:left-auto sm:right-auto sm:rounded-none sm:border-0 sm:border-t sm:bg-white sm:shadow-none",
          showControls ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0 pointer-events-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto"
        ].join(" ")}
      >
        {/* Mobile Page Turn Bottom Bar */}
        <div className="flex flex-col gap-2 sm:hidden">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-line px-2 py-2 text-xs font-medium"
              onClick={goPrevious}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              前のページ
            </button>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-line px-2 py-2 text-xs font-medium"
              onClick={() => setIsTocOpen((current) => !current)}
              aria-expanded={isTocOpen}
              aria-controls="epub-toc-panel"
            >
              <Menu className="h-4 w-4" aria-hidden />
              目次
            </button>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-line px-2 py-2 text-xs font-medium"
              onClick={goNext}
            >
              次のページ
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="text-center">
            <p className="min-w-0 truncate text-xs text-slate-500">{locationLabel}</p>
          </div>
        </div>

        {/* Desktop Page Turn Bottom Bar */}
        <div className="hidden items-center justify-between gap-3 sm:flex">
          <div className="flex items-center gap-2">
            <button type="button" className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm font-medium" onClick={goPrevious}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              前のページ
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm font-medium"
              onClick={() => setIsTocOpen((current) => !current)}
              aria-expanded={isTocOpen}
              aria-controls="epub-toc-panel"
            >
              <Menu className="h-4 w-4" aria-hidden />
              目次
            </button>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <p className="text-sm text-slate-600">{locationLabel}</p>
          </div>
          <button type="button" className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm font-medium" onClick={goNext}>
            次のページ
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {!showControls && (
        <button
          type="button"
          className="absolute bottom-4 left-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/90 text-white shadow-panel transition-all duration-300 hover:bg-slate-700 sm:hidden"
          aria-label="メニューを表示"
          onClick={() => setShowControls(true)}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      )}
    </section>
  );
}

function getRenderedIframe(view: { iframe?: HTMLIFrameElement | null; document?: Document | null }): HTMLIFrameElement | null {
  return view.iframe ?? (view.document?.defaultView?.frameElement as HTMLIFrameElement | null) ?? null;
}

function toAbsoluteRect(rect: DOMRect, iframe: HTMLIFrameElement | null): DOMRect {
  if (!iframe) {
    return rect;
  }

  const iframeRect = iframe.getBoundingClientRect();
  return new DOMRect(rect.left + iframeRect.left, rect.top + iframeRect.top, rect.width, rect.height);
}

function rangeFromPoint(doc: Document, x: number, y: number): Range | null {
  const rangeFromPoint = doc.caretRangeFromPoint?.bind(doc);
  if (rangeFromPoint) {
    return rangeFromPoint(x, y);
  }

  const positionFromPoint = doc.caretPositionFromPoint?.bind(doc);
  if (positionFromPoint) {
    const position = positionFromPoint(x, y);
    if (!position) {
      return null;
    }
    const range = doc.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  return null;
}

function expandRangeToWord(range: Range): Range {
  const doc = range.startContainer.ownerDocument;
  if (!doc) {
    return range;
  }
  const selectionRange = doc.createRange();

  if (range.startContainer.nodeType !== Node.TEXT_NODE) {
    selectionRange.selectNodeContents(range.startContainer);
    return selectionRange;
  }

  const text = range.startContainer.textContent ?? "";
  const offset = Math.max(0, Math.min(range.startOffset, text.length));
  const bounds = findWordBounds(text, offset);

  if (!bounds) {
    selectionRange.setStart(range.startContainer, offset);
    selectionRange.setEnd(range.startContainer, Math.min(offset + 1, text.length));
    return selectionRange;
  }

  selectionRange.setStart(range.startContainer, bounds.start);
  selectionRange.setEnd(range.startContainer, bounds.end);
  return selectionRange;
}

function findWordBounds(text: string, offset: number): { start: number; end: number } | null {
  if (text.trim().length === 0) {
    return null;
  }

  let start = offset;
  let end = offset;

  while (start > 0 && !isBoundary(text[start - 1])) {
    start -= 1;
  }

  while (end < text.length && !isBoundary(text[end])) {
    end += 1;
  }

  if (start === end) {
    if (offset < text.length) {
      end = Math.min(text.length, offset + 1);
    } else if (offset > 0) {
      start = offset - 1;
    } else {
      return null;
    }
  }

  return { start, end };
}

function isBoundary(character: string | undefined): boolean {
  if (!character) {
    return true;
  }
  return /\s|[.,!?;:()[\]{}'"'"'"“”‘’、。・]/u.test(character);
}

function formatLocationLabel(section: EpubRenderedSectionLike | null, pageLabel: string): string {
  if (section?.linear === false) {
    return section.title?.trim() || "表紙";
  }

  if (pageLabel) {
    return pageLabel;
  }

  return "EPUB";
}

function createEpubRenderOptions(): EpubRenderOptions {
  return {
    width: "100%",
    height: "100%",
    flow: "paginated",
    spread: "none",
    gap: 32,
    method: "blobUrl",
    resizeOnOrientationChange: true
  };
}

function applyEpubTheme(rendition: Rendition, size: number): void {
  rendition.themes.default({
    "*, *::before, *::after": {
      "box-sizing": "border-box",
      "overflow-wrap": "break-word",
      "word-break": "break-word"
    },
    html: {
      margin: "0",
      padding: "0"
    },
    body: {
      color: "#172033",
      "font-family": "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      "line-height": "1.55",
      margin: "0",
      "overflow-wrap": "anywhere"
    },
    "ul, ol": {
      "max-width": "100%",
      margin: "0 0 1rem",
      "padding-inline-start": "1.5rem"
    },
    li: {
      "max-width": "100%"
    },
    "img, svg, video, canvas": {
      "max-width": "100% !important",
      width: "auto !important",
      height: "auto !important",
      "object-fit": "contain !important",
      display: "block",
      margin: "0 auto"
    },
    ".image": {
      "max-width": "100% !important",
      width: "auto !important",
      display: "block",
      margin: "1rem auto",
      overflow: "hidden",
      "break-inside": "avoid",
      "page-break-inside": "avoid"
    },
    ".image > img, .image > svg, .image > video, .image > canvas": {
      "max-width": "100% !important",
      width: "auto !important",
      height: "auto !important",
      "object-fit": "contain !important",
      display: "block",
      margin: "0 auto"
    },
    ".image > .caption": {
      "max-width": "100%",
      margin: "0.25rem 0 0",
      "text-align": "left"
    },
    figure: {
      "max-width": "100%",
      display: "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "flex-start",
      gap: "0.25rem",
      overflow: "hidden",
      "break-inside": "avoid",
      "page-break-inside": "avoid"
    },
    "figure > img, figure > svg, figure > video, figure > canvas": {
      "flex": "1 1 auto",
      "min-height": "0",
      width: "100%",
      "max-width": "100%",
      height: "auto",
      "object-fit": "contain"
    },
    figcaption: {
      "flex": "0 0 auto",
      "max-width": "100%",
      "text-align": "left"
    },
    "table, pre, code": {
      "max-width": "100%",
      "white-space": "pre-wrap",
      "overflow-wrap": "anywhere"
    }
  });
  applyThemeFontSize(rendition, size);
}

function applyThemeFontSize(rendition: Rendition, size: number): void {
  const themes = rendition.themes as Rendition["themes"] & {
    fontSize(size: string): void;
  };
  themes.fontSize(`${size}%`);
}

async function measureEpubBookPagination(input: {
  blob: Blob;
  viewport: { width: number; height: number };
  containerInset: EpubContentInset;
  fontSize: number;
  isCurrentRun: () => boolean;
}): Promise<EpubMeasuredPagination | null> {
  if (!input.isCurrentRun()) {
    return null;
  }

  const hiddenContainer = document.createElement("div");
  hiddenContainer.style.position = "fixed";
  hiddenContainer.style.left = "-10000px";
  hiddenContainer.style.top = "0";
  hiddenContainer.style.boxSizing = "border-box";
  hiddenContainer.style.width = `${input.viewport.width + input.containerInset.left + input.containerInset.right}px`;
  hiddenContainer.style.height = `${input.viewport.height + input.containerInset.top + input.containerInset.bottom}px`;
  hiddenContainer.style.padding = epubContentPadding.css;
  hiddenContainer.style.overflow = "hidden";
  hiddenContainer.style.opacity = "0";
  hiddenContainer.style.pointerEvents = "none";
  hiddenContainer.setAttribute("aria-hidden", "true");
  const hiddenViewport = document.createElement("div");
  hiddenViewport.style.width = "100%";
  hiddenViewport.style.height = "100%";
  hiddenViewport.style.overflow = "hidden";
  hiddenContainer.append(hiddenViewport);
  document.body.append(hiddenContainer);

  let measurementBook: Book | null = null;

  try {
    const data = await input.blob.arrayBuffer();
    if (!input.isCurrentRun()) {
      return null;
    }

    measurementBook = ePub(undefined, { replacements: "blobUrl" });
    await measurementBook.open(data, "binary");
    await measurementBook.opened;
    await measurementBook.ready;
    if (!input.isCurrentRun()) {
      return null;
    }

    const epubBook = measurementBook as EpubBookLike;
    const expectedSectionIndexes = getSpineSectionIndexes(epubBook.spine.spineItems);
    const rendition = measurementBook.renderTo(hiddenViewport, createEpubRenderOptions()) as EpubRenditionLike;
    applyEpubTheme(rendition, input.fontSize);

    const sectionPageCounts: EpubSectionPageCount[] = [];
    for (const item of epubBook.spine.spineItems) {
      if (!input.isCurrentRun()) {
        return null;
      }

      if (typeof item.index !== "number" || !Number.isInteger(item.index) || !item.href) {
        continue;
      }

      await rendition.display(item.href);
      await waitForAnimationFrame();
      await waitForAnimationFrame();
      const displayedPage = readEpubDisplayedPage(rendition.currentLocation().start);
      if (typeof displayedPage.total === "number") {
        sectionPageCounts.push({
          sectionIndex: item.index,
          pageCount: displayedPage.total
        });
      }
    }

    return {
      sectionPageCounts,
      expectedSectionIndexes
    };
  } finally {
    measurementBook?.destroy();
    hiddenContainer.remove();
  }
}

function getSpineSectionIndexes(items: EpubSpineItemLike[]): number[] {
  return items
    .map((item) => item.index)
    .filter((index): index is number => typeof index === "number" && Number.isInteger(index));
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function readElementContentInset(element: HTMLElement): EpubContentInset {
  const style = window.getComputedStyle(element);
  return {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0
  };
}

function flattenTocHrefs(items: EpubTocItem[]): string[] {
  return items.flatMap((item) => [item.href, ...(item.subitems ? flattenTocHrefs(item.subitems) : [])]).filter(isNonEmptyString);
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function renderTocTree(
  items: EpubTocItem[],
  onJump: (href: string) => void,
  depth: number
): React.ReactElement {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={`${item.href}-${item.label}`} className="min-w-0">
          <button
            type="button"
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-white hover:text-ink"
            style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
            onClick={() => onJump(item.href)}
          >
            <span className="block break-words leading-5">{item.label}</span>
          </button>
          {item.subitems && item.subitems.length > 0 ? renderTocTree(item.subitems, onJump, depth + 1) : null}
        </div>
      ))}
    </div>
  );
}
