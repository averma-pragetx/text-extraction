import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { FileStack, Clock, Building2, Activity, ShieldCheck, Check, AlertTriangle, Upload, GitBranch, FilesIcon, LineChart } from "lucide-react";
import { useC } from "../context/ThemeContext";
import { Stat } from "../components/common/Stat";
import { HealthRing } from "../components/common/HealthRing";
import { Chip } from "../components/common/Chip";
import { GlowDot } from "../components/common/GlowDot";

export function Dashboard() {
  const c = useC();
  const invoice = [42, 58, 67, 71, 53, 88, 92, 76, 84, 95, 102, 89].map((v, i) => ({ 
    m: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"][i], 
    v 
  }));
  const disc = [
    { n: "Civil", v: 78, col: c.cyan }, 
    { n: "Piping", v: 65, col: c.violet }, 
    { n: "Electrical", v: 54, col: c.magenta }, 
    { n: "Instrument", v: 48, col: c.amber }, 
    { n: "Mechanical", v: 71, col: c.lime }, 
    { n: "HVAC", v: 39, col: c.blue }
  ];
  const feed = [
    { col: c.lime, i: Check, t: "Invoice INV-2847 processed", s: "Tata Projects · ₹18.4L ingested", time: "2m" },
    { col: c.amber, i: AlertTriangle, t: "Mismatch flagged — PO-1192", s: "qty 240 vs 195 · sent to review", time: "8m" },
    { col: c.cyan, i: Upload, t: "DCI-Rev4.pdf uploaded", s: "Rohan Shah · extraction queued", time: "14m" },
    { col: c.violet, i: GitBranch, t: "Workflow fired", s: "overdue reminder → PM, Vendor V-34", time: "1h" },
    { col: c.red, i: Clock, t: "SLA breached — MR-0291", s: "72h pending · escalated", time: "3h" },
  ];

  const Tip = () => ({ 
    background: c.bg2, 
    border: `1px solid ${c.glassBorder}`, 
    borderRadius: 12, 
    fontFamily: "Space Mono", 
    fontSize: 12, 
    color: c.text 
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
      <div className="rise" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <Stat icon={FileStack} label="Documents processed" value="1,284" delta="+18%" up color={c.cyan} />
        <Stat icon={Clock} label="Pending approvals" value="4" color={c.amber} />
        <Stat icon={Building2} label="Project value" value="₹84.2Cr" delta="on track" up color={c.lime} />
        <Stat icon={Activity} label="Schedule progress" value="62%" delta="-3.2%" color={c.red} />
      </div>
      <div className="rise glass" style={{ gridColumn: "span 2", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <ShieldCheck size={16} color={c.violet} />
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Project health</span>
          {/* <span style={{ marginLeft: "auto" }}><Chip color={c.cyan}>executive view</Chip></span> */}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          <HealthRing label="Cost" value={85} color={c.lime} />
          <HealthRing label="Schedule" value={78} color={c.amber} />
          <HealthRing label="Vendor" value={92} color={c.cyan} />
          <HealthRing label="Document" value={88} color={c.violet} />
        </div>
      </div>
      <div className="rise glass" style={{ gridColumn: "span 2", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <FilesIcon size={16} color={c.cyan} />
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Invoice volume</span>
          <span style={{ marginLeft: "auto" }}><Chip color={c.cyan}>FY 2025–2026</Chip></span>
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={invoice}>
            <defs>
              <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={c.cyan} />
                <stop offset="1" stopColor={c.violet} stopOpacity={.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={c.track} vertical={false} />
            <XAxis dataKey="m" tick={{ fill: c.dim, fontSize: 10, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: c.dim, fontSize: 10, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} width={26} />
            <Tooltip contentStyle={Tip()} cursor={{ fill: c.track }} />
            <Bar dataKey="v" fill="url(#bg)" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rise glass" style={{ gridColumn: "span 2", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <LineChart size={16} color={c.cyan} />
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Discipline progress</span>
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {disc.map((d) => (
            <div key={d.n}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                <span style={{ color: c.muted }}>{d.n}</span>
                <span className="mono" style={{ color: d.col, fontWeight: 700 }}>{d.v}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: c.track, overflow: "hidden" }}>
                <div style={{ width: d.v + "%", height: "100%", borderRadius: 6, background: `linear-gradient(90deg,${d.col}88,${d.col})`, boxShadow: c.isDark ? `0 0 12px ${d.col}88` : "none" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rise glass" style={{ gridColumn: "span 2", padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Clock size={16} color={c.cyan} />
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Latest updates</span>
        </div>
        {feed.map((f, i) => {
          const Icon = f.i;
          return (
            <div key={i} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: i < feed.length - 1 ? `1px solid ${c.glassBorder}` : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: f.col + "1c", border: `1px solid ${f.col}3a` }}>
                <Icon size={15} color={f.col} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: c.text, fontWeight: 500 }}>{f.t}</div>
                <div className="mono" style={{ fontSize: 10.5, color: c.dim, marginTop: 2 }}>{f.s}</div>
              </div>
              <span className="mono" style={{ fontSize: 10.5, color: c.dim }}>{f.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
