import { askOpenRouter, isOpenRouterConfigured } from "@/lib/openrouter";

type AiDeliveryEstimateInput = {
  pickupLocation: string;
  dropoffLocation: string;
  distanceKm: number;
  fallbackFee: number;
};

function extractAmount(value: string) {
  const match = value.replace(/,/g, "").match(/\b\d{3,7}\b/);
  return match ? Number(match[0]) : null;
}

export async function getAiDeliveryEstimate(input: AiDeliveryEstimateInput) {
  if (!isOpenRouterConfigured()) {
    return {
      fee: input.fallbackFee,
      source: "formula",
      raw: { reason: "OpenRouter API key missing." }
    };
  }

  try {
    const answer = await askOpenRouter([
      {
        role: "system",
        content: "You estimate Nigerian intra-city delivery prices. Return only a JSON object with estimated_fee_ngn and explanation."
      },
      {
        role: "user",
        content: `Estimate a fair independent courier fee in NGN from ${input.pickupLocation} to ${input.dropoffLocation}. Distance is ${input.distanceKm} km. Use Lagos/Nigeria marketplace context.`
      }
    ]);
    const amount = extractAmount(answer);

    return {
      fee: amount && amount > 0 ? Math.ceil(amount / 100) * 100 : input.fallbackFee,
      source: "openrouter",
      raw: { answer }
    };
  } catch (error) {
    return {
      fee: input.fallbackFee,
      source: "formula",
      raw: { error: error instanceof Error ? error.message : "OpenRouter estimate failed." }
    };
  }
}
