import { logger } from "./logger";
import { isMarketOpen as sharedIsMarketOpen } from "./market-hours";

export type BrokerageProvider = "paper" | "alpaca" | "interactive-brokers" | "td-ameritrade";

export interface BrokerageOrder {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  type: "market" | "limit" | "stop" | "stop_limit";
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: "day" | "gtc" | "ioc";
}

export interface BrokeragePosition {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
}

export interface BrokerageAccount {
  equity: number;
  cash: number;
  buyingPower: number;
  dayTradeCount: number;
  provider: BrokerageProvider;
  connected: boolean;
  paperTrading: boolean;
}

export interface BrokerageAdapter {
  provider: BrokerageProvider;
  connected: boolean;
  getAccount(): Promise<BrokerageAccount>;
  getPositions(): Promise<BrokeragePosition[]>;
  submitOrder(order: BrokerageOrder): Promise<{ orderId: string; status: string; message: string }>;
  cancelOrder(orderId: string): Promise<boolean>;
  isMarketOpen(): Promise<boolean>;
}

class PaperBrokerageAdapter implements BrokerageAdapter {
  provider: BrokerageProvider = "paper";
  connected = true;

  async getAccount(): Promise<BrokerageAccount> {
    return {
      equity: 100_000,
      cash: 100_000,
      buyingPower: 200_000,
      dayTradeCount: 0,
      provider: "paper",
      connected: true,
      paperTrading: true,
    };
  }

  async getPositions(): Promise<BrokeragePosition[]> {
    return [];
  }

  async submitOrder(order: BrokerageOrder): Promise<{ orderId: string; status: string; message: string }> {
    const orderId = `PAPER-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    logger.info({ orderId, side: order.side, qty: order.qty, symbol: order.symbol }, "Paper brokerage order submitted");
    return {
      orderId,
      status: "filled",
      message: `Paper trade executed: ${order.side.toUpperCase()} ${order.qty} ${order.symbol}`,
    };
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    return true;
  }

  async isMarketOpen(): Promise<boolean> {
    return sharedIsMarketOpen();
  }
}

class AlpacaAdapter implements BrokerageAdapter {
  provider: BrokerageProvider = "alpaca";
  connected = false;
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(apiKey: string, apiSecret: string, paper = true) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = paper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
    this.connected = !!(apiKey && apiSecret);
  }

  private get headers() {
    return {
      "APCA-API-KEY-ID": this.apiKey,
      "APCA-API-SECRET-KEY": this.apiSecret,
      "Content-Type": "application/json",
    };
  }

  async getAccount(): Promise<BrokerageAccount> {
    if (!this.connected) throw new Error("Alpaca not connected. Set ALPACA_API_KEY and ALPACA_API_SECRET.");
    const res = await fetch(`${this.baseUrl}/v2/account`, { headers: this.headers });
    const data = await res.json() as any;
    return {
      equity: parseFloat(data.equity ?? "0"),
      cash: parseFloat(data.cash ?? "0"),
      buyingPower: parseFloat(data.buying_power ?? "0"),
      dayTradeCount: data.daytrade_count ?? 0,
      provider: "alpaca",
      connected: true,
      paperTrading: this.baseUrl.includes("paper"),
    };
  }

  async getPositions(): Promise<BrokeragePosition[]> {
    if (!this.connected) return [];
    const res = await fetch(`${this.baseUrl}/v2/positions`, { headers: this.headers });
    const data = await res.json() as any;
    return (data ?? []).map((p: any) => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      avgEntryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      unrealizedPnl: parseFloat(p.unrealized_pl),
      unrealizedPnlPct: parseFloat(p.unrealized_plpc) * 100,
    }));
  }

  async submitOrder(order: BrokerageOrder): Promise<{ orderId: string; status: string; message: string }> {
    if (!this.connected) throw new Error("Alpaca not connected.");
    const body = {
      symbol: order.symbol,
      qty: order.qty,
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce,
      limit_price: order.limitPrice,
      stop_price: order.stopPrice,
    };
    const res = await fetch(`${this.baseUrl}/v2/orders`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    return {
      orderId: data.id,
      status: data.status,
      message: `Order ${data.status}: ${order.side} ${order.qty} ${order.symbol}`,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    if (!this.connected) return false;
    const res = await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
      method: "DELETE",
      headers: this.headers,
    });
    return res.ok;
  }

  async isMarketOpen(): Promise<boolean> {
    if (!this.connected) {
      return sharedIsMarketOpen();
    }
    const res = await fetch(`${this.baseUrl}/v2/clock`, { headers: this.headers });
    const data = await res.json() as any;
    return data.is_open ?? false;
  }
}

let _adapter: BrokerageAdapter | null = null;

export function getBrokerageAdapter(): BrokerageAdapter {
  if (_adapter) return _adapter;

  const alpacaKey = process.env["ALPACA_API_KEY"];
  const alpacaSecret = process.env["ALPACA_API_SECRET"];

  if (alpacaKey && alpacaSecret) {
    _adapter = new AlpacaAdapter(alpacaKey, alpacaSecret, true);
    logger.info("Using Alpaca paper trading adapter");
  } else {
    _adapter = new PaperBrokerageAdapter();
    logger.info("Using built-in paper trading adapter");
  }

  return _adapter;
}

export function getBrokerageStatus(): {
  provider: BrokerageProvider;
  connected: boolean;
  paperTrading: boolean;
  alpacaConfigured: boolean;
  availableProviders: { id: string; name: string; description: string; configured: boolean; requiresKeys: string[] }[];
} {
  const alpacaConfigured = !!(process.env["ALPACA_API_KEY"] && process.env["ALPACA_API_SECRET"]);
  const adapter = getBrokerageAdapter();

  return {
    provider: adapter.provider,
    connected: adapter.connected,
    paperTrading: adapter.provider === "paper" || (adapter.provider === "alpaca" && true),
    alpacaConfigured,
    availableProviders: [
      {
        id: "paper",
        name: "Built-in Paper Trading",
        description: "Simulated trading with $100,000 virtual money. No real money at risk.",
        configured: true,
        requiresKeys: [],
      },
      {
        id: "alpaca",
        name: "Alpaca (Paper)",
        description: "Alpaca paper trading account. Get free API keys at alpaca.markets.",
        configured: alpacaConfigured,
        requiresKeys: ["ALPACA_API_KEY", "ALPACA_API_SECRET"],
      },
      {
        id: "interactive-brokers",
        name: "Interactive Brokers",
        description: "Professional-grade brokerage. Coming soon.",
        configured: false,
        requiresKeys: ["IB_CLIENT_ID", "IB_GATEWAY_HOST"],
      },
    ],
  };
}
