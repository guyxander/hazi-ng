import { askOpenRouter, getOpenRouterModel, isOpenRouterConfigured } from "@/lib/openrouter";

type PriceSuggestionInput = {
  title: string;
  description: string;
  category?: string;
};

type PriceSuggestion = {
  recommendedPrice: number | null;
  maximumPrice: number | null;
  marketNotes: string;
  sources: string[];
};

function parseJsonObject(value: string) {
  const match = value.match(/\{[\s\S]*\}/);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]) as Partial<PriceSuggestion>;
  } catch {
    return null;
  }
}

function fallbackSuggestion(input: PriceSuggestionInput, reason?: string): PriceSuggestion {
  return {
    recommendedPrice: null,
    maximumPrice: null,
    marketNotes: reason || `OpenRouter could not estimate a fair Nigerian used-goods price for "${input.title}" yet.`,
    sources: []
  };
}

export async function suggestOpenRouterPrice(input: PriceSuggestionInput): Promise<PriceSuggestion> {
  const freeModel = getOpenRouterModel();
  const candidateModels = Array.from(new Set([
    freeModel,
    "cohere/north-mini-code:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free"
  ])).filter((model) => model.endsWith(":free"));

  if (!isOpenRouterConfigured()) {
    return fallbackSuggestion(input, `Add an OpenRouter API key to estimate a fair Nigerian used-goods price for "${input.title}".`);
  }

  if (!candidateModels.length) {
    return fallbackSuggestion(input, "Set OPENROUTER_FREE_MODEL to a free OpenRouter model ending in ':free'.");
  }

  let lastError: Error | null = null;

  for (const model of candidateModels) {
    try {
      const answer = await askOpenRouter([
        {
          role: "system",
          content: [
            "You are a Nigerian used-goods pricing assistant for Hazi.ng.",
            "Estimate a fair seller price from the item details only.",
            "Use Nigerian naira.",
            "Return strict JSON only with recommendedPrice, maximumPrice, marketNotes, sources.",
            "recommendedPrice and maximumPrice must be numbers without currency symbols.",
            "sources should be short reasoning labels, not URLs, because no web browsing is available."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            item: input,
            pricingContext: "Second-hand auction marketplace in Nigeria. Seller price should be attractive enough to start bidding while maximumPrice should be the upper fair-market ask."
          })
        }
      ], model);
      const parsed = parseJsonObject(answer);

      return {
        recommendedPrice: Number(parsed?.recommendedPrice ?? 0) || null,
        maximumPrice: Number(parsed?.maximumPrice ?? 0) || null,
        marketNotes: parsed?.marketNotes || "Price suggestion generated from item details.",
        sources: Array.isArray(parsed?.sources) ? parsed.sources.map(String).slice(0, 5) : [`OpenRouter estimate via ${model}`]
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown OpenRouter error.");
    }
  }

  return fallbackSuggestion(input, lastError ? `OpenRouter price estimate failed: ${lastError.message}` : undefined);
}
