"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, Trash2 } from "lucide-react";
import { BookImportButton } from "@/components/BookImportButton";
import { db, deleteBook } from "@/lib/db";
import type { StoredBook } from "@/lib/types";

export function BookshelfClient(): React.ReactElement {
  const [books, setBooks] = useState<StoredBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  useEffect(() => {
    async function loadBooks(): Promise<void> {
      const loaded = await db.books.orderBy("updatedAt").reverse().toArray();
      setBooks(loaded);
      setIsLoading(false);
    }

    void loadBooks();
  }, []);

  async function handleDelete(book: StoredBook): Promise<void> {
    const confirmed = window.confirm(`「${book.title}」を本棚から削除します。保存済みファイルと読書位置も削除されます。`);
    if (!confirmed) {
      return;
    }

    setDeletingBookId(book.id);
    try {
      await deleteBook(book);
      setBooks((currentBooks) => currentBooks.filter((currentBook) => currentBook.id !== book.id));
    } finally {
      setDeletingBookId(null);
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold text-ink">本棚</h1>
          <p className="mt-2 text-sm text-slate-600">PDFとEPUBをIndexedDBに保存して、ローカルで開きます。</p>
        </div>
        <BookImportButton />
      </div>

      {isLoading ? <p className="rounded-md border border-line bg-white p-4 text-sm text-slate-600">読み込み中...</p> : null}

      {!isLoading && books.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold text-ink">まだ本がありません</h2>
          <p className="mt-2 text-sm text-slate-600">PDFまたはEPUBを追加するとReaderで開けます。</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {books.map((book) => (
          <article key={book.id} className="rounded-lg border border-line bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-panel">
            <div className="mb-4 flex h-28 items-center justify-center rounded-md bg-slate-50">
              <FileText className="h-10 w-10 text-slate-400" aria-hidden />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-ink">{book.title}</h2>
                <p className="mt-1 truncate text-sm text-slate-500">{book.fileName}</p>
              </div>
              <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold uppercase text-blue-700">{book.format}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <Link href={`/reader/${book.id}`} className="inline-flex flex-1 items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
                開く
              </Link>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={deletingBookId === book.id}
                onClick={() => {
                  void handleDelete(book);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                削除
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
