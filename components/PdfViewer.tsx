"use client";

import React, { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Menu, X } from "lucide-react";
import { GlobalWorkerOptions, TextLayer, getDocument, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import { saveProgress } from "@/lib/db";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

const pdfAssetBaseUrl = "/pdfjs/";
const maxOutputScale = 2;

type PdfViewerProps = {
  bookId: string;
  blob: Blob;
  initialPage: number;
  jumpRequest?: {
    location: { type: "pdf_page"; page: number } | { type: "epub_cfi"; cfi?: string };
    token: string;
  } | null;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onTextChange: (text: string) => void;
  onSelectionChange: (text: string, rect: DOMRect | null) => void;
  onLocationChange: (location: { type: "pdf_page"; page: number }) => void;
  onPositionChange: (position: { label: string; page: number; total: number }) => void;
};

export function PdfViewer({
  bookId,
  blob,
  initialPage,
  jumpRequest,
  isFullscreen = false,
  onToggleFullscreen,
  onTextChange,
  onSelectionChange,
  onLocationChange,
  onPositionChange
}: PdfViewerProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const textLayerTaskRef = useRef<TextLayer | null>(null);
  const selectionCleanupRef = useRef<(() => void) | null>(null);
  const selectionFrameRef = useRef<number | null>(null);
  const renderGenerationRef = useRef(0);
  const [pageNumber, setPageNumber] = useState(Math.max(1, initialPage));
  const [pageCount, setPageCount] = useState(0);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let isHorizontalSwipe = false;

    const handleTouchStart = (e: TouchEvent): void => {
      if (e.touches.length > 0) {
        touchStartXRef.current = e.touches[0].screenX;
        touchStartYRef.current = e.touches[0].screenY;
        isHorizontalSwipe = false;
      }
    };

    const handleTouchMove = (e: TouchEvent): void => {
      if (touchStartXRef.current === null || touchStartYRef.current === null) {
        return;
      }
      if (e.touches.length > 0) {
        const currentX = e.touches[0].screenX;
        const currentY = e.touches[0].screenY;
        const diffX = currentX - touchStartXRef.current;
        const diffY = currentY - touchStartYRef.current;

        if (!isHorizontalSwipe && Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
          isHorizontalSwipe = true;
        }

        if (isHorizontalSwipe) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent): void => {
      if (touchStartXRef.current === null || touchStartYRef.current === null) {
        return;
      }
      if (e.changedTouches.length > 0) {
        const endX = e.changedTouches[0].screenX;
        const endY = e.changedTouches[0].screenY;
        const diffX = endX - touchStartXRef.current;
        const diffY = endY - touchStartYRef.current;

        if (Math.abs(diffY) > 50) {
          touchStartXRef.current = null;
          touchStartYRef.current = null;
          isHorizontalSwipe = false;
          return;
        }

        if (diffX < -50) {
          if (pageCount > 0 && pageNumber < pageCount) {
            setPageNumber((current) => current + 1);
          }
        } else if (diffX > 50) {
          if (pageNumber > 1) {
            setPageNumber((current) => current - 1);
          }
        }
      }
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      isHorizontalSwipe = false;
    };

    const handleTouchCancel = (): void => {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      isHorizontalSwipe = false;
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [pageCount, pageNumber]);
  const [renderWidth, setRenderWidth] = useState(0);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateWidth = (): void => {
      setRenderWidth(container.clientWidth);
    };
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    updateWidth();

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument(): Promise<void> {
      setError(null);
      const data = new Uint8Array(await blob.arrayBuffer());
      const loadingTask = getDocument({
        data,
        cMapUrl: `${pdfAssetBaseUrl}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${pdfAssetBaseUrl}standard_fonts/`
      });
      const pdf = await loadingTask.promise;

      if (cancelled) {
        await pdf.destroy();
        return;
      }

      documentRef.current = pdf;
      setPageCount(pdf.numPages);
      setPageNumber(Math.min(Math.max(1, initialPage), pdf.numPages));
      setDocumentVersion((current) => current + 1);
    }

    void loadDocument().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "PDFの読み込みに失敗しました。");
    });

    return () => {
      cancelled = true;
      renderGenerationRef.current += 1;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      textLayerTaskRef.current?.cancel();
      textLayerTaskRef.current = null;
      selectionCleanupRef.current?.();
      selectionCleanupRef.current = null;
      if (selectionFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionFrameRef.current);
        selectionFrameRef.current = null;
      }
      const current = documentRef.current;
      documentRef.current = null;
      if (current) {
        void current.destroy();
      }
    };
  }, [blob, initialPage]);

  useEffect(() => {
    let cancelled = false;
    const generation = renderGenerationRef.current + 1;
    renderGenerationRef.current = generation;
    const textLayerElement = textLayerRef.current;

    async function renderPage(): Promise<void> {
      const pdf = documentRef.current;
      const canvas = canvasRef.current;
      const textLayerContainer = textLayerElement;
      if (!pdf || !canvas || !textLayerContainer) {
        return;
      }

      const previousTask = renderTaskRef.current;
      if (previousTask) {
        previousTask.cancel();
        await previousTask.promise.catch(() => undefined);
        if (cancelled || generation !== renderGenerationRef.current) {
          return;
        }
      }

      const page = await pdf.getPage(pageNumber);
      if (cancelled || generation !== renderGenerationRef.current) {
        return;
      }

      const containerWidth = Math.min(Math.max(renderWidth - 32, 320), 860);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.max(0.7, Math.min(1.5, containerWidth / baseViewport.width));
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvasを初期化できませんでした。");
      }

      const outputScale = Math.min(window.devicePixelRatio || 1, maxOutputScale);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      textLayerContainer.style.width = `${Math.floor(viewport.width)}px`;
      textLayerContainer.style.height = `${Math.floor(viewport.height)}px`;

      const renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
      });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
      } finally {
        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }
      }

      if (cancelled || generation !== renderGenerationRef.current) {
        return;
      }

      textLayerContainer.replaceChildren();
      const textContent = await page.getTextContent();
      if (cancelled || generation !== renderGenerationRef.current) {
        return;
      }

      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerContainer,
        viewport
      });
      textLayerTaskRef.current?.cancel();
      textLayerTaskRef.current = textLayer;
      await textLayer.render();

      if (cancelled || generation !== renderGenerationRef.current) {
        return;
      }

      const text = textContent.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!cancelled) {
        onTextChange(text);
        onLocationChange({ type: "pdf_page", page: pageNumber });
        onPositionChange({
          label: `P.${pageNumber} / ${pageCount || pdf.numPages}`,
          page: pageNumber,
          total: pageCount || pdf.numPages
        });
        attachPdfSelectionHandlers(textLayerContainer, onSelectionChange, selectionCleanupRef, selectionFrameRef);
        await saveProgress({
          bookId,
          format: "pdf",
          pdfPage: pageNumber,
          updatedAt: new Date().toISOString()
        });
      }
    }

    void renderPage().catch((cause: unknown) => {
      if (isRenderCancelled(cause)) {
        return;
      }
      setError(cause instanceof Error ? cause.message : "PDFページの表示に失敗しました。");
    });

    return () => {
      cancelled = true;
      if (generation === renderGenerationRef.current) {
        renderGenerationRef.current += 1;
      }
      renderTaskRef.current?.cancel();
      textLayerTaskRef.current?.cancel();
      selectionCleanupRef.current?.();
      selectionCleanupRef.current = null;
      if (selectionFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionFrameRef.current);
        selectionFrameRef.current = null;
      }
    };
  }, [bookId, documentVersion, onLocationChange, onPositionChange, onSelectionChange, onTextChange, pageNumber, pageCount, renderWidth]);

  useEffect(() => {
    if (!jumpRequest || jumpRequest.location.type !== "pdf_page") {
      return;
    }

    const nextPage = Math.max(1, jumpRequest.location.page ?? 1);
    setPageNumber((current) => (current === nextPage ? current : nextPage));
  }, [jumpRequest, jumpRequest?.token]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={[
          "z-30 border-b border-line bg-white px-3 py-2 transition-all duration-300",
          "absolute left-2 right-2 top-2 rounded-lg border bg-white/95 shadow-md sm:static sm:left-auto sm:right-auto sm:top-auto sm:rounded-none sm:border-0 sm:border-b sm:bg-white sm:shadow-none",
          showControls ? "translate-y-0 opacity-100" : "-translate-y-16 opacity-0 pointer-events-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto"
        ].join(" ")}
      >
        <div className="flex items-center justify-end gap-2">
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
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-line bg-white p-2 text-ink hover:bg-slate-50 sm:hidden"
            onClick={() => setShowControls(false)}
            aria-label="メニューを非表示"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`min-h-0 flex-1 overflow-auto bg-slate-100 touch-pan-y ${isFullscreen ? "p-0" : "p-4"}`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button")) {
            return;
          }
          const selection = window.getSelection();
          if (selection && selection.toString().trim().length > 0) {
            return;
          }
          if (window.innerWidth < 640) {
            setShowControls((current) => !current);
          }
        }}
      >
        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        <div className="mx-auto w-fit rounded-md bg-white p-2 shadow-sm my-4">
          <div className="relative">
            <canvas ref={canvasRef} aria-label="PDF page canvas" />
            <div ref={textLayerRef} className="textLayer absolute inset-0" />
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
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm font-medium disabled:opacity-40"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            前
          </button>
          <p className="text-sm text-slate-600 font-medium">
            {pageNumber} / {pageCount || "-"}
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm font-medium disabled:opacity-40"
            disabled={pageCount === 0 || pageNumber >= pageCount}
            onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
          >
            次
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

function isRenderCancelled(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "RenderingCancelledException";
}

function attachPdfSelectionHandlers(
  container: HTMLDivElement,
  onSelectionChange: (text: string, rect: DOMRect | null) => void,
  selectionCleanupRef: MutableRefObject<(() => void) | null>,
  selectionFrameRef: MutableRefObject<number | null>
): void {
  const doc = container.ownerDocument;

  selectionCleanupRef.current?.();

  const updateSelection = (): void => {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) {
      onSelectionChange("", null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      onSelectionChange("", null);
      return;
    }

    onSelectionChange(text, selection.getRangeAt(0).getBoundingClientRect());
  };

  const scheduleSelectionUpdate = (): void => {
    if (selectionFrameRef.current !== null) {
      container.ownerDocument.defaultView?.cancelAnimationFrame(selectionFrameRef.current);
    }
    const view = container.ownerDocument.defaultView;
    if (!view) {
      updateSelection();
      return;
    }
    selectionFrameRef.current = view.requestAnimationFrame(() => {
      selectionFrameRef.current = null;
      updateSelection();
    });
  };

  const listeners: Array<[keyof DocumentEventMap, EventListener]> = [
    ["selectionchange", scheduleSelectionUpdate],
    ["pointerup", scheduleSelectionUpdate],
    ["touchend", scheduleSelectionUpdate],
    ["mouseup", scheduleSelectionUpdate],
    ["click", scheduleSelectionUpdate]
  ];

  for (const [eventName, listener] of listeners) {
    doc.addEventListener(eventName, listener);
  }

  selectionCleanupRef.current = () => {
    for (const [eventName, listener] of listeners) {
      doc.removeEventListener(eventName, listener);
    }
    if (selectionFrameRef.current !== null) {
      container.ownerDocument.defaultView?.cancelAnimationFrame(selectionFrameRef.current);
      selectionFrameRef.current = null;
    }
  };

  updateSelection();
}
