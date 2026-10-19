import cors from "cors";
import express, { NextFunction, Request, Response, Express } from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { JsonRpcHandler } from "./jsonrpc.handler";
import {
  clientAddress,
  ConnectionLimiter,
  GatewayLimits,
  loadLimits,
  RateLimiter,
} from "./lib/limits";

export function createApp(overrides: Partial<GatewayLimits> = {}): {
  app: Express;
  server: http.Server;
} {
  const limits = { ...loadLimits(), ...overrides };
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    maxPayload: limits.maxPayloadBytes,
  });
  const connections = new ConnectionLimiter(limits.maxConnectionsPerClient);

  app.use(cors());
  app.use(express.json());

  wss.on("connection", (ws, req) => {
    const release = connections.acquire(clientAddress(req, limits.trustProxy));
    if (!release) {
      ws.close(1013, "Too many connections");
      return;
    }

    const handler = new JsonRpcHandler(ws, limits);
    const rate = new RateLimiter(limits.messagesPerSecond, limits.messageBurst);

    // A connection that never speaks, or stops answering pings, is closed so
    // it cannot hold a slot against the per-client limit.
    const firstMessageTimer = setTimeout(
      () => ws.close(1008, "No message received"),
      limits.firstMessageTimeoutMs
    );
    let alive = true;
    ws.on("pong", () => {
      alive = true;
    });
    const pinger = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, limits.pingIntervalMs);

    ws.on("message", async (data) => {
      clearTimeout(firstMessageTimer);
      if (!rate.take()) {
        ws.close(1008, "Rate limit exceeded");
        return;
      }
      await handler.processMessage(data.toString());
    });

    ws.on("close", () => {
      clearTimeout(firstMessageTimer);
      clearInterval(pinger);
      release();
      handler.cleanup();
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "up",
    });
  });

  app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json({ message: "Resource not found" });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
  });

  return { app, server };
}
