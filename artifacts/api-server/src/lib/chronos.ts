export interface ChronosForecast {
  direction: "bullish" | "bearish" | "neutral";
  forecastPct: number;
  confidenceLow: number;
  confidenceHigh: number;
  horizon: number;
  generatedAt: string;
}

export interface ChronosForecastResponse extends ChronosForecast {
  available: boolean;
  error?: string;
}

const chronosCache = new Map<string, { data: ChronosForecast; expiresAt: number }>();
const chronosFailureCache = new Map<string, { error: string; expiresAt: number }>();
const CHRONOS_CACHE_TTL = 30 * 60 * 1000;
const CHRONOS_FAILURE_TTL = 5 * 60 * 1000;

const HF_CHRONOS_MODEL = "amazon/chronos-t5-small";
const HF_INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${HF_CHRONOS_MODEL}`;

async function callChronos(closingPrices: number[]): Promise<ChronosForecast> {
  const token = process.env["HUGGINGFACE_API_TOKEN"];
  if (!token) {
    throw new Error("HUGGINGFACE_API_TOKEN is not set");
  }

  const response = await fetch(HF_INFERENCE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: closingPrices,
      parameters: {
        prediction_length: 5,
        num_samples: 20,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chronos API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as unknown;

  return parseChronosResponse(data, closingPrices);
}

function parseChronosResponse(data: unknown, closingPrices: number[]): ChronosForecast {
  const lastPrice = closingPrices[closingPrices.length - 1] ?? 0;

  let medianForecast = lastPrice;
  let lowForecast = lastPrice;
  let highForecast = lastPrice;

  try {
    if (Array.isArray(data) && data.length > 0) {
      const firstResult = data[0];

      if (Array.isArray(firstResult)) {
        const samples = firstResult as number[][];
        const finalValues: number[] = [];

        for (const sample of samples) {
          if (Array.isArray(sample) && sample.length > 0) {
            finalValues.push(sample[sample.length - 1] as number);
          }
        }

        if (finalValues.length > 0) {
          finalValues.sort((a, b) => a - b);
          const mid = Math.floor(finalValues.length / 2);
          medianForecast = finalValues[mid] ?? lastPrice;
          lowForecast = finalValues[Math.floor(finalValues.length * 0.1)] ?? lastPrice;
          highForecast = finalValues[Math.floor(finalValues.length * 0.9)] ?? lastPrice;
        }
      } else if (typeof firstResult === "object" && firstResult !== null) {
        const obj = firstResult as Record<string, unknown>;
        if ("mean" in obj && typeof obj["mean"] === "number") {
          medianForecast = obj["mean"] as number;
        }
        if ("quantiles" in obj && Array.isArray(obj["quantiles"])) {
          const q = obj["quantiles"] as number[];
          lowForecast = q[1] ?? lastPrice;
          highForecast = q[3] ?? lastPrice;
          medianForecast = q[2] ?? lastPrice;
        }
      }
    }
  } catch {
    medianForecast = lastPrice;
  }

  const forecastPct = lastPrice > 0 ? ((medianForecast - lastPrice) / lastPrice) * 100 : 0;
  const lowPct = lastPrice > 0 ? ((lowForecast - lastPrice) / lastPrice) * 100 : 0;
  const highPct = lastPrice > 0 ? ((highForecast - lastPrice) / lastPrice) * 100 : 0;

  const direction: ChronosForecast["direction"] =
    forecastPct > 0.2 ? "bullish" : forecastPct < -0.2 ? "bearish" : "neutral";

  return {
    direction,
    forecastPct: Math.round(forecastPct * 100) / 100,
    confidenceLow: Math.round(lowPct * 100) / 100,
    confidenceHigh: Math.round(highPct * 100) / 100,
    horizon: 5,
    generatedAt: new Date().toISOString(),
  };
}

export async function getChronosForecast(
  symbol: string,
  closingPrices: number[]
): Promise<ChronosForecast> {
  const cached = chronosCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const failure = chronosFailureCache.get(symbol);
  if (failure && failure.expiresAt > Date.now()) {
    throw new Error(failure.error);
  }

  const prices = closingPrices.slice(-64);

  try {
    const forecast = await callChronos(prices);
    chronosCache.set(symbol, { data: forecast, expiresAt: Date.now() + CHRONOS_CACHE_TTL });
    return forecast;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Chronos failed";
    chronosFailureCache.set(symbol, { error: msg, expiresAt: Date.now() + CHRONOS_FAILURE_TTL });
    throw err;
  }
}
