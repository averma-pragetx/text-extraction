import { ResponsiveContainer, RadialBarChart, RadialBar } from "recharts";
import { useC } from "../../context/ThemeContext";

export function HealthRing({ label, value, color }) {
  const c = useC();
  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      <ResponsiveContainer width="100%" height={108}>
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ v: value, fill: color }]} startAngle={90} endAngle={90 - (value / 100) * 360}>
          <RadialBar background={{ fill: c.track }} dataKey="v" cornerRadius={20} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", top: "38%", left: 0, right: 0, transform: "translateY(-50%)" }}>
        <div className="disp" style={{ fontSize: 22, fontWeight: 700, color }}>{value}<span style={{ fontSize: 12, color: c.muted }}>%</span></div>
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: c.muted, letterSpacing: ".5px", marginTop: 2, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
