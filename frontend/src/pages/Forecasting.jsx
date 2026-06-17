import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Line } from "recharts";
import { useC } from "../context/ThemeContext";

export function Forecasting() {
  const c = useC();
  const cost = [
    { q: "Q1", f: 18.2, b: 17.1 }, 
    { q: "Q2", f: 34.6, b: 32.8 }, 
    { q: "Q3", f: 52.1, b: 49.2 }, 
    { q: "Q4", f: 71.4, b: 65.6 }, 
    { q: "Q5", f: 91.4, b: 84.2 }
  ];
  const burn = [
    { m: "Jan", v: 5 }, 
    { m: "Feb", v: 7 }, 
    { m: "Mar", v: 10 }, 
    { m: "Apr", v: 8 }, 
    { m: "May", v: 12 }, 
    { m: "Jun", v: 9 }
  ];
  const lights = [
    { l: "Cost", col: c.lime, s: "healthy" }, 
    { l: "Schedule", col: c.amber, s: "watch" }, 
    { l: "Procurement", col: c.red, s: "at risk" }, 
    { l: "Approvals", col: c.lime, s: "healthy" }
  ];
  const cards = [
    { l: "Forecast at completion", v: "₹91.4Cr", s: "↑ ₹7.2Cr over budget", col: c.red }, 
    { l: "Budget", v: "₹84.2Cr", s: "approved baseline", col: c.cyan },
    { l: "Actual spend", v: "₹52.1Cr", s: "62% consumed", col: c.violet }, 
    { l: "Remaining planned", v: "₹39.3Cr", s: "to completion", col: c.lime },
    { l: "Schedule variance", v: "-12%", s: "behind plan", col: c.amber }, 
    { l: "Expected completion", v: "Oct 2026", s: "+23 days", col: c.magenta },
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="rise glass" style={{ padding: "20px 24px", display: "flex", gap: 14, justifyContent: "space-between" }}>
        {lights.map((x) => (
          <div key={x.l} style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 14, height: 14, borderRadius: 99, background: x.col, boxShadow: `0 0 16px ${x.col}`, animation: "pulseGlow 2s infinite" }} />
            <div>
              <div className="disp" style={{ fontSize: 14, fontWeight: 600 }}>{x.l}</div>
              <div className="mono" style={{ fontSize: 10, color: c.dim, textTransform: "uppercase" }}>{x.s}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="rise" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {cards.map((x) => (
          <div key={x.l} className="glass statCard" style={{ padding: "18px 20px" }}>
            <div className="mono" style={{ fontSize: 10, color: c.dim, textTransform: "uppercase", letterSpacing: ".5px" }}>{x.l}</div>
            <div className="disp" style={{ fontSize: 26, fontWeight: 700, color: c.text, margin: "8px 0 4px" }}>{x.v}</div>
            <div className="mono" style={{ fontSize: 11, color: x.col }}>{x.s}</div>
          </div>
        ))}
      </div>
      <div className="rise" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div className="glass" style={{ padding: "22px 24px" }}>
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Cost forecast vs budget</span>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={cost} style={{ marginTop: 14 }}>
              <defs>
                <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={c.violet} stopOpacity={.5} />
                  <stop offset="1" stopColor={c.violet} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={c.track} vertical={false} />
              <XAxis dataKey="q" tick={{ fill: c.dim, fontSize: 10, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: c.dim, fontSize: 10, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} width={30} tickFormatter={(v) => "₹" + v} />
              <Tooltip contentStyle={Tip()} />
              <Area type="monotone" dataKey="f" stroke={c.violet} strokeWidth={2.5} fill="url(#fg)" />
              <Line type="monotone" dataKey="b" stroke={c.lime} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="glass" style={{ padding: "22px 24px" }}>
          <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Burn rate</span>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={burn} style={{ marginTop: 14 }}>
              <defs>
                <linearGradient id="bb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={c.magenta} />
                  <stop offset="1" stopColor={c.amber} stopOpacity={.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={c.track} vertical={false} />
              <XAxis dataKey="m" tick={{ fill: c.dim, fontSize: 10, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: c.dim, fontSize: 10, fontFamily: "Space Mono" }} axisLine={false} tickLine={false} width={26} />
              <Tooltip contentStyle={Tip()} cursor={{ fill: c.track }} />
              <Bar dataKey="v" fill="url(#bb)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
