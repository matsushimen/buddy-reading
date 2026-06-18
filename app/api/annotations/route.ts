import { NextResponse } from "next/server";
import { runAnnotationAgent } from "@/lib/agent/annotation-agent";
import { annotationRequestSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const parsed = annotationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid annotation request", issues: parsed.error.issues }, { status: 400 });
  }

  const response = await runAnnotationAgent(parsed.data);
  return NextResponse.json(response);
}
