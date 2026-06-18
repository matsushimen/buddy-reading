import { NextResponse } from "next/server";
import { runMemoryProposalAgent } from "@/lib/agent/memory-proposal-agent";
import { memoryProposalRequestSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const parsed = memoryProposalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid memory proposal request", issues: parsed.error.issues }, { status: 400 });
  }

  const response = await runMemoryProposalAgent(parsed.data);
  return NextResponse.json(response);
}
