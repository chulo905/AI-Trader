import React, { useState, useEffect, useRef } from "react";
import { useGetMarketHistory, useGetQuote } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, PriceChange } from "@/components/terminal-ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { formatPrice } from "@/lib/utils";
import { CHART_COLORS, OVERLAY_COLORS } from "@/lib/chart-constants";
import {
  computeIchimoku, computeStochastic, computePSAR,
  computeSMA, computeEMA, computeBollinger, computeRSI,
} from "@/lib/indicators";
import type { OhlcBar } from "@/lib/indicators";
import type { GetMarketHistoryTimeframe, GetMarketHistoryPeriod } from "@workspace/api-client-react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  ColorType,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";

function LegendSwatch({ color, dot }: { color: string; dot?: boolean }) {
  const cssVar = { "--swatch-color": color } as React.CSSProperties;
  return dot
    ? <span className="w-2 h-2 rounded-full inline-block [background:var(--swatch-color)]" style={cssVar} />
    : <span className="w-6 h-px inline-block [background:var(--swatch-color)]" style={cssVar} />;
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
const PERIODS = ['1D', '5D', '1M', '3M', '6M', '1Y'] as const;

const OVERLAYS = [
  { id: "sma", label: "SMA 20/50" },
  { id: "ema", label: "EMA 20" },
  { id: "bollinger", label: "Bollinger" },
  { id: "rsi", label: "RSI" },
  { id: "ichimoku", label: "Ichimoku" },
  { id: "stochastic", label: "Stochastic" },
  { id: "psar", label: "Parabolic SAR" },
] as const;

type OverlayId = (typeof OVERLAYS)[number]["id"];

function formatCandleTime(timestamp: string | number): number {
  return Math.floor(new Date(timestamp).getTime() / 1000);
}

interface OverlaySeries {
  ichimoku: {
    tenkan: ISeriesApi<"Line"> | null;
    kijun: ISeriesApi<"Line"> | null;
    senkouA: ISeriesApi<"Line"> | null;
    senkouB: ISeriesApi<"Line"> | null;
  };
  stochastic: { k: ISeriesApi<"Line"> | null; d: ISeriesApi<"Line"> | null };
  psar: ISeriesApi<"Line"> | null;
  sma20: ISeriesApi<"Line"> | null;
  sma50: ISeriesApi<"Line"> | null;
  ema20: ISeriesApi<"Line"> | null;
  bollinger: {
    upper: ISeriesApi<"Line"> | null;
    middle: ISeriesApi<"Line"> | null;
    lower: ISeriesApi<"Line"> | null;
  };
  rsi: ISeriesApi<"Line"> | null;
}

function makeOverlaySeries(): OverlaySeries {
  return {
    ichimoku: { tenkan: null, kijun: null, senkouA: null, senkouB: null },
    stochastic: { k: null, d: null },
    psar: null,
    sma20: null,
    sma50: null,
    ema20: null,
    bollinger: { upper: null, middle: null, lower: null },
    rsi: null,
  };
}

function clearOverlaySeries(chart: IChartApi, series: OverlaySeries) {
  const ich = series.ichimoku;
  if (ich.tenkan) { chart.removeSeries(ich.tenkan); ich.tenkan = null; }
  if (ich.kijun) { chart.removeSeries(ich.kijun); ich.kijun = null; }
  if (ich.senkouA) { chart.removeSeries(ich.senkouA); ich.senkouA = null; }
  if (ich.senkouB) { chart.removeSeries(ich.senkouB); ich.senkouB = null; }
  const st = series.stochastic;
  if (st.k) { chart.removeSeries(st.k); st.k = null; }
  if (st.d) { chart.removeSeries(st.d); st.d = null; }
  if (series.psar) { chart.removeSeries(series.psar); series.psar = null; }
  if (series.sma20) { chart.removeSeries(series.sma20); series.sma20 = null; }
  if (series.sma50) { chart.removeSeries(series.sma50); series.sma50 = null; }
  if (series.ema20) { chart.removeSeries(series.ema20); series.ema20 = null; }
  const bb = series.bollinger;
  if (bb.upper) { chart.removeSeries(bb.upper); bb.upper = null; }
  if (bb.middle) { chart.removeSeries(bb.middle); bb.middle = null; }
  if (bb.lower) { chart.removeSeries(bb.lower); bb.lower = null; }
  if (series.rsi) { chart.removeSeries(series.rsi); series.rsi = null; }
}

function DataDelayBadge({ dataDelay }: { dataDelay?: string }) {
  if (!dataDelay || dataDelay === "realtime") return null;
  if (dataDelay === "mock") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
        SIMULATED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
      15-MIN DELAYED
    </span>
  );
}

function ChartWidget({ symbol }: { symbol: string }) {
  const [timeframe, setTimeframe] = useState<GetMarketHistoryTimeframe>('1d');
  const [period, setPeriod] = useState<GetMarketHistoryPeriod>('3M');
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayId>>(new Set());

  const { data: quote } = useGetQuote(symbol, { query: { refetchInterval: 10000 } });
  const { data: historyData, isLoading, error } = useGetMarketHistory(symbol, { timeframe, period });
  const quoteExt = quote as (typeof quote & { dataDelay?: string; isMock?: boolean }) | undefined;

  const historyDataRaw = historyData as unknown as { candles: typeof historyData; isMock: boolean; dataDelay: string } | null;
  const history = Array.isArray((historyData as any)?.candles) ? (historyData as any).candles : Array.isArray(historyData) ? historyData : undefined;
  const historyDataDelay = historyDataRaw?.dataDelay;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const overlayRef = useRef<OverlaySeries>(makeOverlaySeries());

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: CHART_COLORS.border },
        horzLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: CHART_COLORS.border },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
      watermark: { visible: false },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      borderUpColor: CHART_COLORS.upColor,
      borderDownColor: CHART_COLORS.downColor,
      wickUpColor: CHART_COLORS.wickUp,
      wickDownColor: CHART_COLORS.wickDown,
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      clearOverlaySeries(chart, overlayRef.current);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      overlayRef.current = makeOverlaySeries();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!history || !candleSeriesRef.current || !volumeSeriesRef.current || !chart) return;

    const seen = new Set<number>();
    const candleData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];
    const sortedBars: OhlcBar[] = [];

    const sorted = [...history].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    for (const bar of sorted) {
      const t = formatCandleTime(bar.time);
      if (seen.has(t)) continue;
      seen.add(t);

      const open = bar.open ?? bar.close;
      const high = bar.high ?? bar.close;
      const low = bar.low ?? bar.close;
      const close = bar.close;

      if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) continue;

      candleData.push({ time: t as unknown as CandlestickData["time"], open, high, low, close });
      volumeData.push({
        time: t as unknown as HistogramData["time"],
        value: bar.volume ?? 0,
        color: close >= open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      });
      sortedBars.push({ time: t, open, high, low, close });
    }

    if (candleData.length === 0) return;

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    clearOverlaySeries(chart, overlayRef.current);
    const ov = overlayRef.current;

    if (activeOverlays.has("sma") && sortedBars.length >= 20) {
      const sma20Data = computeSMA(sortedBars, 20);
      ov.sma20 = chart.addLineSeries({ color: OVERLAY_COLORS.sma20, lineWidth: 1, priceScaleId: "right", lastValueVisible: true, priceLineVisible: false });
      if (sma20Data.length) ov.sma20.setData(sma20Data);

      if (sortedBars.length >= 50) {
        const sma50Data = computeSMA(sortedBars, 50);
        ov.sma50 = chart.addLineSeries({ color: OVERLAY_COLORS.sma50, lineWidth: 1, priceScaleId: "right", lastValueVisible: true, priceLineVisible: false });
        if (sma50Data.length) ov.sma50.setData(sma50Data);
      }
    }

    if (activeOverlays.has("ema") && sortedBars.length >= 20) {
      const ema20Data = computeEMA(sortedBars, 20);
      ov.ema20 = chart.addLineSeries({ color: OVERLAY_COLORS.ema20, lineWidth: 1, priceScaleId: "right", lastValueVisible: true, priceLineVisible: false });
      if (ema20Data.length) ov.ema20.setData(ema20Data);
    }

    if (activeOverlays.has("bollinger") && sortedBars.length >= 20) {
      const { upper, middle, lower } = computeBollinger(sortedBars);
      ov.bollinger.upper = chart.addLineSeries({ color: OVERLAY_COLORS.bollingerUpper, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false, lineStyle: LineStyle.Dashed });
      ov.bollinger.middle = chart.addLineSeries({ color: OVERLAY_COLORS.bollingerMiddle, lineWidth: 1, priceScaleId: "right", lastValueVisible: true, priceLineVisible: false });
      ov.bollinger.lower = chart.addLineSeries({ color: OVERLAY_COLORS.bollingerLower, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false, lineStyle: LineStyle.Dashed });
      if (upper.length) ov.bollinger.upper.setData(upper);
      if (middle.length) ov.bollinger.middle.setData(middle);
      if (lower.length) ov.bollinger.lower.setData(lower);
    }

    if (activeOverlays.has("rsi") && sortedBars.length >= 15) {
      const rsiData = computeRSI(sortedBars);
      ov.rsi = chart.addLineSeries({ color: OVERLAY_COLORS.rsi, lineWidth: 1, priceScaleId: "rsi", lastValueVisible: true, priceLineVisible: false });
      chart.priceScale("rsi").applyOptions({ scaleMargins: { top: 0.72, bottom: 0.02 } });
      if (rsiData.length) ov.rsi.setData(rsiData);
    }

    if (activeOverlays.has("ichimoku") && sortedBars.length >= 52) {
      const { tenkan, kijun, senkouA, senkouB } = computeIchimoku(sortedBars);
      ov.ichimoku.tenkan = chart.addLineSeries({ color: OVERLAY_COLORS.ichimokuTenkan, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false });
      ov.ichimoku.kijun = chart.addLineSeries({ color: OVERLAY_COLORS.ichimokuKijun, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false });
      ov.ichimoku.senkouA = chart.addLineSeries({ color: OVERLAY_COLORS.ichimokuSenkouA, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false });
      ov.ichimoku.senkouB = chart.addLineSeries({ color: OVERLAY_COLORS.ichimokuSenkouB, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false });
      if (tenkan.length) ov.ichimoku.tenkan.setData(tenkan);
      if (kijun.length) ov.ichimoku.kijun.setData(kijun);
      if (senkouA.length) ov.ichimoku.senkouA.setData(senkouA);
      if (senkouB.length) ov.ichimoku.senkouB.setData(senkouB);
    }

    if (activeOverlays.has("stochastic") && sortedBars.length >= 20) {
      const { k, d } = computeStochastic(sortedBars);
      ov.stochastic.k = chart.addLineSeries({ color: OVERLAY_COLORS.stochasticK, lineWidth: 1, priceScaleId: "stoch", lastValueVisible: true, priceLineVisible: false });
      ov.stochastic.d = chart.addLineSeries({ color: OVERLAY_COLORS.stochasticD, lineWidth: 1, priceScaleId: "stoch", lastValueVisible: true, priceLineVisible: false, lineStyle: LineStyle.Dashed });
      chart.priceScale("stoch").applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 } });
      if (k.length) ov.stochastic.k.setData(k);
      if (d.length) ov.stochastic.d.setData(d);
    }

    if (activeOverlays.has("psar") && sortedBars.length >= 5) {
      const psarData = computePSAR(sortedBars);
      ov.psar = chart.addLineSeries({ color: OVERLAY_COLORS.psar, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false, pointMarkersVisible: true });
      if (psarData.length) ov.psar.setData(psarData);
    }

    chart.timeScale().fitContent();
  }, [history, activeOverlays]);

  const toggleOverlay = (id: OverlayId) => {
    setActiveOverlays(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 font-mono">
            {symbol}
            {quote && <span className="font-mono text-xl">{formatPrice(quote.price)}</span>}
            {quote && <PriceChange value={quote.changePercent} className="text-lg" />}
            <DataDelayBadge dataDelay={quoteExt?.dataDelay} />
          </h1>
          <p className="text-sm text-muted-foreground">{quote?.name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-muted/50 p-1 rounded-sm border border-border/50">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-mono rounded-sm transition-all ${
                  timeframe === tf
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex bg-muted/50 p-1 rounded-sm border border-border/50">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-mono rounded-sm transition-all ${
                  period === p
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs text-muted-foreground font-mono self-center">Overlays:</span>
        {OVERLAYS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => toggleOverlay(id)}
            className={`px-3 py-1 text-xs font-mono rounded-md border transition-all ${
              activeOverlays.has(id)
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {label}
            {activeOverlays.has(id) && (
              <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
            )}
          </button>
        ))}
      </div>

      <TerminalCard className="flex-1 min-h-[600px] p-0 relative overflow-hidden">
        {error && <div className="absolute inset-0 p-6 z-10"><ErrorPanel error={error} /></div>}
        {isLoading && !error && <TerminalSkeleton className="absolute inset-0 z-10" />}
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
      </TerminalCard>

      <div className="flex flex-wrap gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className="w-3 h-3 rounded-sm bg-bullish inline-block" />
          Bullish
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className="w-3 h-3 rounded-sm bg-bearish inline-block" />
          Bearish
        </div>
        {activeOverlays.has("sma") && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <LegendSwatch color={OVERLAY_COLORS.sma20} />
              SMA 20
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <LegendSwatch color={OVERLAY_COLORS.sma50} />
              SMA 50
            </div>
          </>
        )}
        {activeOverlays.has("ema") && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <LegendSwatch color={OVERLAY_COLORS.ema20} />
            EMA 20
          </div>
        )}
        {activeOverlays.has("bollinger") && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <LegendSwatch color={OVERLAY_COLORS.bollingerMiddle} />
            Bollinger Bands
          </div>
        )}
        {activeOverlays.has("rsi") && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <LegendSwatch color={OVERLAY_COLORS.rsi} />
            RSI
          </div>
        )}
        {activeOverlays.has("ichimoku") && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <LegendSwatch color={OVERLAY_COLORS.ichimokuTenkan} />
              Tenkan
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <LegendSwatch color={OVERLAY_COLORS.ichimokuKijun} />
              Kijun
            </div>
          </>
        )}
        {activeOverlays.has("stochastic") && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <LegendSwatch color={OVERLAY_COLORS.stochasticK} />
              Stoch %K
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <LegendSwatch color={OVERLAY_COLORS.stochasticD} />
              Stoch %D
            </div>
          </>
        )}
        {activeOverlays.has("psar") && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <LegendSwatch color={OVERLAY_COLORS.psar} dot />
            Parabolic SAR
          </div>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {historyDataDelay && historyDataDelay !== "realtime" && (
            <DataDelayBadge dataDelay={historyDataDelay} />
          )}
          TradingView Lightweight Charts • Paper Trading Only
        </span>
      </div>
    </>
  );
}

export default function ChartPage() {
  const { selectedSymbol } = useAppState();

  return (
    <PageTransition>
      <ErrorBoundary label="Chart">
        <ChartWidget symbol={selectedSymbol} />
      </ErrorBoundary>
    </PageTransition>
  );
}
