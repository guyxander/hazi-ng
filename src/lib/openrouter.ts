type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getOpenRouterModel() {
  const configuredModel = process.env.OPENROUTER_FREE_MODEL || "meta-llama/llama-3.2-3b-instruct:free";

  if (configuredModel === "meta-llama/llama-3.1-8b-instruct:free") {
    return "meta-llama/llama-3.2-3b-instruct:free";
  }

  return configuredModel;
}

export async function askOpenRouter(messages: OpenRouterMessage[], model = getOpenRouterModel()) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OpenRouter is not configured.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://hazi.ng",
      "X-Title": "Hazi.ng"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2
    })
  });

  const payload = (await response.json()) as OpenRouterResponse & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenRouter request failed.");
  }

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenRouter returned no content.");
  }

  return content;
}
