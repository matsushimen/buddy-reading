import { NextResponse } from "next/server";
import { runAnnotationChatAgent } from "@/lib/agent/annotation-chat-agent";
import { annotationChatRequestSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const parsed = annotationChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid annotation chat request", issues: parsed.error.issues }, { status: 400 });
  }

  const response = await runAnnotationChatAgent(parsed.data);
  return NextResponse.json(response);
}
