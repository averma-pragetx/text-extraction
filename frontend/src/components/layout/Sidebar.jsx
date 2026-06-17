import { NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useC } from "../../context/ThemeContext";
import { NAV } from "../../constants/navigation";

export function Sidebar() {
  const c = useC();
  const groups = [...new Set(NAV.map((n) => n.grp))];
  const isC = c.isCollapsed;

  return (
    <aside 
      style={{ 
        width: isC ? 78 : 232, 
        flexShrink: 0, 
        padding: isC ? "22px 10px" : "22px 16px", 
        borderRight: `1px solid ${c.glassBorder}`, 
        display: "flex", 
        flexDirection: "column", 
        position: "sticky", 
        top: 0, 
        height: "100vh",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s ease"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: isC ? "center" : "space-between", gap: 12, padding: isC ? "0 0 22px" : "0 8px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${c.cyan},${c.violet})`, boxShadow: `0 0 22px ${c.violet}${c.isDark ? "88" : "44"}`, flexShrink: 0 }}>
            <span className="disp" style={{ fontWeight: 700, color: "#fff", fontSize: 17 }}>E</span>
          </div>
          {!isC && (
            <div className="rise">
              <div className="disp" style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-.3px" }}>EPCFlow</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {groups.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            {!isC && <div className="mono rise" style={{ fontSize: 9, color: c.dim, letterSpacing: "1.2px", padding: "0 10px 6px", textTransform: "uppercase" }}>{g}</div>}
            {NAV.filter((n) => n.grp === g).map((n) => {
              const Icon = n.icon;
              return (
                <NavLink 
                  key={n.id} 
                  to={n.path}
                  title={isC ? n.label : ""}
                  className={({ isActive }) => "navItem" + (isActive ? " active" : "")}
                  style={{ justifyContent: isC ? "center" : "flex-start", padding: isC ? "11px 0" : "11px 14px" }}
                >
                  <Icon size={17} style={{ flexShrink: 0 }} />
                  {!isC && <span className="rise" style={{ whiteSpace: "nowrap" }}>{n.label}</span>}
                  {!isC && n.badge && (
                    <span className="mono rise" style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 8, background: c.red + "26", color: c.red }}>
                      {n.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button 
          onClick={c.toggleCollapse}
          className="gbtn ghost"
          style={{ 
            width: "100%", 
            padding: "8px 0", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            borderRadius: 10
          }}
          title={isC ? "Expand" : "Collapse"}
        >
          {isC ? <ChevronRight size={16} /> : <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ChevronLeft size={16} /> <span style={{ fontSize: 12 }}>Collapse</span></div>}
        </button>

        <div className="glass" style={{ padding: isC ? "8px" : "11px 12px", display: "flex", alignItems: "center", justifyContent: isC ? "center" : "flex-start", gap: 10 }}>
          <div className="disp" style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${c.magenta},${c.amber})`, fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>PX</div>
          {!isC && (
            <div className="rise">
              <div style={{ fontSize: 12, fontWeight: 600 }}>PragetX</div>
              <div className="mono" style={{ fontSize: 9.5, color: c.dim }}>standard plan</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
