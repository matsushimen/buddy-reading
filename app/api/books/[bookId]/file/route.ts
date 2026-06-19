import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

type RouteParams = {
  params: Promise<{
    bookId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const { bookId } = await params;
    const rootDir = process.cwd();
    const files = await fs.readdir(rootDir);
    const matchedFile = files.find((f) => {
      const hash = createHash("md5").update(f).digest("hex").slice(0, 24);
      return hash === bookId;
    });

    if (!matchedFile) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const filePath = path.join(rootDir, matchedFile);
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);
    const format = matchedFile.toLowerCase().endsWith(".pdf") ? "pdf" : "epub";
    const contentType = format === "pdf" ? "application/pdf" : "application/epub+zip";

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(matchedFile)}"`
      }
    });
  } catch (error) {
    console.error("Failed to serve book file:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
