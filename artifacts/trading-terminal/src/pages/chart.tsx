import React, { useState, useEffect, useRef } from "react";
import { useGetMarketHistory, useGetQuote } from "@workspace/api-client-react";
import { useAppState } from "@/hooks/use-app-state";
import { TerminalCard, PageTransition, TerminalSkeleton, ErrorPanel, PriceChange } from "@/components/terminal-ui";
import { formatPrice } from "@/lib/utils";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  ColorType,
  CrosshairMode,
  LineStyle,
} from "lightweight-charts";

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
const PERIODS = ['1D', '5D', '1M', '3M', '6M', '1Y'] as const;

const CHART_COLORS = {
  background: "#0a0a0a",
  text: "#6b7280",
  grid: "#161616",
  border: "#212121",
  crosshair: "#6b7280",
  upColor: "#22c55e",
  downColor: "#ef4444",
  wickUp: "#22c55e",
  wickDown: "#ef4444",
  volumeUp: "rgba(34,197,94,0.35)",
  volumeDown: "rgba(239,68,68,0.35)",
};

const OVERLAY_COLORS = {
  ichimokuTenkan: "#e879f9",
  ichimokuKijun: "#3b82f6",
  ichimokuSenkouA: "rgba(34,197,94,0.15)",
  ichimokuSenkouB: "rgba(239,68,68,0.15)",
  stochasticK: "#f59e0b",
  stochasticD: "#a78bfa",
  psar: "#facc15",
};

const OVERLAYS = [
  { id: "ichimoku", label: "Ichimoku" },
  { id: "stochastic", label: "Stochastic" },
  { id: "psar", label: "Parabolic SAR" },
] as const;

type OverlayId = (typeof OVERLAYS)[number]["id"];

function formatCandleTime(timestamp: string | number): number {
  const d = new Date(timestamp);
  return Math.floor(d.getTime() / 1000);
}

function computeIchimoku(sorted: { time: number; high: number; low: number; close: number }[]) {
  const tenkanPeriod = 9;
  const kijunPeriod = 26;
  const senkouBPeriod = 52;
  const displacement = 26;

  const tenkan: LineData[] = [];
  const kijun: LineData[] = [];
  const senkouA: LineData[] = [];
  const senkouB: LineData[] = [];
  const chikou: LineData[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const bar = sorted[i]!;

    if (i >= tenkanPeriod - 1) {
      const slice = sorted.slice(i - tenkanPeriod + 1, i + 1);
      const hi = Math.max(...slice.map(b => b.high));
      const lo = Math.min(...slice.map(b => b.low));
      tenkan.push({ time: bar.time as any, value: Math.round(((hi + lo) / 2) * 100) / 100 });
    }

    if (i >= kijunPeriod - 1) {
      const slice = sorted.slice(i - kijunPeriod + 1, i + 1);
      const hi = Math.max(...slice.map(b => b.high));
      const lo = Math.min(...slice.map(b => b.low));
      kijun.push({ time: bar.time as any, value: Math.round(((hi + lo) / 2) * 100) / 100 });
    }

    const dispIndex = i - displacement;
    if (dispIndex >= tenkanPeriod - 1 && dispIndex >= kijunPeriod - 1) {
      const tSlice = sorted.slice(dispIndex - tenkanPeriod + 1, dispIndex + 1);
      const kSlice = sorted.slice(dispIndex - kijunPeriod + 1, dispIndex + 1);
      const tHi = Math.max(...tSlice.map(b => b.high));
      const tLo = Math.min(...tSlice.map(b => b.low));
      const kHi = Math.max(...kSlice.map(b => b.high));
      const kLo = Math.min(...kSlice.map(b => b.low));
      const tVal = (tHi + tLo) / 2;
      const kVal = (kHi + kLo) / 2;
      senkouA.push({ time: bar.time as any, value: Math.round(((tVal + kVal) / 2) * 100) / 100 });
    }

    if (dispIndex >= senkouBPeriod - 1) {
      const slice = sorted.slice(dispIndex - senkouBPeriod + 1, dispIndex + 1);
      const hi = Math.max(...slice.map(b => b.high));
      const lo = Math.min(...slice.map(b => b.low));
      senkouB.push({ time: bar.time as any, value: Math.round(((hi + lo) / 2) * 100) / 100 });
    }

    if (i + displacement < sorted.length) {
      chikou.push({ time: sorted[i + displacement]!.time as any, value: Math.round(bar.close * 100) / 100 });
    }
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

function computeStochastic(sorted: { time: number; high: number; low: number; close: number }[], period = 14, smoothK = 3, smoothD = 3) {
  const rawK: number[] = [];
  for (let i = period - 1; i < sorted.length; i++) {
    const slice = sorted.slice(i - period + 1, i + 1);
    const hi = Math.max(...slice.map(b => b.high));
    const lo = Math.min(...slice.map(b => b.low));
    const close = sorted[i]!.close;
    rawK.push(hi !== lo ? ((close - lo) / (hi - lo)) * 100 : 50);
  }

  const smaSeries = (arr: number[], p: number) => {
    const result: number[] = [];
    for (let i = p - 1; i < arr.length; i++) {
      const s = arr.slice(i - p + 1, i + 1);
      result.push(s.reduce((a, b) => a + b, 0) / p);
    }
    return result;
  };

  const kLine = smaSeries(rawK, smoothK);
  const dLine = smaSeries(kLine, smoothD);

  const offset = period - 1 + smoothK - 1;
  const kData: LineData[] = kLine.map((v, i) => ({
    time: sorted[i + offset]!.time as any,
    value: Math.round(v * 10) / 10,
  }));
  const dOffset = offset + smoothD - 1;
  const dData: LineData[] = dLine.map((v, i) => ({
    time: sorted[i + dOffset]!.time as any,
    value: Math.round(v * 10) / 10,
  }));

  return { k: kData, d: dData };
}

function computePSAR(sorted: { time: number; high: number; low: number; close: number }[], step = 0.02, maxAF = 0.2) {
  if (sorted.length < 2) return [];
  const result: LineData[] = [];
  let bull = true;
  let af = step;
  let ep = sorted[0]!.high;
  let sar = sorted[0]!.low;

  for (let i = 1; i < sorted.length; i++) {
    const bar = sorted[i]!;
    const prevBar = sorted[i - 1]!;

    sar = sar + af * (ep - sar);

    if (bull) {
      sar = Math.min(sar, prevBar.low, i >= 2 ? sorted[i - 2]!.low : prevBar.low);
      if (bar.low < sar) {
        bull = false;
        sar = ep;
        ep = bar.low;
        af = step;
      } else {
        if (bar.high > ep) {
          ep = bar.high;
          af = Math.min(af + step, maxAF);
        }
      }
    } else {
      sar = Math.max(sar, prevBar.high, i >= 2 ? sorted[i - 2]!.high : prevBar.high);
      if (bar.high > sar) {
        bull = true;
        sar = ep;
        ep = bar.high;
        af = step;
      } else {
        if (bar.low < ep) {
          ep = bar.low;
          af = Math.min(af + step, maxAF);
        }
      }
    }

    result.push({ time: bar.time as any, value: Math.round(sar * 100) / 100 });
  }

  return result;
}

export default function ChartPage() {
  const { selectedSymbol } = useAppState();
  const [timeframe, setTimeframe] = useState<string>('1d');
  const [period, setPeriod] = useState<string>('3M');
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayId>>(new Set());

  const { data: quote } = useGetQuote(selectedSymbol, { query: { refetchInterval: 10000 } });
  const { data: history, isLoading, error } = useGetMarketHistory(selectedSymbol, { timeframe, period });

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const ichimokuSeriesRef = useRef<{
    tenkan: ISeriesApi<"Line"> | null;
    kijun: ISeriesApi<"Line"> | null;
    senkouA: ISeriesApi<"Line"> | null;
    senkouB: ISeriesApi<"Line"> | null;
  }>({ tenkan: null, kijun: null, senkouA: null, senkouB: null });

  const stochasticSeriesRef = useRef<{
    k: ISeriesApi<"Line"> | null;
    d: ISeriesApi<"Line"> | null;
  }>({ k: null, d: null });

  const psarSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

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
        vertLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: "#212121" },
        horzLine: { color: CHART_COLORS.crosshair, labelBackgroundColor: "#212121" },
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

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ichimokuSeriesRef.current = { tenkan: null, kijun: null, senkouA: null, senkouB: null };
      stochasticSeriesRef.current = { k: null, d: null };
      psarSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!history || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const seen = new Set<number>();
    const candleData: CandlestickData[] = [];
    const volumeData: HistogramData[] = [];

    const sorted = [...history].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    const sortedBars: { time: number; open: number; high: number; low: number; close: number }[] = [];

    for (const bar of sorted) {
      const t = formatCandleTime(bar.time);
      if (seen.has(t)) continue;
      seen.add(t);

      const open = bar.open ?? bar.close;
      const high = bar.high ?? bar.close;
      const low = bar.low ?? bar.close;
      const close = bar.close;

      if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) continue;

      candleData.push({ time: t as any, open, high, low, close });
      volumeData.push({
        time: t as any,
        value: bar.volume ?? 0,
        color: close >= open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      });
      sortedBars.push({ time: t, open, high, low, close });
    }

    if (candleData.length === 0) return;

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    const chart = chartRef.current;
    if (!chart) return;

    const ich = ichimokuSeriesRef.current;
    if (ich.tenkan) { chart.removeSeries(ich.tenkan); ich.tenkan = null; }
    if (ich.kijun) { chart.removeSeries(ich.kijun); ich.kijun = null; }
    if (ich.senkouA) { chart.removeSeries(ich.senkouA); ich.senkouA = null; }
    if (ich.senkouB) { chart.removeSeries(ich.senkouB); ich.senkouB = null; }
    const stoch = stochasticSeriesRef.current;
    if (stoch.k) { chart.removeSeries(stoch.k); stoch.k = null; }
    if (stoch.d) { chart.removeSeries(stoch.d); stoch.d = null; }
    if (psarSeriesRef.current) { chart.removeSeries(psarSeriesRef.current); psarSeriesRef.current = null; }

    if (activeOverlays.has("ichimoku") && sortedBars.length >= 52) {
      const { tenkan, kijun, senkouA, senkouB } = computeIchimoku(sortedBars);
      ich.tenkan = chart.addLineSeries({ color: OVERLAY_COLORS.ichimokuTenkan, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false });
      ich.kijun = chart.addLineSeries({ color: OVERLAY_COLORS.ichimokuKijun, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false });
      ich.senkouA = chart.addLineSeries({ color: OVERLAY_COLORS.ichimokuSenkouA, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false });
      ich.senkouB = chart.addLineSeries({ color: OVERLAY_COLORS.ichimokuSenkouB, lineWidth: 1, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false });
      if (tenkan.length) ich.tenkan.setData(tenkan);
      if (kijun.length) ich.kijun.setData(kijun);
      if (senkouA.length) ich.senkouA.setData(senkouA);
      if (senkouB.length) ich.senkouB.setData(senkouB);
    }

    if (activeOverlays.has("stochastic") && sortedBars.length >= 20) {
      const { k, d } = computeStochastic(sortedBars);
      stoch.k = chart.addLineSeries({ color: OVERLAY_COLORS.stochasticK, lineWidth: 1, priceScaleId: "stoch", lastValueVisible: true, priceLineVisible: false, lineStyle: LineStyle.Solid });
      stoch.d = chart.addLineSeries({ color: OVERLAY_COLORS.stochasticD, lineWidth: 1, priceScaleId: "stoch", lastValueVisible: true, priceLineVisible: false, lineStyle: LineStyle.Dashed });
      chart.priceScale("stoch").applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 }, });
      if (k.length) stoch.k.setData(k);
      if (d.length) stoch.d.setData(d);
    }

    if (activeOverlays.has("psar") && sortedBars.length >= 5) {
      const psarData = computePSAR(sortedBars);
      psarSeriesRef.current = chart.addLineSeries({ color: OVERLAY_COLORS.psar, lineWidth: 0, priceScaleId: "right", lastValueVisible: false, priceLineVisible: false, pointMarkersVisible: true });
      if (psarData.length) psarSeriesRef.current.setData(psarData);
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
    <PageTransition>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 font-mono">
            {selectedSymbol}
            {quote && <span className="font-mono text-xl">{formatPrice(quote.price)}</span>}
            {quote && <PriceChange value={quote.changePercent} className="text-lg" />}
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
          Bullish candle
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className="w-3 h-3 rounded-sm bg-bearish inline-block" />
          Bearish candle
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className="w-8 h-px bg-muted-foreground inline-block" />
          Volume histogram
        </div>
        {activeOverlays.has("ichimoku") && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <span className="w-6 h-px inline-block" style={{ background: OVERLAY_COLORS.ichimokuTenkan }} />
              Tenkan
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <span className="w-6 h-px inline-block" style={{ background: OVERLAY_COLORS.ichimokuKijun }} />
              Kijun
            </div>
          </>
        )}
        {activeOverlays.has("stochastic") && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <span className="w-6 h-px inline-block" style={{ background: OVERLAY_COLORS.stochasticK }} />
              Stoch %K
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <span className="w-6 h-px inline-block" style={{ background: OVERLAY_COLORS.stochasticD }} />
              Stoch %D
            </div>
          </>
        )}
        {activeOverlays.has("psar") && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: OVERLAY_COLORS.psar }} />
            Parabolic SAR
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground">TradingView Lightweight Charts • Paper Trading Only</span>
      </div>
    </PageTransition>
  );
}
