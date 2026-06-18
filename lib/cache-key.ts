import type { AnnotationRequest } from "@/lib/types";
import { promptVersion } from "./agent/prompt-builder";

type CacheKeyContext = {
  model: string;
  memoryVersion: string;
  bookContextVersion: string;
};

export async function createAnnotationCacheKey(request: AnnotationRequest, context: CacheKeyContext): Promise<string> {
  const input = {
    bookId: request.bookId,
    format: request.format,
    location: request.location,
    visibleTextHash: await sha256(request.visibleText),
    selectedTextHash: await sha256(request.selectedText ?? ""),
    skillId: request.skillId,
    userId: request.userId,
    model: context.model,
    memoryVersion: context.memoryVersion,
    bookContextVersion: context.bookContextVersion,
    options: request.options,
    promptVersion
  };

  return sha256(JSON.stringify(input));
}

async function sha256(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return fallbackHash(value);
}

function fallbackHash(value: string): string {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hash1 ^= code;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 ^= code + index;
    hash2 = Math.imul(hash2, 0x01000193);
  }

  const part1 = (hash1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  return `${part1}${part2}`;
}
