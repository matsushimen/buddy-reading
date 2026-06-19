import { NextResponse } from "next/server";
import { getAgentConfig } from "@/lib/agent/agent-config";
import { callMockEmbeddings } from "@/lib/agent/mock-llm";
import { callOpenAiCompatibleEmbeddings } from "@/lib/agent/openai-compatible-client";
import { embeddingRequestSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const parsed = embeddingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { input } = parsed.data;
  const config = getAgentConfig();

  try {
    let embeddings: number[][];
    if (config.useMock) {
      embeddings = callMockEmbeddings(input);
    } else {
      embeddings = await callOpenAiCompatibleEmbeddings(input, {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.embeddingModel,
        timeoutMs: config.timeoutMs
      });
    }

    return NextResponse.json({ embeddings });
  } catch (error) {
    console.error("Failed to generate embeddings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate embeddings" },
      { status: 500 }
    );
  }
}
