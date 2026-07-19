import { useState } from "react";
import { splitOrder, ApiError } from "../lib/api";
import type { OrderResponse, SplitResponse } from "../lib/types";

interface Props {
  defaultOrder: OrderResponse | null;
}

export default function SplitScreen({ defaultOrder }: Props) {
  const [orderId, setOrderId] = useState(defaultOrder?.id ?? "");
  const [total, setTotal] = useState(defaultOrder?.total ?? "");
  const [ways, setWays] = useState(2);
  const [result, setResult] = useState<SplitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSplit() {
    setError(null);
    setResult(null);
    if (!orderId.trim()) {
      setError("Enter an order id first — place an order or paste one in.");
      return;
    }
    setLoading(true);
    splitOrder(orderId.trim(), ways)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not split this order"))
      .finally(() => setLoading(false));
  }

  const sumCents = result ? result.shares.reduce((sum, s) => sum + Math.round(parseFloat(s) * 100), 0) : 0;
  const totalCents = result ? Math.round(parseFloat(result.total) * 100) : 0;
  const sumMatches = result ? sumCents === totalCents : null;

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <h2>Split a bill</h2>
        <div className="field">
          <label htmlFor="order-id">Order id</label>
          <input
            id="order-id"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g. order_1_abc123"
          />
          {total && <p className="hint">Order total: ${total}</p>}
        </div>
        <div className="field">
          <label htmlFor="ways">Split N ways (2–20)</label>
          <input
            id="ways"
            type="number"
            min={2}
            max={20}
            value={ways}
            onChange={(e) => setWays(Number(e.target.value))}
          />
        </div>
        <button className="primary" onClick={handleSplit} disabled={loading}>
          {loading ? "Splitting…" : "Split"}
        </button>
      </div>

      {result && (
        <div className="panel">
          <h2>Shares</h2>
          <div className="stat-row">
            <div className="stat">
              <span className="hint">Total</span>
              <b>${result.total}</b>
            </div>
            <div className="stat">
              <span className="hint">Ways</span>
              <b>{result.shares.length}</b>
            </div>
            <div className="stat">
              <span className="hint">Shares sum to total?</span>
              <b style={{ color: sumMatches ? "#2f6f4e" : "#b3261e" }}>{sumMatches ? "✓ Yes" : "✗ No"}</b>
            </div>
          </div>
          <div className="shares-grid">
            {result.shares.map((s, i) => (
              <div className="share-chip" key={i}>
                ${s}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
