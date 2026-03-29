export function calculatePnl(
  side: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  shares: number
): { realizedPnl: number; realizedPnlPercent: number } {
  const rawPnl = side === "long"
    ? (exitPrice - entryPrice) * shares
    : (entryPrice - exitPrice) * shares;
  const realizedPnl = Math.round(rawPnl * 100) / 100;
  const realizedPnlPercent = Math.round((rawPnl / (entryPrice * shares)) * 100 * 100) / 100;
  return { realizedPnl, realizedPnlPercent };
}

export function calculateUnrealizedPnl(
  side: "long" | "short",
  entryPrice: number,
  currentPrice: number,
  shares: number
): { unrealizedPnl: number; unrealizedPnlPercent: number } {
  const rawPnl = side === "long"
    ? (currentPrice - entryPrice) * shares
    : (entryPrice - currentPrice) * shares;
  const unrealizedPnl = Math.round(rawPnl * 100) / 100;
  const unrealizedPnlPercent = Math.round((rawPnl / (entryPrice * shares)) * 100 * 100) / 100;
  return { unrealizedPnl, unrealizedPnlPercent };
}
