import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { ReadingProgress } from "@/lib/types";

const getProgressFilePath = () => path.join(process.cwd(), "memory", "progress.json");

async function readProgressMap(): Promise<Record<string, ReadingProgress>> {
  const filePath = getProgressFilePath();
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as Record<string, ReadingProgress>;
  } catch {
    return {};
  }
}

async function writeProgressMap(map: Record<string, ReadingProgress>): Promise<void> {
  const filePath = getProgressFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(map, null, 2), "utf-8");
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get("bookId");
    const progressMap = await readProgressMap();

    if (bookId) {
      const progress = progressMap[bookId] || null;
      return NextResponse.json(progress);
    }

    return NextResponse.json(progressMap);
  } catch (error) {
    console.error("Failed to read progress:", error);
    return NextResponse.json({ error: "Failed to read progress" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const incoming = (await request.json()) as ReadingProgress;
    const { bookId, updatedAt } = incoming;

    if (!bookId || !updatedAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const progressMap = await readProgressMap();
    const existing = progressMap[bookId];

    if (!existing || new Date(updatedAt) > new Date(existing.updatedAt)) {
      progressMap[bookId] = incoming;
      await writeProgressMap(progressMap);
      return NextResponse.json(incoming);
    }

    return NextResponse.json(existing);
  } catch (error) {
    console.error("Failed to save progress:", error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
