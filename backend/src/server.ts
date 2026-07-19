import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { createOrder } from "./orders.js";
import { splitOrder } from "./split.js";
import { dailyReport } from "./reports.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/orders", (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = createOrder(req.body);
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  });

  app.post("/orders/:id/split", (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = splitOrder(req.params.id, req.body?.ways);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get("/reports/daily", (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = dailyReport(req.query.date, req.query.tz);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Central error handler: our domain errors carry a `status`; anything
  // else is an unexpected 500 (and logged, not swallowed).
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 500) {
      console.error(err);
    }
    res.status(status).json({ error: (err as Error)?.message ?? "Internal server error" });
  });

  return app;
}
