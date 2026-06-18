import { NextResponse } from "next/server";
import { loadMemoryTemplate, loadUserMemory, saveUserMemory } from "@/lib/agent/memory-loader";
import { memoryApprovalRequestSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? "default";
    const memory = await loadUserMemory(userId);
    const template = await loadMemoryTemplate();
    return NextResponse.json({ ...memory, template });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid memory request";
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

  const parsed = memoryApprovalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid memory request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const saved = await saveUserMemory(parsed.data.userId, parsed.data.content);
    const template = await loadMemoryTemplate();
    return NextResponse.json({ ...saved, template });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid memory request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
