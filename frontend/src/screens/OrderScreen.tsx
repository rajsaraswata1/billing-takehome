import { useEffect, useMemo, useState } from "react";
import menuData from "../fixtures/menu.json";
import shopsData from "../fixtures/shops.json";
import { createOrder, ApiError } from "../lib/api";
import type { MenuItem, OrderResponse, PaymentType, Shop } from "../lib/types";

const MENU = menuData.items as MenuItem[];
const SHOPS = shopsData.shops as Shop[];

function isMoneyString(v: string): boolean {
  return /^\d+(\.\d{0,2})?$/.test(v);
}

interface Props {
  onOrderPlaced: (order: OrderResponse) => void;
}

export default function OrderScreen({ onOrderPlaced }: Props) {
  const [shopId, setShopId] = useState(SHOPS[0].id);
  const [paymentType, setPaymentType] = useState<PaymentType>("CARD");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tip, setTip] = useState("0.00");
  const [discount, setDiscount] = useState("0.00");

  const [preview, setPreview] = useState<OrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);

  const items = useMemo(
    () => Object.entries(cart).filter(([, qty]) => qty > 0).map(([sku, qty]) => ({ sku, qty })),
    [cart]
  );

  function setQty(sku: string, qty: number) {
    setCart((prev) => ({ ...prev, [sku]: Math.max(0, qty) }));
  }

  // "Live" breakdown: the numbers shown are never computed in the browser.
  // Every meaningful change (cart, payment type, tip, discount, shop) is
  // debounced and re-sent to the server, and we render whatever the server
  // returns. There's no separate "quote" endpoint in the contract, so this
  // reuses POST /orders itself as the preview call — see DECISIONS.md for
  // the tradeoff that entails (each preview tick is a real stored order).
  useEffect(() => {
    setError(null);
    if (items.length === 0) {
      setPreview(null);
      return;
    }
    if (!isMoneyString(tip) || !isMoneyString(discount)) {
      setPreview(null);
      return;
    }
    const handle = setTimeout(() => {
      setLoading(true);
      createOrder({
        shop_id: shopId,
        items,
        tip: normalizeMoney(tip),
        discount: normalizeMoney(discount),
        payment_type: paymentType,
      })
        .then((order) => {
          setPreview(order);
        })
        .catch((err) => {
          setPreview(null);
          setError(err instanceof ApiError ? err.message : "Could not price this order");
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, paymentType, JSON.stringify(items), tip, discount]);

  function handlePlaceOrder() {
    if (!preview) return;
    // The preview already IS a server-created order (see effect above), so
    // placing the order is just confirming the most recent priced preview —
    // no extra network round trip needed.
    setPlacing(true);
    setTimeout(() => setPlacing(false), 200);
    onOrderPlaced(preview);
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <h2>Shop &amp; payment</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="shop">Shop</label>
            <select id="shop" value={shopId} onChange={(e) => setShopId(e.target.value)}>
              {SHOPS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.timezone})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Payment type</label>
            <div className="toggle-group">
              <button
                className={paymentType === "CARD" ? "active" : ""}
                onClick={() => setPaymentType("CARD")}
                type="button"
              >
                Card
              </button>
              <button
                className={paymentType === "CASH" ? "active" : ""}
                onClick={() => setPaymentType("CASH")}
                type="button"
              >
                Cash
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Menu</h2>
        {MENU.map((item) => (
          <div className="menu-row" key={item.sku}>
            <span className="name">{item.name}</span>
            <span className="price">${item.price}</span>
            <div className="qty-control">
              <button type="button" onClick={() => setQty(item.sku, (cart[item.sku] ?? 0) - 1)}>
                −
              </button>
              <span>{cart[item.sku] ?? 0}</span>
              <button type="button" onClick={() => setQty(item.sku, (cart[item.sku] ?? 0) + 1)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Tip &amp; discount</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="tip">Tip ($)</label>
            <input id="tip" value={tip} onChange={(e) => setTip(e.target.value)} inputMode="decimal" />
          </div>
          <div className="field">
            <label htmlFor="discount">Discount ($)</label>
            <input
              id="discount"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>
          Fee breakdown {loading && <span className="hint">(pricing…)</span>}
        </h2>
        {!preview && items.length === 0 && <p className="hint">Add items to see server-priced totals.</p>}
        {preview && (
          <div className="breakdown">
            <div className="line">
              <span>Subtotal{preview.payment_type === "CARD" ? " (incl. dual pricing)" : ""}</span>
              <span>${preview.subtotal}</span>
            </div>
            {preview.payment_type === "CARD" && (
              <div className="line">
                <span className="muted">— of which dual-pricing surcharge</span>
                <span className="muted">${preview.dual_pricing_surcharge}</span>
              </div>
            )}
            <div className="line">
              <span>Convenience fee</span>
              <span>${preview.convenience_fee}</span>
            </div>
            <div className="line">
              <span>Tip</span>
              <span>${preview.tip}</span>
            </div>
            <div className="line">
              <span>Discount</span>
              <span>−${preview.discount}</span>
            </div>
            <div className="line total">
              <span>Total</span>
              <span>${preview.total}</span>
            </div>
          </div>
        )}
        <button className="primary" style={{ marginTop: 14 }} disabled={!preview || placing} onClick={handlePlaceOrder}>
          Place order &amp; go to split →
        </button>
      </div>
    </div>
  );
}

/** Pads a user-typed "2" or "2.5" into the "2.00" / "2.50" shape the API expects. */
function normalizeMoney(v: string): string {
  if (!v) return "0.00";
  const [whole, frac = ""] = v.split(".");
  return `${whole || "0"}.${(frac + "00").slice(0, 2)}`;
}
