import { 
  LayoutDashboard, FileStack, ScanEye, TrendingUp, BarChart3, GitBranch, 
  Bell, ClipboardList 
} from "lucide-react";

export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, grp: "Main", path: "/" },
  { id: "documents", label: "Documents", icon: FileStack, grp: "Main", path: "/documents" },
  { id: "review", label: "Review queue", icon: ScanEye, grp: "Main", badge: "4", path: "/review" },
  { id: "forecasting", label: "Forecasting", icon: TrendingUp, grp: "Intelligence", path: "/forecasting" },
  { id: "analytics", label: "Analytics", icon: BarChart3, grp: "Intelligence", path: "/analytics" },
  { id: "workflows", label: "Workflows", icon: GitBranch, grp: "Automation", path: "/workflows" },
  { id: "alerts", label: "Alerts", icon: Bell, grp: "Automation", badge: "7", path: "/alerts" },
  { id: "audit", label: "Audit trail", icon: ClipboardList, grp: "Admin", path: "/audit" },
];

export const TITLES = { 
  dashboard: "Dashboard", 
  documents: "Documents", 
  review: "Review queue", 
  forecasting: "Forecasting", 
  analytics: "Analytics", 
  workflows: "Workflows", 
  alerts: "Alerts", 
  audit: "Audit trail" 
};
