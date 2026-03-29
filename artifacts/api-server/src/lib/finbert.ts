export interface FinBertSentiment {
  label: "positive" | "negative" | "neutral";
  score: number;
}

export interface FinBertResult {
  text: string;
  sentiment: FinBertSentiment;
}

const finbertCache = new Map<string, { data: FinBertResult[]; expiresAt: number }>();
const FINBERT_CACHE_TTL = 15 * 60 * 1000;

const HF_MODELS = [
  "nickmuchi/financial-roberta-large-sentiment-analysis",
  "mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis",
  "ProsusAI/finbert",
];

async function callHuggingFaceModel(model: string, inputs: string[]): Promise<FinBertSentiment[]> {
  const token = process.env["HUGGINGFACE_API_TOKEN"];
  if (!token) {
    throw new Error("HUGGINGFACE_API_TOKEN is not set");
  }

  const url = `https://router.huggingface.co/hf-inference/models/${model}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HuggingFace API error ${response.status} (${model}): ${text}`);
  }

  const data = (await response.json()) as Array<Array<{ label: string; score: number }>>;

  return data.map((labelScores) => {
    const best = labelScores.reduce((a, b) => (a.score > b.score ? a : b));
    const rawLabel = best.label.toLowerCase();
    const label: FinBertSentiment["label"] =
      rawLabel === "positive" || rawLabel === "label_2" || rawLabel === "pos"
        ? "positive"
        : rawLabel === "negative" || rawLabel === "label_0" || rawLabel === "neg"
        ? "negative"
        : "neutral";
    return { label, score: best.score };
  });
}

async function callHuggingFace(inputs: string[]): Promise<FinBertSentiment[]> {
  let lastError: unknown;

  for (const model of HF_MODELS) {
    try {
      return await callHuggingFaceModel(model, inputs);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

export async function runFinBert(texts: string[], cacheKey: string): Promise<FinBertResult[]> {
  const cached = finbertCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const BATCH_SIZE = 10;
  const results: FinBertResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const sentiments = await callHuggingFace(batch);
    for (let j = 0; j < batch.length; j++) {
      results.push({ text: batch[j]!, sentiment: sentiments[j]! });
    }
  }

  finbertCache.set(cacheKey, { data: results, expiresAt: Date.now() + FINBERT_CACHE_TTL });
  return results;
}

export function aggregateFinBertScores(results: FinBertResult[]): { score: number; breakdown: Record<string, number> } {
  if (results.length === 0) return { score: 50, breakdown: { positive: 0, negative: 0, neutral: 0 } };

  const counts = { positive: 0, negative: 0, neutral: 0 };
  let weightedSum = 0;

  for (const r of results) {
    counts[r.sentiment.label]++;
    if (r.sentiment.label === "positive") weightedSum += r.sentiment.score;
    else if (r.sentiment.label === "negative") weightedSum -= r.sentiment.score;
  }

  const positiveRatio = counts.positive / results.length;
  const negativeRatio = counts.negative / results.length;
  const score = Math.round(50 + (positiveRatio - negativeRatio) * 50);

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: counts,
  };
}
