import { bookContextProposalResponseSchema } from "../schemas";
import type { BookContextProposalRequest, BookContextProposalResponse } from "../types";
import { getAgentConfig } from "./agent-config";
import { buildBookContextProposalPrompt } from "./book-context-proposal-prompt";
import { createFallbackBookContextProposalResponse, parseBookContextProposalJson } from "./json-output";
import { callOpenAiCompatibleChat } from "./openai-compatible-client";
import { loadBookContext, loadBookContextTemplate } from "./book-context-loader";

export async function runBookContextProposalAgent(request: BookContextProposalRequest): Promise<BookContextProposalResponse> {
  const [config, bookContext, template] = await Promise.all([
    Promise.resolve(getAgentConfig()),
    loadBookContext(request.bookId),
    loadBookContextTemplate()
  ]);
  const currentBookContext = request.currentBookContext.trim().length > 0 ? request.currentBookContext : bookContext.content || template;
  const prompt = buildBookContextProposalPrompt(request, currentBookContext);

  if (config.useMock) {
    const response = {
      proposedBookContext: currentBookContext.trim().length > 0 ? currentBookContext : template,
      reason: "モック応答として既定のBOOK_CONTEXTを返しました。",
      warnings: []
    };
    return bookContextProposalResponseSchema.parse(response);
  }

  try {
    const content = await callOpenAiCompatibleChat(prompt, config);
    return parseBookContextProposalJson(content);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown Agent error";
    return createFallbackBookContextProposalResponse(message);
  }
}
