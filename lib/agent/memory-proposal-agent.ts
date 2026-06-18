import { memoryProposalResponseSchema } from "../schemas";
import type { MemoryProposalRequest, MemoryProposalResponse } from "../types";
import { getAgentConfig } from "./agent-config";
import { buildMemoryProposalPrompt } from "./memory-proposal-prompt";
import { createFallbackMemoryProposalResponse, parseMemoryProposalJson } from "./json-output";
import { callOpenAiCompatibleChat } from "./openai-compatible-client";
import { loadUserMemory } from "./memory-loader";

export async function runMemoryProposalAgent(request: MemoryProposalRequest): Promise<MemoryProposalResponse> {
  const [config, memory] = await Promise.all([Promise.resolve(getAgentConfig()), loadUserMemory(request.userId)]);
  const currentMemory = request.currentMemory.trim().length > 0 ? request.currentMemory : memory.content;
  const prompt = buildMemoryProposalPrompt(request, currentMemory);

  if (config.useMock) {
    const response = {
      proposedMemory:
        currentMemory.trim().length > 0
          ? currentMemory
          : "# MEMORY.md\n\n- Preferred annotation language: Japanese\n- Preferred explanation style: concise but technically precise\n- Preferred detail level: standard\n",
      reason: "モック応答として既定のメモリを返しました。",
      warnings: []
    };
    return memoryProposalResponseSchema.parse(response);
  }

  try {
    const content = await callOpenAiCompatibleChat(prompt, config);
    return parseMemoryProposalJson(content);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown Agent error";
    return createFallbackMemoryProposalResponse(message);
  }
}
