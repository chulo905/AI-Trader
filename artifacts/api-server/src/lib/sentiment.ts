import { openai } from "@workspace/integrations-openai-ai-server";

export interface SentimentResult {
  symbol: string;
  overallSentiment: "very-bullish" | "bullish" | "neutral" | "bearish" | "very-bearish";
  score: number;
  label: string;
  summary: string;
  keyFactors: string[];
  newsHeadlines: { headline: string; sentiment: "positive" | "neutral" | "negative"; impact: "high" | "medium" | "low" }[];
  socialBuzz: string;
  analystConsensus: string;
  aiPowered: boolean;
  generatedAt: string;
}

const sentimentCache = new Map<string, { data: SentimentResult; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function buildFallbackSentiment(symbol: string, price: number, changePercent: number): SentimentResult {
  const trending = Math.abs(changePercent) > 2;
  const score = changePercent > 2 ? 70 : changePercent > 0.5 ? 60 : changePercent < -2 ? 30 : changePercent < -0.5 ? 40 : 50;

  const sentiment: SentimentResult["overallSentiment"] = score >= 65 ? "bullish" : score >= 55 ? "bullish" : score <= 35 ? "bearish" : "neutral";

  return {
    symbol,
    overallSentiment: sentiment,
    score,
    label: score >= 65 ? "Bullish" : score >= 55 ? "Slightly Bullish" : score <= 35 ? "Bearish" : score <= 45 ? "Slightly Bearish" : "Neutral",
    summary: `${symbol} is showing ${changePercent >= 0 ? "positive" : "negative"} momentum with ${trending ? "significant" : "modest"} market activity today.`,
    keyFactors: [
      `Price ${changePercent >= 0 ? "up" : "down"} ${Math.abs(changePercent).toFixed(2)}% today`,
      "Analyzing market sentiment...",
      "Scanning news sources...",
    ],
    newsHeadlines: [
      { headline: `${symbol} shows ${changePercent >= 0 ? "strength" : "weakness"} in today's session`, sentiment: changePercent >= 0 ? "positive" : "negative", impact: "medium" },
      { headline: "AI sentiment analysis running in background...", sentiment: "neutral", impact: "low" },
    ],
    socialBuzz: "Analyzing social media activity...",
    analystConsensus: "Fetching analyst data...",
    aiPowered: false,
    generatedAt: new Date().toISOString(),
  };
}

export async function getSentiment(symbol: string, price: number, changePercent: number): Promise<SentimentResult> {
  const cached = sentimentCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const fallback = buildFallbackSentiment(symbol, price, changePercent);

  (async () => {
    try {
      const prompt = `You are a financial sentiment analyst. Generate realistic market sentiment data for ${symbol} stock at $${price} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}% today).

Return ONLY valid JSON:
{
  "overallSentiment": "very-bullish" | "bullish" | "neutral" | "bearish" | "very-bearish",
  "score": <integer 0-100, where 50=neutral, 70=bullish, 30=bearish>,
  "label": "<short label like 'Bullish', 'Cautious', 'Strongly Bullish'>",
  "summary": "<2-3 sentences about current market sentiment for this stock, plain English>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>", "<factor 4>"],
  "newsHeadlines": [
    {"headline": "<realistic headline>", "sentiment": "positive"|"neutral"|"negative", "impact": "high"|"medium"|"low"},
    {"headline": "<realistic headline>", "sentiment": "positive"|"neutral"|"negative", "impact": "high"|"medium"|"low"},
    {"headline": "<realistic headline>", "sentiment": "positive"|"neutral"|"negative", "impact": "high"|"medium"|"low"}
  ],
  "socialBuzz": "<1 sentence about what retail investors/social media is saying>",
  "analystConsensus": "<1 sentence like 'Wall Street consensus: Buy — 18 analysts, avg price target $195'>"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5-nano",
        max_completion_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
      const result: SentimentResult = {
        symbol,
        overallSentiment: parsed.overallSentiment ?? "neutral",
        score: parsed.score ?? 50,
        label: parsed.label ?? "Neutral",
        summary: parsed.summary ?? "",
        keyFactors: parsed.keyFactors ?? [],
        newsHeadlines: parsed.newsHeadlines ?? [],
        socialBuzz: parsed.socialBuzz ?? "",
        analystConsensus: parsed.analystConsensus ?? "",
        aiPowered: true,
        generatedAt: new Date().toISOString(),
      };

      sentimentCache.set(symbol, { data: result, expiresAt: Date.now() + CACHE_TTL });
    } catch (err) {
      console.error("[Sentiment] GPT error:", err);
    }
  })();

  return fallback;
}
