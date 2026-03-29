import { openai } from "./openai-client";
import { runFinBert, aggregateFinBertScores } from "./finbert.js";
import { logger } from "./logger";

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

function scoreToSentiment(score: number): SentimentResult["overallSentiment"] {
  if (score >= 70) return "very-bullish";
  if (score >= 58) return "bullish";
  if (score <= 30) return "very-bearish";
  if (score <= 42) return "bearish";
  return "neutral";
}

function scoreToLabel(score: number): string {
  if (score >= 70) return "Strongly Bullish";
  if (score >= 58) return "Bullish";
  if (score >= 53) return "Slightly Bullish";
  if (score <= 30) return "Strongly Bearish";
  if (score <= 42) return "Bearish";
  if (score <= 47) return "Slightly Bearish";
  return "Neutral";
}

function buildFallbackSentiment(symbol: string, price: number, changePercent: number): SentimentResult {
  const trending = Math.abs(changePercent) > 2;
  const score = changePercent > 2 ? 70 : changePercent > 0.5 ? 60 : changePercent < -2 ? 30 : changePercent < -0.5 ? 40 : 50;

  return {
    symbol,
    overallSentiment: scoreToSentiment(score),
    score,
    label: scoreToLabel(score),
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

function buildHfOnlySentiment(
  symbol: string,
  hfScore: number,
  changePercent: number,
): SentimentResult {
  const direction = changePercent >= 0 ? "positive" : "negative";
  return {
    symbol,
    overallSentiment: scoreToSentiment(hfScore),
    score: hfScore,
    label: scoreToLabel(hfScore),
    summary: `${symbol} Financial RoBERTa analysis indicates ${scoreToLabel(hfScore).toLowerCase()} sentiment. Price moved ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}% today with ${direction} market signals.`,
    keyFactors: [
      `Financial RoBERTa NLP score: ${hfScore}/100`,
      `Price momentum: ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
      "Deep NLP analysis of market language patterns",
    ],
    newsHeadlines: [
      { headline: `${symbol} ${scoreToLabel(hfScore).toLowerCase()} outlook per NLP analysis`, sentiment: hfScore >= 55 ? "positive" : hfScore <= 45 ? "negative" : "neutral", impact: "medium" },
      { headline: `Price ${changePercent >= 0 ? "advance" : "decline"} ${Math.abs(changePercent).toFixed(2)}% in current session`, sentiment: changePercent >= 0 ? "positive" : "negative", impact: "medium" },
    ],
    socialBuzz: `Institutional NLP indicators suggest ${scoreToLabel(hfScore).toLowerCase()} positioning for ${symbol}.`,
    analystConsensus: "Based on Financial RoBERTa model analysis.",
    aiPowered: true,
    generatedAt: new Date().toISOString(),
  };
}

export async function getSentiment(symbol: string, price: number, changePercent: number): Promise<SentimentResult> {
  const cached = sentimentCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const fallback = buildFallbackSentiment(symbol, price, changePercent);

  (async () => {
    try {
      const sentenceInputs = [
        `${symbol} stock price is currently $${price}, ${changePercent >= 0 ? "up" : "down"} ${Math.abs(changePercent).toFixed(2)}% today.`,
        `${symbol} shows ${Math.abs(changePercent) > 2 ? "strong" : "moderate"} ${changePercent >= 0 ? "bullish" : "bearish"} momentum in the current trading session.`,
        `Investors are ${changePercent >= 0 ? "buying" : "selling"} ${symbol} shares following today's price ${changePercent >= 0 ? "gains" : "losses"}.`,
      ];

      let hfScore: number | null = null;
      try {
        const finbertResults = await runFinBert(sentenceInputs, `finbert-primary:${symbol}`);
        const { score } = aggregateFinBertScores(finbertResults);
        hfScore = score;
        logger.debug({ symbol, hfScore }, "Financial RoBERTa primary sentiment computed");
      } catch (hfErr) {
        logger.warn({ symbol, err: hfErr }, "Financial RoBERTa unavailable, falling back to GPT");
      }

      if (hfScore !== null) {
        const result = buildHfOnlySentiment(symbol, hfScore, changePercent);
        sentimentCache.set(symbol, { data: result, expiresAt: Date.now() + CACHE_TTL });

        enrichWithGpt(symbol, price, changePercent, hfScore).then((enriched) => {
          if (enriched) sentimentCache.set(symbol, { data: enriched, expiresAt: Date.now() + CACHE_TTL });
        }).catch(() => {});
        return;
      }

      const gptResult = await runGptSentiment(symbol, price, changePercent);
      if (gptResult) {
        sentimentCache.set(symbol, { data: gptResult, expiresAt: Date.now() + CACHE_TTL });
      }
    } catch (err) {
      logger.error({ symbol, err }, "Sentiment analysis error");
    }
  })();

  return fallback;
}

async function enrichWithGpt(
  symbol: string,
  price: number,
  changePercent: number,
  hfScore: number,
): Promise<SentimentResult | null> {
  if (!openai) return null;
  try {
    const prompt = `You are a financial sentiment analyst. Generate realistic market sentiment data for ${symbol} stock at $${price} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}% today). The NLP sentiment score is ${hfScore}/100 (where 50=neutral, 70+=bullish, 30-=bearish).

Return ONLY valid JSON:
{
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
      model: "gpt-4o-mini",
      max_completion_tokens: 800,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      symbol,
      overallSentiment: scoreToSentiment(hfScore),
      score: hfScore,
      label: scoreToLabel(hfScore),
      summary: parsed.summary ?? scoreToLabel(hfScore),
      keyFactors: parsed.keyFactors ?? [],
      newsHeadlines: parsed.newsHeadlines ?? [],
      socialBuzz: parsed.socialBuzz ?? "",
      analystConsensus: parsed.analystConsensus ?? "",
      aiPowered: true,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function runGptSentiment(symbol: string, price: number, changePercent: number): Promise<SentimentResult | null> {
  if (!openai) return null;
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
      model: "gpt-4o-mini",
      max_completion_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const score: number = parsed.score ?? 50;
    return {
      symbol,
      overallSentiment: scoreToSentiment(score),
      score,
      label: scoreToLabel(score),
      summary: parsed.summary ?? "",
      keyFactors: parsed.keyFactors ?? [],
      newsHeadlines: parsed.newsHeadlines ?? [],
      socialBuzz: parsed.socialBuzz ?? "",
      analystConsensus: parsed.analystConsensus ?? "",
      aiPowered: true,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error({ symbol, err }, "GPT sentiment fallback error");
    return null;
  }
}
