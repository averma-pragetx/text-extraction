import { useState } from "react";
import { AlertTriangle, Truck } from "lucide-react";
import { useC } from "../context/ThemeContext";
import { fmt } from "../utils/format";
import { Chip } from "../components/common/Chip";

export function Workflows() {
  const c = useC();
  const [on, setOn] = useState([true, true]);
  const wf = [
    { 
      name: "Invoice mismatch alert", 
      icon: AlertTriangle, 
      col: c.red, 
      desc: "Fires when invoice qty ≠ PO qty. Creates alert, notifies user, flags for review.", 
      trig: "document.processed · mismatch=true", 
      runs: 284, ok: 284, last: "09:14", extra: "12 active", ec: c.amber 
    },
    { 
      name: "Overdue delivery reminder", 
      icon: Truck, 
      col: c.amber, 
      desc: "Daily check on delivery dates. D1 reminder → D3 escalation → D5 critical to PM.", 
      trig: "scheduled · daily 08:00", 
      runs: 1563, ok: 1563, last: "08:00", extra: "3 escalations", ec: c.red 
    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {wf.map((w, i) => {
        const Icon = w.icon;
        return (
          <div key={i} className="rise glass" style={{ padding: "22px 26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: w.col + "1c", border: `1px solid ${w.col}3a` }}>
                <Icon size={22} color={w.col} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="disp" style={{ fontSize: 16, fontWeight: 600 }}>{w.name}</div>
                <div style={{ fontSize: 12.5, color: c.muted, marginTop: 3 }}>{w.desc}</div>
              </div>
              <div onClick={() => setOn((p) => p.map((v, j) => (j === i ? !v : v)))} style={{ width: 46, height: 26, borderRadius: 99, cursor: "pointer", position: "relative", transition: "all .25s", background: on[i] ? `linear-gradient(90deg,${c.cyan},${c.violet})` : c.track, boxShadow: on[i] ? `0 0 16px ${c.violet}88` : "none" }}>
                <div style={{ width: 20, height: 20, borderRadius: 99, background: "#fff", position: "absolute", top: 3, left: on[i] ? 23 : 3, transition: "all .25s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
              </div>
            </div>
            <div className="mono" style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: c.isDark ? "rgba(255,255,255,0.03)" : "#F5F7FC", border: `1px solid ${c.glassBorder}`, fontSize: 11.5, color: c.muted }}>
              <span style={{ color: c.cyan }}>trigger</span> → {w.trig}
            </div>
            <div style={{ display: "flex", gap: 30, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${c.glassBorder}` }}>
              {[["runs", fmt(w.runs), c.text], ["success", fmt(w.ok), c.lime], ["last", w.last, c.text], ["active", w.extra, w.ec]].map(([l, v, col]) => (
                <div key={l}>
                  <div className="disp" style={{ fontSize: 15, fontWeight: 700, color: col }}>{v}</div>
                  <div className="mono" style={{ fontSize: 9.5, color: c.dim, textTransform: "uppercase", letterSpacing: ".5px" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="rise glass" style={{ padding: "20px 24px" }}>
        <span className="disp" style={{ fontWeight: 600, fontSize: 15 }}>Recent runs</span>
        <div style={{ marginTop: 12 }}>
          {[["Success", c.lime, "Invoice mismatch alert", "INV-2847 · mismatch=false", "09:14"], ["Success", c.lime, "Overdue delivery reminder", "Vendor V-22 · D5 escalation → PM", "08:00"], ["Alert", c.red, "Invoice mismatch alert", "INV-2841 · delta ₹8.2L · alert created", "Yesterday"], ["Success", c.lime, "Overdue delivery reminder", "Vendor V-34 · D1 reminder sent", "08:00"]].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${c.glassBorder}` : "none", fontSize: 12.5 }}>
              <Chip color={r[1]}>{r[0]}</Chip>
              <span style={{ color: c.text, flex: "0 0 auto", fontWeight: 500 }}>{r[2]}</span>
              <span className="mono" style={{ color: c.dim, flex: 1, fontSize: 11 }}>{r[3]}</span>
              <span className="mono" style={{ color: c.dim, fontSize: 11 }}>{r[4]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
