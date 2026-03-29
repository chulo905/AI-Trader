export type { BacktestResult, BacktestTrade } from "@workspace/api-client-react";

import { useGetBacktest } from "@workspace/api-client-react";

export function useBacktest(symbol: string | null, period: string) {
  return useGetBacktest(
    symbol ?? "",
    { period },
    { query: { enabled: !!symbol } },
  );
}
