import { useLocation, Link } from "react-router-dom";
import { Sun, Moon, Bell, Upload } from "lucide-react";
import { useC } from "../../context/ThemeContext";
import { TITLES, NAV } from "../../constants/navigation";

export function Header() {
  const c = useC();
  const location = useLocation();

  // Find current title based on path
  const currentNav = NAV.find(n => n.path === location.pathname);
  const title = currentNav ? TITLES[currentNav.id] : "Home";

  return (
    <header style={{ height: 68, display: "flex", alignItems: "center", padding: "0 30px", borderBottom: `1px solid ${c.glassBorder}`, backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 5, background: c.bg + "cc" }}>
      <div>
        <h1 className="disp" style={{ fontSize: 19, fontWeight: 600 }}>{title}</h1>
        {/* <div className="mono" style={{ fontSize: 10.5, color: c.dim, marginTop: 1 }}>PragetX · 2601-APPL · Padra, Gujarat</div> */}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        <button 
          className="gbtn ghost" 
          style={{ padding: "9px 12px" }} 
          onClick={c.toggleTheme} 
          title="Toggle theme"
        >
          {c.isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {/* <button className="gbtn ghost" style={{ padding: "9px 12px" }}>
          <Bell size={16} />
        </button> */}
        <Link to="/documents" className="gbtn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <Upload size={15} style={{ marginRight: 6 }} />
          Upload Doc
        </Link>
      </div>
    </header>
  );
}
