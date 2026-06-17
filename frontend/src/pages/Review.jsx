import { useState } from "react";
import { Check, X, Pencil, CircleCheck, Eye } from "lucide-react";
import { useC } from "../context/ThemeContext";
import { Chip } from "../components/common/Chip";

export function Review() {
  const c = useC();
  const init = [
    { f: "DCI-Rev4.pdf", meta: "DCI · 12 pages · PragetX · today 08:52", cf: 74, flags: [["Discipline code ambiguous", c.amber], ["3 fields below 70%", c.amber]], fields: [["Discipline", "PE / PP?"], ["Doc number", "2601-PE-001"]] },
    { f: "INV-2839.pdf", meta: "Invoice · 2 pages · unknown vendor · yesterday", cf: 61, flags: [["Vendor not in master", c.red], ["PO reference missing", c.red], ["Amount format unusual", c.amber]], fields: [["Vendor", ""], ["PO reference", ""]] },
    { f: "NCR-0046.pdf", meta: "NCR · scanned · Site QC · 3 days ago", cf: 77, flags: [["Scanned — OCR uncertainty", c.amber], ["Signature unclear", c.amber]], fields: [["Raised by", "QC team"], ["Severity", "Medium"]] },
    { f: "MR-0288.pdf", meta: "MR · 7 pages · Procurement · 5 days ago", cf: 69, flags: [["Value exceeds ₹50L threshold", c.red], ["Line items partial", c.amber]], fields: [["Total value", "₹54,20,000"], ["Items", "12 / 15"]] },
  ];
  const [items, setItems] = useState(init);
  const [open, setOpen] = useState(null);
  const ringColor = (v) => (v >= 75 ? c.amber : c.red);
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="mono" style={{ fontSize: 12, color: c.muted }}>{items.length} documents below 80% confidence awaiting review</div>
      {items.map((it, i) => (
        <div key={it.f} className="rise glass" style={{ padding: "18px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 50, height: 50, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `3px solid ${ringColor(it.cf)}`, color: ringColor(it.cf), boxShadow: c.isDark ? `0 0 16px ${ringColor(it.cf)}66` : "none" }} className="mono">
              <span style={{ fontSize: 13, fontWeight: 700 }}>{it.cf}%</span>
            </div>
            <div style={{ flex: 1 }}>
              <div className="disp" style={{ fontSize: 15, fontWeight: 600 }}>{it.f}</div>
              <div className="mono" style={{ fontSize: 11, color: c.dim, marginTop: 2 }}>{it.meta}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {it.flags.map(([t, col], j) => <Chip key={j} color={col}>{t}</Chip>)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="gbtn ghost" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => openModal(it)}><Eye size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Preview Document</button>
              <button className="gbtn ghost" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => setOpen(open === i ? null : i)}>
                {open === i ? <X size={14} /> : <Pencil size={14} />}
                <span style={{ marginLeft: 6 }}>{open === i ? "Close" : "Review"}</span>
              </button>
              <button className="gbtn" style={{ padding: "8px 14px", fontSize: 12 }} onClick={() => setItems(items.filter((_, k) => k !== i))}>
                <Check size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Approve
              </button>
            </div>
          </div>
          {open === i && (
            <div className="rise" style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${c.glassBorder}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {it.fields.map(([l, v], j) => (
                <div key={j}>
                  <div className="mono" style={{ fontSize: 9.5, color: c.dim, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>{l}</div>
                  <input className="efield" defaultValue={v} placeholder="enter value" />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && (
        <div className="glass" style={{ padding: 48, textAlign: "center" }}>
          <CircleCheck size={32} color={c.lime} style={{ marginBottom: 10 }} />
          <div className="disp" style={{ fontWeight: 600 }}>Queue clear</div>
          <div className="mono" style={{ fontSize: 11, color: c.dim, marginTop: 4 }}>all documents reviewed</div>
        </div>
      )}
    </div>
  );
}
