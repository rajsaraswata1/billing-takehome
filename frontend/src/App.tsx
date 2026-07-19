import { useState } from "react";
import type { OrderResponse } from "./lib/types";
import OrderScreen from "./screens/OrderScreen";
import SplitScreen from "./screens/SplitScreen";
import ReportScreen from "./screens/ReportScreen";

type Tab = "order" | "split" | "report";

export default function App() {
  const [tab, setTab] = useState<Tab>("order");
  // Shared so the Split screen can default to whatever order you just placed.
  const [lastOrder, setLastOrder] = useState<OrderResponse | null>(null);

  return (
    <div>
      <h1>Fleksa Billing</h1>
      <p className="subtitle">Mini restaurant ordering &amp; billing — take-home build.</p>

      <nav className="tabs">
        <button className={tab === "order" ? "active" : ""} onClick={() => setTab("order")}>
          Order
        </button>
        <button className={tab === "split" ? "active" : ""} onClick={() => setTab("split")}>
          Split
        </button>
        <button className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}>
          Daily report
        </button>
      </nav>

      {tab === "order" && (
        <OrderScreen
          onOrderPlaced={(order) => {
            setLastOrder(order);
            setTab("split");
          }}
        />
      )}
      {tab === "split" && <SplitScreen defaultOrder={lastOrder} />}
      {tab === "report" && <ReportScreen />}
    </div>
  );
}
