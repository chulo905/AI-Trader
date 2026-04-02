import { openai } from "./openai-client.js";
import { logger } from "./logger.js";

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  style: string;
  bias: string;
  focusOn: string;
}

export interface AgentVote {
  agentId: string;
  agentName: string;
  role: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasoning: string;
  keySignal: string;
  round1Action?: "BUY" | "SELL" | "HOLD";
  opinionShifted: boolean;
}

export interface SwarmResult {
  symbol: string;
  price: number;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  dissentScore: number;
  swarmScore: number;
  bullAgents: number;
  bearAgents: number;
  holdAgents: number;
  agentVotes: AgentVote[];
  synthesisReport: string;
  roundOneSummary: string;
  roundTwoSummary: string;
  durationMs: number;
  runAt: string;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  changePercent: number;
  rsi14: number;
  macdSignal: number;
  atr14: number;
  sma50pct: number;
  sma200pct: number;
  regime: string;
  sentimentScore?: number;
  overallSentiment?: string;
  volume?: number;
  isMock?: boolean;
}

export const SWARM_AGENTS: AgentPersona[] = [
  {
    id: "warren",
    name: "Warren",
    role: "Value Investor",
    style: "Buffett-style fundamental analysis. Ignores short-term noise. Focuses on intrinsic value, moat, and long-term earnings power.",
    bias: "Bullish on quality, bearish on speculation. Prefers holding over trading.",
    focusOn: "P/E vs fair value, competitive moat, earnings quality, margin of safety",
  },
  {
    id: "kira",
    name: "Kira",
    role: "Technical Analyst",
    style: "Pure price action and chart-based signals. Relies on RSI, MACD, moving averages, support/resistance levels.",
    bias: "Trend-following. Buys breakouts, sells breakdowns. Dislikes counter-trend trades.",
    focusOn: "RSI momentum, MACD crossovers, SMA positioning, ATR volatility regime",
  },
  {
    id: "maya",
    name: "Maya",
    role: "Macro Economist",
    style: "Top-down macro analysis. Looks at rate environment, USD strength, sector rotation, global risk-on/off.",
    bias: "Prefers risk-off in high-rate environments. Bullish on defensive sectors in uncertainty.",
    focusOn: "Rate sensitivity, dollar correlation, sector regime, macro risk environment",
  },
  {
    id: "tyler",
    name: "Tyler",
    role: "Momentum Trader",
    style: "Aggressive momentum and trend-following. Chases breakouts, rides trends until they break. Short holding periods.",
    bias: "Strongly bullish in uptrends, quickly turns bearish on trend breaks. High conviction in clear trends.",
    focusOn: "Price momentum, 20-day trend, relative strength, breakout confirmation",
  },
  {
    id: "sophia",
    name: "Sophia",
    role: "Risk Manager",
    style: "Obsessed with downside protection. Focuses on maximum drawdown, stop-loss distance, volatility, and tail risk.",
    bias: "Bearish by default unless reward/risk is clearly favorable. Never takes oversized positions.",
    focusOn: "ATR-based risk, drawdown probability, stop distance, reward-to-risk ratio",
  },
  {
    id: "alex",
    name: "Alex",
    role: "Market Structure Analyst",
    style: "Analyzes order flow, liquidity zones, and market microstructure. Identifies where institutions are positioning.",
    bias: "Neutral until a clear institutional footprint is visible. Respects volume signals.",
    focusOn: "Volume profile, liquidity zones, bid-ask dynamics, institutional positioning clues",
  },
  {
    id: "jordan",
    name: "Jordan",
    role: "Retail Sentiment Analyst",
    style: "Tracks social media buzz, retail trader positioning, and crowd psychology. Fades extreme retail sentiment.",
    bias: "Contrarian on extreme retail enthusiasm. Bullish when retail is fearful, bearish when euphoric.",
    focusOn: "Sentiment score, retail positioning, social buzz, fear vs greed signals",
  },
  {
    id: "ethan",
    name: "Ethan",
    role: "Event-Driven Trader",
    style: "Catalyst-focused. Trades around earnings, news, Fed decisions, product launches, M&A. Holds through catalysts.",
    bias: "High conviction on clear catalysts. Avoids trading in catalyst vacuum.",
    focusOn: "Upcoming catalysts, news flow, earnings proximity, event-driven risk premium",
  },
  {
    id: "luna",
    name: "Luna",
    role: "Contrarian Analyst",
    style: "Fades consensus. When everyone is bullish, looks for reasons to be bearish and vice versa. Seeks mean reversion.",
    bias: "Always questions the dominant narrative. Bullish on oversold dips, bearish on overbought tops.",
    focusOn: "Consensus positioning, RSI extremes, sentiment contrarian signals, overextension",
  },
  {
    id: "quant",
    name: "Quant",
    role: "Quantitative Strategist",
    style: "Data-driven, model-based analysis. Uses statistical signals, mean-reversion models, and systematic rules. No emotion.",
    bias: "Neutral until statistics clearly favor one side. High confidence only with multiple confirming signals.",
    focusOn: "Statistical signal strength, model score, systematic rule convergence, edge probability",
  },
];

const simCache = new Map<string, { result: SwarmResult; expiresAt: number }>();
const CACHE_TTL = 15 * 60 * 1000;

function buildMarketContext(snap: MarketSnapshot): string {
  const trend = snap.sma200pct > 0 ? "above 200-SMA (uptrend)" : "below 200-SMA (downtrend)";
  const rsiLabel = snap.rsi14 >= 70 ? "overbought" : snap.rsi14 <= 30 ? "oversold" : "neutral";
  const macdLabel = snap.macdSignal > 0 ? "positive (bullish momentum)" : "negative (bearish momentum)";
  const sentLabel = snap.overallSentiment ?? "unknown";

  return `
MARKET DATA SNAPSHOT — ${snap.symbol} @ $${snap.price.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Price Change (today):  ${snap.changePercent >= 0 ? "+" : ""}${snap.changePercent.toFixed(2)}%
Market Trend:          ${trend} (${snap.sma200pct >= 0 ? "+" : ""}${snap.sma200pct.toFixed(1)}% from 200-SMA)
SMA-50 Position:       ${snap.sma50pct >= 0 ? "+" : ""}${snap.sma50pct.toFixed(1)}% from 50-SMA
RSI (14):              ${snap.rsi14.toFixed(1)} — ${rsiLabel}
MACD Signal:           ${macdLabel}
ATR (14):              $${snap.atr14.toFixed(2)} (volatility proxy)
Market Regime:         ${snap.regime}
Sentiment:             ${sentLabel} (score: ${snap.sentimentScore ?? "N/A"}/100)
`.trim();
}

async function getAgentVoteRound1(
  agent: AgentPersona,
  marketContext: string
): Promise<AgentVote> {
  const prompt = `You are ${agent.name}, a professional ${agent.role} at a hedge fund.

Your investing style: ${agent.style}
Your natural bias: ${agent.bias}
You focus primarily on: ${agent.focusOn}

Here is the current market snapshot you must analyze:

${marketContext}

Based on your unique expertise and the data above, make a trading decision.

Respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": <number 1-100>,
  "reasoning": "<1-2 sentences explaining your decision in your own voice>",
  "keySignal": "<the single most important data point driving your decision>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const action = (["BUY", "SELL", "HOLD"].includes(raw.action) ? raw.action : "HOLD") as "BUY" | "SELL" | "HOLD";

    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      action,
      confidence: Math.max(1, Math.min(100, Number(raw.confidence) || 50)),
      reasoning: String(raw.reasoning || "No reasoning provided."),
      keySignal: String(raw.keySignal || "—"),
      opinionShifted: false,
    };
  } catch (err) {
    logger.warn({ agentId: agent.id, err }, "MiroFish agent round-1 failed");
    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      action: "HOLD",
      confidence: 30,
      reasoning: "Analysis unavailable — defaulting to HOLD.",
      keySignal: "—",
      opinionShifted: false,
    };
  }
}

async function getAgentVoteRound2(
  agent: AgentPersona,
  marketContext: string,
  round1Votes: AgentVote[]
): Promise<AgentVote> {
  const otherVotes = round1Votes
    .filter(v => v.agentId !== agent.id)
    .map(v => `• ${v.agentName} (${v.role}): ${v.action} (${v.confidence}% confidence) — "${v.keySignal}"`)
    .join("\n");

  const myRound1 = round1Votes.find(v => v.agentId === agent.id);
  const myPrevious = myRound1
    ? `Your round-1 call: ${myRound1.action} at ${myRound1.confidence}% confidence.`
    : "";

  const prompt = `You are ${agent.name}, a professional ${agent.role}.

Your style: ${agent.style}
Your focus: ${agent.focusOn}

${myPrevious}

After your initial analysis, here is what the other 9 analysts on the swarm decided:

${otherVotes}

Now consider their perspectives alongside yours. You may REVISE your view if compelling arguments have emerged, or MAINTAIN your position if you disagree with the consensus.

Respond with ONLY a JSON object:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": <number 1-100>,
  "reasoning": "<1-2 sentences — mention if you changed your mind and why, or why you hold firm>",
  "keySignal": "<the single most important signal for your final decision>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 220,
      response_format: { type: "json_object" },
    });

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const action = (["BUY", "SELL", "HOLD"].includes(raw.action) ? raw.action : "HOLD") as "BUY" | "SELL" | "HOLD";
    const prevAction = myRound1?.action ?? "HOLD";

    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      action,
      confidence: Math.max(1, Math.min(100, Number(raw.confidence) || 50)),
      reasoning: String(raw.reasoning || ""),
      keySignal: String(raw.keySignal || "—"),
      round1Action: prevAction,
      opinionShifted: action !== prevAction,
    };
  } catch (err) {
    logger.warn({ agentId: agent.id, err }, "MiroFish agent round-2 failed");
    return myRound1 ?? {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      action: "HOLD",
      confidence: 30,
      reasoning: "Analysis unavailable — maintaining previous position.",
      keySignal: "—",
      opinionShifted: false,
    };
  }
}

async function synthesizeSwarm(
  marketContext: string,
  finalVotes: AgentVote[],
  symbol: string
): Promise<string> {
  const votesSummary = finalVotes
    .map(v => `${v.agentName} (${v.role}): ${v.action} @ ${v.confidence}%${v.opinionShifted ? " [REVISED]" : ""}`)
    .join("\n");

  const prompt = `You are the Chief Investment Strategist synthesizing a 10-agent swarm simulation for ${symbol}.

Market Context:
${marketContext}

Agent Final Votes:
${votesSummary}

Write a 3-4 sentence synthesis report covering:
1. The dominant consensus and key drivers
2. Notable disagreements between agents and what they signal
3. The final recommendation and confidence level with specific actionable insight

Write in professional, decisive language. Be specific about the stock symbol. No bullet points — flowing prose only.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 350,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "Synthesis unavailable.";
  } catch {
    return `The swarm of 10 analyst agents completed their simulation for ${symbol}. Review individual agent votes for detailed insights.`;
  }
}

function computeSwarmConsensus(votes: AgentVote[]): {
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  dissentScore: number;
  swarmScore: number;
  bullAgents: number;
  bearAgents: number;
  holdAgents: number;
} {
  const bull = votes.filter(v => v.action === "BUY");
  const bear = votes.filter(v => v.action === "SELL");
  const hold = votes.filter(v => v.action === "HOLD");

  const weightedBull = bull.reduce((s, v) => s + v.confidence, 0);
  const weightedBear = bear.reduce((s, v) => s + v.confidence, 0);
  const weightedHold = hold.reduce((s, v) => s + v.confidence, 0);

  const total = votes.length;

  let action: "BUY" | "SELL" | "HOLD" = "HOLD";
  let confidence = 50;

  if (bull.length > bear.length && bull.length > hold.length) {
    action = "BUY";
    confidence = Math.round(weightedBull / Math.max(1, bull.length));
  } else if (bear.length > bull.length && bear.length > hold.length) {
    action = "SELL";
    confidence = Math.round(weightedBear / Math.max(1, bear.length));
  } else if (bull.length === bear.length && bull.length > 0) {
    action = "HOLD";
    confidence = 45;
  } else {
    action = "HOLD";
    confidence = Math.round(weightedHold / Math.max(1, hold.length));
  }

  const dominant = Math.max(bull.length, bear.length, hold.length);
  const dissentScore = Math.round(((total - dominant) / total) * 100);

  const swarmScore = Math.round(
    (action === "BUY" ? confidence : action === "SELL" ? -confidence : 0) *
    (1 - dissentScore / 200)
  );

  return {
    action,
    confidence,
    dissentScore,
    swarmScore,
    bullAgents: bull.length,
    bearAgents: bear.length,
    holdAgents: hold.length,
  };
}

export async function runMirofishSwarm(snap: MarketSnapshot): Promise<SwarmResult> {
  const cacheKey = `${snap.symbol}:${Math.floor(Date.now() / CACHE_TTL)}`;
  const cached = simCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logger.info({ symbol: snap.symbol }, "MiroFish swarm served from cache");
    return cached.result;
  }

  const startTime = Date.now();
  const marketContext = buildMarketContext(snap);

  logger.info({ symbol: snap.symbol, agents: SWARM_AGENTS.length }, "MiroFish swarm Round 1 starting");

  const round1Votes = await Promise.all(
    SWARM_AGENTS.map(agent => getAgentVoteRound1(agent, marketContext))
  );

  const r1Consensus = computeSwarmConsensus(round1Votes);
  const roundOneSummary = `Round 1: ${r1Consensus.bullAgents} BUY / ${r1Consensus.bearAgents} SELL / ${r1Consensus.holdAgents} HOLD → preliminary ${r1Consensus.action} @ ${r1Consensus.confidence}% confidence`;

  logger.info({ symbol: snap.symbol, r1: r1Consensus.action }, "MiroFish Round 1 complete — starting Round 2 (opinion dynamics)");

  const round2Votes = await Promise.all(
    SWARM_AGENTS.map(agent => getAgentVoteRound2(agent, marketContext, round1Votes))
  );

  const shifted = round2Votes.filter(v => v.opinionShifted).length;
  const roundTwoSummary = `Round 2: ${shifted}/${SWARM_AGENTS.length} agents revised their view after peer review`;

  const consensus = computeSwarmConsensus(round2Votes);
  const synthesisReport = await synthesizeSwarm(marketContext, round2Votes, snap.symbol);

  const durationMs = Date.now() - startTime;

  const result: SwarmResult = {
    symbol: snap.symbol,
    price: snap.price,
    action: consensus.action,
    confidence: consensus.confidence,
    dissentScore: consensus.dissentScore,
    swarmScore: consensus.swarmScore,
    bullAgents: consensus.bullAgents,
    bearAgents: consensus.bearAgents,
    holdAgents: consensus.holdAgents,
    agentVotes: round2Votes,
    synthesisReport,
    roundOneSummary,
    roundTwoSummary,
    durationMs,
    runAt: new Date().toISOString(),
  };

  simCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });

  logger.info({
    symbol: snap.symbol,
    action: result.action,
    confidence: result.confidence,
    dissentScore: result.dissentScore,
    durationMs,
  }, "MiroFish swarm simulation complete");

  return result;
}

export function getCachedSwarmResult(symbol: string): SwarmResult | null {
  const key = `${symbol}:${Math.floor(Date.now() / CACHE_TTL)}`;
  const cached = simCache.get(key);
  return cached && cached.expiresAt > Date.now() ? cached.result : null;
}
