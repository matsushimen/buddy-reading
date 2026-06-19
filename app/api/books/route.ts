import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

export async function GET(): Promise<NextResponse> {
  try {
    const rootDir = process.cwd();
    const files = await fs.readdir(rootDir);
    const bookFiles = files.filter(
      (f) => f.toLowerCase().endsWith(".pdf") || f.toLowerCase().endsWith(".epub")
    );

    const books = await Promise.all(
      bookFiles.map(async (filename) => {
        const filePath = path.join(rootDir, filename);
        const stat = await fs.stat(filePath);
        const bookId = createHash("md5").update(filename).digest("hex").slice(0, 24);
        const format = filename.toLowerCase().endsWith(".pdf") ? "pdf" : "epub";

        return {
          id: bookId,
          title: filename.replace(/\.(pdf|epub)$/i, ""),
          format,
          fileName: filename,
          fileBlobKey: `file_${bookId}`,
          createdAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString()
        };
      })
    );

    return NextResponse.json(books);
  } catch (error) {
    console.error("Failed to scan books directory:", error);
    return NextResponse.json({ error: "Failed to scan books" }, { status: 500 });
  }
}
