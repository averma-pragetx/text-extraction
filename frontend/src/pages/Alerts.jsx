import { useState } from "react";
import { AlertCircle, Truck, Clock, FileText, AlertTriangle, BarChart3 } from "lucide-react";
import { useC } from "../context/ThemeContext";
import { Chip } from "../components/common/Chip";

export function Alerts() {
  const c = useC();
  const all = [
    { sev: "critical", type: "mismatch", icon: AlertCircle, title: "Invoice qty mismatch — INV-2841", tag: "₹8.2L delta", desc: "PO-1185 expects 320 units. Invoice shows 265. L&T Construction. Assigned: Priya Mehta.", meta: "Invoice mismatch · 5 days ago · email sent" },
    { sev: "critical", type: "delivery", icon: Truck, title: "Delivery critical — Vendor V-22", tag: "Day 5", desc: "Piping package P-14 delivery 5 days overdue. Critical path impact: 8 days. PM notified.", meta: "Overdue delivery · D5 escalation" },
    { sev: "critical", type: "sla", icon: Clock, title: "SLA breach — MR-0291 pending 72h", tag: null, desc: "Material requisition ₹44.2L pending approval 3+ days. Escalated to Dinesh Mistry.", meta: "SLA tracker · escalated · audit logged" },
    { sev: "warning", type: "mismatch", icon: FileText, title: "Invoice mismatch — INV-2836", tag: null, desc: "PO-1179 quantity variance 8%. Within tolerance, flagged for record. Siemens India.", meta: "Invoice mismatch · 1 week ago" },
    { sev: "warning", type: "delivery", icon: Truck, title: "Delivery reminder — Vendor V-34", tag: "Day 1", desc: "Electrical cable package E-07 due today. Reminder sent to vendor contact.", meta: "Overdue delivery · today 08:00" },
    { sev: "warning", type: "sla", icon: AlertTriangle, title: "NCR-0047 unresolved — 8 days", tag: null, desc: "Civil non-conformance awaiting contractor sign-off. Work-stoppage risk.", meta: "Quality tracker · flagged" },
    { sev: "warning", type: "sla", icon: BarChart3, title: "Invoice backlog — 38 invoices 45+ days", tag: null, desc: "Payment delays across 6 vendors. Supply disruption risk if not cleared.", meta: "Finance · AP aging report" },
  ];
  const filters = [
    ["all", "All", all.length], 
    ["critical", "Critical", all.filter(a => a.sev === "critical").length], 
    ["warning", "Warning", all.filter(a => a.sev === "warning").length], 
    ["mismatch", "Mismatch", null], 
    ["delivery", "Delivery", null], 
    ["sla", "SLA", null]
  ];
  const [f, setF] = useState("all");
  const shown = all.filter(a => f === "all" || a.sev === f || a.type === f);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {filters.map(([k, l, n]) => (
          <div key={k} className={"fchip" + (f === k ? " on" : "")} onClick={() => setF(k)}>
            {l}{n != null ? ` (${n})` : ""}
          </div>
        ))}
      </div>
      {shown.map((a, i) => {
        const Icon = a.icon; const col = a.sev === "critical" ? c.red : c.amber;
        return (
          <div key={i} className="rise glass" style={{ padding: "16px 20px", display: "flex", gap: 14, alignItems: "flex-start", borderColor: col + "44", background: c.isDark ? col + "0e" : col + "0c" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: col + "1f", border: `1px solid ${col}3a` }}>
              <Icon size={17} color={col} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="disp" style={{ fontSize: 13.5, fontWeight: 600 }}>{a.title}</span>
                {a.tag && <Chip color={col}>{a.tag}</Chip>}
              </div>
              <div style={{ fontSize: 12.5, color: c.muted, marginTop: 4 }}>{a.desc}</div>
              <div className="mono" style={{ fontSize: 10.5, color: c.dim, marginTop: 5 }}>{a.meta}</div>
            </div>
            <button className="gbtn ghost" style={{ padding: "7px 12px", fontSize: 11.5 }}>View →</button>
          </div>
        );
      })}
    </div>
  );
}
