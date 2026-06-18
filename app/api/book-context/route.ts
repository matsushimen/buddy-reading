import { NextResponse } from "next/server";
import { loadBookContext, loadBookContextTemplate, saveBookContext } from "@/lib/agent/book-context-loader";
import { bookContextApprovalRequestSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const bookId = url.searchParams.get("bookId") ?? "";
    const bookContext = await loadBookContext(bookId);
    const template = await loadBookContextTemplate();
    return NextResponse.json({ ...bookContext, template });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid book context request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const parsed = bookContextApprovalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid book context request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const saved = await saveBookContext(parsed.data.bookId, parsed.data.content);
    const template = await loadBookContextTemplate();
    return NextResponse.json({ ...saved, template });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid book context request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
