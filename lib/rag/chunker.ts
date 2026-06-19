/**
 * Simple text chunker for RAG document processing.
 * Splits input text into chunks of roughly `targetSize` characters,
 * attempting to preserve sentence or paragraph boundaries where possible.
 */
export function chunkText(text: string, targetSize = 600, overlap = 100): string[] {
  if (text.length <= targetSize) {
    const trimmed = text.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    let end = Math.min(index + targetSize, text.length);

    if (end < text.length) {
      // Find a sentence or paragraph boundary near the target end
      const boundaryOffset = findBoundaryNear(text, end, 60);
      if (boundaryOffset !== -1) {
        end = boundaryOffset;
      }
    }

    const chunk = text.slice(index, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    index = Math.max(index + 1, end - overlap);
  }

  return chunks;
}

function findBoundaryNear(text: string, index: number, searchRange: number): number {
  const boundaries = ["\n\n", "\r\n\r\n", "\n", "\r\n", "。", "！", "？", ".", "!", "?"];
  
  for (const boundary of boundaries) {
    const searchStart = Math.max(index - searchRange, 0);
    const searchEnd = Math.min(index + searchRange, text.length);
    const slice = text.slice(searchStart, searchEnd);
    
    // Find boundary in the slice
    const sliceIndex = slice.lastIndexOf(boundary);
    if (sliceIndex !== -1) {
      return searchStart + sliceIndex + boundary.length;
    }
  }
  
  return -1;
}
