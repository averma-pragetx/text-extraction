import { useC } from "../../context/ThemeContext";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Stat({ icon: Icon, label, value, delta, up, color }) {
  const c = useC();
  return (
    <div className="glass statCard" style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: color + "1c", border: `1px solid ${color}3a` }}>
          <Icon size={19} color={color} />
        </div>
        {delta && (
          <span className="mono" style={{ fontSize: 11, color: up ? c.lime : c.red, display: "flex", alignItems: "center", gap: 3 }}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {delta}
          </span>
        )}
      </div>
      <div className="disp" style={{ fontSize: 28, fontWeight: 700, color: c.text, marginTop: 14, lineHeight: 1 }}>{value}</div>
      <div className="mono" style={{ fontSize: 10.5, color: c.muted, marginTop: 6, letterSpacing: ".5px", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
