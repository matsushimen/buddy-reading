"use client";

import Dexie, { type Table } from "dexie";
import type { AnnotationRecord, AppSettings, BookChunk, ReadingProgress, StoredBook, StoredBookFile } from "@/lib/types";

const defaultSettings: AppSettings = {
  userId: "default",
  skillId: "default",
  model: "server-env",
  language: "ja",
  detailLevel: "standard"
};

class ReaderDatabase extends Dexie {
  books!: Table<StoredBook, string>;
  files!: Table<StoredBookFile, string>;
  progress!: Table<ReadingProgress, string>;
  settings!: Table<{ key: string; value: AppSettings }, string>;
  annotations!: Table<AnnotationRecord, string>;
  bookChunks!: Table<BookChunk, string>;

  constructor() {
    super("buddy-reading");
    this.version(1).stores({
      books: "id, format, updatedAt",
      files: "key",
      progress: "bookId, updatedAt",
      settings: "key"
    });
    this.version(2).stores({
      books: "id, format, updatedAt",
      files: "key",
      progress: "bookId, updatedAt",
      settings: "key",
      annotations: "id, cacheKey, bookId, updatedAt"
    });
    this.version(3).stores({
      books: "id, format, updatedAt",
      files: "key",
      progress: "bookId, updatedAt",
      settings: "key",
      annotations: "id, cacheKey, bookId, updatedAt, locationKey"
    });
    this.version(4).stores({
      books: "id, format, updatedAt",
      files: "key",
      progress: "bookId, updatedAt",
      settings: "key",
      annotations: "id, cacheKey, bookId, updatedAt, locationKey",
      bookChunks: "id, bookId"
    });
  }
}

export const db = new ReaderDatabase();

export async function importBook(file: File): Promise<StoredBook> {
  const format = inferFormat(file);
  const now = new Date().toISOString();
  const id = createOpaqueId();
  const fileBlobKey = `file_${id}`;
  const title = file.name.replace(/\.(pdf|epub)$/i, "");
  const book: StoredBook = {
    id,
    title,
    format,
    fileName: file.name,
    fileBlobKey,
    createdAt: now,
    updatedAt: now
  };

  await db.transaction("rw", db.books, db.files, async () => {
    await db.files.put({ key: fileBlobKey, blob: file });
    await db.books.put(book);
  });

  return book;
}

export async function getSettings(): Promise<AppSettings> {
  const stored = await db.settings.get("default");
  return {
    ...defaultSettings,
    ...stored?.value
  };
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingProgress: ReadingProgress | null = null;

async function performSync(): Promise<void> {
  if (!pendingProgress) {
    return;
  }
  const progress = pendingProgress;
  pendingProgress = null;
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  try {
    const response = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(progress)
    });
    if (response.ok) {
      const serverProgress = (await response.json()) as ReadingProgress;
      if (new Date(serverProgress.updatedAt) > new Date(progress.updatedAt)) {
        await db.progress.put(serverProgress);
      }
    }
  } catch (err) {
    console.warn("Failed to sync progress to server:", err);
  }
}

export async function getProgress(bookId: string): Promise<ReadingProgress | null> {
  // Sync from server first
  try {
    const response = await fetch(`/api/progress?bookId=${bookId}`);
    if (response.ok) {
      const serverProgress = (await response.json()) as ReadingProgress | null;
      if (serverProgress) {
        const local = await db.progress.get(bookId);
        if (!local || new Date(serverProgress.updatedAt) > new Date(local.updatedAt)) {
          await db.progress.put(serverProgress);
          return serverProgress;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to fetch progress from server:", err);
  }

  return (await db.progress.get(bookId)) ?? null;
}

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  await db.progress.put(progress);

  // Debounce server sync by 1 second to avoid spamming the endpoint
  pendingProgress = progress;
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    void performSync();
  }, 1000);
}

export async function getBookFile(book: StoredBook): Promise<Blob | null> {
  const record = await db.files.get(book.fileBlobKey);
  if (record?.blob) {
    return record.blob;
  }

  // Fallback: Fetch from server-side files
  try {
    const response = await fetch(`/api/books/${book.id}/file`);
    if (response.ok) {
      const blob = await response.blob();
      // Cache locally in IndexedDB
      await db.files.put({ key: book.fileBlobKey, blob });
      return blob;
    }
  } catch (err) {
    console.warn("Failed to fetch book file from server:", err);
  }

  return null;
}

export async function deleteBook(book: StoredBook): Promise<void> {
  await db.transaction("rw", [db.books, db.files, db.progress, db.annotations, db.bookChunks], async () => {
    await db.books.delete(book.id);
    await db.files.delete(book.fileBlobKey);
    await db.progress.delete(book.id);
    await db.annotations.where("bookId").equals(book.id).delete();
    await db.bookChunks.where("bookId").equals(book.id).delete();
  });
}

export async function saveBookChunks(chunks: BookChunk[]): Promise<void> {
  await db.bookChunks.bulkPut(chunks);
}

export async function getBookChunks(bookId: string): Promise<BookChunk[]> {
  return await db.bookChunks.where("bookId").equals(bookId).toArray();
}

export async function getAnnotationByCacheKey(cacheKey: string): Promise<AnnotationRecord | null> {
  return (await db.annotations.where("cacheKey").equals(cacheKey).first()) ?? null;
}

export async function saveAnnotation(record: AnnotationRecord): Promise<void> {
  await db.annotations.put(record);
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  await db.annotations.delete(annotationId);
}

export async function getAnnotationsByBookId(bookId: string): Promise<AnnotationRecord[]> {
  const annotations = await db.annotations.where("bookId").equals(bookId).toArray();
  return annotations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function inferFormat(file: File): "pdf" | "epub" {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    return "pdf";
  }
  if (lowerName.endsWith(".epub") || file.type === "application/epub+zip") {
    return "epub";
  }
  throw new Error("PDF または EPUB ファイルを選択してください。");
}

function createOpaqueId(): string {
  const randomUuid = globalThis.crypto.randomUUID?.();
  if (randomUuid) {
    return randomUuid.replaceAll("-", "_");
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
