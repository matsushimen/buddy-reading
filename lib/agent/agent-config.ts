export type AgentConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
  timeoutMs: number;
  temperature: number;
  sendResponseFormat: boolean;
  useMock: boolean;
};

const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = "gpt-4o-mini";
const defaultEmbeddingModel = "text-embedding-3-small";
const defaultTimeoutMs = 60000;
const defaultTemperature = 0.2;

export function getAgentConfig(): AgentConfig {
  const baseUrl = process.env.OPENAI_COMPAT_BASE_URL?.trim() || defaultBaseUrl;
  const apiKey = process.env.OPENAI_COMPAT_API_KEY?.trim() ?? "";
  const model = process.env.OPENAI_COMPAT_MODEL?.trim() || defaultModel;
  const embeddingModel = process.env.OPENAI_COMPAT_EMBEDDING_MODEL?.trim() || defaultEmbeddingModel;
  const timeoutMs = parsePositiveInteger(process.env.OPENAI_COMPAT_TIMEOUT_MS, defaultTimeoutMs);
  const temperature = parseFiniteNumber(process.env.OPENAI_COMPAT_TEMPERATURE, defaultTemperature);
  const sendResponseFormat = process.env.OPENAI_COMPAT_RESPONSE_FORMAT !== "false";
  const forcedMock = process.env.AGENT_MOCK_MODE === "true";

  return {
    baseUrl,
    apiKey,
    model,
    embeddingModel,
    timeoutMs,
    temperature,
    sendResponseFormat,
    useMock: forcedMock || apiKey.length === 0
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseFiniteNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
