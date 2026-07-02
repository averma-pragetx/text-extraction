import { useNavigate } from "react-router-dom";
import { ArrowRight, FileStack, ScanEye, ShieldCheck, Sun, Moon } from "lucide-react";
import { useC } from "../context/ThemeContext";

export function Home() {
  const c = useC();
  const navigate = useNavigate();

  const points = [
    { icon: FileStack, text: "Ingest invoices, receipts and purchase orders" },
    { icon: ScanEye, text: "Extract fields with spatial-aware OCR + LLM reasoning" },
    { icon: ShieldCheck, text: "Track cost, schedule and vendor health in one place" },
  ];

  return (
    <div
      className="rise"
      style={{
        position: "relative",
        height: "100%",
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 24,
        padding: "40px 20px",
      }}
    >
      <button
        className="gbtn ghost"
        style={{ position: "absolute", top: 0, right: 0, padding: "9px 12px" }}
        onClick={c.toggleTheme}
        title="Toggle theme"
      >
        {c.isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div style={{ width: 64, height: 64, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${c.cyan},${c.violet})`, boxShadow: `0 0 30px ${c.violet}${c.isDark ? "88" : "44"}` }}>
        <span className="disp" style={{ fontWeight: 700, color: "#fff", fontSize: 26 }}>E</span>
      </div>

      <div>
        <div className="disp" style={{ fontWeight: 700, fontSize: 30, letterSpacing: "-.5px" }}>Welcome to EPCFlow</div>
        <div style={{ color: c.muted, fontSize: 14.5, marginTop: 10, maxWidth: 480 }}>
          The document intelligence platform for EPC project finance — extraction, review and reporting in one workspace.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        {points.map((p, i) => {
          const Icon = p.icon;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, color: c.text, fontSize: 13 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: c.cyan + "1c", border: `1px solid ${c.cyan}3a` }}>
                <Icon size={14} color={c.cyan} />
              </div>
              <span>{p.text}</span>
            </div>
          );
        })}
      </div>

      <button
        className="gbtn"
        onClick={() => navigate("/dashboard")}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12, fontWeight: 600, fontSize: 14, marginTop: 12 }}
      >
        Go to Dashboard <ArrowRight size={16} />
      </button>
    </div>
  );
}
