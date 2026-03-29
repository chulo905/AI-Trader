import React from "react";
import { Link, useLocation } from "wouter";
import { useGetPortfolio } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import {
  LayoutDashboard, Sparkles, LineChart, Compass, Briefcase,
  Settings, Bot, Shield, FlaskConical, Newspaper, Cable, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { path: string; label: string; icon: React.ElementType; desc: string; highlight?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Trading",
    items: [
      { path: "/",          label: "Home",       icon: LayoutDashboard, desc: "Market overview" },
      { path: "/autopilot", label: "AI Pilot",   icon: Sparkles,        desc: "AI trading decisions", highlight: true },
      { path: "/autonomous",label: "Auto Loop",  icon: Bot,             desc: "Autonomous execution" },
      { path: "/chart",     label: "Charts",     icon: LineChart,       desc: "Price charts" },
      { path: "/portfolio", label: "Portfolio",  icon: Briefcase,       desc: "Positions & P&L" },
    ],
  },
  {
    label: "Research",
    items: [
      { path: "/sentiment", label: "Sentiment",  icon: Newspaper,       desc: "News & sentiment" },
      { path: "/discover",  label: "Discover",   icon: Compass,         desc: "Find opportunities" },
      { path: "/backtest",  label: "Backtest",   icon: FlaskConical,    desc: "Test strategies" },
    ],
  },
  {
    label: "System",
    items: [
      { path: "/risk",      label: "Risk",       icon: Shield,          desc: "Risk management" },
      { path: "/brokerage", label: "Brokerage",  icon: Cable,           desc: "Live integration" },
      { path: "/alerts",    label: "Alerts",     icon: Bell,            desc: "Price alerts" },
      { path: "/settings",  label: "Settings",   icon: Settings,        desc: "Preferences" },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { data: portfolio } = useGetPortfolio({ query: { retry: false, staleTime: 30000 } });

  const pnlPositive = (portfolio?.todayPnl ?? 0) >= 0;
  const isActive = (path: string) => location === path || (path !== "/" && location.startsWith(path));

  return (
    <aside className="w-[52px] lg:w-52 border-r border-border flex flex-col shrink-0 bg-card overflow-y-auto">
      <div className="h-12 flex items-center justify-center lg:justify-start lg:px-4 border-b border-border shrink-0">
        <div className="w-6 h-6 bg-primary flex items-center justify-center shrink-0 rounded-sm">
          <Sparkles className="w-3 h-3 text-primary-foreground" />
        </div>
        <div className="hidden lg:block ml-2.5">
          <p className="font-bold text-sm tracking-tight leading-none">AI Trader</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Paper trading only</p>
        </div>
      </div>

      <nav className="flex-1 py-2 flex flex-col px-1.5">
        {navGroups.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <div className="my-2 border-t border-border" />}
            <p className="hidden lg:block text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] px-2.5 py-1.5">
              {group.label}
            </p>
            {group.items.map(item => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <div className={cn(
                    "relative flex items-center gap-2.5 px-2.5 py-2 rounded-sm transition-all duration-100 cursor-pointer group",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <div className="hidden lg:block min-w-0 flex-1">
                      <p className="text-xs font-medium leading-none truncate">{item.label}</p>
                      {!active && <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{item.desc}</p>}
                    </div>
                    {item.highlight && !active && (
                      <span className="hidden lg:block ml-auto text-[9px] font-bold bg-foreground/8 text-foreground/60 px-1.5 py-0.5 rounded-sm border border-border">AI</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {portfolio && (
        <div className="mx-1.5 mb-1.5 p-2.5 border border-border rounded-sm shrink-0">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 hidden lg:block">Account</p>
          <p className="font-bold text-sm font-mono hidden lg:block tabular-nums">{formatCurrency(portfolio.equity)}</p>
          <p className={cn("text-xs font-mono hidden lg:block tabular-nums mt-0.5", pnlPositive ? "text-bullish" : "text-bearish")}>
            {pnlPositive ? "+" : ""}{formatCurrency(portfolio.todayPnl)} today
          </p>
          <div className="lg:hidden flex justify-center">
            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </div>
      )}
    </aside>
  );
}
