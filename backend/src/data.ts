import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { MenuItem, Shop, StoredOrder } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "..", "fixtures");

function loadJson<T>(filename: string): T {
  const raw = readFileSync(path.join(fixturesDir, filename), "utf-8");
  return JSON.parse(raw) as T;
}

const menuData = loadJson<{ items: MenuItem[] }>("menu.json");
const shopsData = loadJson<{ shops: Shop[] }>("shops.json");

export const menuBySku: Map<string, MenuItem> = new Map(
  menuData.items.map((item) => [item.sku, item])
);

export const shopsById: Map<string, Shop> = new Map(
  shopsData.shops.map((shop) => [shop.id, shop])
);

// In-memory order storage. A real service would use a DB; the assignment
// explicitly says in-memory is fine, and it keeps the test suite simple
// and hermetic (no external state to reset between test runs).
class OrderStore {
  private orders = new Map<string, StoredOrder>();
  private counter = 0;

  create(order: Omit<StoredOrder, "id">): StoredOrder {
    this.counter += 1;
    const id = `order_${this.counter}_${Date.now().toString(36)}`;
    const stored: StoredOrder = { ...order, id };
    this.orders.set(id, stored);
    return stored;
  }

  get(id: string): StoredOrder | undefined {
    return this.orders.get(id);
  }

  all(): StoredOrder[] {
    return [...this.orders.values()];
  }

  /** Test-only: wipe state between test files so tests stay isolated. */
  clear(): void {
    this.orders.clear();
    this.counter = 0;
  }
}

export const orderStore = new OrderStore();
