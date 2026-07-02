import { Routes, Route, useLocation } from "react-router-dom";
import { useC } from "./context/ThemeContext";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { Documents } from "./pages/Documents";
import { Review } from "./pages/Review";
import { GenerateInvoice } from "./pages/GenerateInvoice";
import { Forecasting } from "./pages/Forecasting";
import { Analytics } from "./pages/Analytics";
import { Workflows } from "./pages/Workflows";
import { Alerts } from "./pages/Alerts";
import { Audit } from "./pages/Audit";
import { getGlobalStyles } from "./styles/GlobalStyles";

export default function App() {
  const c = useC();
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div
      style={{
        fontFamily: "'Space Grotesk',system-ui,sans-serif",
        color: c.text,
        minHeight: "100vh",
        display: "flex",
        background: c.isDark
          ? `radial-gradient(1200px 600px at 80% -10%, ${c.violet}1a, transparent), radial-gradient(900px 500px at -10% 110%, ${c.cyan}14, transparent), ${c.bg}`
          : `radial-gradient(1100px 560px at 82% -12%, ${c.violet}12, transparent), radial-gradient(820px 460px at -8% 112%, ${c.cyan}10, transparent), ${c.bg}`
      }}
    >
      <style>{getGlobalStyles(c)}</style>

      {!isHome && <Sidebar />}

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {!isHome && <Header />}
        <div style={{ flex: 1, overflowY: "auto", padding: "26px 30px" }} key={location.pathname + c.isDark}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/review" element={<Review />} />
            <Route path="/generate-invoice" element={<GenerateInvoice />} />
            <Route path="/forecasting" element={<Forecasting />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/audit" element={<Audit />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
