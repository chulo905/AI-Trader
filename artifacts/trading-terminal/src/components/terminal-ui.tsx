import React from "react";
import { cn, formatPercent } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertCircle, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from "lucide-react";

/* ── Card ──────────────────────────────────────────────────────────────── */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("bg-card border border-border rounded-sm overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("px-5 py-3.5 border-b border-border flex items-center justify-between", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h3 className={cn("text-[11px] font-semibold text-muted-foreground uppercase tracking-widest", className)}>
      {children}
    </h3>
  );
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

/* ── Legacy TerminalCard ─────────────────────────────────────────────── */
export function TerminalCard({ className, children, title, action }: { className?: string; children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {action && <div>{action}</div>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ── Button ─────────────────────────────────────────────────────────────── */
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "success" | "danger" | "warning";
  size?: "sm" | "md" | "lg" | "xl";
}

export function Btn({ className, variant = "primary", size = "md", children, ...props }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/50 disabled:opacity-30 disabled:pointer-events-none active:scale-[0.99] tracking-tight";
  const v = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost:   "text-muted-foreground hover:text-foreground hover:bg-muted",
    outline: "border border-border text-foreground hover:bg-muted",
    success: "bg-bullish text-white hover:bg-bullish/90",
    danger:  "bg-bearish text-white hover:bg-bearish/90",
    warning: "bg-warning text-black hover:bg-warning/90",
  };
  const s = {
    sm: "h-7 px-3 text-xs",
    md: "h-9 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
    xl: "h-13 px-7 text-base",
  };
  return <button className={cn(base, v[variant], s[size], className)} {...props}>{children}</button>;
}

/* Legacy aliases */
export function TerminalButton({ className, variant = "default", size = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" | "bullish" | "bearish", size?: "default" | "sm" | "lg" }) {
  const variantMap = { default: "primary", outline: "outline", ghost: "ghost", bullish: "success", bearish: "danger" } as const;
  const sizeMap = { default: "md", sm: "sm", lg: "lg" } as const;
  return <Btn className={className} variant={variantMap[variant]} size={sizeMap[size]} {...props} />;
}

export function TerminalInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("flex h-9 w-full rounded-sm border border-border bg-muted px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 focus:border-foreground/30 transition-all", className)}
      {...props}
    />
  );
}

export function TerminalLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 block", className)} {...props} />;
}

/* ── AI Action Badge ─────────────────────────────────────────────────────── */
export function ActionBadge({ action, className }: { action: string; className?: string }) {
  const a = action.toUpperCase();
  if (a.includes("STRONG BUY")) return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-bold text-xs bg-bullish/12 text-bullish border border-bullish/25 tracking-wider", className)}>
      <ArrowUp className="w-3.5 h-3.5" /> STRONG BUY
    </span>
  );
  if (a.includes("BUY")) return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-bold text-xs bg-bullish/10 text-bullish border border-bullish/20 tracking-wider", className)}>
      <TrendingUp className="w-3.5 h-3.5" /> BUY
    </span>
  );
  if (a.includes("STRONG SELL")) return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-bold text-xs bg-bearish/12 text-bearish border border-bearish/25 tracking-wider", className)}>
      <ArrowDown className="w-3.5 h-3.5" /> STRONG SELL
    </span>
  );
  if (a.includes("SELL")) return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-bold text-xs bg-bearish/10 text-bearish border border-bearish/20 tracking-wider", className)}>
      <TrendingDown className="w-3.5 h-3.5" /> SELL
    </span>
  );
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-bold text-xs bg-muted text-muted-foreground border border-border tracking-wider", className)}>
      <Minus className="w-3.5 h-3.5" /> HOLD
    </span>
  );
}

/* ── Signal Badge ─────────────────────────────────────────────────────────── */
export function SignalBadge({ signal, className }: { signal?: string | null; className?: string }) {
  if (!signal) return <span className="text-muted-foreground text-xs font-mono">—</span>;
  const s = signal.toLowerCase();
  if (s === "bullish" || s === "long" || s.includes("buy")) return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-bullish/10 text-bullish border border-bullish/20 tracking-wider", className)}>
      <TrendingUp className="w-2.5 h-2.5" /> {signal.toUpperCase()}
    </span>
  );
  if (s === "bearish" || s === "short" || s.includes("sell")) return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-bearish/10 text-bearish border border-bearish/20 tracking-wider", className)}>
      <TrendingDown className="w-2.5 h-2.5" /> {signal.toUpperCase()}
    </span>
  );
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-muted text-muted-foreground border border-border tracking-wider", className)}>
      <Minus className="w-2.5 h-2.5" /> {signal.toUpperCase()}
    </span>
  );
}

/* ── Price Change ───────────────────────────────────────────────────────── */
export function PriceChange({ value, className, showIcon }: { value?: number | null; className?: string; showIcon?: boolean }) {
  if (value === undefined || value === null) return <span className="text-muted-foreground font-mono">—</span>;
  const up = value > 0;
  const down = value < 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono font-semibold tabular-nums", up ? "text-bullish" : down ? "text-bearish" : "text-muted-foreground", className)}>
      {showIcon && up && <ArrowUp className="w-3 h-3" />}
      {showIcon && down && <ArrowDown className="w-3 h-3" />}
      {up ? "+" : ""}{formatPercent(value)}
    </span>
  );
}

/* ── Stat Card ───────────────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, valueClass, trend }: { label: string; value: React.ReactNode; sub?: React.ReactNode; valueClass?: string; trend?: number }) {
  return (
    <Card>
      <div className="p-5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
        <p className={cn("text-2xl font-bold tracking-tight font-mono tabular-nums", valueClass)}>{value}</p>
        {(sub || trend !== undefined) && (
          <div className="mt-1.5 flex items-center gap-2">
            {trend !== undefined && <PriceChange value={trend} className="text-xs" />}
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ── Data Point ─────────────────────────────────────────────────────────── */
export function DataPoint({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={cn("font-mono font-semibold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-muted", className)} />;
}

export function TerminalSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className} />;
}

/* ── Error ─────────────────────────────────────────────────────────────── */
export function ErrorPanel({ error, className }: { error: any; className?: string }) {
  return (
    <div className={cn("p-4 border border-bearish/20 bg-bearish-bg rounded-sm flex items-start gap-3", className)}>
      <AlertCircle className="w-4 h-4 text-bearish shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-bearish">Error</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{error?.message ?? "Unknown error"}</p>
      </div>
    </div>
  );
}

/* ── Page Transition ─────────────────────────────────────────────────────── */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex flex-col gap-5 h-full"
    >
      {children}
    </motion.div>
  );
}

/* ── Table ─────────────────────────────────────────────────────────────── */
export function Table({ headers, children, className }: { headers: string[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto border border-border rounded-sm", className)}>
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest first:pl-5 last:pr-5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">{children}</tbody>
      </table>
    </div>
  );
}

export function TerminalTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <Table headers={headers}>{children}</Table>;
}

/* ── Confidence Ring ─────────────────────────────────────────────────────── */
export function ConfidenceRing({ value, size = 80 }: { value: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 70 ? "#22c55e" : value >= 50 ? "#e8e8e8" : "#ef4444";
  const trackColor = "hsl(0 0% 13%)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={trackColor} strokeWidth={6} />
      <circle
        cx={size/2} cy={size/2} r={radius}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="butt"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill={color} fontSize={size * 0.2} fontWeight={700} fontFamily="'JetBrains Mono',monospace">
        {value}%
      </text>
    </svg>
  );
}

/* ── Pill tabs ─────────────────────────────────────────────────────────── */
export function PillTabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-0 border border-border rounded-sm overflow-hidden">
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "flex-1 py-1.5 px-4 text-xs font-semibold uppercase tracking-wider transition-all border-r border-border last:border-r-0",
            active === t
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
