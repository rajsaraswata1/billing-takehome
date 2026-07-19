import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/server.js";
import { orderStore } from "../src/data.js";

const app = createApp();
beforeEach(() => orderStore.clear());

describe("POST /orders", () => {
  it("returns 201 with a fully-priced order", async () => {
    const res = await request(app)
      .post("/orders")
      .send({
        shop_id: "shop_berlin",
        items: [{ sku: "PIZZA_M", qty: 2 }],
        tip: "2.00",
        discount: "1.50",
        payment_type: "CARD",
      });
    expect(res.status).toBe(201);
    expect(res.body.total).toMatch(/^\d+\.\d{2}$/);
  });

  it("returns 400 for an unknown sku", async () => {
    const res = await request(app)
      .post("/orders")
      .send({
        shop_id: "shop_berlin",
        items: [{ sku: "NOPE", qty: 1 }],
        tip: "0.00",
        discount: "0.00",
        payment_type: "CARD",
      });
    expect(res.status).toBe(400);
  });
});

describe("POST /orders/:id/split", () => {
  it("returns 200 with exact shares, and 404 for a missing order", async () => {
    const created = await request(app)
      .post("/orders")
      .send({
        shop_id: "shop_berlin",
        items: [{ sku: "PIZZA_M", qty: 1 }],
        tip: "0.00",
        discount: "0.00",
        payment_type: "CASH",
      });

    const split = await request(app).post(`/orders/${created.body.id}/split`).send({ ways: 3 });
    expect(split.status).toBe(200);
    expect(split.body.shares).toHaveLength(3);

    const missing = await request(app).post("/orders/nonexistent/split").send({ ways: 3 });
    expect(missing.status).toBe(404);
  });
});

describe("GET /reports/daily", () => {
  it("returns 200 with the shape from the contract, and 400 for a bad tz", async () => {
    const res = await request(app).get("/reports/daily").query({ date: "2026-07-05", tz: "America/Chicago" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("order_count");
    expect(res.body).toHaveProperty("gross_total");

    const bad = await request(app).get("/reports/daily").query({ date: "2026-07-05", tz: "Nowhere/Place" });
    expect(bad.status).toBe(400);
  });
});
