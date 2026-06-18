import { NextResponse } from "next/server";
import { runBookContextProposalAgent } from "@/lib/agent/book-context-proposal-agent";
import { bookContextProposalRequestSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const parsed = bookContextProposalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid book context proposal request", issues: parsed.error.issues }, { status: 400 });
  }

  const response = await runBookContextProposalAgent(parsed.data);
  return NextResponse.json(response);
}
