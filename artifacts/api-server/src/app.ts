import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const REQUIRED_ENV_VARS = ["DATABASE_URL"] as const;

for (const varName of REQUIRED_ENV_VARS) {
  if (!process.env[varName]) {
    logger.fatal({ varName }, `Required environment variable ${varName} is missing. Exiting.`);
    process.exit(1);
  }
}

if (!process.env["TRADER_SAGE_API_KEY"]) {
  logger.warn("TRADER_SAGE_API_KEY is not set — market data will fall back to mock data");
}

if (!process.env["OPENAI_API_KEY"]) {
  logger.warn("OPENAI_API_KEY is not set — AI analysis features will be unavailable");
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = err as { statusCode?: number; status?: number; code?: string; message?: string };
  const statusCode = e.statusCode ?? e.status ?? 500;
  const code = e.code ?? "INTERNAL_ERROR";
  const message = e.message ?? "An unexpected error occurred";

  if (statusCode >= 500) {
    logger.error({ err, statusCode }, "Unhandled server error");
  } else {
    logger.warn({ err, statusCode }, "Request error");
  }

  res.status(statusCode).json({ error: message, code, message });
});

export default app;
