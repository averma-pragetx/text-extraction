import { ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts";
import { Cpu, Zap, CircleCheck } from "lucide-react";
import { useC } from "../context/ThemeContext";
import { Stat } from "../components/common/Stat";

export function Analytics() {
  const c = useC();
  const heat = [
    { t: "Engineering", d: 1.1, col: c.lime }, 
    { t: "Procurement", d: 2.4, col: c.amber }, 
    { t: "Finance", d: 4.2, col: c.red }, 
    { t: "QA / QC", d: 1.8, col: c.cyan }
  ];
  const trend = [40, 52, 48, 61, 55, 70, 68, 82].map((v, i) => ({ x: i, v }));

  const Tip = () => ({ 
    background: c.bg2, 
    border: `1px solid ${c.glassBorder}`, 
    borderRadius: 12, 
    fontFamily: "Space Mono", 
    fontSize: 12, 
    color: c.text 
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="rise" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <Stat icon={Cpu} label="Avg processing time" value="4.2s" delta="-1.1s" up color={c.cyan} />
        <Stat icon={Zap} label="Classification accuracy" value="94.7%" delta="+2.1%" up color={c.violet} />
        <Stat icon={CircleCheck} label="Auto-approved" value="91.4%" color={c.lime} />
      </div>
      <div className="rise" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="glass" style={{ padding: "22px 24px" }}>
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Approval heatmap</span>
          <div className="mono" style={{ fontSize: 10.5, color: c.dim, marginBottom: 16, marginTop: 2 }}>avg approval time by team</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {heat.map((h) => (
              <div key={h.t}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                  <span style={{ color: c.muted }}>{h.t}</span>
                  <span className="mono" style={{ color: h.col }}>{h.d} days</span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: c.track, overflow: "hidden" }}>
                  <div style={{ width: (h.d / 5) * 100 + "%", height: "100%", borderRadius: 6, background: `linear-gradient(90deg,${h.col}77,${h.col})`, boxShadow: c.isDark ? `0 0 12px ${h.col}88` : "none" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="glass" style={{ padding: "22px 24px" }}>
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Document volume trend</span>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={trend} style={{ marginTop: 18 }}>
              <defs>
                <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={c.cyan} stopOpacity={.6} />
                  <stop offset="1" stopColor={c.cyan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip contentStyle={Tip()} />
              <Area type="monotone" dataKey="v" stroke={c.cyan} strokeWidth={2.5} fill="url(#tg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rise glass" style={{ padding: "20px 24px" }}>
        <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Monthly volumes</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 14 }}>
          {[["Invoices", "89", c.cyan], ["Documents", "142", c.violet], ["Vendor activity", "37", c.magenta], ["Approvals", "64", c.lime]].map(([l, v, col]) => (
            <div key={l} style={{ background: c.isDark ? "rgba(255,255,255,0.03)" : "#F5F7FC", border: `1px solid ${c.glassBorder}`, borderRadius: 14, padding: 16 }}>
              <div className="disp" style={{ fontSize: 22, fontWeight: 700, color: col }}>{v}</div>
              <div className="mono" style={{ fontSize: 10, color: c.dim, textTransform: "uppercase", marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
