export type ChatCompletionConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  sendResponseFormat: boolean;
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ChatCompletionRequestBody = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  response_format?: {
    type: "json_object";
  };
};

export async function callOpenAiCompatibleChat(prompt: { system: string; user: string }, config: ChatCompletionConfig): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const messages: ChatMessage[] = [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user }
    ];
    const body: ChatCompletionRequestBody = {
      model: config.model,
      messages,
      temperature: config.temperature
    };

    if (config.sendResponseFormat) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${errorText.slice(0, 300)}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LLM response did not include message content");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callOpenAiCompatibleEmbeddings(
  input: string | string[],
  config: { baseUrl: string; apiKey: string; model: string; timeoutMs: number }
): Promise<number[][]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const endpoint = `${config.baseUrl.replace(/\/$/, "")}/embeddings`;
    const body = {
      model: config.model,
      input
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding request failed: ${response.status} ${errorText.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{
        embedding?: number[];
        index?: number;
      }>;
    };

    if (!payload.data || payload.data.length === 0) {
      throw new Error("Embedding response did not include data");
    }

    const sortedData = [...payload.data].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
    const embeddings = sortedData.map((item) => item.embedding).filter((val): val is number[] => Array.isArray(val));

    if (embeddings.length === 0) {
      throw new Error("Embedding response did not include valid embeddings");
    }

    return embeddings;
  } finally {
    clearTimeout(timeout);
  }
}
