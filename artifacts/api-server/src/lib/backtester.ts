import { computeIndicators, type OHLCVBar } from "./technicals";

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  symbol: string;
  side: "long";
  entryPrice: number;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPct: number;
  holdingDays: number;
  reason: string;
}

export interface BacktestResult {
  symbol: string;
  period: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgHoldingDays: number;
  bestTrade: number;
  worstTrade: number;
  equity: number[];
  trades: BacktestTrade[];
  summary: string;
}

function computeScore(indicators: ReturnType<typeof computeIndicators>, changePercent: number): number {
  const rsi = indicators.rsi14;
  const macdBull = indicators.macd ? indicators.macd.histogram > 0 : null;
  const aboveSma50 = indicators.priceVsSma50 !== null ? indicators.priceVsSma50 > 0 : null;

  let score = 0;
  if (rsi !== null) score += rsi > 60 ? 2 : rsi < 40 ? -2 : 0;
  if (macdBull === true) score += 2;
  if (macdBull === false) score -= 2;
  if (aboveSma50 === true) score += 1;
  if (aboveSma50 === false) score -= 1;
  if (changePercent > 1.5) score += 1;
  if (changePercent < -1.5) score -= 1;

  return score;
}

function actionFromScore(score: number): string {
  if (score >= 4) return "STRONG BUY";
  if (score >= 2) return "BUY";
  if (score <= -4) return "STRONG SELL";
  if (score <= -2) return "SELL";
  return "HOLD";
}

export function runBacktest(bars: OHLCVBar[], symbol: string, period: string, budgetPerTrade = 1000): BacktestResult {
  const MIN_BARS_FOR_INDICATORS = 26;
  const STOP_LOSS_PCT = 0.015;
  const TAKE_PROFIT_PCT = 0.04;

  const trades: BacktestTrade[] = [];
  const equity: number[] = [100_000];
  let cash = 100_000;

  let openTrade: { entryIdx: number; entryPrice: number; shares: number; stopLoss: number; takeProfit: number } | null = null;
  let peakEquity = cash;
  let maxDrawdown = 0;

  for (let i = MIN_BARS_FOR_INDICATORS; i < bars.length; i++) {
    const windowBars = bars.slice(0, i);
    const currentBar = bars[i]!;
    const indicators = computeIndicators(windowBars);
    const prevBar = bars[i - 1]!;
    const changePercent = ((currentBar.close - prevBar.close) / prevBar.close) * 100;

    if (openTrade) {
      const hitStop = currentBar.low <= openTrade.stopLoss;
      const hitTarget = currentBar.high >= openTrade.takeProfit;
      const exitSignal = ["SELL", "STRONG SELL"].includes(actionFromScore(computeScore(indicators, changePercent)));

      if (hitStop || hitTarget || exitSignal) {
        const exitPrice = hitStop ? openTrade.stopLoss : hitTarget ? openTrade.takeProfit : currentBar.close;
        const pnl = (exitPrice - openTrade.entryPrice) * openTrade.shares;
        const pnlPct = (exitPrice - openTrade.entryPrice) / openTrade.entryPrice * 100;
        const holdingDays = i - openTrade.entryIdx;

        cash += exitPrice * openTrade.shares;

        trades.push({
          entryDate: bars[openTrade.entryIdx]!.time as string,
          exitDate: currentBar.time as string,
          symbol,
          side: "long",
          entryPrice: openTrade.entryPrice,
          exitPrice,
          shares: openTrade.shares,
          pnl,
          pnlPct,
          holdingDays,
          reason: hitStop ? "Stop Loss" : hitTarget ? "Take Profit" : "Sell Signal",
        });

        openTrade = null;
      }
    }

    if (!openTrade) {
      const score = computeScore(indicators, changePercent);
      const action = actionFromScore(score);

      if (action === "BUY" || action === "STRONG BUY") {
        const budget = Math.min(budgetPerTrade, cash * 0.3);
        const shares = Math.floor(budget / currentBar.close);

        if (shares > 0 && cash >= shares * currentBar.close) {
          cash -= shares * currentBar.close;
          openTrade = {
            entryIdx: i,
            entryPrice: currentBar.close,
            shares,
            stopLoss: currentBar.close * (1 - STOP_LOSS_PCT),
            takeProfit: currentBar.close * (1 + TAKE_PROFIT_PCT),
          };
        }
      }
    }

    const openValue = openTrade ? openTrade.shares * currentBar.close : 0;
    const totalEquity = cash + openValue;
    equity.push(Math.round(totalEquity * 100) / 100);

    if (totalEquity > peakEquity) peakEquity = totalEquity;
    const drawdown = (peakEquity - totalEquity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  if (openTrade && bars.length > 0) {
    const lastBar = bars[bars.length - 1]!;
    const exitPrice = lastBar.close;
    const pnl = (exitPrice - openTrade.entryPrice) * openTrade.shares;
    trades.push({
      entryDate: bars[openTrade.entryIdx]!.time as string,
      exitDate: lastBar.time as string,
      symbol, side: "long",
      entryPrice: openTrade.entryPrice, exitPrice,
      shares: openTrade.shares, pnl,
      pnlPct: (exitPrice - openTrade.entryPrice) / openTrade.entryPrice * 100,
      holdingDays: bars.length - 1 - openTrade.entryIdx,
      reason: "Period End",
    });
    cash += exitPrice * openTrade.shares;
  }

  const winning = trades.filter(t => t.pnl > 0);
  const losing = trades.filter(t => t.pnl <= 0);
  const winRate = trades.length > 0 ? winning.length / trades.length : 0;
  const totalReturn = equity[equity.length - 1]! - equity[0]!;
  const totalReturnPct = totalReturn / equity[0]! * 100;

  const avgWin = winning.length > 0 ? winning.reduce((s, t) => s + t.pnl, 0) / winning.length : 0;
  const avgLoss = losing.length > 0 ? losing.reduce((s, t) => s + t.pnl, 0) / losing.length : 0;

  const grossProfit = winning.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losing.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  const avgHoldingDays = trades.length > 0 ? trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length : 0;
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.pnl)) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.pnl)) : 0;

  const dailyReturns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    dailyReturns.push((equity[i]! - equity[i - 1]!) / equity[i - 1]!);
  }
  const meanReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const stdReturn = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (dailyReturns.length - 1))
    : 0.01;
  const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

  const summary = `Backtested ${symbol} over ${period}: ${trades.length} trades, ${(winRate * 100).toFixed(0)}% win rate, ${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}% total return. Max drawdown: ${(maxDrawdown * 100).toFixed(1)}%. Sharpe ratio: ${sharpeRatio.toFixed(2)}.`;

  return {
    symbol, period,
    totalTrades: trades.length,
    winningTrades: winning.length,
    losingTrades: losing.length,
    winRate: Math.round(winRate * 1000) / 10,
    totalReturn: Math.round(totalReturn * 100) / 100,
    totalReturnPct: Math.round(totalReturnPct * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    maxDrawdownPct: Math.round(maxDrawdown * 10000) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    avgHoldingDays: Math.round(avgHoldingDays * 10) / 10,
    bestTrade: Math.round(bestTrade * 100) / 100,
    worstTrade: Math.round(worstTrade * 100) / 100,
    equity,
    trades: trades.slice(-20),
    summary,
  };
}
