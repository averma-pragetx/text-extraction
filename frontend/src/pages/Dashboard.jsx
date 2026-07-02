import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie } from "recharts";
import {
  FileStack, Clock, Wallet, XCircle, Activity, ShieldCheck, Check, AlertTriangle,
  Upload, GitBranch, FilesIcon, Building2,
} from "lucide-react";
import { useC } from "../context/ThemeContext";
import { Stat } from "../components/common/Stat";
import { HealthRing } from "../components/common/HealthRing";
import { Chip } from "../components/common/Chip";
import { api } from "../utils/api";

const STATUS_META = {
  Saved: { color: "amber", icon: Upload },
  Approved: { color: "lime", icon: Check },
  Rejected: { color: "red", icon: XCircle },
  Ingested: { color: "cyan", icon: GitBranch },
};

function toQuery(filters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.vendor) params.set("vendor", filters.vendor);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const EMPTY_STATS = { total_documents: 0, pending_approvals: 0, approved_documents: 0, rejected_documents: 0, total_value: 0, total_value_cr: 0 };

export function Dashboard() {
  const c = useC();
  const [filters, setFilters] = useState({ status: "", vendor: "", dateFrom: "", dateTo: "" });
  const [stats, setStats] = useState(EMPTY_STATS);
  const [volume, setVolume] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/dashboard/filters")
      .then((res) => setFilterOptions(res || { vendors: [], statuses: [] }))
      .catch(() => setFilterOptions({ vendors: [], statuses: [] }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = toQuery(filters);

    setLoading(true);
    setError(null);

    Promise.all([
      api(`/dashboard/stats${qs}`),
      api(`/dashboard/volume${qs}`),
      api(`/dashboard/status-breakdown${qs}`),
      api(`/dashboard/vendors${qs}`),
      api(`/dashboard/updates${qs}${qs ? "&" : "?"}limit=3`),
    ])
      .then(([statsRes, volumeRes, breakdownRes, vendorsRes, updatesRes]) => {
        if (cancelled) return;
        setStats(statsRes || EMPTY_STATS);
        setVolume(volumeRes || []);
        setStatusBreakdown(breakdownRes || []);
        setVendors(vendorsRes || []);
        setUpdates(updatesRes || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load dashboard data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filters]);

  const statusTotal = useMemo(() => statusBreakdown.reduce((sum, s) => sum + s.count, 0), [statusBreakdown]);
  const statusPct = (name) => {
    if (!statusTotal) return 0;
    const found = statusBreakdown.find((s) => s.status === name);
    return found ? Math.round((found.count / statusTotal) * 100) : 0;
  };

  const vendorChartData = useMemo(() => {
    const palette = [c.cyan, c.violet, c.magenta, c.amber, c.lime, c.blue];
    return vendors.map((v, i) => ({ ...v, fill: palette[i % palette.length] }));
  }, [vendors, c.cyan, c.violet, c.magenta, c.amber, c.lime, c.blue]);

  const totalVendorValue = useMemo(() => vendorChartData.reduce((sum, v) => sum + (v.value || 0), 0), [vendorChartData]);
  const formatCompact = (n) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${Number(n).toLocaleString("en-IN")}`;
  };

  const Tip = () => ({
    background: c.bg2,
    border: `1px solid ${c.glassBorder}`,
    borderRadius: 12,
    fontFamily: "Space Mono",
    fontSize: 12,
    color: c.text,
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>

      <div className="rise" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <Stat icon={Wallet} label="Total invoice amount" value={`₹${Number(stats.total_value || 0).toLocaleString("en-IN")}`} color={c.lime} />
        <Stat icon={FileStack} label="Documents processed" value={stats.total_documents} color={c.cyan} />
        <Stat icon={Clock} label="Pending approvals" value={stats.pending_approvals} color={c.amber} />
        <Stat icon={XCircle} label="Rejected documents" value={stats.rejected_documents} color={c.red} />
      </div>

      <div className="rise glass" style={{ gridColumn: "span 2", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <ShieldCheck size={16} color={c.violet} />
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Status breakdown</span>
          <span style={{ marginLeft: "auto" }}><Chip color={c.violet}>{statusTotal} documents</Chip></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <HealthRing label="Saved" value={statusPct("Saved")} color={c.amber} />
          <HealthRing label="Approved" value={statusPct("Approved")} color={c.lime} />
          <HealthRing label="Rejected" value={statusPct("Rejected")} color={c.red} />
        </div>
      </div>

      <div className="rise glass" style={{ gridColumn: "span 2", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <FilesIcon size={16} color={c.cyan} />
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Invoice volume</span>
        </div>
        {volume.length > 0 ? (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={volume}>
              <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={c.cyan} />
                  <stop offset="1" stopColor={c.violet} stopOpacity={.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={c.track} vertical={false} />
              <XAxis dataKey="m" tick={{ fill: c.dim, fontSize: 10, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: c.dim, fontSize: 10, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} width={26} allowDecimals={false} />
              <Tooltip contentStyle={Tip()} cursor={{ fill: c.track }} />
              <Bar dataKey="v" fill="url(#bg)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: c.dim, fontSize: 12.5 }}>
            No documents match the current filters
          </div>
        )}
      </div>

      <div className="rise glass" style={{ gridColumn: "span 2", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Building2 size={16} color={c.cyan} />
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Top vendors by value</span>
          <span style={{ marginLeft: "auto" }}><Chip color={c.cyan}>{vendorChartData.length} vendors</Chip></span>
        </div>
        {vendorChartData.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ position: "relative", width: 150, height: 180, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vendorChartData}
                    dataKey="value"
                    nameKey="vendor"
                    cx="50%"
                    cy="50%"
                    innerRadius="62%"
                    outerRadius="98%"
                    paddingAngle={4}
                    cornerRadius={8}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {vendorChartData.map((v) => (
                      <Cell key={v.vendor} fill={v.fill} style={{ filter: c.isDark ? `drop-shadow(0 0 6px ${v.fill}66)` : "none" }} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={Tip()}
                    formatter={(value, name) => [`₹${Number(value).toLocaleString("en-IN")}`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
                <div className="disp" style={{ fontSize: 18, fontWeight: 700, color: c.text }}>{formatCompact(totalVendorValue)}</div>
                <div className="mono" style={{ fontSize: 9, color: c.dim, textTransform: "uppercase", letterSpacing: ".5px", marginTop: 2 }}>Total value</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {vendorChartData.map((v) => {
                const pct = totalVendorValue ? Math.round((v.value / totalVendorValue) * 100) : 0;
                return (
                  <div key={v.vendor} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: v.fill, flexShrink: 0, boxShadow: c.isDark ? `0 0 8px ${v.fill}aa` : "none" }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={v.vendor}>
                      {v.vendor}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: c.muted, flexShrink: 0 }}>{formatCompact(v.value || 0)}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: v.fill, fontWeight: 700, width: 32, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: c.dim, fontSize: 12.5 }}>
            No vendor data available yet
          </div>
        )}
      </div>

      <div className="rise glass" style={{ gridColumn: "span 2", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Activity size={16} color={c.cyan} />
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Latest updates</span>
        </div>
        {updates.length > 0 ? updates.map((u, i) => {
          const meta = STATUS_META[u.status] || { color: "cyan", icon: AlertTriangle };
          const col = c[meta.color];
          const Icon = meta.icon;
          return (
            <div key={u.id} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: i < updates.length - 1 ? `1px solid ${c.glassBorder}` : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: col + "1c", border: `1px solid ${col}3a` }}>
                <Icon size={15} color={col} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: c.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.filename}</div>
                <div className="mono" style={{ fontSize: 10.5, color: c.dim, marginTop: 2 }}>
                  {u.vendor}{u.amount ? ` · ₹${Number(u.amount).toLocaleString("en-IN")}` : ""} · {u.status}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 10.5, color: c.dim, flexShrink: 0 }}>{timeAgo(u.timestamp)}</span>
            </div>
          );
        }) : (
          <div style={{ color: c.dim, fontSize: 12.5 }}>No recent activity to show</div>
        )}
      </div>
    </div>
  );
}
