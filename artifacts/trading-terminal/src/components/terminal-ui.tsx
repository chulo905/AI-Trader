import React from "react";
import { cn, formatPercent } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, TrendingUp, TrendingDown, Minus, CheckCircle2, ArrowUp, ArrowDown } from "lucide-react";

/* ── Card ──────────────────────────────────────────────────────────────── */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("bg-card border border-border rounded-2xl overflow-hidden relative", className)}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-6 py-4 border-b border-border/60 flex items-center justify-between", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("text-sm font-semibold text-muted-foreground tracking-wide", className)}>{children}</h3>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

/* ── Legacy TerminalCard (backward compat) ─────────────────────────────── */
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
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]";
  const v = {
    primary:  "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/10",
    ghost:    "text-muted-foreground hover:text-foreground hover:bg-muted",
    outline:  "border border-border text-foreground hover:bg-muted hover:border-primary/30",
    success:  "bg-bullish text-white hover:bg-bullish/90 shadow-lg shadow-bullish/15",
    danger:   "bg-bearish text-white hover:bg-bearish/90 shadow-lg shadow-bearish/15",
    warning:  "bg-warning text-black hover:bg-warning/90 shadow-lg shadow-warning/15",
  };
  const s = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
    xl: "h-14 px-8 text-lg",
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
  return <input className={cn("flex h-10 w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all", className)} {...props} />;
}

export function TerminalLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-muted-foreground mb-1.5 block", className)} {...props} />;
}

/* ── AI Action Badge ─────────────────────────────────────────────────────── */
export function ActionBadge({ action, className }: { action: string; className?: string }) {
  const a = action.toUpperCase();
  if (a.includes("STRONG BUY")) return (
    <span className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-bullish/15 text-bullish border border-bullish/30", className)}>
      <ArrowUp className="w-4 h-4" /> STRONG BUY
    </span>
  );
  if (a.includes("BUY")) return (
    <span className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-bullish/10 text-bullish border border-bullish/20", className)}>
      <TrendingUp className="w-4 h-4" /> BUY
    </span>
  );
  if (a.includes("STRONG SELL")) return (
    <span className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-bearish/15 text-bearish border border-bearish/30", className)}>
      <ArrowDown className="w-4 h-4" /> STRONG SELL
    </span>
  );
  if (a.includes("SELL")) return (
    <span className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-bearish/10 text-bearish border border-bearish/20", className)}>
      <TrendingDown className="w-4 h-4" /> SELL
    </span>
  );
  return (
    <span className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-muted text-muted-foreground border border-border", className)}>
      <Minus className="w-4 h-4" /> HOLD
    </span>
  );
}

/* ── Signal Badge ─────────────────────────────────────────────────────────── */
export function SignalBadge({ signal, className }: { signal?: string | null; className?: string }) {
  if (!signal) return <span className="text-muted-foreground text-xs">—</span>;
  const s = signal.toLowerCase();
  if (s === "bullish" || s === "long" || s.includes("buy")) return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-bullish/10 text-bullish border border-bullish/20", className)}>
      <TrendingUp className="w-3 h-3" /> {signal.toUpperCase()}
    </span>
  );
  if (s === "bearish" || s === "short" || s.includes("sell")) return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-bearish/10 text-bearish border border-bearish/20", className)}>
      <TrendingDown className="w-3 h-3" /> {signal.toUpperCase()}
    </span>
  );
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-warning/10 text-warning border border-warning/20", className)}>
      <Minus className="w-3 h-3" /> {signal.toUpperCase()}
    </span>
  );
}

/* ── Price Change ───────────────────────────────────────────────────────── */
export function PriceChange({ value, className, showIcon }: { value?: number | null; className?: string; showIcon?: boolean }) {
  if (value === undefined || value === null) return <span className="text-muted-foreground">—</span>;
  const up = value > 0;
  const down = value < 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono font-semibold text-sm", up ? "text-bullish" : down ? "text-bearish" : "text-muted-foreground", className)}>
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
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <p className={cn("text-2xl font-bold tracking-tight", valueClass)}>{value}</p>
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
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold", valueClass)}>{value}</span>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted/60", className)} />;
}

export function TerminalSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className} />;
}

/* ── Error ─────────────────────────────────────────────────────────────── */
export function ErrorPanel({ error, className }: { error: any; className?: string }) {
  return (
    <div className={cn("p-4 border border-bearish/20 bg-bearish-bg rounded-xl flex items-start gap-3", className)}>
      <AlertCircle className="w-4 h-4 text-bearish shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-bearish">Something went wrong</p>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{error?.message ?? "Unknown error"}</p>
      </div>
    </div>
  );
}

/* ── Page Transition ─────────────────────────────────────────────────────── */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col gap-6 h-full"
    >
      {children}
    </motion.div>
  );
}

/* ── Table ─────────────────────────────────────────────────────────────── */
export function Table({ headers, children, className }: { headers: string[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-border/50", className)}>
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-xs font-medium text-muted-foreground tracking-wide first:pl-5 last:pr-5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/20">{children}</tbody>
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
  const color = value >= 70 ? "#10b981" : value >= 50 ? "#6366f1" : "#f43f5e";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(220 18% 14%)" strokeWidth={8} />
      <circle
        cx={size/2} cy={size/2} r={radius}
        fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill={color} fontSize={size * 0.22} fontWeight={700} fontFamily="Inter,sans-serif">
        {value}%
      </text>
    </svg>
  );
}

/* ── Pill tabs ─────────────────────────────────────────────────────────── */
export function PillTabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-xl">
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all",
            active === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
