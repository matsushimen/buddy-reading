import { annotationResponseSchema } from "../schemas";
import type { AnnotationRequest, AnnotationResponse } from "../types";
import { getAgentConfig } from "./agent-config";
import { createFallbackAnnotationResponse, parseAnnotationJson } from "./json-output";
import { loadBookContext } from "./book-context-loader";
import { loadUserMemory } from "./memory-loader";
import { callMockLlm } from "./mock-llm";
import { callOpenAiCompatibleChat } from "./openai-compatible-client";
import { buildAnnotationPrompt } from "./prompt-builder";
import { loadSkill } from "./skill-loader";

export async function runAnnotationAgent(request: AnnotationRequest): Promise<AnnotationResponse> {
  const [config, skillContent, memory, bookContext] = await Promise.all([
    Promise.resolve(getAgentConfig()),
    loadSkill(request.skillId),
    loadUserMemory(request.userId),
    loadBookContext(request.bookId)
  ]);
  const prompt = buildAnnotationPrompt(
    request,
    skillContent,
    memory.content,
    memory.version,
    bookContext.content,
    bookContext.version
  );

  if (config.useMock) {
    const response = callMockLlm(request);
    return annotationResponseSchema.parse(response);
  }

  try {
    const content = await callOpenAiCompatibleChat(prompt, config);
    return parseAnnotationJson(content);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown Agent error";
    return createFallbackAnnotationResponse(message);
  }
}
