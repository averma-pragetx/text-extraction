import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useC } from "../context/ThemeContext";
import { Chip } from "../components/common/Chip";

export function Audit() {
  const c = useC();
  const log = [
    { ts: "2026-06-15 09:14", type: "document", ev: "Doc processed", evc: c.cyan, actor: "System · OCR", target: "INV-2847.pdf", out: "Success", outc: c.lime, det: "Confidence 97.4% · auto-ingested" },
    { ts: "2026-06-15 09:14", type: "workflow", ev: "Workflow run", evc: c.violet, actor: "Invoice mismatch WF", target: "INV-2847", out: "No mismatch", outc: c.lime, det: "Qty matched PO-1194" },
    { ts: "2026-06-15 08:52", type: "system", ev: "Review queued", evc: c.amber, actor: "System · classifier", target: "DCI-Rev4.pdf", out: "Held", outc: c.amber, det: "Confidence 74.1% below threshold" },
    { ts: "2026-06-15 08:00", type: "workflow", ev: "Workflow run", evc: c.violet, actor: "Overdue delivery WF", target: "Vendor V-22", out: "D5 escalation", outc: c.red, det: "Email to PM · audit logged" },
    { ts: "2026-06-14 17:22", type: "user", ev: "User action", evc: c.magenta, actor: "Rohan Shah", target: "INV-2847 fields", out: "Approved", outc: c.lime, det: "Manual review · PO ref corrected" },
    { ts: "2026-06-14 15:08", type: "system", ev: "SLA breach", evc: c.red, actor: "SLA tracker", target: "MR-0291", out: "Escalated", outc: c.red, det: "72h breached · to Dinesh Mistry" },
    { ts: "2026-06-12 11:30", type: "document", ev: "Doc processed", evc: c.cyan, actor: "System · OCR", target: "INV-2841.pdf", out: "Mismatch", outc: c.red, det: "Delta 55 units · ₹8.2L · alert created" },
  ];
  const filters = [
    ["all", "All events"], 
    ["document", "Document"], 
    ["workflow", "Workflow"], 
    ["user", "User"], 
    ["system", "System"]
  ];
  const [f, setF] = useState("all");
  const shown = log.filter(l => f === "all" || l.type === f);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {filters.map(([k, l]) => (
          <div key={k} className={"fchip" + (f === k ? " on" : "")} onClick={() => setF(k)}>
            {l}
          </div>
        ))}
        <span className="mono" style={{ marginLeft: "auto", fontSize: 10.5, color: c.dim, display: "flex", alignItems: "center", gap: 5 }}>
          <ShieldCheck size={13} />immutable
        </span>
      </div>
      <div className="rise glass" style={{ padding: "18px 22px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              {["Timestamp", "Event", "Actor", "Target", "Outcome", "Details"].map((h) => (
                <th key={h} className="mono" style={{ textAlign: "left", color: c.dim, fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".5px", padding: "0 10px 12px 0", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((l, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${c.glassBorder}` }}>
                <td className="mono" style={{ padding: "12px 10px 12px 0", color: c.dim, fontSize: 11, whiteSpace: "nowrap" }}>{l.ts}</td>
                <td style={{ padding: "12px 10px" }}><Chip color={l.evc}>{l.ev}</Chip></td>
                <td style={{ padding: "12px 10px", color: c.muted }}>{l.actor}</td>
                <td style={{ padding: "12px 10px", color: c.text, fontWeight: 500 }}>{l.target}</td>
                <td style={{ padding: "12px 10px" }}>
                  <span style={{ color: l.outc, fontSize: 11.5, fontWeight: 600 }}>{l.out}</span>
                </td>
                <td className="mono" style={{ padding: "12px 10px", color: c.dim, fontSize: 11 }}>{l.det}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
