import React from "react";
import { cn, formatPercent } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";

export function TerminalCard({ className, children, title, action }: { className?: string; children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  return (
    <div className={cn("bg-card border border-border rounded-xl shadow-lg flex flex-col overflow-hidden relative", className)}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      {title && (
        <div className="px-5 py-4 border-b border-border/50 flex justify-between items-center bg-muted/20">
          <h3 className="font-semibold text-sm tracking-wide text-foreground/90 uppercase">{title}</h3>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5 flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

export function TerminalButton({ className, variant = "default", size = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" | "bullish" | "bearish", size?: "default" | "sm" | "lg" }) {
  const base = "inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-95";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(6,182,212,0.2)]",
    outline: "border border-border bg-transparent hover:bg-muted text-foreground",
    ghost: "bg-transparent hover:bg-muted text-foreground",
    bullish: "bg-bullish text-white hover:bg-bullish/90 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
    bearish: "bg-bearish text-white hover:bg-bearish/90 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
  };
  const sizes = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-8 px-3 text-xs",
    lg: "h-12 px-6 text-base",
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}

export function TerminalInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono",
        className
      )}
      {...props}
    />
  );
}

export function TerminalLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block", className)} {...props} />;
}

export function SignalBadge({ signal, className }: { signal?: string | null; className?: string }) {
  if (!signal) return <span className="text-muted-foreground">—</span>;
  const s = signal.toLowerCase();
  
  if (s === "bullish" || s === "long") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-bullish-muted text-bullish border border-bullish/20", className)}>
        <TrendingUp className="w-3 h-3" /> {signal.toUpperCase()}
      </span>
    );
  }
  if (s === "bearish" || s === "short") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-bearish-muted text-bearish border border-bearish/20", className)}>
        <TrendingDown className="w-3 h-3" /> {signal.toUpperCase()}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-neutral-muted text-neutral border border-neutral/20", className)}>
      <Minus className="w-3 h-3" /> {signal.toUpperCase()}
    </span>
  );
}

export function PriceChange({ value, className }: { value?: number | null; className?: string }) {
  if (value === undefined || value === null) return <span>—</span>;
  const isPositive = value > 0;
  const isNegative = value < 0;
  
  return (
    <span className={cn("font-mono", isPositive ? "text-bullish drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]" : isNegative ? "text-bearish drop-shadow-[0_0_4px_rgba(239,68,68,0.3)]" : "text-muted-foreground", className)}>
      {isPositive ? "+" : ""}{formatPercent(value)}
    </span>
  );
}

export function DataPoint({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      <span className={cn("font-mono font-medium text-foreground", valueClass)}>{value}</span>
    </div>
  );
}

export function TerminalSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/50", className)} />;
}

export function ErrorPanel({ error }: { error: any }) {
  return (
    <div className="w-full p-4 border border-destructive/30 bg-destructive/10 rounded-lg flex items-start gap-3 text-destructive">
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <h4 className="font-semibold text-sm">Failed to load data</h4>
        <p className="text-xs opacity-80 font-mono mt-1">{error?.message || "Unknown error occurred"}</p>
      </div>
    </div>
  );
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="h-full flex flex-col gap-6">
      {children}
    </motion.div>
  );
}

export function TerminalTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-muted/30">
          <tr className="border-b border-border/50 text-muted-foreground">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/20">
          {children}
        </tbody>
      </table>
    </div>
  );
}
