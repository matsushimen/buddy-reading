import { annotationChatResponseSchema } from "../schemas";
import type { AnnotationChatRequest, AnnotationChatResponse } from "../types";
import { getAgentConfig } from "./agent-config";
import { loadBookContext } from "./book-context-loader";
import { buildAnnotationChatPrompt } from "./chat-prompt-builder";
import { createFallbackAnnotationChatResponse, parseAnnotationChatJson } from "./json-output";
import { loadUserMemory } from "./memory-loader";
import { callMockAnnotationChat } from "./mock-llm";
import { callOpenAiCompatibleChat } from "./openai-compatible-client";
import { loadSkill } from "./skill-loader";

export async function runAnnotationChatAgent(request: AnnotationChatRequest): Promise<AnnotationChatResponse> {
  const [config, skillContent, memory, bookContext] = await Promise.all([
    Promise.resolve(getAgentConfig()),
    loadSkill(request.skillId),
    loadUserMemory(request.userId),
    loadBookContext(request.bookId)
  ]);
  const prompt = buildAnnotationChatPrompt(
    request,
    skillContent,
    memory.content,
    memory.version,
    bookContext.content,
    bookContext.version
  );

  if (config.useMock) {
    const response = callMockAnnotationChat(request);
    return annotationChatResponseSchema.parse(response);
  }

  try {
    const content = await callOpenAiCompatibleChat(prompt, config);
    return parseAnnotationChatJson(content);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown Agent error";
    return createFallbackAnnotationChatResponse(message);
  }
}
