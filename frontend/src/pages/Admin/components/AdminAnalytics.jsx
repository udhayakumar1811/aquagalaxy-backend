import { useState, useEffect } from "react";
import { API_URL } from "../../../config";
import { safeParseResponse } from "../../../utils/apiHandler";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

function MetricCard({ label, value, color = "#0b1c3f" }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", flex: "1 1 160px", minWidth: "160px" }}>
      <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: "800", color }}>{value}</div>
    </div>
  );
}

// Simple horizontal-bar visualization built from plain divs — avoids
// pulling in a charting library dependency (Section 64: "don't introduce
// unnecessary dependencies") for what's fundamentally a short admin list.
function BarList({ items, valueKey, labelKey, formatValue = (v) => v }) {
  const max = Math.max(...items.map((i) => i[valueKey]), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "3px" }}>
            <span>{item[labelKey]}</span>
            <span style={{ fontWeight: "600" }}>{formatValue(item[valueKey])}</span>
          </div>
          <div style={{ background: "#f1f5f9", borderRadius: "4px", height: "8px" }}>
            <div style={{ background: "#0284c7", height: "8px", borderRadius: "4px", width: `${(item[valueKey] / max) * 100}%` }} />
          </div>
        </div>
      ))}
      {items.length === 0 && <p style={{ color: "#94a3b8", fontSize: "13px" }}>No data for this period.</p>}
    </div>
  );
}

function AdminAnalytics({ token }) {
  const [range, setRange] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = () => {
    setLoading(true);
    const params = new URLSearchParams({ range });
    if (range === "custom" && customFrom && customTo) {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    fetch(`${API_URL}/api/admin/analytics?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => safeParseResponse(res, "Analytics"))
      .then(setData)
      .catch((err) => console.error("Error fetching analytics:", err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (range !== "custom" || (customFrom && customTo)) fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, token]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="panel-card">
        <h2>Analytics</h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px", marginBottom: "10px" }}>
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              style={{
                padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600",
                background: range === r.value ? "#0b1c3f" : "#f1f5f9", color: range === r.value ? "white" : "#334155",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
            <span>to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
            <button onClick={fetchAnalytics} style={{ padding: "6px 14px", background: "#0284c7", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Apply</button>
          </div>
        )}
      </div>

      {loading || !data ? (
        <div className="panel-card">Loading…</div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <MetricCard label="Total Revenue" value={`₹${data.totals.totalRevenue}`} color="#16a34a" />
            <MetricCard label="Total Orders" value={data.totals.totalOrders} />
            <MetricCard label="Paid Orders" value={data.totals.paidOrders} color="#16a34a" />
            <MetricCard label="Pending Payments" value={data.totals.pendingPayments} color="#b45309" />
            <MetricCard label="Cancelled" value={data.totals.cancelledOrders} color="#dc2626" />
            <MetricCard label="Delivered" value={data.totals.deliveredOrders} color="#1d4ed8" />
            <MetricCard label="Total Customers" value={data.totals.totalCustomers} />
            <MetricCard label="New Customers" value={data.totals.newCustomers} color="#7c3aed" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            <div className="panel-card">
              <h3>Revenue by Date</h3>
              <BarList items={data.revenueByDate} valueKey="revenue" labelKey="date" formatValue={(v) => `₹${v}`} />
            </div>
            <div className="panel-card">
              <h3>Revenue by Category</h3>
              <BarList items={data.revenueByCategory} valueKey="revenue" labelKey="category" formatValue={(v) => `₹${v}`} />
            </div>
            <div className="panel-card">
              <h3>Top Selling Products</h3>
              <BarList items={data.topSellingProducts} valueKey="quantitySold" labelKey="name" />
            </div>
            <div className="panel-card">
              <h3>Order Status Distribution</h3>
              <BarList items={data.statusDistribution} valueKey="count" labelKey="status" />
            </div>
            <div className="panel-card">
              <h3>Payment Method Stats</h3>
              <BarList items={data.paymentMethodStats} valueKey="count" labelKey="method" />
            </div>
            <div className="panel-card">
              <h3>Low Stock Products</h3>
              {data.lowStockProducts.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "13px" }}>Nothing low on stock. 🎉</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px" }}>
                  {data.lowStockProducts.map((p) => (
                    <li key={p._id} style={{ color: p.qnt === 0 ? "#dc2626" : "#b45309", marginBottom: "4px" }}>
                      {p.name} — {p.qnt} left
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminAnalytics;
