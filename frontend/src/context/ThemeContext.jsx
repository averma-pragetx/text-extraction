import { createContext, useContext, useState } from "react";
import { DARK, LIGHT } from "../constants/themes";

const ThemeCtx = createContext(LIGHT);

export const useC = () => useContext(ThemeCtx);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const theme = isDark ? DARK : LIGHT;

  const toggleTheme = () => setIsDark(!isDark);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <ThemeCtx.Provider value={{ ...theme, isDark, toggleTheme, isCollapsed, toggleCollapse }}>
      {children}
    </ThemeCtx.Provider>
  );
}
