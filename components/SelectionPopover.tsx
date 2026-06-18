"use client";

import type { CSSProperties } from "react";
import { Loader2, X } from "lucide-react";
import type { AnnotationResponse } from "@/lib/types";

export type SelectionPopoverState = {
  text: string;
  rect: DOMRect | null;
};

type SelectionPopoverProps = {
  state: SelectionPopoverState | null;
  response: AnnotationResponse | null;
  error: string | null;
  isLoading: boolean;
  onExplain: () => void;
  onClose: () => void;
};

export function SelectionPopover(props: SelectionPopoverProps): React.ReactElement | null {
  const { state, response, error, isLoading, onClose, onExplain } = props;

  if (!state) {
    return null;
  }

  const style = getPopoverStyle(state.rect);

  return (
    <div className="fixed z-50 w-[min(20rem,calc(100vw-1.5rem))]" style={style}>
      <div className="rounded-lg border border-line bg-white p-3 shadow-panel">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">選択中のテキスト</p>
            <p className="mt-1 max-h-24 overflow-hidden text-sm leading-6 text-ink">{state.text}</p>
          </div>
          <button type="button" className="rounded-md p-1 text-slate-500" aria-label="閉じる" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={onExplain}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            AIで説明
          </button>
          <button type="button" className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-ink" onClick={onClose}>
            閉じる
          </button>
        </div>

        {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs leading-5 text-red-700">{error}</p> : null}

        {response ? (
          <div className="mt-3 space-y-2">
            <p className="rounded-md bg-slate-50 p-2 text-sm leading-6 text-slate-700">{response.annotations[0]?.short ?? "説明を生成しました。"}</p>
            {response.annotations[0]?.details?.length ? (
              <ul className="space-y-1 text-xs leading-5 text-slate-600">
                {response.annotations[0].details.slice(0, 3).map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs leading-5 text-slate-500">詳細はサイドバーの注釈履歴に残ります。</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getPopoverStyle(rect: DOMRect | null): CSSProperties {
  if (!rect) {
    return { left: "0.75rem", bottom: "1rem" };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const preferredLeft = Math.max(12, Math.min(rect.left, viewportWidth - 332));
  const preferredTop = rect.bottom + 12;
  const shouldFlipUp = preferredTop + 260 > viewportHeight && rect.top > 280;

  return shouldFlipUp
    ? {
        left: `${preferredLeft}px`,
        top: `${Math.max(12, rect.top - 272)}px`
      }
    : {
        left: `${preferredLeft}px`,
        top: `${Math.min(preferredTop, viewportHeight - 12)}px`
      };
}
