import {
  LayoutDashboard, FileStack, ScanEye, TrendingUp, BarChart3, GitBranch,
  Bell, ClipboardList, FilePlus2
} from "lucide-react";

export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, grp: "Main", path: "/dashboard" },
  { id: "documents", label: "Documents", icon: FileStack, grp: "Main", path: "/documents" },
  { id: "review", label: "Review queue", icon: ScanEye, grp: "Main",  path: "/review" },
  { id: "generate-invoice", label: "Generate Invoice", icon: FilePlus2, grp: "Main", path: "/generate-invoice" },
  { id: "forecasting", label: "Forecasting", icon: TrendingUp, grp: "Intelligence", path: "/forecasting" },
  { id: "analytics", label: "Analytics", icon: BarChart3, grp: "Intelligence", path: "/analytics" },
  { id: "workflows", label: "Workflows", icon: GitBranch, grp: "Automation", path: "/workflows" },
  { id: "alerts", label: "Alerts", icon: Bell, grp: "Automation", path: "/alerts" },
  { id: "audit", label: "Audit trail", icon: ClipboardList, grp: "Admin", path: "/audit" },
];

export const TITLES = {
  dashboard: "Dashboard",
  documents: "Documents",
  review: "Review queue",
  "generate-invoice": "Generate Invoice",
  forecasting: "Forecasting",
  analytics: "Analytics",
  workflows: "Workflows",
  alerts: "Alerts",
  audit: "Audit trail"
};
