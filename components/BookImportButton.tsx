"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { importBook } from "@/lib/db";

export function BookImportButton(): React.ReactElement {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleFiles(files: FileList | null): Promise<void> {
    const file = files?.item(0);
    if (!file) {
      return;
    }

    setError(null);
    setIsImporting(true);
    try {
      const book = await importBook(file);
      router.push(`/reader/${book.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ファイルの取り込みに失敗しました。");
    } finally {
      setIsImporting(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="application/pdf,application/epub+zip,.pdf,.epub"
        onChange={(event) => {
          void handleFiles(event.currentTarget.files);
        }}
      />
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" aria-hidden />
        {isImporting ? "取り込み中..." : "PDF/EPUBを追加"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
