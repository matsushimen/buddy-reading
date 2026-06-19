import { db } from "../db";
import type { BookChunk } from "../types";
import { chunkText } from "./chunker";

/**
 * Computes the cosine similarity between two numeric vectors.
 * General formula: (A . B) / (||A|| * ||B||)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Splits book text into chunks, generates embedding vectors via the server API,
 * and saves them into IndexedDB (db.bookChunks).
 */
export async function generateAndSaveBookEmbeddings(
  bookId: string,
  text: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const chunks = chunkText(text, 600, 100);
  if (chunks.length === 0) {
    return;
  }

  const batchSize = 25;
  const bookChunks: BookChunk[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ input: batch })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Embedding generation API failed: ${response.status} ${errText.slice(0, 300)}`);
    }

    const payload = (await response.json()) as { embeddings?: number[][] };
    const embeddings = payload.embeddings;
    if (!embeddings || embeddings.length !== batch.length) {
      throw new Error("API response did not return matching number of embeddings");
    }

    for (let j = 0; j < batch.length; j++) {
      bookChunks.push({
        id: `${bookId}_chunk_${i + j}`,
        bookId,
        text: batch[j],
        embedding: embeddings[j],
        createdAt: now
      });
    }

    if (onProgress) {
      onProgress(Math.min(100, Math.round(((i + batch.length) / chunks.length) * 100)));
    }
  }

  // Clear any existing chunks for this book first to avoid duplicates
  await db.bookChunks.where("bookId").equals(bookId).delete();
  await db.bookChunks.bulkPut(bookChunks);
}

/**
 * Searches the stored book chunks using a query string.
 * Generates an embedding for the query, retrieves all book chunks from IndexedDB,
 * calculates cosine similarities, and returns the top matches.
 */
export async function searchBookChunks(
  bookId: string,
  query: string,
  limit = 5
): Promise<Array<{ chunk: BookChunk; similarity: number }>> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  // 1. Generate embedding for query
  const response = await fetch("/api/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ input: trimmedQuery })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Query embedding generation API failed: ${response.status} ${errText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { embeddings?: number[][] };
  const embeddings = payload.embeddings;
  if (!embeddings || embeddings.length === 0 || !embeddings[0]) {
    throw new Error("API response did not return query embedding");
  }
  const queryVector = embeddings[0];

  // 2. Fetch all chunks for this book
  const chunks = await db.bookChunks.where("bookId").equals(bookId).toArray();
  if (chunks.length === 0) {
    return [];
  }

  // 3. Compute cosine similarities
  const results = chunks.map((chunk) => {
    const similarity = cosineSimilarity(queryVector, chunk.embedding);
    return { chunk, similarity };
  });

  // 4. Sort descending by similarity score
  return results
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit);
}
