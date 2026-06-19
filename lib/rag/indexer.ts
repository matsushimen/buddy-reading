/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import ePub from "epubjs";
import { getDocument } from "pdfjs-dist";
import { getBookChunks } from "../db";
import { generateAndSaveBookEmbeddings } from "./vector-search";

/**
 * Checks if a book has already been indexed. If not, it parses the PDF/EPUB,
 * extracts all readable text, and calls the embedding indexer.
 */
export async function indexBookIfMissing(
  bookId: string,
  title: string,
  format: "pdf" | "epub",
  blob: Blob,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    const existing = await getBookChunks(bookId);
    if (existing.length > 0) {
      console.log(`Book "${title}" is already indexed (${existing.length} chunks).`);
      if (onProgress) {
        onProgress(100);
      }
      return;
    }

    console.log(`Starting local indexing for book "${title}"...`);
    let fullText = "";
    const arrayBuffer = await blob.arrayBuffer();

    if (format === "pdf") {
      const loadingTask = getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/"
      });
      const pdf = await loadingTask.promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: unknown) => {
            if (item && typeof item === "object" && "str" in item) {
              return (item as { str: string }).str;
            }
            return "";
          })
          .join(" ");
        fullText += pageText + "\n";
      }
      await pdf.destroy();
    } else {
      const book = ePub(undefined);
      await book.open(arrayBuffer, "binary");
      await book.opened;

      const spineBook = book as any;
      const spine = spineBook.spine;
      const spineItems = spine?.spineItems ?? [];

      for (const item of spineItems) {
        if (item.href) {
          const section = spineBook.spine.get(item.href);
          if (section) {
            const doc = await section.load(spineBook.load.bind(spineBook));
            if (doc && doc.body) {
              const text = doc.body.innerText || doc.body.textContent || "";
              fullText += text + "\n";
            }
          }
        }
      }
      book.destroy();
    }

    const cleanedText = fullText.replace(/\s+/g, " ").trim();
    if (cleanedText.length > 0) {
      await generateAndSaveBookEmbeddings(bookId, cleanedText, onProgress);
      console.log(`Book "${title}" indexed successfully.`);
    } else {
      console.warn(`No text extracted for book "${title}".`);
      if (onProgress) {
        onProgress(100);
      }
    }
  } catch (error) {
    console.error(`Error during book indexing:`, error);
    throw error;
  }
}
