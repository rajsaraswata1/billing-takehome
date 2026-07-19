import { useState } from "react";
import shopsData from "../fixtures/shops.json";
import { dailyReport, ApiError } from "../lib/api";
import type { DailyReportResponse, Shop } from "../lib/types";

const SHOPS = shopsData.shops as Shop[];
// Common timezones, plus every shop's own tz, plus a free-text fallback so
// you can type any IANA name the contract might test against.
const COMMON_TZS = Array.from(new Set(["UTC", ...SHOPS.map((s) => s.timezone), "America/New_York", "Asia/Kolkata"]));

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportScreen() {
  const [date, setDate] = useState(todayISO());
  const [tz, setTz] = useState(COMMON_TZS[0]);
  const [customTz, setCustomTz] = useState("");
  const [report, setReport] = useState<DailyReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function effectiveTz(): string {
    return customTz.trim() || tz;
  }

  function load() {
    setError(null);
    setLoading(true);
    dailyReport(date, effectiveTz())
      .then(setReport)
      .catch((err) => {
        setReport(null);
        setError(err instanceof ApiError ? err.message : "Could not load the report");
      })
      .finally(() => setLoading(false));
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <h2>Daily report</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="date">Business date</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tz">Timezone</label>
            <select id="tz" value={tz} onChange={(e) => setTz(e.target.value)} disabled={!!customTz.trim()}>
              {COMMON_TZS.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="custom-tz">Or type any IANA timezone</label>
          <input
            id="custom-tz"
            value={customTz}
            onChange={(e) => setCustomTz(e.target.value)}
            placeholder="e.g. Australia/Sydney"
          />
        </div>
        <button className="primary" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Load report"}
        </button>
      </div>

      {report && (
        <div className="panel">
          <h2>
            {report.date} · {report.tz}
          </h2>
          <div className="stat-row">
            <div className="stat">
              <span className="hint">Orders</span>
              <b>{report.order_count}</b>
            </div>
            <div className="stat">
              <span className="hint">Gross total</span>
              <b>${report.gross_total}</b>
            </div>
            <div className="stat">
              <span className="hint">Card fees</span>
              <b>${report.card_fees_total}</b>
            </div>
          </div>

          {report.orders.length === 0 ? (
            <p className="hint">No orders fell on this business day for this timezone.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order id</th>
                  <th>Placed at</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.placed_at}</td>
                    <td>${o.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
