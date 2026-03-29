import { createRequire } from "module";
import { logger } from "./logger";
import { isMarketOpen as sharedIsMarketOpen } from "./market-hours";

const _require = createRequire(import.meta.url);

interface AlpacaSDKConstructor {
  new (config: AlpacaSDKConfig): AlpacaSDKClient;
}

interface AlpacaSDKConfig {
  keyId: string;
  secretKey: string;
  paper: boolean;
  usePolygon?: boolean;
}

interface AlpacaAccountResponse {
  equity?: string;
  cash?: string;
  buying_power?: string;
  daytrade_count?: number;
}

interface AlpacaPositionResponse {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  unrealized_plpc: string;
}

interface AlpacaOrderResponse {
  id: string;
  status: string;
}

interface AlpacaClockResponse {
  is_open?: boolean;
}

interface AlpacaOrderRequest {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: string;
  time_in_force: string;
  limit_price?: number;
  stop_price?: number;
}

interface AlpacaSDKClient {
  getAccount(): Promise<AlpacaAccountResponse>;
  getPositions(): Promise<AlpacaPositionResponse[]>;
  createOrder(order: AlpacaOrderRequest): Promise<AlpacaOrderResponse>;
  cancelOrder(orderId: string): Promise<void>;
  getClock(): Promise<AlpacaClockResponse>;
}

const AlpacaSDK = _require("@alpacahq/alpaca-trade-api") as AlpacaSDKConstructor;

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
  private client: AlpacaSDKClient | null = null;
  private paper: boolean;

  constructor(apiKey: string, apiSecret: string, paper = true) {
    this.paper = paper;
    this.connected = !!(apiKey && apiSecret);
    if (this.connected) {
      this.client = new AlpacaSDK({
        keyId: apiKey,
        secretKey: apiSecret,
        paper,
        usePolygon: false,
      });
    }
  }

  async getAccount(): Promise<BrokerageAccount> {
    if (!this.client) throw new Error("Alpaca not connected. Set ALPACA_API_KEY and ALPACA_API_SECRET.");
    const data = await this.client.getAccount();
    return {
      equity: parseFloat(data.equity ?? "0"),
      cash: parseFloat(data.cash ?? "0"),
      buyingPower: parseFloat(data.buying_power ?? "0"),
      dayTradeCount: data.daytrade_count ?? 0,
      provider: "alpaca",
      connected: true,
      paperTrading: this.paper,
    };
  }

  async getPositions(): Promise<BrokeragePosition[]> {
    if (!this.client) return [];
    const data = await this.client.getPositions();
    return data.map((p) => ({
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      avgEntryPrice: parseFloat(p.avg_entry_price),
      currentPrice: parseFloat(p.current_price),
      unrealizedPnl: parseFloat(p.unrealized_pl),
      unrealizedPnlPct: parseFloat(p.unrealized_plpc) * 100,
    }));
  }

  async submitOrder(order: BrokerageOrder): Promise<{ orderId: string; status: string; message: string }> {
    if (!this.client) throw new Error("Alpaca not connected.");
    const data = await this.client.createOrder({
      symbol: order.symbol,
      qty: order.qty,
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce,
      limit_price: order.limitPrice,
      stop_price: order.stopPrice,
    });
    return {
      orderId: data.id,
      status: data.status,
      message: `Order ${data.status}: ${order.side} ${order.qty} ${order.symbol}`,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.client.cancelOrder(orderId);
      return true;
    } catch {
      return false;
    }
  }

  async isMarketOpen(): Promise<boolean> {
    if (!this.client) {
      return sharedIsMarketOpen();
    }
    try {
      const clock = await this.client.getClock();
      return clock.is_open ?? false;
    } catch {
      return sharedIsMarketOpen();
    }
  }
}

let _adapter: BrokerageAdapter | null = null;

export function getBrokerageAdapter(): BrokerageAdapter {
  if (_adapter) return _adapter;

  const alpacaKey = process.env["ALPACA_API_KEY"];
  const alpacaSecret = process.env["ALPACA_API_SECRET"];

  if (alpacaKey && alpacaSecret) {
    _adapter = new AlpacaAdapter(alpacaKey, alpacaSecret, true);
    logger.info("Using Alpaca paper trading adapter (official SDK)");
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
